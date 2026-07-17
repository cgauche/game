/**
 * FLOW CORE — le NOYAU PUR (engine) de la couche de LOGIQUE authorée du jeu : conditions → effets →
 * branches, façon liste de blocs imbriqués (RPG Maker / ink), pas de graphe à fils. UNE structure
 * récursive, sérialisation STABLE (c'est le contrat édité dans l'éditeur ET sauvegardé dans les
 * scènes/sorts). Elle subsume, à terme, `Effect[]` (la séquence), les branches `test`/dialogue, et les
 * conditions de trigger — source UNIQUE de la logique de contenu (triggers, dialogues, interactions,
 * pièges, sorts custom).
 *
 * POURQUOI EN `engine/` (règle 3 — le moteur reste PUR) : la feuille `do` est GÉNÉRIQUE (`Flow<E>`).
 * Le défaut `EffectOp` (appliquer des `GameOp`) ne dépend QUE du moteur ; la couche `state` instancie
 * `Flow<Effect>` (la feuille devient l'union `Effect` complète : transition/dialogue/combat…, qui EST
 * state). Le moteur (ops/miscast/domainAttributes/types/magic/weaponDamage) ne référence que ce noyau.
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
 * vit dans le store (`runFlow`) — comme `applyEffects` aujourd'hui.
 */
import { toDate } from './clock';
import type { CharKey, Difficulty, HitLocation } from './types';
import { relationBetween, type Camp, type Relation } from './relations';
import { groupMatch } from './groups';
import type { GameOp, PairedSense } from './ops';

/** Fenêtre horaire d'un trigger/Condition (heure-du-jour, `before` EXCLUSIF). Champs absents = borne
 *  ouverte ; objet vide = toujours vrai. Aucune dépendance — type structurel pur. */
export interface TemporalCondition {
  afterHour?: number;
  afterMinute?: number;
  beforeHour?: number;
  beforeMinute?: number;
}

/** EFFECTOP — la feuille PURE (engine) d'un `Flow` : applique des `GameOp` (Blessures/soin/État/charMod/
 *  Corruption/buffs… — vocabulaire PARTAGÉ avec les sorts, `engine/ops`) à une cible. C'est le DÉFAUT de
 *  la feuille générique `Flow<E>` ; la couche `state` élargit `E` à son union `Effect` (transition/
 *  dialogue/combat…). `on` = qui : `party`/`hero` (scène, défaut `party`) ou `caster`/`target` (contexte
 *  d'incantation, résolu par le flux de sort). */
export interface EffectOp {
  type: 'ops';
  ops: GameOp[];
  on?: 'party' | 'hero' | 'caster' | 'target';
  heroId?: string;
  /** Échéance d'HORLOGE (minute `gameTime`) des effets DURABLES posés par ces ops — BAKÉE sur la feuille
   *  (durée d'un consommable résolue AU BOIRE, `bakeConsumableFlow`) pour SURVIVRE aux suspensions (une
   *  branche de `test` voyage sérialisée dans un pending/meta, jamais une closure). Lue par `leafOpsCtx`
   *  à CHAQUE point d'application d'un EffectOp → `ctx.defaultUntilTime`. Absente = durée du contexte. */
  untilTime?: number;
  /** Libellé de SOURCE des ActiveEffect posés (nom du consommable) — baké avec `untilTime` (même raison). */
  label?: string;
}

/** OpsCtx d'une FEUILLE EffectOp : le contexte de l'appelant SURCHARGÉ par les champs bakés de la feuille
 *  (`untilTime` → durée d'horloge, `label` → source). SOURCE UNIQUE — tous les exécuteurs d'EffectOp
 *  (handler de scène `ops`, `runCombatFlow`, `runPureFlowLines`, runner de consommable) DOIVENT l'appliquer,
 *  sinon une branche suspendue perdrait sa durée (charMod permanent au lieu de « 2d10 minutes »). */
export function leafOpsCtx<C extends { defaultUntilTime?: number; label?: string }>(base: C, e: EffectOp): C {
  if (e.untilTime == null && e.label == null) return base;
  return {
    ...base,
    ...(e.untilTime != null ? { defaultUntilTime: e.untilTime } : {}),
    ...(e.label != null ? { label: e.label } : {}),
  };
}

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
/** Référence à UNE Caractéristique EFFECTIVE d'un acteur (`bonus:true` → son Bonus). Toutes les
 *  Caractéristiques sont exposées (pas de champ ad hoc) — lues par les seuils relatifs, ex. Voie d'eau
 *  « coule à Endurance » ⇔ `{who:'target', char:'E'}` (MDG ch.13). */
export type CharRef = { who: ActorRef; char: CharKey; bonus?: boolean };
/** SUJET d'une comparaison `compare` : `who` (cible/lanceur) × (une donnée fixe, la valeur/stacks d'un
 *  État nommé, ou une Caractéristique — 0 si absent → « la cible a l'État X » ⇔ `{who:'target', condition:X} >= 1`). */
export type CompareSubject = { who: ActorRef; field: ActorField } | { who: ActorRef; condition: string } | CharRef;
/** Opérateur de comparaison (Condition `compare`). */
export type CompareOp = '>=' | '<=' | '==' | '<' | '>';
/** Vue d'un acteur lue par les Conditions d'acteur (`compare`/`relation`/`has`) : id + PB + Taille/
 *  Avantage + camp + appartenances (Groupes/Talents/Traits) + valeur d'États par nom. */
