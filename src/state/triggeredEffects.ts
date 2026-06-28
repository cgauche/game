/**
 * Effets DÉCLENCHÉS authorés (`TriggeredEffect`) — le pendant « sur événement » des sorts (« au
 * lancement »). GÉNÉRIQUE : un même dispatcher applique les effets portés par les TRAITS de la créature
 * (`TraitData.effects` — Toile, Sang corrosif…) ET par les ATOUTS de son arme (`QualityData.effects` —
 * un Atout « à la touche : 1d10 + Empêtré »). Il REMPLACE les handlers en dur dispersés.
 *
 * Réutilise `runSpellFlowLines` (le MÊME vocabulaire d'ops que les sorts, variante pure de
 * `runCombatFlow` → zéro duplication). Pur côté effets (ops via applyOps) ; mute les combattants en
 * place et renvoie le journal. Le référent des formules « (X) » est le PORTEUR (`caster` = la créature
 * qui frappe) — donc « Force de la source » = sa Force.
 */
import { type Combatant, type Weapon, type HitLocation, type Difficulty, CHAR_LABELS } from '../engine/types';
import type { Get, Set as SetFn } from './flowTypes';
import { type EffectTrigger, type TriggeredEffect, type Flow, flowHasTest, spellEffectOps } from './flow';
import type { OpsCtx, GameOp } from '../engine/ops';
import { describeTestRoll } from '../engine/ops';
import { resolveQualities } from '../engine/qualities/dispatch';
import { featureLevel } from '../engine/combatFeatures/dispatch';
import type { CombatFeature } from '../engine/combatFeatures/types';
import { isOutOfAction, combatTestPenalty } from '../engine/conditions';
import { roundTestInteractive } from './combat/cadenceGate';
import { isEngagedWith, isEngaged } from '../engine/engagement';
import { SIZE_ORDER, effectiveSize } from '../engine/size';
import { combatDistance } from './footprint';
import { chebyshev } from './path';
import { losClear, tileSeenByFoe } from './lineOfSight';
import { smokeOf, combatantsWithinRadius } from './combatGeometry';
import { traitById, qualityById, findManeuverById, findTalentById, findConditionById, findPsychologyById, refLabel } from '../data';
import { difficultyFromLabel, rollTest } from '../engine/tests';
import { rawCombatTestBase } from '../engine/skills';
import { runSpellFlowLines } from './combatEffects';
import { combatConditionCtx, flowTestGated } from './combat/flowEval';
import { resolveTestDifficulty } from './flow';
import { RNG, defaultRNG } from '../engine/dice';

/** PARAMÈTRE un effet de trait par l'ARGUMENT d'instance du porteur : substitue la difficulté d'un Test
 *  `argDifficulty` par celle dérivée de l'arg (« Venin (Difficile) » → difficile). Rend les effets
 *  authorés réutilisables et éditables tout en restant tunés par leur instance. Immuable (clone partiel). */
function withArg(effects: TriggeredEffect[], arg?: string, value?: number): TriggeredEffect[] {
  const diff = arg ? difficultyFromLabel(arg) : undefined;
  // Injection GÉNÉRIQUE de l'instance dans une op : un champ valant `'$arg'` reçoit l'arg (trait Maladie
  // « (peste) » → `exposeDisease{disease:'$arg'}`) ; `'$indice'` reçoit l'Indice numérique de l'instance
  // (Redoutable `value:2` → `gainAdvantage{amount:'$indice'}`). Une seule convention, pas de variante.
  // Si l'instance N'A PAS le paramètre attendu (trait templé posé sans arg/value), l'op est DROPPÉE (null) :
  // JAMAIS un placeholder qui fuit vers les résolveurs (`resolveFormula('$indice')` planterait sinon).
  const substOp = (op: GameOp): GameOp | null => {
    const o = op as Record<string, unknown>;
    const hasArg = Object.values(o).includes('$arg');
    const hasInd = Object.values(o).includes('$indice');
    if (!hasArg && !hasInd) return op; // pas de template → inchangée
    if ((hasArg && arg === undefined) || (hasInd && value === undefined)) return null; // paramètre manquant → op inerte
    const out = { ...o };
    for (const k in out) { if (out[k] === '$arg') out[k] = arg; else if (out[k] === '$indice') out[k] = value; }
    return out as unknown as GameOp;
  };
  const visit = (f: Flow): Flow => {
    if (f.kind === 'seq') return { ...f, steps: f.steps.map(visit) };
    if (f.kind === 'if') return { ...f, then: visit(f.then), ...(f.else ? { else: visit(f.else) } : {}) };
    if (f.kind === 'test') {
      // Nœud Flow `test` dont la difficulté vient de l'arg d'instance (« Venin (Difficile) ») : on
      // substitue `test.difficulty` (mêmes sémantique/gate que l'ancienne op `test.argDifficulty`).
      const test = f.test.argDifficulty && diff ? { ...f.test, difficulty: diff } : f.test;
      return { ...f, test, success: visit(f.success), fail: visit(f.fail) };
    }
    if (f.kind === 'do' && f.effect.type === 'ops') return { ...f, effect: { ...f.effect, ops: f.effect.ops.map(substOp).filter((o): o is GameOp => o != null) } };
    return f;
  };
  return effects.map((eff) => ({ ...eff, flow: visit(eff.flow) }));
}

