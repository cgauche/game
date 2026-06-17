/**
 * Effets DÉCLENCHÉS authorés (`TriggeredEffect`) — le pendant « sur événement » des sorts (« au
 * lancement »). GÉNÉRIQUE : un même dispatcher applique les effets portés par les TRAITS de la créature
 * (`TraitData.effects` — Toile, Sang corrosif…) ET par les ATOUTS de son arme (`QualityData.effects` —
 * un Atout « à la touche : 1d10 + Empêtré »). Il REMPLACE les handlers en dur dispersés.
 *
 * Réutilise `runSpellFlow` (le MÊME exécuteur que les sorts → vocabulaire d'ops partagé, zéro
 * duplication). Pur côté effets (ops via applyOps) ; mute les combattants en place et renvoie le
 * journal. Le référent des formules « (X) » est le PORTEUR (`caster` = la créature qui frappe) — donc
 * « Force de la source » = sa Force.
 */
import type { Combatant, Weapon, HitLocation } from '../engine/types';
import type { Get } from './flowTypes';
import type { EffectTrigger, TriggeredEffect, Flow } from './flow';
import type { GameOp } from '../engine/ops';
import { resolveQualities } from '../engine/qualities/dispatch';
import { isOutOfAction } from '../engine/conditions';
import { isEngagedWith } from '../engine/engagement';
import { combatDistance } from './footprint';
import { traitById, qualityByLabel, findManeuverById } from '../data';
import { activeEnchantsFor } from '../engine/weaponDamage';
import { difficultyFromLabel } from '../engine/tests';
import { runSpellFlow } from './combatEffects';
import { RNG, defaultRNG } from '../engine/dice';

/** PARAMÈTRE un effet de trait par l'ARGUMENT d'instance du porteur : substitue la difficulté d'un Test
 *  `argDifficulty` par celle dérivée de l'arg (« Venin (Difficile) » → difficile). Rend les effets
 *  authorés réutilisables et éditables tout en restant tunés par leur instance. Immuable (clone partiel). */
function withArg(effects: TriggeredEffect[], arg?: string): TriggeredEffect[] {
  if (!arg) return effects;
  const diff = difficultyFromLabel(arg);
  const visit = (f: Flow): Flow => {
    if (f.kind === 'do' && f.effect.type === 'ops') {
      let touched = false;
      const ops = f.effect.ops.map((o: GameOp) => (o.op === 'test' && o.argDifficulty ? (touched = true, { ...o, difficulty: diff }) : o));
      return touched ? { ...f, effect: { ...f.effect, ops } } : f;
    }
    if (f.kind === 'seq') return { ...f, steps: f.steps.map(visit) };
    if (f.kind === 'if') return { ...f, then: visit(f.then), ...(f.else ? { else: visit(f.else) } : {}) };
    if (f.kind === 'test') return { ...f, success: visit(f.success), fail: visit(f.fail) };
    return f;
  };
  return effects.map((eff) => ({ ...eff, flow: visit(eff.flow) }));
}

/** Effets déclenchés portés par une créature (ses Traits) et, le cas échéant, par l'arme qui frappe :
 *  ses ENCHANTEMENTS actifs applicables (Marteau ardent, Épée de justice…), ses Traits, ses Atouts.
 *  Source UNIQUE d'agrégation : les trois sont traités à l'identique (`TriggeredEffect`). Ordre FIGÉ
 *  (enchants → traits → atouts) pour un déroulé RNG déterministe quand plusieurs portent un Test. */
function effectsOf(actor: Combatant, weapon?: Weapon): TriggeredEffect[] {
  const out: TriggeredEffect[] = [];
  if (weapon) for (const e of activeEnchantsFor(actor, weapon)) out.push(...(e.onHitEffects ?? []));
  for (const raw of actor.traits ?? []) { const inst = raw; out.push(...withArg(traitById.get(inst.id)?.effects ?? [], inst.arg)); }
  if (weapon) for (const { def } of resolveQualities(weapon)) out.push(...(qualityByLabel.get(def.key)?.effects ?? []));
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
  /** Localisation de la touche courante (dé inversé) — alimente la Condition Flow `location` (Assommante). */
  location?: HitLocation }

/** CŒUR d'application : applique une LISTE d'effets `TriggeredEffect` de `actor` correspondant à
 *  `trigger`, chacun via `runSpellFlow` aux cibles résolues (`on`). Source UNIQUE : utilisé par
 *  `fireTriggers` (effets de traits/atouts) ET par les manœuvres (effets du profil de manœuvre). */
export function applyTriggeredEffects(
  get: Get, actor: Combatant, effects: TriggeredEffect[], trigger: EffectTrigger, ctx: TriggerCtx = {},
): string[] {
  const lines: string[] = [];
  const rng = ctx.rng ?? defaultRNG;
  for (const eff of effects) {
    if (eff.trigger !== trigger) continue;
    for (const t of targetsFor(get, actor, eff.on, ctx.victim)) {
      if (isOutOfAction(t)) continue;
      lines.push(...runSpellFlow(t, actor, eff.flow, { rng, caster: actor, sl: ctx.margin, woundsDealt: ctx.woundsDealt, indice: ctx.indice, location: ctx.location }));
    }
  }
  return lines;
}

/**
 * Déclenche les effets de `actor` (Traits + Atouts de `ctx.weapon`) correspondant à `trigger` — pour
 * TOUTE attaque/événement. (Les effets propres à une MANŒUVRE précise vivent sur son profil et sont
 * appliqués par `applyTriggeredEffects(maneuverEffectsOf(...))`, scoped à la manœuvre.)
 */
export function fireTriggers(get: Get, actor: Combatant, trigger: EffectTrigger, ctx: TriggerCtx = {}): string[] {
  return applyTriggeredEffects(get, actor, effectsOf(actor, ctx.weapon), trigger, ctx);
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