export interface ActorView {
  id: string; woundsCurrent: number; woundsMax: number; size: number; advantage: number; camp: Camp;
  groups: string[]; talents: { id: string; spec?: string }[]; traits: string[];
  conditions: Record<string, number>;
  /** États PSYCHOLOGIQUES actifs portés (`psychState` — types dont l'affliction n'est pas résistée) —
   *  lus par `has what:'psych'` (gate « porteur en Frénésie » du Contrôle de la Frénésie, LDB 10). */
  psych?: string[];
  /** Caractéristiques EFFECTIVES (toutes), lues par la Condition `compare` via `{who, char}` (+ `bonus`). */
  chars: Record<CharKey, number>;
  /** Niveau des CAPACITÉS de combat (`CombatFeature` agrégées) — lu par la Condition `capability`
   *  (Cœur vaillant `braveheart`…). Absent → toute capacité vaut 0. */
  capabilities?: Record<string, number>;
  /** Domaine du Chaos de l'acteur (`chaosDomainOf` — spec du Talent Magie du Chaos, EDOC 13) — lu par la
   *  Condition `casterChaosDomain`. Absent = non porteur du Talent Magie du Chaos. */
  chaosDomain?: string;
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
   *  `{who:'target',field:'woundsCurrent'} >= 1`. Acteur absent → false. `factor` met à l'échelle la valeur
   *  référencée (« la MOITIÉ de l'Endurance » ⇔ `{who:'target',char:'E',factor:0.5}`, Voie d'eau). */
  | { kind: 'compare'; subject: CompareSubject; op: CompareOp; value: number | (CompareSubject & { factor?: number }) }
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
  /** CAUSE d'un effarouchement courant (`ctx.startleCause` : 'noise' bruits forts / 'magic' présence de
   *  magie — LDB 85 l.197 Nerveux) — gate l'exemption Dressé (Guerre ignore les bruits, Magie ignore la
   *  magie, LDB 85 l.89). Hors contexte d'effarouchement = jamais vrai. */
  | { kind: 'startleCause'; is: 'noise' | 'magic' }
  /** Blessures infligées par l'attaque/lancement courant (`ctx.woundsDealt`), comparées par `op` à
   *  `value` (Venin : `> 0` → Empoisonné ; un rider « coup lourd » : `>= 3`). Hors contexte = 0. */
  | { kind: 'woundsDealt'; op: CompareOp; value: number }
  /** Écart d'Avantage avec les adversaires Engagés (`ctx.engagedAdvantageGap`), comparé par `op` à `value`
   *  (Instable : `> 0` → la créature est repoussée et perd des PB, LDB 85 l.177). Hors combat = 0. */
  | { kind: 'engagedAdvantageGap'; op: CompareOp; value: number }
  /** AVANCE d'Avantage sur TOUS les adversaires Engagés (`ctx.engagedAdvantageLead` = son Avantage − le
   *  meilleur Avantage ennemi engagé), SIGNÉE et non bornée, comparée par `op` à `value`. C'est l'INVERSE
   *  non-clampé de `engagedAdvantageGap` (qui mesure de combien un ennemi DÉPASSE le porteur, ≥ 0) : `> 0`
   *  = le porteur a un Avantage STRICTEMENT supérieur à TOUS ses adversaires engagés (Absorption « si la
   *  créature a un Avantage plus élevé que tous les adversaires engagés », EDO p.147). Hors combat / sans
   *  foe engagé = 0. */
  | { kind: 'engagedAdvantageLead'; op: CompareOp; value: number }
  /** Y a-t-il un adversaire VIVANT dans la Ligne de Vue de `target` (`ctx.foeInLoS`) ? Géométrie d'arène
   *  emballée en donnée (au-dessus de `lineOfSightCover`) : sortie de Frénésie « plus d'ennemi en vue → fin »
   *  (LDB 21 l.36), fuite/récupération du Brisé « hors de vue de l'ennemi » (LDB 16 l.55). Hors combat = false. */
  | { kind: 'foeInLoS' }
  /** Aucun adversaire VIVANT ne voit l'acteur (sens foe→acteur, ≠ `foeInLoS` acteur→foe) — « caché hors de
   *  vue de l'ennemi » (Brisé, LDB 16 l.55/71 : retrait sans Test + difficulté Accessible). Précalculé sur
   *  la battle (`ctx.hiddenFromFoes`). Hors combat = false. */
  | { kind: 'hiddenFromFoes' }
  /** L'acteur est-il ENGAGÉ avec un adversaire (LDB 13 l.159) ? Gate de récupération du Brisé (LDB 16 l.57 :
   *  aucun Test si Engagé). Précalculé (`ctx.engaged`). Hors combat = false. */
  | { kind: 'engaged' }
  /** Le Test courant est-il un TEST D'ÉQUIPAGE à bord (MDG ch.14) ? Gate du bonus « Commandant émérite »
   *  (MDG 09 l.54 : « à bord de votre bateau ou impliquant votre équipage »). Hors Test d'équipage = false. */
  | { kind: 'crewTest' }
  /** Distance (cases) à l'adversaire VIVANT le plus proche, comparée par `op` à `value` (Brisé : Très
   *  difficile si ≤ 3, LDB 16 l.58). Précalculée (`ctx.nearestFoeDist`). Aucun adversaire / hors combat = +∞. */
  | { kind: 'nearestFoe'; op: CompareOp; value: number }
  /** Niveau d'une CAPACITÉ de combat (`CombatFeature`) de l'acteur `who`, comparé par `op` (défaut `>=`) à
   *  `value` (défaut 1) — Cœur vaillant (`braveheart`) octroyable par talent OU effet. Acteur absent = 0. */
  | { kind: 'capability'; who: ActorRef; id: string; op?: CompareOp; value?: number }
  /** Camp / RELATION d'un acteur (`who`) — gate « seulement les ennemis / les alliés / les neutres »
   *  (riders de domaine offensifs : `who:'target', is:'opponent'`). `ally`/`opponent` sont RELATIFS à
   *  l'autre acteur (même camp / camp différent) ; `party`/`neutral`/`hostile` sont ABSOLUS (le `kind`).
   *  Acteur(s) absent(s) = false. */
  | { kind: 'relation'; who: ActorRef; is: Relation | Camp }
  /** L'acteur (`who`) POSSÈDE un élément : appartenance à un **Groupe** (faction, via `groupMatch`),
   *  un **Talent** (par id, `spec` éventuel — « Magie des Arcanes (Feu) »), un **Trait** (par id), ou
   *  un **état psychologique** actif (par type — `psych`, ex. 'frenesie' : gate du Contrôle de la
   *  Frénésie, LDB 10). Généralise les gates op-level `onlyGroups`/`unlessImmune`. Acteur absent = false. */
  | { kind: 'has'; who: ActorRef; what: 'group' | 'talent' | 'trait' | 'psych'; value: string; spec?: string }
  /** Le Domaine du Chaos du LANCEUR (`ctx.caster.chaosDomain`, `chaosDomainOf`) est-il `is` ? Gate
   *  GÉNÉRIQUE de tout Sort d'Arcanes du Chaos « se manifestant selon le Domaine spécifique » (EDOC 13
   *  l.264-266) — la branche du Flow sélectionne sa colonne (Allure démoniaque : Nurgle/Slaanesh/Tzeentch/
   *  Indivisible). Lanceur sans Domaine résolu → toutes les branches sont fausses (bug de données côté
   *  authoring : un Sort d'Arcanes du Chaos exige le Talent Magie du Chaos). */
  | { kind: 'casterChaosDomain'; is: string }
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
  /** Écart d'Avantage avec les adversaires Engagés — lu par la Condition `engagedAdvantageGap` (Instable). */
  engagedAdvantageGap?: number;
  /** Avance d'Avantage SIGNÉE sur tous les adversaires Engagés (son Avantage − le meilleur ennemi engagé) —
   *  lue par la Condition `engagedAdvantageLead` (Absorption : `> 0` = strictement supérieur à tous). */
  engagedAdvantageLead?: number;
  /** KIND de l'attaque courante (`creatureAttackKind` : 'morsure'/'cornes'/…) — lu par la Condition `attackKind`. */
  attackKind?: string;
  /** CAUSE de l'effarouchement courant ('noise'/'magic') — lue par la Condition `startleCause` (exemption Dressé). */
  startleCause?: 'noise' | 'magic';
  /** Un adversaire vivant est-il dans la Ligne de Vue du porteur — lu par la Condition `foeInLoS`
   *  (sortie de Frénésie, fuite/récupération du Brisé). Précalculé sur la `battle` par l'appelant. */
  foeInLoS?: boolean;
  /** Aucun adversaire vivant ne voit l'acteur (sens foe→acteur) — lu par `hiddenFromFoes` (Brisé caché). */
  hiddenFromFoes?: boolean;
  /** L'acteur est-il Engagé avec un adversaire — lu par `engaged` (gate de récupération du Brisé). */
  engaged?: boolean;
  /** Distance (cases) à l'adversaire vivant le plus proche — lue par `nearestFoe`. +∞ si aucun. */
  nearestFoeDist?: number;
  /** Le Test courant est-il un TEST D'ÉQUIPAGE à bord (MDG ch.14) — lu par la Condition `crewTest`
   *  (Commandant émérite : « à bord de votre bateau ou impliquant votre équipage », MDG 09 l.54). */
  crewTest?: boolean;
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
      // Carve-out doctrine (#318) : ce repli n'est PAS une comparaison par-label déguisée — un objet
      // CUSTOM n'a structurellement AUCUN id de catalogue à comparer (il n'existe dans aucune source
      // data), donc son nom EST son seul identifiant stable côté ItemInstance. Rien à migrer.
      const have = (ctx.party ?? []).reduce((n, h) => n + (h.items ?? []).filter((it) => (it.trappingId ?? it.name) === cond.trappingId).length, 0);
      return have >= need;
    }
    case 'money': return ctx.money ? brassValue(ctx.money) >= brassValue(cond.atLeast) : false;
    case 'partyDead': {
      const party = ctx.party ?? [];
      return party.length > 0 && (cond.who === 'all' ? party.every((h) => h.dead) : party.some((h) => h.dead));
    }
    case 'compare': {
      // Lecture d'un côté de la comparaison : valeur d'un État (par nom), Caractéristique (+Bonus), ou champ fixe.
      const read = (sel: CompareSubject): number | undefined => {
        const a = sel.who === 'caster' ? ctx.caster : ctx.target;
        if (!a) return undefined;
        if ('condition' in sel) return a.conditions[sel.condition] ?? 0;
        if ('char' in sel) { const v = a.chars[sel.char]; return sel.bonus ? Math.floor(v / 10) : v; }
        return a[sel.field];
      };
      const lhs = read(cond.subject);
      const rhsRaw = typeof cond.value === 'number' ? cond.value : read(cond.value);
      const rhs = typeof cond.value === 'number' || rhsRaw == null ? rhsRaw : rhsRaw * (cond.value.factor ?? 1);
      if (lhs == null || rhs == null) return false; // acteur absent → false
      return applyCompareOp(lhs, cond.op, rhs);
    }
    case 'slThreshold': return applyCompareOp(ctx.sl ?? 0, cond.op, cond.value);
    case 'location': return ctx.location != null && ctx.location === cond.is;
    case 'attackKind': return ctx.attackKind != null && ctx.attackKind === cond.is;
    case 'startleCause': return ctx.startleCause != null && ctx.startleCause === cond.is;
    case 'woundsDealt': return applyCompareOp(ctx.woundsDealt ?? 0, cond.op, cond.value);
    case 'engagedAdvantageGap': return applyCompareOp(ctx.engagedAdvantageGap ?? 0, cond.op, cond.value);
    case 'engagedAdvantageLead': return applyCompareOp(ctx.engagedAdvantageLead ?? 0, cond.op, cond.value);
    case 'foeInLoS': return !!ctx.foeInLoS;
    case 'hiddenFromFoes': return !!ctx.hiddenFromFoes;
    case 'engaged': return !!ctx.engaged;
    case 'crewTest': return !!ctx.crewTest;
    case 'nearestFoe': return applyCompareOp(ctx.nearestFoeDist ?? Infinity, cond.op, cond.value);
    case 'capability': {
      const a = cond.who === 'caster' ? ctx.caster : ctx.target;
      return a ? applyCompareOp(a.capabilities?.[cond.id] ?? 0, cond.op ?? '>=', cond.value ?? 1) : false;
    }
    case 'relation': {
      const a = cond.who === 'caster' ? ctx.caster : ctx.target;
      if (!a) return false;
      if (cond.is === 'party' || cond.is === 'neutral' || cond.is === 'hostile') return a.camp === cond.is; // camp ABSOLU
      const other = cond.who === 'caster' ? ctx.target : ctx.caster; // RELATIF à l'autre acteur
      return !!other && relationBetween(a, other) === cond.is;
    }
    case 'has': {
      const a = cond.who === 'caster' ? ctx.caster : ctx.target;
      if (!a) return false;
      if (cond.what === 'group') return groupMatch(cond.value, a.groups);
      if (cond.what === 'talent') return a.talents.some((t) => t.id === cond.value && (!cond.spec || t.spec === cond.spec));
      if (cond.what === 'psych') return (a.psych ?? []).includes(cond.value);
      return a.traits.includes(cond.value);
    }
    case 'casterChaosDomain': return ctx.caster?.chaosDomain === cond.is;
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