/**
 * SOURCE UNIQUE d'énumération des sources d'effet DÉCLENCHÉ d'un combattant — TOUS les KINDS en UN endroit :
 * Atouts d'arme (`weapon.onHitEffects`), Traits, Qualités d'arme, Talents, ÉTATS, états PSY. Chaque source
 * est taguée `key`/`cap`/`label` (+ `stacks` pour les statuts, pions réduits d'une capacité de la cible).
 * TOUT le reste en DÉRIVE (zéro énumérateur parallèle) : `fireTriggers` (via `effectsOf` non-statut +
 * `fireConditionEffects`/`firePsychEffects`), `resolveFreeAttacks` (via `freeAttackSourcesOf`). AJOUTER UN
 * KIND = ICI seulement. Ordre FIGÉ (enchant → traits → atouts → talents → États → psy) = déroulé RNG déterministe. */
function effectSourcesOf(actor: Combatant, weapon?: Weapon): TriggerSource[] {
  const out: TriggerSource[] = [];
  if (weapon?.onHitEffects?.length) out.push({ effects: weapon.onHitEffects, cap: 1, key: `weapon:${weapon.name}`, label: weapon.name });
  for (const tr of actor.traits ?? []) { const d = traitById.get(tr.id); if (d?.effects?.length) out.push({ effects: withArg(d.effects, tr.arg, tr.value), cap: 1, key: `trait:${tr.id}`, label: d.label ?? tr.id }); }
  if (weapon) for (const { id } of resolveQualities(weapon)) { const d = qualityById.get(id); if (d?.effects?.length) out.push({ effects: d.effects, cap: 1, key: `qual:${id}`, label: d.label ?? id }); }
  for (const t of actor.talents ?? []) { const d = findTalentById(t.talentId); if (d?.effects?.length) out.push({ effects: d.effects, cap: t.times ?? 1, key: t.talentId, label: d.label ?? t.talentId }); }
  for (const cond of actor.conditions ?? []) {
    const d = findConditionById(cond.name);
    if (!d?.effects?.length) continue;
    const reduce = d.stacksReducedBy ? featureLevel(actor, d.stacksReducedBy as keyof CombatFeature) : 0; // Hémorragique − Endurci…
    out.push({ effects: d.effects, cap: 1, key: `cond:${cond.name}`, label: d.label ?? cond.name, stacks: Math.max(0, (cond.value ?? 1) - reduce) });
  }
  for (const p of actor.psychState ?? []) { const d = findPsychologyById(p.type); if (d?.effects?.length) out.push({ effects: d.effects, cap: 1, key: `psy:${p.type}`, label: d.label ?? p.type, stacks: 1 }); }
  return out;
}

/** Un tag de STATUT (État ou état psy) — il porte `stacks` et son dispatch (`fireConditionEffects`/
 *  `firePsychEffects`) injecte ses pions ; les KINDS « durs » (arme/trait/qualité/talent) n'en ont pas. */
const isStatusSource = (s: TriggerSource): boolean => s.key.startsWith('cond:') || s.key.startsWith('psy:');

/** Effets déclenchés NON-statut à plat (Atouts d'arme → Traits → Qualités → Talents) — sous-vue de
 *  `effectSourcesOf`. Les États/psy ont leur propre dispatch (avec pions), d'où le filtre. Ordre RNG figé. */
function effectsOf(actor: Combatant, weapon?: Weapon): TriggeredEffect[] {
  return effectSourcesOf(actor, weapon).filter((s) => !isStatusSource(s)).flatMap((s) => s.effects);
}

