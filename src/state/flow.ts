/**
 * FLOW — la couche de LOGIQUE authorée du jeu : conditions → effets → branches, façon liste de
 * blocs imbriqués (RPG Maker / ink), pas de graphe à fils. UNE structure récursive, sérialisation
 * STABLE (c'est le contrat édité dans l'éditeur ET sauvegardé dans les scènes/sorts). Elle subsume,
 * à terme, `Effect[]` (la séquence), les branches `test`/dialogue, et les conditions de trigger —
 * source UNIQUE de la logique de contenu (triggers, dialogues, interactions, pièges, sorts custom).
 *
 * Discipline (briques stables, pas de DSL ouvert) :
 *  - ENSEMBLE CLOS de Conditions et de nœuds — la puissance vient de la COMPOSITION, pas de la
 *    croissance de l'ensemble. Ajouter un nœud « juste pour un sort » = échec.
 *  - PAS de boucle (arbre, jamais cyclique) : ni `while`, ni saut arrière → contenu raisonnable,
 *    pas de risque de boucle infinie.
 *  - Les Conditions sont PURES (lisent l'état, ne le mutent pas) ; les effets sont les feuilles `do`.
 *
 * Ce module porte le MODÈLE + l'évaluation PURE des Conditions (remplace `condMet` +
 * `temporalConditionMet`). L'EXÉCUTION interactive (ouvrir une modale de Test, suspendre, reprendre)
 * vit dans le store (`runFlow`, brique suivante) — comme `applyEffects` aujourd'hui.
 */
import type { Effect, TemporalCondition } from './scene';
import { toDate } from '../engine/clock';
import type { CharKey, Difficulty, HitLocation } from '../engine/types';
import type { Camp, Relation } from '../engine/relations';
import { groupMatch } from '../engine/groups';

/** Algèbre CLOSE de Conditions (sérialisation-stable). `flag`/`time` reprennent la sémantique des
 *  anciens `condMet`/`temporalConditionMet` ; `all`/`any` composent ; `not` nie. Aucune condition
 *  qui MUTE l'état — purement interrogative. */
/** Bourse (sous-ensemble de `Money`) — comparée en sous de bronze (1 CO = 240 sb, 1 pa = 12 sb). */
export interface Purse { gold?: number; silver?: number; brass?: number }
const brassValue = (m: Purse): number => (m.gold ?? 0) * 240 + (m.silver ?? 0) * 12 + (m.brass ?? 0);

/** Applique un opérateur de comparaison — SOURCE UNIQUE pour les Conditions `compare` et `woundsDealt`. */
const applyCompareOp = (a: number, op: CompareOp, b: number): boolean =>
  op === '>=' ? a >= b : op === '<=' ? a <= b : op === '==' ? a === b : op === '<' ? a < b : a > b;

/** Acteur d'un Flow visé par une comparaison : la CIBLE (l'unité affectée) ou le LANCEUR/porteur. */
export type ActorRef = 'target' | 'caster';
/** Donnée numérique fixe d'un acteur (`size` = ordinal de Taille SIZE_ORDER ; `advantage` = Avantage). */
export type ActorField = 'woundsCurrent' | 'woundsMax' | 'size' | 'advantage';
/** SUJET d'une comparaison `compare` : `who` (cible/lanceur) × (une donnée fixe OU la valeur/stacks d'un
 *  État nommé — 0 si absent → « la cible a l'État X » ⇔ `{who:'target', condition:X} >= 1`). */
export type CompareSubject = { who: ActorRef; field: ActorField } | { who: ActorRef; condition: string };
/** Opérateur de comparaison (Condition `compare`). */
export type CompareOp = '>=' | '<=' | '==' | '<' | '>';
/** Vue d'un acteur lue par les Conditions d'acteur (`compare`/`relation`/`has`) : id + PB + Taille/
 *  Avantage + camp + appartenances (Groupes/Talents/Traits) + valeur d'États par nom. */
export interface ActorView {
  id: string; woundsCurrent: number; woundsMax: number; size: number; advantage: number; camp: Camp;
  groups: string[]; talents: { id: string; spec?: string }[]; traits: string[];
  conditions: Record<string, number>;
}