/** Difficulté EFFECTIVE d'un `FlowTest` : la PREMIÈRE entrée `difficultyBy` dont la Condition est vraie
 *  impose sa difficulté ; sinon `difficulty` (défaut Intermédiaire). SOURCE UNIQUE — voie inline (ennemi/
 *  auto), étape de cascade (héros) et hors-combat la partagent (Brisé : caché/proche/loin, LDB 16 l.58). */
export function resolveTestDifficulty(ft: FlowTest, cc: ConditionCtx): Difficulty {
  for (const d of ft.difficultyBy ?? []) if (evalCondition(d.cond, cc)) return d.difficulty;
  return ft.difficulty ?? 'intermediaire';
}

/** Le `gate` d'un `FlowTest` est-il ouvert (Test à jouer) ? Vrai si absent ; sinon évalue la Condition. */
export function flowTestGateOpen(ft: FlowTest, cc: ConditionCtx): boolean {
  return ft.gate == null || evalCondition(ft.gate, cc);
}

/** Spécification d'un jet de compétence/caractéristique différé (→ modale) — TOUT le métier du Test,
 *  SANS les branches (portées par le nœud Flow `test`). Source UNIQUE : `Effect` 'test' est normalisé
 *  vers cette forme à l'exécution (un seul ouvreur de modale `openSkillTest`). */