/** Ops d'un déclencheur `trigger` portées par le combattant (Traits/Talents/Atouts), à plat. Sert à
 *  RÉSOUDRE les ops IMPURES (summon, zone : grille/initiative) au SITE du trigger — elles sont inertes
 *  dans `applyOps` (moteur pur) et n'étaient résolues qu'au lancement de sort. GÉNÉRIQUE (pas limité à
 *  summon) : l'appelant (state) filtre par `op.op` et dispatche vers le résolveur idoine (applySummon,
 *  placeZoneFromOp…). `on:'self'/'caster'/'target'` désignent tous le porteur dans un effet de trait. */
export function triggerEffectOps(actor: Combatant, trigger: EffectTrigger): GameOp[] {
  return effectsOf(actor).filter((e) => e.trigger === trigger).flatMap((e) => spellEffectOps(e.flow));
}

/** Une SOURCE d'effets déclenchés du combattant, AVEC son identité (`key`) et son plafond (`cap`) —
 *  nécessaires aux ATTAQUES GRATUITES (imputation /Round par source ; plafond par source). `stacks` = pions
 *  de la source quand c'est un STATUT (État/psy), injectés dans le `ctx` du dispatch ; absent sinon. */
export interface TriggerSource { effects: TriggeredEffect[]; cap: number; key: string; label: string; stacks?: number; }

/** Sources d'attaque gratuite DÉCLENCHÉE = LES MÊMES sources que le dispatcher (`effectSourcesOf`, source
 *  unique) — `resolveFreeAttacks` filtre celles qui portent un `grantFreeAttack` (`flowHasFreeAttack`), quel
 *  que soit le KIND (Atout d'arme/Trait/Qualité/Talent/État/psy). NB : l'attaque libre « disponible » de la
 *  Frénésie vit dans son `passive` (`when:'available'`) → `availableFreeAttackOps`/`aiAvailableFreeAttack`, pas ici. */
export function freeAttackSourcesOf(actor: Combatant, weapon?: Weapon): TriggerSource[] {
  return effectSourcesOf(actor, weapon);
}

/** Combattants visés par un effet selon `on` (le porteur, la victime touchée, ou TOUS ceux Engagés
 *  avec lui — Sang corrosif : « tous ceux qui sont Engagés avec elle », alliés compris). */
function targetsFor(get: Get, actor: Combatant, on: TriggeredEffect['on'], victim?: Combatant): Combatant[] {
  if (on === 'self') return [actor];
  if (on === 'victim') return victim ? [victim] : [];
  const battle = get().battle;
  if (!battle) return [];
  if (on === 'grappled') { // les adversaires EMPOIGNÉS par le porteur (`grapplingWith`) — la victime absorbée
    const held = new Set(actor.grapplingWith ?? []);
    return battle.combatants.filter((c) => held.has(c.id));
  }
  if (typeof on === 'object') {
    if ('pick' in on) {
      // SÉLECTION d'un nombre LIMITÉ d'adversaires Engagés à engloutir (Absorption : « UN adversaire de taille
      // égale ou inférieure », un à la fois). Capacité restante = `max` − empoignés déjà tenus (un seul à la
      // fois pour max:1) ; candidats = Engagés vivants non encore tenus, de Taille ≤ la sienne, les + proches.
      const held = actor.grapplingWith ?? [];
      const capacity = Math.max(0, on.max - held.length);
      if (capacity === 0) return [];
      const selfSize = SIZE_ORDER[effectiveSize(actor.size)];
      const eligible = battle.combatants.filter((c) =>
        c.id !== actor.id && c.kind !== actor.kind && !isOutOfAction(c)
        && isEngagedWith(c, actor.id) && !held.includes(c.id)
        && (on.sizeAtMost !== 'self' || SIZE_ORDER[effectiveSize(c.size)] <= selfSize));
      eligible.sort((a, b) => combatDistance(actor, a) - combatDistance(actor, b)); // les plus proches d'abord
      return eligible.slice(0, capacity);
    }
    // GÉOMÉTRIE : tous les combattants à portée d'un centre (arc d'Azyr, Trait/Talent d'aire)
    const center = on.near === 'self' ? actor : victim;
    if (!center?.pos) return [];
    const radius = Math.max(1, Math.ceil(on.radiusMeters / 2)); // 1 case = 2 m
    // ORCHESTRATEUR d'aire PARTAGÉ (combatantsWithinRadius), distance d'EMPREINTE (la Taille compte) : un effet
    // déclenché SOURCE-AGNOSTIQUE (Trait/Talent/Atout/État portant `on:{near,radiusMeters}`) applique son Flow
    // de GameOps à TOUTES les cibles du rayon — MÊME collecte que munitions/zoneBlast/manœuvres.
    return combatantsWithinRadius(center.pos, radius, battle.combatants,
      (c) => c.id !== center.id && c.id !== actor.id && !isOutOfAction(c),
      (_ctr, c) => combatDistance(center, c));
  }
  return battle.combatants.filter((c) => c.id !== actor.id && isEngagedWith(c, actor.id)); // 'engaged'
}