export type Condition =
  | { kind: 'always' }
  /** ET de drapeaux avec négation : « v1,!v2 » ⇔ flags.v1 && !flags.v2 (sémantique `condMet`). */
  | { kind: 'flag'; expr: string }
  /** Fenêtre horaire (heure-du-jour, `before` exclusif) — sémantique `temporalConditionMet`. */
  | { kind: 'time'; window: TemporalCondition }
  /** Le GROUPE possède au moins `count` (défaut 1) exemplaire(s) de l'objet d'`id` `trappingId` (réf de
   *  catalogue stable). Repli sur le NOM pour les objets CUSTOM (hors-base, sans `trappingId`). */
  | { kind: 'hasItem'; trappingId: string; count?: number }
  /** La bourse du groupe vaut AU MOINS le seuil `atLeast` (comparaison en sous de bronze). */
  | { kind: 'money'; atLeast: Purse }
  /** État vital du groupe : `any` = au moins un héros mort, `all` = tous morts. */
  | { kind: 'partyDead'; who: 'any' | 'all' }
  /** COMPARAISON sur un ACTEUR du Flow (cible OU lanceur) — UNIQUE Condition « données d'acteur » :
   *  `subject` (`who` × donnée fixe OU valeur d'un État) · `op` (≥ ≤ = < >) · `value`. `value` est une
   *  CONSTANTE ou le champ d'un AUTRE acteur (« cible plus petite que l'attaquant » ⇔
   *  `{who:'target',field:'size'} '<' {who:'caster',field:'size'}`). Régénération « PB > 0 » ⇔
   *  `{who:'target',field:'woundsCurrent'} >= 1`. Acteur absent → false. */
  | { kind: 'compare'; subject: CompareSubject; op: CompareOp; value: number | { who: ActorRef; field: ActorField } }
  /** Seuil de MARGE / DR du contexte (`ctx.sl`) : vrai si `sl ≥ atLeast`. Permet d'authorer les issues
   *  échelonnées d'une manœuvre (Regard pétrifiant : « si la marge atteint 6 DR → Pétrifié », LDB 85
   *  l.238) en GameOp Flow — `if slThreshold(6) → … else if slThreshold(2) → …`. Hors contexte = 0. */
  | { kind: 'slThreshold'; op: CompareOp; value: number }
  /** Localisation touchée par l'attaque courante (`ctx.location`, dé inversé) — Assommante : « si vous
   *  touchez la Tête… ». Hors contexte d'attaque (location absente) = jamais vrai. */
  | { kind: 'location'; is: HitLocation }
  /** KIND de l'attaque courante (`ctx.attackKind` : 'morsure'/'cornes'/'caudale'/… cf. `creatureAttackKind`)
   *  — gate « seulement quand l'attaque est une Morsure » (Vampirique). Hors contexte = jamais vrai. */
  | { kind: 'attackKind'; is: string }
  /** Blessures infligées par l'attaque/lancement courant (`ctx.woundsDealt`), comparées par `op` à
   *  `value` (Venin : `> 0` → Empoisonné ; un rider « coup lourd » : `>= 3`). Hors contexte = 0. */
  | { kind: 'woundsDealt'; op: CompareOp; value: number }
  /** Camp / RELATION d'un acteur (`who`) — gate « seulement les ennemis / les alliés / les neutres »
   *  (riders de domaine offensifs : `who:'target', is:'opponent'`). `ally`/`opponent` sont RELATIFS à
   *  l'autre acteur (même camp / camp différent) ; `party`/`neutral`/`hostile` sont ABSOLUS (le `kind`).
   *  Acteur(s) absent(s) = false. */
  | { kind: 'relation'; who: ActorRef; is: Relation | Camp }
  /** L'acteur (`who`) POSSÈDE un élément : appartenance à un **Groupe** (faction, via `groupMatch`),
   *  un **Talent** (par id, `spec` éventuel — « Magie des Arcanes (Feu) »), ou un **Trait** (par id).
   *  Généralise les gates op-level `onlyGroups`/`unlessImmune`. Acteur absent = false. */
  | { kind: 'has'; who: ActorRef; what: 'group' | 'talent' | 'trait'; value: string; spec?: string }
  | { kind: 'all'; of: Condition[] }
  | { kind: 'any'; of: Condition[] }
  | { kind: 'not'; of: Condition };

