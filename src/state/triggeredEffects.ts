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
import type { Combatant, Weapon } from '../engine/types';
import type { Get } from './flowTypes';
import type { EffectTrigger, TriggeredEffect } from './flow';
import { asTrait } from '../engine/traits/dispatch';
import { resolveQualities } from '../engine/qualities/dispatch';
import { isOutOfAction } from '../engine/conditions';
import { isEngagedWith } from '../engine/engagement';
import { traitByLabel, qualityByLabel } from '../data';
import { runSpellFlow } from './combatEffects';
import { RNG, defaultRNG } from '../engine/dice';

/** Effets déclenchés portés par une créature (ses Traits) et, le cas échéant, par l'arme qui frappe
 *  (ses Atouts). Source UNIQUE d'agrégation : Trait et Atout sont traités à l'identique. */
function effectsOf(actor: Combatant, weapon?: Weapon): TriggeredEffect[] {
  const out: TriggeredEffect[] = [];
  for (const raw of actor.traits ?? []) out.push(...(traitByLabel.get(asTrait(raw).key)?.effects ?? []));
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
  return battle.combatants.filter((c) => c.id !== actor.id && isEngagedWith(c, actor.id));
}

/** Contexte d'application d'effets déclenchés. `margin` (marge d'un Test opposé) alimente les échelles
 *  `valuePerSL` via `ctx.sl` ; `woundsDealt` alimente le Vol de vie (op `lifeSteal`). */
export interface TriggerCtx { victim?: Combatant; weapon?: Weapon; rng?: RNG; margin?: number; woundsDealt?: number;
  /** Indice de l'attaque naturelle d'une MANŒUVRE — alimente les Formula `{indiceOf}` (Dégâts en GameOp). */
  indice?: number }

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
      lines.push(...runSpellFlow(t, actor, eff.flow, { rng, caster: actor, sl: ctx.margin, woundsDealt: ctx.woundsDealt, indice: ctx.indice }));
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
 *  Empêtré…) — lus du profil `TraitData.maneuver.effects`. Vide si la créature n'a pas cette manœuvre. */
export function maneuverEffectsOf(actor: Combatant, kind: string): TriggeredEffect[] {
  for (const raw of actor.traits ?? []) {
    const td = traitByLabel.get(asTrait(raw).key);
    if (td?.maneuver?.kind === kind) return td.maneuver.effects ?? [];
  }
  return [];
}