/** Contexte d'application d'effets déclenchés. `margin` (marge d'un Test opposé) alimente les échelles
 *  `valuePerSL` via `ctx.sl` ; `woundsDealt` alimente le Vol de vie (op `lifeSteal`). */
export interface TriggerCtx { victim?: Combatant; weapon?: Weapon; rng?: RNG; margin?: number; woundsDealt?: number;
  /** Indice de l'attaque naturelle d'une MANŒUVRE — alimente les Formula `{indiceOf}` (Dégâts en GameOp). */
  indice?: number;
  /** Nombre de PIONS de l'État qui déclenche un `effects: onRoundEnd` — alimente les Formula `{stacks:'self'}`
   *  (Empoisonné « 1 PB/pion »). Posé par `fireConditionEffects`. */
  stacks?: number;
  /** Écart d'Avantage avec les adversaires Engagés — alimente la Formula `{engagedAdvantageGap}` ET la
   *  Condition `engagedAdvantageGap` (Instable). Calculé par `applyTriggeredEffects` sur la `battle`. */
  engagedAdvantageGap?: number;
  /** Avance d'Avantage SIGNÉE sur tous les adversaires Engagés — alimente la Condition `engagedAdvantageLead`
   *  (Absorption). Calculée par `applyTriggeredEffects` sur la `battle`. */
  engagedAdvantageLead?: number;
  /** Localisation de la touche courante (dé inversé) — alimente la Condition Flow `location` (Assommante). */
  location?: HitLocation;
  /** KIND de l'attaque courante (`creatureAttackKind` : 'morsure'/'cornes'/…) — alimente la Condition Flow
   *  `attackKind` (Vampirique : Vol de vie sur Morsure seulement). */
  attackKind?: string;
  /** CAUSE de l'effarouchement courant ('noise'/'magic', LDB 85 l.197) — alimente la Condition Flow
   *  `startleCause` (exemption Dressé : Guerre ignore les bruits, Magie ignore la magie). Posé par les
   *  émetteurs `onStartled` (arme à feu/Explosion → 'noise' ; incantation → 'magic'). */
  startleCause?: 'noise' | 'magic';
  /** Un adversaire vivant est-il dans la Ligne de Vue du porteur — alimente la Condition Flow `foeInLoS`
   *  (sortie de Frénésie, fuite/récupération du Brisé). Si absent, calculé sur la `battle` au déclenchement. */
  foeInLoS?: boolean;
  /** ID de l'État qui vient d'être GAGNÉ (déclencheur `onGainCondition`) — filtre les effets dont
   *  `condition` ne le matche pas (Mâchoires d'acier : `condition:'sonne'`). */
  conditionName?: string;
  /** TYPE de l'attaque courante (`weapon.type` : 'melee'/'ranged') — filtre les effets `onHit`/`onWoundLoss`
   *  dont `attackType` ne le matche pas. Posé par les émetteurs onHit/onWoundLoss. */
  attackType?: 'melee' | 'ranged';
  /** `set` du store — fourni quand un Test de trigger peut être routé en cascade influençable (héros
   *  manuel) ou résolu inline (ennemi/auto). Câblé sur tous les `fireTriggers` de combat (onHit/
   *  onWoundLoss/onKill/onStartled/onRoundStart/Domaine + manœuvres) ; INERTE tant qu'aucune donnée de
   *  trigger ne porte un nœud Flow `test` au 1ᵉʳ niveau (seul Mâchoires d'acier en a un, `onGainCondition`,
   *  câblé via le hook du store). Absent → pas de routage (les flows non-`test` passent par
   *  `runSpellFlowLines`, qui rend le `string[]` tissé inline par l'appelant). */
  set?: SetFn;
  /** Pose le drapeau `deferInteractiveTest` sur la résolution d'un Test routé : un héros MANUEL ne pousse
   *  PAS son étape ICI (la cascade n'est pas ouverte au moment où le hook `end-of-round` diffuse) — elle
   *  est COLLECTÉE par `collectHeroRoundEndUpkeep`. Ennemi/auto restent résolus inline. */
  deferInteractiveTest?: boolean }