export interface FlowTest {
  skill?: string;
  /** Spécialisation ciblée (Métier (Serrurier), Savoir (Magie)…) — précise QUELLE instance de `skill`
   *  est testée quand le héros en possède plusieurs ; sinon la première suffit. */
  spec?: string;
  /** Sens SOLLICITÉ par ce Test de Perception (LDB 18) — authoré sur le nœud de test d'une scène/dialogue :
   *  `'vue'` (repérer un mouvement, lire, guetter l'horizon) ou `'ouie'` (écouter à une porte, entendre une
   *  approche). Restreint le malus de Surdité (`skillMod{sense:'ouie'}`) au seul Test auditif, symétrique à
   *  la Cécité (qui nomme ses compétences en donnée). Absent = Test générique/ambigu → malus appliqué par
   *  défaut (conservateur : un sourd rate les indices sonores d'une vigilance générale). Lu par `openSkillTest`
   *  → `testValue`. */
  sense?: PairedSense;
  characteristic?: CharKey;
  difficulty?: Difficulty;
  /** DR minimum requis (défaut 0 = simple réussite). */
  requireSL?: number;
  label?: string;
  /** Outil utilisé : `trappingId` de la possession cataloguée (ex. `'marteau'`) pour un objet du
   *  catalogue, ou nom libre pour un objet CUSTOM (sans `trappingId`). Résolu au runtime par id en
   *  priorité (`i.trappingId === tool`), repli sur le nom (`i.name === tool`) pour les objets custom.
   *  Sa qualité d'artisanat module l'issue / casse l'objet. */
  tool?: string;
  /** Groupes de l'interlocuteur : malus Animosité/Préjugé sur un Test de Sociabilité (LDB 21). */
  vsGroups?: string[];
  /** Statut de la cible (« Argent 3 ») : mod social d'Échelon/Standing sur un Test social (LDB 08). */
  vsStatus?: string;
  /** Le Test social est une mendicité (option « Mendicité et Statut », LDB 08 l.92). */
  begging?: boolean;
  /** L'interlocuteur est une créature CAPRICIEUSE (Trait Capricieux, T2C ch.15) : un d10 tiré UNE fois
   *  module le Test de Sociabilité de −2 à +2 DR (soit ±10 par DR sur la valeur, comme la réaction de
   *  Statut LDB 08). Authoré sur le Test d'un dialogue mené avec la créature. */
  vsCapricieux?: boolean;
  /** Difficulté réduite si un héros possède la compétence/le talent requis. */
  easierIf?: { hasSkill?: { id: string; spec?: string }; hasTalent?: string; steps?: number };
  /** La difficulté EFFECTIVE vient de l'argument d'instance du porteur (« Venin (Difficile) ») —
   *  substituée à la collecte (`withArg`/`effectsOf`) ; `difficulty` ci-dessus est le défaut (arg absent).
   *  GATE reportée de l'op `test` (sémantique IDENTIQUE) — honorée par `resolveFlowTest`. */
  argDifficulty?: boolean;
  /** Saute le Test (= no-op, ni étape ni branche) si la cible est IMMUNISÉE au type donné — Immunité
   *  (Poison) → Venin sans effet. Même `immunityTypes()` que l'op `test`. */
  unlessImmune?: string;
  /** Le Test n'a lieu que si la cible appartient à l'un de ces Groupes (Épée de justice : « Criminel »).
   *  Sinon = no-op. Même `groupMatch` que l'op `test`. */
  onlyGroups?: string[];
  /** Le Test est sauté si la cible appartient à l'un de ces Groupes (Morsure de l'hiver : hors
   *  Mort-vivant/Démon). Même `groupMatch` que l'op `test`. */
  exceptGroups?: string[];
  /** GATE générique : le Test n'a lieu QUE si cette Condition est vraie (sinon no-op — ni étape ni branche,
   *  comme `unlessImmune`/`onlyGroups`). Généralise ces gates à l'algèbre de Conditions (Brisé : « pas
   *  Engagé OU Cœur vaillant, ET pions restants »). Évaluée AVANT le jet par `resolveFlowTest`/`resolveInlineFlowTest`. */
  gate?: Condition;
  /** Test de résistance (maladie/poison/peur/danger…) qu'on ne peut pas SOUTENIR (LDB 12 l.197) —
   *  marqueur DÉCLARATIF pour éviter qu'un futur nœud de Test câble un Soutien interdit par erreur ;
   *  coupe le Soutien à la source côté `openSkillTest` (`combatEffects.ts`), jamais une denylist par
   *  id de Compétence/Caractéristique. */
  noSupport?: boolean;
  /** MENACE à laquelle ce Test RÉSISTE (tag du talent « Résistance (Menace) », LDB 10 l.1015-1021 :
   *  'Poison' pour Venin/lames empoisonnées…). Copié sur l'étape de cascade du héros → offre
   *  l'auto-succès du talent (verbe `resist`, cf. engine/menace). Absent = Test non couvert. */
  menace?: string;
  /** Difficulté DYNAMIQUE : la PREMIÈRE Condition vraie impose sa difficulté ; sinon `difficulty` (défaut
   *  Intermédiaire). Brisé (LDB 16 l.58) : caché → Accessible, ennemi à ≤3 → Très difficile, sinon Intermédiaire. */
  difficultyBy?: { cond: Condition; difficulty: Difficulty }[];
  /** Test OPPOSÉ (Assommante, LDB 62 l.268 : « Test opposé Force/Résistance ») : le côté qui jette CE
   *  Test (`skill`/`characteristic` ci-dessus) est le DÉFENSEUR (la cible/victime) ; l'ATTAQUANT (le
   *  porteur de l'effet) oppose `attacker`[+`attackerSkill`], pré-jeté et FIGÉ. L'issue success/sl du
   *  défenseur vient de `resolveOpposed(jetDéfenseur, jetAttaquantFigé)` (PAS `roll ≤ target`) — le
   *  défenseur RÉSISTE (branche `success`) si l'attaquant ne l'emporte PAS (défenseur OU égalité) ;
   *  l'attaquant l'emporte → défenseur PERD → branche `fail`. Calque la mécanique figée de `recover`/
   *  `disengage` (l'opposant garde son jet, reroll-aware). */
  opposed?: { attacker: CharKey; attackerSkill?: string; attackerLabel?: string;
    /** Bonus de DR ajouté au jet du DÉFENSEUR (celui qui passe CE Test) AVANT l'opposition — Piège-lame
     *  (LDB 62 l.295 : « en ajoutant votre DR obtenu au précédent Test de Corps à corps »). Modifie À LA
     *  FOIS le vainqueur et la marge nette (il s'additionne au `sl` du défenseur dans `resolveOpposed`).
     *  Absent = 0 (Assommante). */
    bonusSL?: number;
    /** Bonus de DR ajouté au jet de l'ATTAQUANT figé (`aT`) AVANT l'opposition — Furtif (LDB 85) sur le
     *  Test de Discrétion de l'embusqueur : « Ajoutez son bonus d'Agilité au DR de tous ses Tests de
     *  Discrétion ». Baké dans `aT.sl` au pré-jet → suit la voie cascade (meta `aT`) ET inline à
     *  l'identique. Absent = 0. */
    attackerBonusSL?: number };
}