/** Contexte d'évaluation d'une Condition (lecture seule) — ensemble CLOS : drapeaux, horloge, et état
 *  VIVANT du groupe (mort/inventaire/bourse). `party`/`money` absents → les conditions d'état sont false. */
export interface ConditionCtx {
  flags: Record<string, boolean>;
  gameTime: number;
  party?: { dead?: boolean; items?: { name: string; trappingId?: string }[] }[];
  money?: Purse;
  /** Acteurs du Flow lus par la Condition `compare` (`conditions` = stacks par nom d'État, 0 si absent).
   *  `target` = l'unité affectée (la « cible » du sous-Flow) ; `caster` = le lanceur/porteur. */
  target?: ActorView;
  caster?: ActorView;
  /** Marge / DR du contexte (jet d'incantation, opposition de manœuvre) — lu par `slThreshold`. */
  sl?: number;
  /** Localisation de la touche courante (dé inversé) — lue par la Condition `location`. */
  location?: HitLocation;
  /** Blessures infligées par l'attaque courante — lue par la Condition `woundsDealt`. */
  woundsDealt?: number;
  /** KIND de l'attaque courante (`creatureAttackKind` : 'morsure'/'cornes'/…) — lu par la Condition `attackKind`. */
  attackKind?: string;
}

/** Évalue une Condition — SOURCE UNIQUE de l'évaluation des conditions (triggers, choix de dialogue,
 *  nœuds `if`). PURE. `flag` : ET de drapeaux avec négation (« v1,!v2 », tolère les espaces) ; `time` :
 *  fenêtre horaire (heure-du-jour, `before` EXCLUSIF). */
export function evalCondition(cond: Condition, ctx: ConditionCtx): boolean {
  switch (cond.kind) {
    case 'always': return true;
    case 'flag':
      return cond.expr.split(',').map((c) => c.trim()).filter(Boolean)
        .every((c) => (c.startsWith('!') ? !ctx.flags[c.slice(1)] : !!ctx.flags[c]));
    case 'time': {
      const d = toDate(ctx.gameTime);
      const now = d.hour * 60 + d.minute;
      const w = cond.window;
      if (w.afterHour != null && now < w.afterHour * 60 + (w.afterMinute ?? 0)) return false;
      if (w.beforeHour != null && now >= w.beforeHour * 60 + (w.beforeMinute ?? 0)) return false;
      return true;
    }
    case 'hasItem': {
      const need = Math.max(1, cond.count ?? 1);
      // Objet catalogué → match par `trappingId` stable ; objet CUSTOM (sans trappingId) → repli sur le nom.
      const have = (ctx.party ?? []).reduce((n, h) => n + (h.items ?? []).filter((it) => (it.trappingId ?? it.name) === cond.trappingId).length, 0);
      return have >= need;
    }
    case 'money': return ctx.money ? brassValue(ctx.money) >= brassValue(cond.atLeast) : false;
    case 'partyDead': {
      const party = ctx.party ?? [];
      return party.length > 0 && (cond.who === 'all' ? party.every((h) => h.dead) : party.some((h) => h.dead));
    }
    case 'compare': {
      // Lecture d'un côté de la comparaison : valeur d'un État (par nom) ou champ fixe d'un acteur.
      const read = (who: ActorRef, sel: { field: ActorField } | { condition: string }): number | undefined => {
        const a = who === 'caster' ? ctx.caster : ctx.target;
        if (!a) return undefined;
        return 'condition' in sel ? (a.conditions[sel.condition] ?? 0) : a[sel.field];
      };
      const s = cond.subject;
      const lhs = read(s.who, s);
      const rhs = typeof cond.value === 'number' ? cond.value : read(cond.value.who, { field: cond.value.field });
      if (lhs == null || rhs == null) return false; // acteur absent → false
      return applyCompareOp(lhs, cond.op, rhs);
    }
    case 'slThreshold': return applyCompareOp(ctx.sl ?? 0, cond.op, cond.value);
    case 'location': return ctx.location != null && ctx.location === cond.is;
    case 'attackKind': return ctx.attackKind != null && ctx.attackKind === cond.is;
    case 'woundsDealt': return applyCompareOp(ctx.woundsDealt ?? 0, cond.op, cond.value);
    case 'relation': {
      const a = cond.who === 'caster' ? ctx.caster : ctx.target;
      if (!a) return false;
      if (cond.is === 'party' || cond.is === 'neutral' || cond.is === 'hostile') return a.camp === cond.is; // camp ABSOLU
      const other = cond.who === 'caster' ? ctx.target : ctx.caster; // RELATIF à l'autre acteur
      if (!other) return false;
      if (cond.is === 'self') return a.id === other.id;
      if (cond.is === 'ally') return a.camp === other.camp && a.id !== other.id; // même camp, pas soi-même
      return a.camp !== other.camp; // 'opponent'
    }
    case 'has': {
      const a = cond.who === 'caster' ? ctx.caster : ctx.target;
      if (!a) return false;
      if (cond.what === 'group') return groupMatch(cond.value, a.groups);
      if (cond.what === 'talent') return a.talents.some((t) => t.id === cond.value && (!cond.spec || t.spec === cond.spec));
      return a.traits.includes(cond.value);
    }
    case 'all': return cond.of.every((c) => evalCondition(c, ctx));
    case 'any': return cond.of.some((c) => evalCondition(c, ctx));
    case 'not': return !evalCondition(cond.of, ctx);
  }
}