/** ROUTEUR d'un Flow de trigger PORTANT un nœud `test` (à n'importe quelle profondeur) vers la voie
 *  CADENCE-AWARE (héros manuel → cascade influençable ; sinon → jet inline) via `runCombatFlow`
 *  (after-aware : un `test` enfoui sous `if`/`seq` suspend en empaquetant le reste). Injecté par la
 *  brique `state/combat/triggeredTest.ts` (inversion de dépendance : ce module reste pur, sans import de
 *  la brique → pas de cycle). Absent ⇒ aucun routage : un nœud `test` non routé tombe sur
 *  `runSpellFlowLines`, qui LÈVE (plus jamais de branche succès silencieuse). `opsCtx` porte le contexte
 *  de la touche (`woundsDealt`/`sl`/`location`/`attackKind`) lu par les Conditions `if` du Flow. */
type TestRouter = (get: Get, set: SetFn, target: Combatant, actor: Combatant, flow: Flow, opsCtx?: OpsCtx) => void;
let testRouter: TestRouter | undefined;
export function setTriggeredTestRouter(fn: TestRouter): void { testRouter = fn; }

/** Résolution INLINE d'un nœud `test` TOP-LEVEL sans routeur cadence-aware (entretien HORS COMBAT) —
 *  jumeau store-free de la branche NON-interactive de `resolveFlowTest` : jet du Test (`combatTestPenalty`
 *  comme un Test simple), puis branche `success`/`fail` jouée par `runSpellFlowLines` (mêmes ops). Un `test`
 *  ENFOUI (hors top-level) LÈVE — un tel cas exige la voie cadence-aware (jamais de branche succès muette). */
function resolveInlineFlowTest(c: Combatant, flow: Flow, ctx: OpsCtx): string[] {
  if (flow.kind !== 'test') throw new Error('resolveInlineFlowTest: nœud non-`test` (un test enfoui exige un routeur cadence-aware).');
  const ft = flow.test;
  // GATE (op-level immunité/groupes + Condition générique `gate`) + difficulté DYNAMIQUE (`difficultyBy`) :
  // SOURCE UNIQUE partagée avec la voie cascade (`resolveFlowTest`). Le `ConditionCtx` est construit de la
  // géométrie d'arène déjà injectée dans `ctx` par le dispatcher (Brisé : caché/Engagé/proximité). Gate
  // fermée ⇒ no-op (ni jet ni branche, comme `unlessImmune`/`onlyGroups` — un Test top-level n'a pas d'`after`).
  const cc = combatConditionCtx(c, ctx);
  if (flowTestGated(ft, c, cc)) return [];
  // `base` BRUT (sans pénalité d'État) + `combatTestPenalty` une SEULE fois (RAW : −10 d'Empoisonné/Sonné/
  // Brisé compté une fois, LDB 16) — MÊME convention que `simpleTriggeredTestStep` (héros) → récupération identique.
  const base = rawCombatTestBase(c, ft.skill, ft.characteristic, ft.spec);
  const difficulty: Difficulty = resolveTestDifficulty(ft, cc);
  const skillLabel = ft.skill ? refLabel('skills', { id: ft.skill, spec: ft.spec }) : (ft.characteristic ? CHAR_LABELS[ft.characteristic] : 'Test');
  const rng = ctx.rng ?? defaultRNG;
  const res = rollTest(base, difficulty, rng, combatTestPenalty(c));
  const branch = res.success ? flow.success : flow.fail;
  return [describeTestRoll(c.name, skillLabel, difficulty, res), ...runSpellFlowLines(c, c, branch, { ...ctx, rng, caster: c, sl: res.sl })];
}

/** Écart d'Avantage de `actor` avec ses adversaires ENGAGÉS : `max(0, meilleur Avantage ennemi engagé −
 *  le sien)` (Instable, LDB 85 l.177 : « la différence entre son Avantage et celui supérieur de son
 *  adversaire »). Hors combat / sans foe engagé = 0. Calculé sur la `battle` (valeur relationnelle). */
function engagedAdvantageGap(get: Get, actor: Combatant): number {
  const battle = get().battle;
  if (!battle) return 0;
  const foes = battle.combatants.filter((e) => e.kind !== actor.kind && !isOutOfAction(e) && isEngagedWith(e, actor.id));
  if (!foes.length) return 0;
  return Math.max(0, Math.max(...foes.map((e) => e.advantage ?? 0)) - (actor.advantage ?? 0));
}

/** AVANCE d'Avantage de `actor` sur TOUS ses adversaires ENGAGÉS : `son Avantage − le meilleur Avantage
 *  ennemi engagé`, SIGNÉE et non bornée (≠ `engagedAdvantageGap` qui clampe à ≥ 0 l'excès ENNEMI). `> 0` =
 *  Avantage STRICTEMENT supérieur à tous (Absorption « si la créature a un Avantage plus élevé que tous les
 *  adversaires engagés », EDO p.147). Hors combat / sans foe engagé = 0. Valeur RELATIONNELLE de l'arène. */