/**
 * Un nœud de Flow, GÉNÉRIQUE sur le type de sa FEUILLE `E` (défaut `EffectOp` — engine pur ; la couche
 * `state` instancie `Flow<Effect>`). Cinq formes, RÉCURSIVES, jamais cycliques :
 *  - `seq`    : exécute `steps` dans l'ordre (l'ancien `Effect[]`) ;
 *  - `do`     : une feuille — applique un effet `E` (action) ;
 *  - `if`     : évalue `cond` (PUR) → `then` / `else` ;
 *  - `test`   : jet ALÉATOIRE interactif → `success` / `fail` (l'ancien `Effect.test`) ;
 *  - `choice` : DÉCISION du joueur opt-in (≠ `test` aléatoire, ≠ `if` état) → `yes` / `no`. Coût
 *    d'Avantage optionnel dépensé sur `yes`. Primitive FONDAMENTALE des réactions de combat
 *    (Frappe Réactive « vous POUVEZ tenter », Déstabilisante « vous POUVEZ dépenser 2 Av ») et, à
 *    terme, des choix de dialogue/pièges. Son exécuteur (`resolveFlowChoice`) pousse une étape-choix
 *    GÉNÉRIQUE `triggeredChoice` (`pushCombatStep` yes/no + applier unique) — il n'invente pas de mécanisme.
 */
export type Flow<E = EffectOp> =
  | { kind: 'seq'; steps: Flow<E>[] }
  | { kind: 'do'; effect: E }
  | { kind: 'if'; cond: Condition; then: Flow<E>; else?: Flow<E> }
  | { kind: 'test'; test: FlowTest; success: Flow<E>; fail: Flow<E> }
  | { kind: 'choice'; prompt: string; cost?: { advantage: number }; icon?: string; yes: Flow<E>; no?: Flow<E> };

/** Flow vide (séquence sans étape) — neutre, sûr comme valeur par défaut d'un consommateur. */
export const EMPTY_FLOW: Flow = { kind: 'seq', steps: [] };

/** DÉCLENCHEUR d'un effet « sur événement » — le pendant du « au lancement » des sorts. Partagé par
 *  TOUT porteur d'effets déclenchés (Trait de créature, Atout d'arme, Talent…). `onHit` : après une
 *  touche réussie (du porteur ou de l'arme) ; `onWoundLoss` : quand le porteur PERD des PB ;
 *  `onRoundStart` : au début de son Round ; `onStartled` : magie / bruit fort ; `onKill` : adversaire
 *  mis hors de combat ; `onGainCondition` : le porteur vient de GAGNER un État (filtré par `condition` —
 *  Mâchoires d'acier : « chaque fois que vous gagnez un État Sonné »).
 *  `onWoundLoss` se produit pour TOUTE perte de PB (mêlée OU distance) ; le TYPE d'attaque voyage dans le
 *  contexte (`attackType`) et un effet peut s'y restreindre via son champ `attackType`.
 *  `onSlain` : le porteur vient d'être mis HORS DE COMBAT, par n'importe quel chemin de mort (0 PB,
 *  Critique létal — démembrement —, mort-auto du désespéré, mort lente). Émis UNE fois (garde `slainNotified`).
 *  Couvre le « démon banni à sa mort » (Démoniaque, LDB 85 p.339) et tout futur effet « à la mort ».
 *  Cycle de vie du COMBAT (au point de hook correspondant — cf. `combatHooks`) : `onCombatStart` (le
 *  combat débute), `onCombatEnd` (le combat se résout, AVANT l'écran de victoire), `onRoundEnd` (fin de
 *  Round, après l'entretien), `onTurnStart`/`onTurnEnd` (début/fin du tour du porteur). */