/** Construit le contexte d'évaluation depuis l'état de jeu (drapeaux/horloge/groupe/bourse) — source
 *  UNIQUE pour que tous les sites (triggers, `if`, choix de dialogue) lisent le MÊME état. */
export function conditionCtx(s: { flags: Record<string, boolean>; gameTime: number; party?: ConditionCtx['party']; money?: Purse }): ConditionCtx {
  return { flags: s.flags, gameTime: s.gameTime, party: s.party, money: s.money };
}

/** Spécification d'un jet de compétence/caractéristique différé (→ modale) — TOUT le métier du Test,
 *  SANS les branches (portées par le nœud Flow `test`). Source UNIQUE : `Effect` 'test' est normalisé
 *  vers cette forme à l'exécution (un seul ouvreur de modale `openSkillTest`). */
export interface FlowTest {
  skill?: string;
  characteristic?: CharKey;
  difficulty?: Difficulty;
  /** DR minimum requis (défaut 0 = simple réussite). */
  requireSL?: number;
  label?: string;
  /** Outil utilisé : sa qualité d'artisanat module l'issue / casse l'objet. */
  tool?: string;
  /** Groupes de l'interlocuteur : malus Animosité/Préjugé sur un Test de Sociabilité (LDB 21). */
  vsGroups?: string[];
  /** Statut de la cible (« Argent 3 ») : mod social d'Échelon/Standing sur un Test social (LDB 08). */
  vsStatus?: string;
  /** Le Test social est une mendicité (option « Mendicité et Statut », LDB 08 l.92). */
  begging?: boolean;
  /** Difficulté réduite si un héros possède la compétence/le talent requis. */
  easierIf?: { hasSkill?: { id: string; spec?: string }; hasTalent?: string; steps?: number };
}

/**
 * Un nœud de Flow. Quatre formes, RÉCURSIVES, jamais cycliques :
 *  - `seq`  : exécute `steps` dans l'ordre (l'ancien `Effect[]`) ;
 *  - `do`   : une feuille — applique un `Effect` (action) ;
 *  - `if`   : évalue `cond` (PUR) → `then` / `else` ;
 *  - `test` : jet interactif → `success` / `fail` (l'ancien `Effect.test`, sorti d'`Effect`).
 */
export type Flow =
  | { kind: 'seq'; steps: Flow[] }
  | { kind: 'do'; effect: Effect }
  | { kind: 'if'; cond: Condition; then: Flow; else?: Flow }
  | { kind: 'test'; test: FlowTest; success: Flow; fail: Flow };

/** Flow vide (séquence sans étape) — neutre, sûr comme valeur par défaut d'un consommateur. */
export const EMPTY_FLOW: Flow = { kind: 'seq', steps: [] };