function engagedAdvantageLead(get: Get, actor: Combatant): number {
  const battle = get().battle;
  if (!battle) return 0;
  const foes = battle.combatants.filter((e) => e.kind !== actor.kind && !isOutOfAction(e) && isEngagedWith(e, actor.id));
  if (!foes.length) return 0;
  return (actor.advantage ?? 0) - Math.max(...foes.map((e) => e.advantage ?? 0));
}

/** Un adversaire VIVANT est-il dans la Ligne de Vue de `actor` ? Géométrie d'arène (au-dessus de
 *  `lineOfSightCover`, fumées/zones bloquantes incluses) alimentant la Condition `foeInLoS` : sortie de
 *  Frénésie (LDB 21 l.36), fuite/récupération du Brisé (LDB 16 l.55). Hors combat / sans position = false. */
export function hasFoeInLoS(get: Get, actor: Combatant): boolean {
  const { battle, scene } = get();
  if (!battle || !scene || !actor.pos) return false;
  return battle.combatants.some(
    (f) => f.kind !== actor.kind && !isOutOfAction(f) && f.pos && losClear(scene, actor.pos!, f.pos, smokeOf(battle)),
  );
}

/** Géométrie d'arène de RÉCUPÉRATION du Brisé (LDB 16 l.55-59) pour `actor`, alimentant les Conditions
 *  `hiddenFromFoes`/`engaged`/`nearestFoe` (auto-retrait caché, gate du Test, difficulté par proximité) :
 *  - `hiddenFromFoes` : AUCUN adversaire vivant ne voit l'acteur (sens foe→acteur, `tileSeenByFoe`) — « caché
 *    hors de vue de tout ennemi » (l.59). Faux s'il n'y a aucun adversaire (rien à fuir → pas de « caché »).
 *  - `engaged` : l'acteur est-il Engagé (l.57 : aucun Test si Engagé) ;
 *  - `nearestFoeDist` : distance (cases) à l'adversaire vivant le plus proche (l.58 : Très difficile si ≤3).
 *  RNG-free → identique côté inline (ennemi/auto) et côté cascade (héros). Hors combat / sans position = neutre. */
export function recoveryGeometry(get: Get, actor: Combatant): { hiddenFromFoes: boolean; engaged: boolean; nearestFoeDist: number } {
  const { battle, scene } = get();
  if (!battle || !actor.pos) return { hiddenFromFoes: false, engaged: false, nearestFoeDist: Infinity };
  const foes = battle.combatants.filter((e) => e.kind !== actor.kind && !isOutOfAction(e) && e.pos);
  const hiddenFromFoes = !!scene && foes.length > 0 && !tileSeenByFoe(scene, foes, actor.pos, smokeOf(battle));
  const nearestFoeDist = foes.length ? Math.min(...foes.map((e) => chebyshev(actor.pos!, e.pos!))) : Infinity;
  return { hiddenFromFoes, engaged: isEngaged(actor), nearestFoeDist };
}

/** CŒUR d'application : applique une LISTE d'effets `TriggeredEffect` de `actor` correspondant à
 *  `trigger`, chacun via `runSpellFlowLines` aux cibles résolues (`on`). Source UNIQUE : utilisé par
 *  `fireTriggers` (effets de traits/atouts) ET par les manœuvres (effets du profil de manœuvre).
 *  Un effet dont le Flow est un nœud `test` ET pour lequel `ctx.set` + le routeur sont fournis (hook
 *  `onGainCondition`) est ROUTÉ vers la voie cadence-aware (jamais la branche succès silencieuse). */
