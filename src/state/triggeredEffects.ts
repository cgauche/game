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
import type { Combatant, Weapon, HitLocation } from '../engine/types';
import type { Get, Set as SetFn } from './flowTypes';
import { type EffectTrigger, type TriggeredEffect, type Flow, flowHasTest } from './flow';
import type { OpsCtx, GameOp } from '../engine/ops';
import { resolveQualities } from '../engine/qualities/dispatch';
import { featureLevel } from '../engine/combatFeatures/dispatch';
import type { CombatFeature } from '../engine/combatFeatures/types';
import { isOutOfAction } from '../engine/conditions';
import { isEngagedWith } from '../engine/engagement';
import { combatDistance } from './footprint';
import { traitById, qualityById, findManeuverById, findTalentById, findConditionById } from '../data';
import { difficultyFromLabel } from '../engine/tests';
import { runSpellFlowLines } from './combatEffects';
import { RNG, defaultRNG } from '../engine/dice';

/** PARAMÈTRE un effet de trait par l'ARGUMENT d'instance du porteur : substitue la difficulté d'un Test
 *  `argDifficulty` par celle dérivée de l'arg (« Venin (Difficile) » → difficile). Rend les effets
 *  authorés réutilisables et éditables tout en restant tunés par leur instance. Immuable (clone partiel). */
function withArg(effects: TriggeredEffect[], arg?: string): TriggeredEffect[] {
  if (!arg) return effects;
  const diff = difficultyFromLabel(arg);
  // Injection GÉNÉRIQUE de l'arg d'instance dans une op : tout champ valant le littéral `'$arg'` reçoit
  // l'arg (trait Maladie « (peste) » → `exposeDisease{disease:'$arg'}`). Une seule convention, pas de variante.
  const substOp = (op: GameOp): GameOp => {
    const o = op as Record<string, unknown>;
    if (!Object.values(o).includes('$arg')) return op;
    const out = { ...o };
    for (const k in out) if (out[k] === '$arg') out[k] = arg;
    return out as unknown as GameOp;
  };
  const visit = (f: Flow): Flow => {
    if (f.kind === 'seq') return { ...f, steps: f.steps.map(visit) };
    if (f.kind === 'if') return { ...f, then: visit(f.then), ...(f.else ? { else: visit(f.else) } : {}) };
    if (f.kind === 'test') {
      // Nœud Flow `test` dont la difficulté vient de l'arg d'instance (« Venin (Difficile) ») : on
      // substitue `test.difficulty` (mêmes sémantique/gate que l'ancienne op `test.argDifficulty`).
      const test = f.test.argDifficulty ? { ...f.test, difficulty: diff } : f.test;
      return { ...f, test, success: visit(f.success), fail: visit(f.fail) };
    }
    if (f.kind === 'do' && f.effect.type === 'ops') return { ...f, effect: { ...f.effect, ops: f.effect.ops.map(substOp) } };
    return f;
  };
  return effects.map((eff) => ({ ...eff, flow: visit(eff.flow) }));
}

/** Effets déclenchés portés par une créature (ses Traits) et, le cas échéant, par l'arme qui frappe :
 *  son ENCHANTEMENT replié (`weapon.onHitEffects` — Marteau ardent, Épée ardente…), ses Traits, ses
 *  Atouts. Source UNIQUE d'agrégation : les trois sont traités à l'identique (`TriggeredEffect`). Ordre
 *  FIGÉ (enchant → traits → atouts) pour un déroulé RNG déterministe quand plusieurs portent un Test. */
function effectsOf(actor: Combatant, weapon?: Weapon): TriggeredEffect[] {
  const out: TriggeredEffect[] = [];
  if (weapon?.onHitEffects) out.push(...weapon.onHitEffects);
  for (const raw of actor.traits ?? []) { const inst = raw; out.push(...withArg(traitById.get(inst.id)?.effects ?? [], inst.arg)); }
  if (weapon) for (const { id } of resolveQualities(weapon)) out.push(...(qualityById.get(id)?.effects ?? []));
  // Talents POSSÉDÉS portant des effets déclenchés (Assaut féroce onHit, Frappe réactive onCharged…) —
  // mêmes `TriggeredEffect` que les traits. Appendus en fin (ordre RNG existant enchant→traits→atouts préservé).
  for (const t of actor.talents ?? []) out.push(...(findTalentById(t.talentId)?.effects ?? []));
  return out;
}