/** DÉCLENCHEUR d'un effet « sur événement » — le pendant du « au lancement » des sorts. Partagé par
 *  TOUT porteur d'effets déclenchés (Trait de créature, Atout d'arme…). `onHit` : après une touche
 *  réussie (du porteur ou de l'arme) ; `onWoundLoss` : quand le porteur PERD des PB ; `onRoundStart` :
 *  au début de son Round ; `onStartled` : magie / bruit fort ; `onKill` : adversaire mis hors de combat. */
export type EffectTrigger = 'onHit' | 'onWoundLoss' | 'onRoundStart' | 'onStartled' | 'onKill' | 'onCharged';

/** Effet DÉCLENCHÉ authoré (donnée éditable) : un Flow d'ops appliqué à `on` quand `trigger` se produit.
 *  GÉNÉRIQUE — porté indifféremment par `TraitData.effects` (Toile, Sang corrosif…) ET `QualityData.effects`
 *  (Atout d'arme : « à la touche, 1d10 + Empêtré »). Même vocabulaire que les sorts (réutilise
 *  `runSpellFlow`/`applyOps`) → plus de handler en dur. `on` : le porteur lui-même (`self`), la victime
 *  touchée (`victim`), ou les adversaires Engagés du porteur (`engaged`). */
/** CIBLE(S) d'un effet déclenché : le porteur (`self`), la victime touchée (`victim`), les adversaires
 *  Engagés (`engaged`), ou — géométrie — TOUS les combattants à `radiusMeters` d'un centre (l'arc d'Azyr :
 *  `{ near: 'victim', radiusMeters: 2 }`). Le centre lui-même et le porteur sont exclus. */
export type EffectTargeting = 'self' | 'victim' | 'engaged' | { near: 'victim' | 'self'; radiusMeters: number };
export interface TriggeredEffect {
  trigger: EffectTrigger;
  on: EffectTargeting;
  flow: Flow;
}

/** Enveloppe une liste d'`Effect` (ancien format) en un Flow `seq` de `do` — pont de migration des
 *  consommateurs (`Trigger.effects`, `DialogueChoice.effects`) vers le Flow, sans réécrire la donnée. */
export function flowFromEffects(effects: Effect[] | undefined): Flow {
  return { kind: 'seq', steps: (effects ?? []).map((effect) => ({ kind: 'do', effect })) };
}

/**
 * Aplatit un Flow SANS Test ni If non résolu en une liste d'`Effect` (les `if` sont évalués contre
 * `ctx`). Couvre `seq`/`do`/`if`. Un nœud `test` lève — son exécution est interactive (store). Utile
 * pour les consommateurs purement séquentiels et pour tester la résolution des branches `if`. */
export function flattenFlow(flow: Flow, ctx: ConditionCtx): Effect[] {
  switch (flow.kind) {
    case 'do': return [flow.effect];
    case 'seq': return flow.steps.flatMap((s) => flattenFlow(s, ctx));
    case 'if': {
      const branch = evalCondition(flow.cond, ctx) ? flow.then : flow.else;
      return branch ? flattenFlow(branch, ctx) : [];
    }
    case 'test':
      throw new Error('flattenFlow: un nœud `test` est interactif — utiliser runFlow (store).');
  }
}

/** Effets `do` de PREMIER niveau d'un Flow (seq plat) — édition en liste + assertions (≡ ancien `effects`). */
export function flowEffects(flow: Flow): Effect[] {
  return flow.kind === 'do' ? [flow.effect] : flow.kind === 'seq' ? flow.steps.flatMap((s) => (s.kind === 'do' ? [s.effect] : [])) : [];
}

/** GameOps des feuilles EffectOp d'un Flow de sort, filtrées par cible (`target`/`caster`). SOURCE
 *  UNIQUE de l'extraction des effets d'un sort depuis `SpellData.effects` : le cast flow applique un
 *  sous-Flow (target vs caster) via `runSpellFlow`, mais les badges UI (`spellSupport`) ont besoin de
 *  la liste d'ops. Visite récursive (les feuilles peuvent vivre sous if/test). `on` absent ⇒ `target`. */