export function applyTriggeredEffects(
  get: Get, actor: Combatant, effects: TriggeredEffect[], trigger: EffectTrigger, ctx: TriggerCtx = {},
): string[] {
  const lines: string[] = [];
  const rng = ctx.rng ?? defaultRNG;
  // Valeur RELATIONNELLE de combat calculée UNE fois pour le porteur (battle-aware) : écart d'Avantage
  // avec ses adversaires Engagés (Instable, LDB 85 l.177). Voyage dans l'opsCtx → Formula/Condition.
  const gap = ctx.engagedAdvantageGap ?? engagedAdvantageGap(get, actor);
  const lead = ctx.engagedAdvantageLead ?? engagedAdvantageLead(get, actor);
  const foeInLoS = ctx.foeInLoS ?? hasFoeInLoS(get, actor);
  // Géométrie de récupération du Brisé (caché/Engagé/proximité) — battle-aware, calculée UNE fois pour le
  // porteur, et SEULEMENT à la frontière de Round (seul moment où un État la consomme : LDB 16 l.55-59),
  // pour ne pas peser sur les déclencheurs d'attaque. Neutre hors `onRoundEnd` (Conditions → false/+∞).
  const geom = trigger === 'onRoundEnd' ? recoveryGeometry(get, actor) : undefined;
  for (const eff of effects) {
    if (eff.trigger !== trigger) continue;
    // Filtre `onGainCondition` : ne réagit qu'à l'État effectivement gagné (Mâchoires → 'sonne').
    if (eff.condition && eff.condition !== ctx.conditionName) continue;
    // Filtre par TYPE d'attaque (onHit/onWoundLoss) : un effet `attackType` ne réagit qu'à ce type.
    if (eff.attackType && eff.attackType !== ctx.attackType) continue;
    for (const t of targetsFor(get, actor, eff.on, ctx.victim)) {
      // On n'applique pas un effet à une cible DÉJÀ hors de combat (pas d'éclaboussure sur un cadavre) —
      // SAUF le PORTEUR réagissant à SON PROPRE événement (`on:'self'`) : une unité doit pouvoir réagir à
      // sa propre chute (Démoniaque banni à 0 PB, futur « éclate/se dédouble à la mort »). Les déclencheurs
      // de FRONTIÈRE de round (`onRoundEnd`/`onRoundStart`) filtrent eux-mêmes les hors-combat côté appelant.
      if (isOutOfAction(t) && t.id !== actor.id) continue;
      // Flow PORTANT un nœud `test` (à n'importe quelle profondeur — top-level Mâchoires, ou enfoui sous
      // `if`/`seq` : Venin/Hurlement/2 enchants) routé vers la voie cadence-aware (héros manuel → cascade
      // influençable ; ennemi/auto → inline) plutôt qu'avalé silencieusement — seulement si l'appelant
      // fournit `set` + un routeur installé. Un Flow `test` non routé (pas de `set`) atteindrait
      // `runSpellFlowLines`, qui LÈVE (jamais de branche succès muette). Le contexte de la touche
      // (`woundsDealt`/`margin→sl`/`location`/`attackKind`) voyage dans l'opsCtx pour les Conditions `if`.
      const flowCtx: OpsCtx = { rng, caster: actor, sl: ctx.margin, woundsDealt: ctx.woundsDealt, indice: ctx.indice, stacks: ctx.stacks, engagedAdvantageGap: gap, engagedAdvantageLead: lead, foeInLoS, location: ctx.location, attackKind: ctx.attackKind, startleCause: ctx.startleCause, hiddenFromFoes: geom?.hiddenFromFoes, engaged: geom?.engaged, nearestFoeDist: geom?.nearestFoeDist };
      if (flowHasTest(eff.flow)) {
        // Test de FIN DE ROUND (`deferInteractiveTest`, posé par le hook `end-of-round` : la cascade n'est
        // pas encore ouverte) : un héros MANUEL est COLLECTÉ par `collectHeroRoundEndUpkeep` (on saute ici) ;
        // ennemi / héros auto → résolu INLINE (lignes RENDUES → sinkées dans le journal comme les dégâts).
        if (ctx.deferInteractiveTest) {
          if (roundTestInteractive(t)) continue;
          lines.push(...resolveInlineFlowTest(t, eff.flow, flowCtx));
          continue;
        }
        // Hors fin de Round : voie cadence-aware si un routeur est branché (onGainCondition / attaques →
        // cascade influençable pour un héros manuel, inline + file différée sinon) ; SANS routeur (entretien
        // HORS COMBAT) → INLINE. Jamais avalé. GÉNÉRIQUE : tout État à `onRoundEnd` test (Empoisonné…).
        if (ctx.set && testRouter) { testRouter(get, ctx.set, t, actor, eff.flow, flowCtx); continue; }
        lines.push(...resolveInlineFlowTest(t, eff.flow, flowCtx));
        continue;
      }
      lines.push(...runSpellFlowLines(t, actor, eff.flow, flowCtx));
    }
  }
  return lines;
}