/** Une SOURCE d'effets déclenchés du combattant, AVEC son identité (`key`) et son plafond (`cap`) —
 *  nécessaires aux ATTAQUES GRATUITES (imputation /Round par source ; plafond par source). */
export interface TriggerSource { effects: TriggeredEffect[]; cap: number; key: string; label: string; }

/** Énumère TOUTES les sources d'attaque gratuite du combattant — MÊME couverture que `effectsOf` (Atouts
 *  d'arme, Traits, Qualités, Talents) + les ÉTATS — chacune taguée `key`/`cap`/`label`. Permet à
 *  `resolveFreeAttacks` de jouer un `grantFreeAttack` quel que soit le KIND de la source (plus de chemin
 *  talent-only) : un Trait/État de créature qui riposte à la charge fonctionne comme le talent. */
export function freeAttackSourcesOf(actor: Combatant, weapon?: Weapon): TriggerSource[] {
  const out: TriggerSource[] = [];
  if (weapon?.onHitEffects?.length) out.push({ effects: weapon.onHitEffects, cap: 1, key: `weapon:${weapon.name}`, label: weapon.name });
  for (const tr of actor.traits ?? []) { const d = traitById.get(tr.id); if (d?.effects?.length) out.push({ effects: withArg(d.effects, tr.arg), cap: 1, key: `trait:${tr.id}`, label: d.label ?? tr.id }); }
  if (weapon) for (const { id } of resolveQualities(weapon)) { const d = qualityById.get(id); if (d?.effects?.length) out.push({ effects: d.effects, cap: 1, key: `qual:${id}`, label: d.label ?? id }); }
  for (const t of actor.talents ?? []) { const d = findTalentById(t.talentId); if (d?.effects?.length) out.push({ effects: d.effects, cap: t.times ?? 1, key: t.talentId, label: d.label ?? t.talentId }); }
  for (const cond of actor.conditions ?? []) { const d = findConditionById(cond.name); if (d?.effects?.length) out.push({ effects: d.effects, cap: 1, key: `cond:${cond.name}`, label: d.label ?? cond.name }); }
  return out;
}

/** Combattants visés par un effet selon `on` (le porteur, la victime touchée, ou TOUS ceux Engagés
 *  avec lui — Sang corrosif : « tous ceux qui sont Engagés avec elle », alliés compris). */