export type EffectTrigger =
  | 'onHit' | 'onCrit' | 'onWoundLoss' | 'onSlain' | 'onRoundStart' | 'onStartled' | 'onKill' | 'onCharged' | 'onGainCondition'
  | 'onCombatStart' | 'onCombatEnd' | 'onRoundEnd' | 'onTurnStart' | 'onTurnEnd'
  | 'onAttackResolved' | 'onCastResolved' | 'onMiscast'
  /** Le PORTEUR vient d'ÉCHOUER un Test (n'importe lequel : combat, scène, entretien) — `ctx.margin` = le
   *  DR de l'échec (négatif). Les paliers de gravité s'expriment en DONNÉE via la Condition `slThreshold`
   *  (jamais de bande codée en dur au moteur) : Crampes abdominales (T2C 16 l.152-158) réagissent à
   *  `slThreshold(≤-2)`/`(≤-4)`/`(≤-6)`. Émis par `fireOwnTestFailed` (state/triggeredEffects), qui garde
   *  la RÉ-ENTRANCE (un Test résolu PENDANT le traitement ne ré-émet jamais). */
  | 'onOwnTestFailed';

/** Effet DÉCLENCHÉ authoré (donnée éditable) : un Flow d'ops appliqué à `on` quand `trigger` se produit.
 *  GÉNÉRIQUE — porté indifféremment par `TraitData.effects` (Toile, Sang corrosif…) ET `QualityData.effects`
 *  (Atout d'arme : « à la touche, 1d10 + Empêtré »). Même vocabulaire que les sorts (réutilise
 *  `runPureFlowLines`/`applyOps`) → plus de handler en dur. `on` : le porteur lui-même (`self`), la victime
 *  touchée (`victim`), ou les adversaires Engagés du porteur (`engaged`). */
/** CIBLE(S) d'un effet déclenché : le porteur (`self`), la victime touchée (`victim`), les adversaires
 *  Engagés (`engaged`), les adversaires que le porteur EMPOIGNE actuellement (`grappled`, = ses
 *  `grapplingWith` — la « victime absorbée » de l'Absorption pour la digestion/redirection), ou —
 *  géométrie — TOUS les combattants à `radiusMeters` d'un centre (l'arc d'Azyr :
 *  `{ near: 'victim', radiusMeters: 2 }`). Le centre lui-même et le porteur sont exclus.
 *  `{ pick: 'engaged', ... }` : SÉLECTIONNE jusqu'à `max` adversaires Engagés non encore empoignés, les
 *  plus PROCHES d'abord, de Taille ≤ la sienne si `sizeAtMost:'self'` — la capacité restante tient compte
 *  des `grapplingWith` déjà tenus (engloutir « un adversaire à la fois », Absorption EDO p.147). Réutilisable
 *  par tout effet « happe le plus proche petit ennemi engagé ». */
export type EffectTargeting = 'self' | 'victim' | 'engaged' | 'grappled'
  | { near: 'victim' | 'self'; radiusMeters: number }
  | { pick: 'engaged'; sizeAtMost?: 'self'; max: number };
export interface TriggeredEffect<E = EffectOp> {
  trigger: EffectTrigger;
  on: EffectTargeting;
  flow: Flow<E>;
  /** Filtre du déclencheur `onGainCondition` : ne réagit que si l'État GAGNÉ a cet `id` (Mâchoires
   *  d'acier : `condition:'sonne'`). Absent = réagit à n'importe quel État gagné. Inerte pour les
   *  autres triggers. */
  condition?: string;
  /** Filtre par TYPE d'attaque (`onHit`/`onWoundLoss`) : ne réagit que si la touche/perte provient d'une
   *  attaque de ce type (`melee`/`ranged`). Absent = tout type (Sang corrosif : « chaque fois qu'elle subit
   *  des Blessures », LDB 85 l.220 → aucune restriction). Lu via `ctx.attackType`. */
  attackType?: 'melee' | 'ranged';
  /** Effet OPT-IN (RAW « Vous pouvez… » — Contrôle de la Frénésie, LDB 10 l.251-255) : le porteur CHOISIT
   *  de le déclencher. Héros en cadence MANUELLE → proposé (étape de CHOIX de fin de Round, skippable) ;
   *  IA / cadence auto → JAMAIS exercé (défaut conservateur : pas de décision silencieuse ni de jet caché
   *  — la sortie rationnelle de l'IA, « plus d'ennemi en vue », est déjà l'effet auto de psychology.json). */
  optional?: boolean;
}

/** Enveloppe une liste d'effets-feuilles (ancien format `Effect[]`) en un Flow `seq` de `do` — pont de
 *  migration des consommateurs (`Trigger.effects`, `DialogueChoice.effects`) vers le Flow, sans réécrire
 *  la donnée. GÉNÉRIQUE sur la feuille (défaut `EffectOp`). */
export function flowFromEffects<E = EffectOp>(effects: E[] | undefined): Flow<E> {
  return { kind: 'seq', steps: (effects ?? []).map((effect) => ({ kind: 'do', effect })) };
}

/**
 * Aplatit un Flow SANS Test ni If non résolu en une liste d'effets-feuilles (les `if` sont évalués
 * contre `ctx`). Couvre `seq`/`do`/`if`. Un nœud `test`/`choice` lève — son exécution est interactive
 * (store). Utile pour les consommateurs purement séquentiels et pour tester la résolution des branches `if`. */
export function flattenFlow<E = EffectOp>(flow: Flow<E>, ctx: ConditionCtx): E[] {
  switch (flow.kind) {
    case 'do': return [flow.effect];
    case 'seq': return flow.steps.flatMap((s) => flattenFlow(s, ctx));
    case 'if': {
      const branch = evalCondition(flow.cond, ctx) ? flow.then : flow.else;
      return branch ? flattenFlow(branch, ctx) : [];
    }
    case 'test':
      throw new Error('flattenFlow: un nœud `test` est interactif — utiliser runFlow (store).');
    case 'choice':
      throw new Error('flattenFlow: un nœud `choice` est interactif — utiliser runFlow (store).');
  }
}

/** Effets `do` de PREMIER niveau d'un Flow (seq plat) — édition en liste + assertions (≡ ancien `effects`). */
export function flowEffects<E = EffectOp>(flow: Flow<E>): E[] {
  return flow.kind === 'do' ? [flow.effect] : flow.kind === 'seq' ? flow.steps.flatMap((s) => (s.kind === 'do' ? [s.effect] : [])) : [];
}

/** La feuille est-elle un `EffectOp` (`{type:'ops'}`) ? Garde STRUCTURELLE — un `Flow<E>` générique peut
 *  porter d'autres feuilles (l'`Effect` complet côté state : transition/dialogue…), mais l'extraction
 *  d'ops ne concerne que les feuilles EffectOp. Source unique du narrowing pour les walkers ci-dessous. */
