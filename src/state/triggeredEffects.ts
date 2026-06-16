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

/**
 * Déclenche les effets de `actor` (Traits + Atouts de `ctx.weapon`) correspondant à `trigger`. Pour
 * chaque effet, applique son Flow aux cibles résolues (`on`) via `runSpellFlow` (caster = le porteur).
 * Renvoie le journal. C'est l'équivalent « sur événement » d'un lancement de sort.
 */
export function fireTriggers(
  get: Get,
  actor: Combatant,
  trigger: EffectTrigger,
  ctx: { victim?: Combatant; weapon?: Weapon; rng?: RNG } = {},
): string[] {
  const lines: string[] = [];
  const rng = ctx.rng ?? defaultRNG;
  for (const eff of effectsOf(actor, ctx.weapon)) {
    if (eff.trigger !== trigger) continue;
    for (const t of targetsFor(get, actor, eff.on, ctx.victim)) {
      if (isOutOfAction(t)) continue;
      lines.push(...runSpellFlow(t, actor, eff.flow, { rng, caster: actor }));
    }
  }
  return lines;
}