/**
 * DISPATCHER UNIQUE des effets déclenchés de `actor` pour un `trigger` — SOURCE UNIQUE, sans code
 * spécifique par KIND d'entité ni par trigger. Réunit TOUTES les sources d'effets portées par le
 * combattant : Traits, Talents, Atouts d'arme (`effectsOf`) ET États (`fireConditionEffects`, qui
 * apporte le `stacks` de chaque État). Maladies/Mutations réagissent par COMPOSITION (elles octroient
 * un Trait/État, déjà couvert ici) — rien de neuf à câbler pour un nouveau type. Ajouter une source =
 * l'AJOUTER ICI, jamais un nouveau chemin de dispatch. (Effets propres à une MANŒUVRE = scoped à son
 * profil via `maneuverEffectsOf`.)
 */
export function fireTriggers(get: Get, actor: Combatant, trigger: EffectTrigger, ctx: TriggerCtx = {}): string[] {
  const lines = applyTriggeredEffects(get, actor, effectsOf(actor, ctx.weapon), trigger, ctx);
  lines.push(...fireConditionEffects(get, actor, trigger, ctx)); // États dispatchés EXACTEMENT comme Traits
  lines.push(...firePsychEffects(get, actor, trigger, ctx)); // états PSY (Frénésie…) — MÊME folding générique
  return lines;
}

/** CŒUR GÉNÉRIQUE du folding des STATUTS portés (`StatusData` : États OU psy) : applique les `effects` de
 *  chaque statut pour `trigger`, avec son nombre de pions (`stacks`). SOURCE UNIQUE — `fireConditionEffects`
 *  et `firePsychEffects` y délèguent (zéro copie du cœur `applyTriggeredEffects`). Le `[...snapshot]` côté
 *  appelant protège l'itération d'une auto-dissipation (`removeCondition`/`endPsych`) qui mute la collection. */
function fireStatusEffects(
  get: Get, c: Combatant, trigger: EffectTrigger, ctx: TriggerCtx,
  statuses: { effects?: TriggeredEffect[]; stacks: number }[],
): string[] {
  const lines: string[] = [];
  for (const s of statuses) {
    if (!s.effects?.length) continue;
    lines.push(...applyTriggeredEffects(get, c, s.effects, trigger, { ...ctx, stacks: s.stacks }));
  }
  return lines;
}

/**
 * Déclenche les `effects` data-driven des ÉTATS portés par `c` (Empoisonné « 1 PB/pion » via `onRoundEnd`…).
 * Chaque État est joué avec `ctx.stacks = ses pions`, RÉDUITS d'une capacité de la cible s'il le déclare
 * (Hémorragique − Endurci `bleedIgnore`, LDB 10 — générique, jamais par-nom). Inerte sans `effects`.
 */
export function fireConditionEffects(get: Get, c: Combatant, trigger: EffectTrigger, ctx: TriggerCtx = {}): string[] {
  return fireStatusEffects(get, c, trigger, ctx, effectSourcesOf(c).filter((s) => s.key.startsWith('cond:')).map((s) => ({ effects: s.effects, stacks: s.stacks ?? 1 })));
}

/**
 * Déclenche les `effects` data-driven des états PSYCHOLOGIQUES portés par `c` (Frénésie : sortie
 * `onTurnStart` → fin + Exténué, LDB 21 l.36). MÊME cœur que les États (`fireStatusEffects`) ; la donnée
 * vit dans `psychology.json`. Inerte tant que `psychState` ne porte aucun type doté d'`effects`.
 */
export function firePsychEffects(get: Get, c: Combatant, trigger: EffectTrigger, ctx: TriggerCtx = {}): string[] {
  return fireStatusEffects(get, c, trigger, ctx, effectSourcesOf(c).filter((s) => s.key.startsWith('psy:')).map((s) => ({ effects: s.effects, stacks: s.stacks ?? 1 })));
}

/** Effets onHit AUTHORÉS de la manœuvre `kind` portée par `actor` (Caudale → À Terre, Tentacules →
 *  Empêtré…) — lus de la MANŒUVRE octroyée (`TraitData.grantsManeuvers` → `findManeuverById`) dont la
 *  `def.kind` correspond. Vide si la créature n'a pas cette manœuvre. Sert le chemin de mêlée FREE
 *  (`freeKind` → arme + onHit) : la touche est résolue comme un coup d'arme, mais les États propres à
 *  la manœuvre (À Terre/Empêtré) viennent de SA donnée éditable. */
export function maneuverEffectsOf(actor: Combatant, kind: string): TriggeredEffect[] {
  for (const raw of actor.traits ?? []) {
    const td = traitById.get(raw.id);
    for (const ref of td?.grantsManeuvers ?? []) {
      const def = findManeuverById(ref.id);
      if (def?.kind === kind) return def.effects ?? [];
    }
  }
  return [];
}