function isEffectOp(e: unknown): e is EffectOp {
  return typeof e === 'object' && e !== null && (e as { type?: unknown }).type === 'ops';
}

/** GameOps des feuilles EffectOp d'un Flow de sort, filtrées par cible (`target`/`caster`). SOURCE
 *  UNIQUE de l'extraction des effets d'un sort depuis `SpellData.effects` : le cast flow applique un
 *  sous-Flow (target vs caster) via `runCombatFlow`, mais les badges UI (`spellSupport`) ont besoin de
 *  la liste d'ops. Visite récursive (les feuilles peuvent vivre sous if/test). `on` absent ⇒ `target`. */
export function spellOps<E = EffectOp>(flow: Flow<E> | undefined, on: 'target' | 'caster'): GameOp[] {
  if (!flow) return [];
  const out: GameOp[] = [];
  walkFlow(flow, (n) => {
    if (n.kind !== 'do') return;
    const e = n.effect;
    if (isEffectOp(e) && (e.on ?? 'target') === on) out.push(...e.ops);
  });
  return out;
}

/** TOUTES les ops EffectOp d'un Flow de sort (target + caster) — pour qualifier la mécanisation d'un
 *  sort (`spellSupport`) sans privilégier une cible : un effet de lanceur (invocation, zone, vol de
 *  vie) compte autant qu'un effet de cible. */
export function spellEffectOps<E = EffectOp>(flow: Flow<E> | undefined): GameOp[] {
  return [...spellOps(flow, 'target'), ...spellOps(flow, 'caster')];
}

/** Sous-Flow d'un Flow de sort ne gardant que les nœuds adressant `on` (target/caster) — pour appliquer
 *  SÉPARÉMENT les effets de cible (par cible, missile/soutien) et ceux du lanceur (une fois). Préserve
 *  l'imbrication if/test : un nœud de structure est conservé si l'une de ses branches porte un effet
 *  `on`. Un `do` ops d'un AUTRE `on` devient un `seq` vide (neutre). `do` non-ops conservés sous `target`. */