export function spellOps(flow: Flow | undefined, on: 'target' | 'caster'): import('../engine/ops').GameOp[] {
  if (!flow) return [];
  const out: import('../engine/ops').GameOp[] = [];
  walkFlow(flow, (n) => {
    if (n.kind === 'do' && n.effect.type === 'ops' && (n.effect.on ?? 'target') === on) out.push(...n.effect.ops);
  });
  return out;
}

/** TOUTES les ops EffectOp d'un Flow de sort (target + caster) — pour qualifier la mécanisation d'un
 *  sort (`spellSupport`) sans privilégier une cible : un effet de lanceur (invocation, zone, vol de
 *  vie) compte autant qu'un effet de cible. */
export function spellEffectOps(flow: Flow | undefined): import('../engine/ops').GameOp[] {
  return [...spellOps(flow, 'target'), ...spellOps(flow, 'caster')];
}

/** Sous-Flow d'un Flow de sort ne gardant que les nœuds adressant `on` (target/caster) — pour appliquer
 *  SÉPARÉMENT les effets de cible (par cible, missile/soutien) et ceux du lanceur (une fois). Préserve
 *  l'imbrication if/test : un nœud de structure est conservé si l'une de ses branches porte un effet
 *  `on`. Un `do` ops d'un AUTRE `on` devient un `seq` vide (neutre). `do` non-ops conservés sous `target`. */
export function spellFlowFor(flow: Flow | undefined, on: 'target' | 'caster'): Flow {
  if (!flow) return EMPTY_FLOW;
  const keep = (f: Flow): Flow => {
    switch (f.kind) {
      case 'do':
        if (f.effect.type === 'ops') return (f.effect.on ?? 'target') === on ? f : EMPTY_FLOW;
        return on === 'target' ? f : EMPTY_FLOW; // effets non-ops (narration…) rattachés à la cible
      case 'seq': return { kind: 'seq', steps: f.steps.map(keep) };
      case 'if': return { kind: 'if', cond: f.cond, then: keep(f.then), ...(f.else ? { else: keep(f.else) } : {}) };
      case 'test': return { kind: 'test', test: f.test, success: keep(f.success), fail: keep(f.fail) };
    }
  };
  return keep(flow);
}

/** Visite toutes les fenêtres horaires d'une Condition (validation des bornes h/min). */
export function walkConditionTimes(cond: Condition, cb: (w: TemporalCondition) => void): void {
  switch (cond.kind) {
    case 'time': cb(cond.window); break;
    case 'all': case 'any': cond.of.forEach((c) => walkConditionTimes(c, cb)); break;
    case 'not': walkConditionTimes(cond.of, cb); break;
  }
}

/** Le Flow contient-il un nœud `test` (→ exécution interactive nécessaire, pas un simple aplatissage) ? */
export function flowHasTest(flow: Flow): boolean {
  switch (flow.kind) {
    case 'do': return false;
    case 'seq': return flow.steps.some(flowHasTest);
    case 'if': return flowHasTest(flow.then) || (flow.else ? flowHasTest(flow.else) : false);
    case 'test': return true;
  }
}

/** Constructeur d'un nœud `test` (jet → réussite/échec). Sucre pour les PRODUCTEURS de Flow (récolte,
 *  saut…) : remplace l'ancien `Effect.test` qu'on poussait dans une liste d'effets. */
export function testFlow(test: FlowTest, success: Flow, fail: Flow): Flow {
  return { kind: 'test', test, success, fail };
}

/** Visite RÉCURSIVE de tous les nœuds d'un Flow (branches `if`/`test` comprises) — pour la validation
 *  (effets référencés, bornes des conditions horaires) sur l'arbre ENTIER, pas seulement le 1er niveau. */
export function walkFlow(flow: Flow, visit: (node: Flow) => void): void {
  visit(flow);
  switch (flow.kind) {
    case 'seq': flow.steps.forEach((s) => walkFlow(s, visit)); break;
    case 'if': walkFlow(flow.then, visit); if (flow.else) walkFlow(flow.else, visit); break;
    case 'test': walkFlow(flow.success, visit); walkFlow(flow.fail, visit); break;
    case 'do': break;
  }
}