function targetsFor(get: Get, actor: Combatant, on: TriggeredEffect['on'], victim?: Combatant): Combatant[] {
  if (on === 'self') return [actor];
  if (on === 'victim') return victim ? [victim] : [];
  const battle = get().battle;
  if (!battle) return [];
  if (typeof on === 'object') { // GÉOMÉTRIE : tous les combattants à portée d'un centre (arc d'Azyr)
    const center = on.near === 'self' ? actor : victim;
    if (!center?.pos) return [];
    const radius = Math.max(1, Math.ceil(on.radiusMeters / 2)); // 1 case = 2 m
    return battle.combatants.filter((c) => c.id !== center.id && c.id !== actor.id && !isOutOfAction(c) && !!c.pos && combatDistance(center, c) <= radius);
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
  /** Localisation de la touche courante (dé inversé) — alimente la Condition Flow `location` (Assommante). */
  location?: HitLocation;
  /** KIND de l'attaque courante (`creatureAttackKind` : 'morsure'/'cornes'/…) — alimente la Condition Flow
   *  `attackKind` (Vampirique : Vol de vie sur Morsure seulement). */
  attackKind?: string;
  /** ID de l'État qui vient d'être GAGNÉ (déclencheur `onGainCondition`) — filtre les effets dont
   *  `condition` ne le matche pas (Mâchoires d'acier : `condition:'sonne'`). */
  conditionName?: string;
  /** `set` du store — fourni quand un Test de trigger peut être routé en cascade influençable (héros
   *  manuel) ou résolu inline (ennemi/auto). Câblé sur tous les `fireTriggers` de combat (onHit/
   *  onWoundLoss/onKill/onStartled/onRoundStart/Domaine + manœuvres) ; INERTE tant qu'aucune donnée de
   *  trigger ne porte un nœud Flow `test` au 1ᵉʳ niveau (seul Mâchoires d'acier en a un, `onGainCondition`,
   *  câblé via le hook du store). Absent → pas de routage (les flows non-`test` passent par
   *  `runSpellFlowLines`, qui rend le `string[]` tissé inline par l'appelant). */
  set?: SetFn }

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
  for (const eff of effects) {
    if (eff.trigger !== trigger) continue;
    // Filtre `onGainCondition` : ne réagit qu'à l'État effectivement gagné (Mâchoires → 'sonne').
    if (eff.condition && eff.condition !== ctx.conditionName) continue;
    for (const t of targetsFor(get, actor, eff.on, ctx.victim)) {
      if (isOutOfAction(t)) continue;
      // Flow PORTANT un nœud `test` (à n'importe quelle profondeur — top-level Mâchoires, ou enfoui sous
      // `if`/`seq` : Venin/Hurlement/2 enchants) routé vers la voie cadence-aware (héros manuel → cascade
      // influençable ; ennemi/auto → inline) plutôt qu'avalé silencieusement — seulement si l'appelant
      // fournit `set` + un routeur installé. Un Flow `test` non routé (pas de `set`) atteindrait
      // `runSpellFlowLines`, qui LÈVE (jamais de branche succès muette). Le contexte de la touche
      // (`woundsDealt`/`margin→sl`/`location`/`attackKind`) voyage dans l'opsCtx pour les Conditions `if`.
      if (flowHasTest(eff.flow) && ctx.set && testRouter) {
        testRouter(get, ctx.set, t, actor, eff.flow, { rng, caster: actor, sl: ctx.margin, woundsDealt: ctx.woundsDealt, indice: ctx.indice, stacks: ctx.stacks, location: ctx.location, attackKind: ctx.attackKind });
        continue;
      }
      lines.push(...runSpellFlowLines(t, actor, eff.flow, { rng, caster: actor, sl: ctx.margin, woundsDealt: ctx.woundsDealt, indice: ctx.indice, stacks: ctx.stacks, location: ctx.location, attackKind: ctx.attackKind }));
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
  return lines;
}

/**
 * Déclenche les `effects` data-driven des ÉTATS portés par `c` correspondant à `trigger` (Empoisonné
 * « 1 PB/pion » via `onRoundEnd`…). Chaque État est joué avec `ctx.stacks = son nombre de pions` → résout
 * les Formula `{stacks:'self'}`. SOURCE UNIQUE des effets d'État ; complète `fireTriggers` (traits/atouts/
 * talents), porteur d'effets distinct. Inerte tant qu'aucun État ne porte d'`effects`.
 */
export function fireConditionEffects(get: Get, c: Combatant, trigger: EffectTrigger, ctx: TriggerCtx = {}): string[] {
  const lines: string[] = [];
  // Snapshot : un effet `removeCondition` (auto-dissipation) mute `c.conditions` pendant l'itération.
  for (const cond of [...(c.conditions ?? [])]) {
    const data = findConditionById(cond.name);
    if (!data?.effects?.length) continue;
    // Pions vus par les effets, RÉDUITS d'une capacité de combat de la cible si l'État le déclare
    // (Hémorragique − Endurci `bleedIgnore`, LDB 10) — générique, jamais codé par-nom.
    const reduce = data.stacksReducedBy ? featureLevel(c, data.stacksReducedBy as keyof CombatFeature) : 0;
    const stacks = Math.max(0, (cond.value ?? 1) - reduce);
    lines.push(...applyTriggeredEffects(get, c, data.effects, trigger, { ...ctx, stacks }));
  }
  return lines;
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