export function spellFlowFor<E = EffectOp>(flow: Flow<E> | undefined, on: 'target' | 'caster'): Flow<E> {
  if (!flow) return { kind: 'seq', steps: [] };
  const keep = (f: Flow<E>): Flow<E> => {
    switch (f.kind) {
      case 'do': {
        const e = f.effect;
        if (isEffectOp(e)) return (e.on ?? 'target') === on ? f : { kind: 'seq', steps: [] };
        return on === 'target' ? f : { kind: 'seq', steps: [] }; // effets non-ops (narration…) rattachés à la cible
      }
      case 'seq': return { kind: 'seq', steps: f.steps.map(keep) };
      case 'if': return { kind: 'if', cond: f.cond, then: keep(f.then), ...(f.else ? { else: keep(f.else) } : {}) };
      case 'test': return { kind: 'test', test: f.test, success: keep(f.success), fail: keep(f.fail) };
      case 'choice': return { kind: 'choice', prompt: f.prompt, ...(f.cost ? { cost: f.cost } : {}), ...(f.icon ? { icon: f.icon } : {}), yes: keep(f.yes), ...(f.no ? { no: keep(f.no) } : {}) };
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

/** Le Flow contient-il un nœud INTERACTIF — `test` (jet) ou `choice` (décision joueur) ? Si oui, son
 *  exécution doit passer par l'exécuteur interactif (`runFlow`/`runCombatFlow`), pas un aplatissage. */
export function flowHasTest<E = EffectOp>(flow: Flow<E>): boolean {
  switch (flow.kind) {
    case 'do': return false;
    case 'seq': return flow.steps.some((s) => flowHasTest(s));
    case 'if': return flowHasTest(flow.then) || (flow.else ? flowHasTest(flow.else) : false);
    case 'test': return true;
    case 'choice': return true;
  }
}

/** Ops IMPURES résolues par le do-loop de `runCombatFlow` (`grantFreeAttack` → frappe gratuite ;
 *  `interruptFocus` → interruption de Focalisation ; `breakBlade` ; `delayed` → file `scheduledEffects`
 *  via `scheduleDelayedOps`) : `applyOps` les laisse inertes. Source UNIQUE pour router une branche de
 *  `test` contenant l'une d'elles vers l'exécuteur IMPUR plutôt que `runPureFlowLines` (qui les avalerait). */
const HOOK_BACKED_OPS = new Set(['grantFreeAttack', 'interruptFocus', 'breakBlade', 'delayed']);

/** Le Flow porte-t-il une op IMPURE adossée à un hook de `runCombatFlow` (cf. `HOOK_BACKED_OPS`) ? Si oui,
 *  son exécution doit passer par `runCombatFlow` (le hook y vit), jamais par `runPureFlowLines`. */
export function flowHasImpureOp<E = EffectOp>(flow: Flow<E>): boolean {
  switch (flow.kind) {
    case 'do': { const e = flow.effect; return isEffectOp(e) && e.ops.some((o) => HOOK_BACKED_OPS.has(o.op)); }
    case 'seq': return flow.steps.some((s) => flowHasImpureOp(s));
    case 'if': return flowHasImpureOp(flow.then) || (flow.else ? flowHasImpureOp(flow.else) : false);
    case 'test': return flowHasImpureOp(flow.success) || flowHasImpureOp(flow.fail);
    case 'choice': return flowHasImpureOp(flow.yes) || (flow.no ? flowHasImpureOp(flow.no) : false);
  }
}

/** Ops de `HOOK_BACKED_OPS` interdites HORS branche `success`/`fail` d'un nœud `test` dans un Flow d'effet
 *  DÉCLENCHÉ (`effects: TriggeredEffect[]`, traits/talents/atouts/États/psychologie…) — EXCLUT
 *  `grantFreeAttack`, légitime top-level (résolu par `resolveFreeAttacks`, cf. `flowHasFreeAttack`, ex.
 *  Frappe réactive). `interruptFocus`/`breakBlade`/`delayed` n'ont de hook que dans le do-loop de
 *  `runCombatFlow` AVEC son contexte de branche de Test résolue ; placées ailleurs, `applyTriggeredEffects`
 *  (walker `runPureFlowLines`) les avale en silence (`applyOps` les laisse inertes). */
const STRAY_IMPURE_OPS = new Set([...HOOK_BACKED_OPS].filter((op) => op !== 'grantFreeAttack'));

/** Le Flow porte-t-il une op de `STRAY_IMPURE_OPS` EN DEHORS d'une branche `success`/`fail` de `test` ?
 *  `inTestBranch` (interne, propagé par la récursion) reste vrai tant qu'on n'est pas ressorti d'un nœud
 *  `test` — vérité utilisée par la garde de bien-formation des données (`effects` déclenchés). */
export function flowHasImpureOpOutsideTest<E = EffectOp>(flow: Flow<E>, inTestBranch = false): boolean {
  switch (flow.kind) {
    case 'do': {
      if (inTestBranch) return false;
      const e = flow.effect;
      return isEffectOp(e) && e.ops.some((o) => STRAY_IMPURE_OPS.has(o.op));
    }
    case 'seq': return flow.steps.some((s) => flowHasImpureOpOutsideTest(s, inTestBranch));
    case 'if': return flowHasImpureOpOutsideTest(flow.then, inTestBranch) || (flow.else ? flowHasImpureOpOutsideTest(flow.else, inTestBranch) : false);
    case 'test': return flowHasImpureOpOutsideTest(flow.success, true) || flowHasImpureOpOutsideTest(flow.fail, true);
    case 'choice': return flowHasImpureOpOutsideTest(flow.yes, inTestBranch) || (flow.no ? flowHasImpureOpOutsideTest(flow.no, inTestBranch) : false);
  }
}

/** Le Flow accorde-t-il une ATTAQUE GRATUITE (op `grantFreeAttack`, à quelque profondeur) ? Un tel Flow
 *  cible un TIERS (le chargeur/la victime) et exige le contexte `freeAttack` → il est joué par le
 *  résolveur d'attaques gratuites (`resolveFreeAttacks`), PAS par le dispatcher générique (où il est inerte). */
export function flowHasFreeAttack<E = EffectOp>(flow: Flow<E>): boolean {
  switch (flow.kind) {
    case 'do': { const e = flow.effect; return isEffectOp(e) && e.ops.some((o) => o.op === 'grantFreeAttack'); }
    case 'seq': return flow.steps.some((s) => flowHasFreeAttack(s));
    case 'if': return flowHasFreeAttack(flow.then) || (flow.else ? flowHasFreeAttack(flow.else) : false);
    case 'test': return flowHasFreeAttack(flow.success) || flowHasFreeAttack(flow.fail);
    case 'choice': return flowHasFreeAttack(flow.yes) || (flow.no ? flowHasFreeAttack(flow.no) : false);
  }
}

/** Constructeur d'un nœud `test` (jet → réussite/échec). Sucre pour les PRODUCTEURS de Flow (récolte,
 *  saut…) : remplace l'ancien `Effect.test` qu'on poussait dans une liste d'effets. */
export function testFlow<E = EffectOp>(test: FlowTest, success: Flow<E>, fail: Flow<E>): Flow<E> {
  return { kind: 'test', test, success, fail };
}

/** Assainit un Flow chargé depuis un document ANCIEN : purge les entrées `null` (JSON n'a pas
 *  `undefined` — un pas d'étape non-écrit sérialise en `null`) des tableaux `seq.steps`, structurellement
 *  INEXPRIMABLES dans l'éditeur (une étape ne peut pas être « vide »). Ne touche à RIEN d'autre — pas
 *  d'invention de branche manquante (`if.then`, `test.success/fail`…) : une réf pendante ou un nœud
 *  malformé reste la charge de la VALIDATION (`checkFlow`), jamais d'une purge silencieuse de données
 *  (un jet de contenu authoré serait un jet silencieux). `sanitizeLeaf` recurse dans une feuille `do`
 *  (ex. le Flow imbriqué d'un `delayedEffect`, propre à la couche `state`). `flow` absent (`null`/
 *  `undefined`) est renvoyé tel quel — la validation le rapportera. */
export function sanitizeFlow<E = EffectOp>(flow: Flow<E>, sanitizeLeaf?: (e: E) => E): Flow<E>;
export function sanitizeFlow<E = EffectOp>(flow: Flow<E> | null | undefined, sanitizeLeaf?: (e: E) => E): Flow<E> | null | undefined;
export function sanitizeFlow<E = EffectOp>(flow: Flow<E> | null | undefined, sanitizeLeaf?: (e: E) => E): Flow<E> | null | undefined {
  if (flow == null) return flow;
  switch (flow.kind) {
    case 'seq':
      return {
        ...flow,
        steps: (flow.steps ?? [])
          .filter((s): s is Flow<E> => s != null)
          .map((s) => sanitizeFlow(s, sanitizeLeaf)),
      };
    case 'do':
      return sanitizeLeaf ? { ...flow, effect: sanitizeLeaf(flow.effect) } : flow;
    case 'if':
      return { ...flow, then: sanitizeFlow(flow.then, sanitizeLeaf), ...(flow.else != null ? { else: sanitizeFlow(flow.else, sanitizeLeaf) } : {}) };
    case 'test':
      return { ...flow, success: sanitizeFlow(flow.success, sanitizeLeaf), fail: sanitizeFlow(flow.fail, sanitizeLeaf) };
    case 'choice':
      return { ...flow, yes: sanitizeFlow(flow.yes, sanitizeLeaf), ...(flow.no != null ? { no: sanitizeFlow(flow.no, sanitizeLeaf) } : {}) };
    default:
      return flow;
  }
}

/** Visite RÉCURSIVE de tous les nœuds d'un Flow (branches `if`/`test` comprises) — pour la validation
 *  (effets référencés, bornes des conditions horaires) sur l'arbre ENTIER, pas seulement le 1er niveau. */
export function walkFlow<E = EffectOp>(flow: Flow<E>, visit: (node: Flow<E>) => void): void {
  visit(flow);
  switch (flow.kind) {
    case 'seq': flow.steps.forEach((s) => walkFlow(s, visit)); break;
    case 'if': walkFlow(flow.then, visit); if (flow.else) walkFlow(flow.else, visit); break;
    case 'test': walkFlow(flow.success, visit); walkFlow(flow.fail, visit); break;
    case 'choice': walkFlow(flow.yes, visit); if (flow.no) walkFlow(flow.no, visit); break;
    case 'do': break;
  }
}
