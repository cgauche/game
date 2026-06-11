/**
 * Zones persistantes de bataille (Jalon 2.6 L11) — généralisation de l'ancien `battle.smoke[]` :
 * une zone = des cases + un TTL en Rounds + des effets optionnels :
 *  - `blocksLoS`   : bloque la Ligne de Vue (fumée du Souffle (Fumée), RAW LDB 85) ;
 *  - `onCross`     : appliqué à quiconque TRAVERSE une case de la zone en se déplaçant
 *                    (Mur de feu, LDB 47 : « Quiconque traverse le mur de feu ») ;
 *  - `perRound`    : appliqué à quiconque est DANS la zone au franchissement de Round
 *                    (Grands feux d'U'Zhul, LDB 47 : « au début d'un Round »).
 * Le TTL est décrémenté à chaque frontière de Round (dissipation à 0) — même cadence que
 * l'ancienne fumée. La TÉLÉPORTATION ne « traverse » pas (apparition — exempte d'onCross).
 */
import type { Pt } from './path';
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';
import { Formula, resolveFormula } from '../engine/ops';
import { ZoneEffect, applyZoneEffect } from '../engine/zones';
import { isOutOfAction } from '../engine/conditions';

export interface BattleZone {
  label: string;
  tiles: Pt[];
  /** Rounds restants (décrément à la frontière de Round, dissipation à 0). */
  rounds: number;
  blocksLoS?: boolean;
  onCross?: ZoneEffect;
  perRound?: ZoneEffect;
  /** Référent des formules de l'effet (« votre BFM » = le lanceur) — résolu à l'application. */
  casterId?: string;
}

export const zoneCovers = (z: BattleZone, p: Pt): boolean => z.tiles.some((t) => t.x === p.x && t.y === p.y);

/** Cases bloquant la Ligne de Vue (toutes zones opaques confondues). */
export const losBlockingTiles = (zones: BattleZone[] | undefined): Pt[] =>
  (zones ?? []).filter((z) => z.blocksLoS).flatMap((z) => z.tiles);

/** Disque de Chebyshev (ZdE « rayon N mètres » — 1 case = 2 m, cohérent applyAreaAttack). */
export function discTiles(center: Pt, radiusTiles: number): Pt[] {
  const out: Pt[] = [];
  for (let dy = -radiusTiles; dy <= radiusTiles; dy++)
    for (let dx = -radiusTiles; dx <= radiusTiles; dx++) out.push({ x: center.x + dx, y: center.y + dy });
  return out;
}

/** Cases d'un MUR (Mur de feu, LDB 47 : « épais de 1 mètre ») : segment PERPENDICULAIRE à l'axe
 *  lanceur→centre, centré sur `center`, de `lengthTiles` cases (épaisseur 1 case). Lanceur sur
 *  le centre (axe nul) : mur horizontal par défaut. */
export function wallTiles(from: Pt, center: Pt, lengthTiles: number): Pt[] {
  const ax = Math.sign(center.x - from.x);
  const ay = Math.sign(center.y - from.y);
  const perp = ax === 0 && ay === 0 ? { x: 1, y: 0 } : { x: -ay, y: ax };
  const out: Pt[] = [];
  const back = Math.floor((lengthTiles - 1) / 2);
  const fwd = Math.ceil((lengthTiles - 1) / 2);
  for (let k = -back; k <= fwd; k++) out.push({ x: center.x + k * perp.x, y: center.y + k * perp.y });
  return out;
}

/** TTL : décrémente toutes les zones d'un Round, dissipe celles à 0. Retourne le journal. */
export function decayZones(zones: BattleZone[] | undefined): { zones: BattleZone[]; log: string[] } {
  const next = (zones ?? []).map((z) => ({ ...z, rounds: z.rounds - 1 }));
  const log = next.filter((z) => z.rounds <= 0).map((z) => `${z.label} se dissipe.`);
  return { zones: next.filter((z) => z.rounds > 0), log };
}

/** Traversée : applique l'`onCross` de chaque zone dont une case du CHEMIN fait partie —
 *  UNE application par zone et par déplacement (« quiconque traverse le mur »). */
export function crossZones(
  zones: BattleZone[] | undefined,
  mover: Combatant,
  path: Pt[],
  resolveCaster: (id?: string) => Combatant | undefined,
  rng: RNG,
): string[] {
  const lines: string[] = [];
  if (mover.dead || isOutOfAction(mover)) return lines;
  for (const z of zones ?? []) {
    if (!z.onCross) continue;
    if (!path.some((p) => zoneCovers(z, p))) continue;
    lines.push(`${mover.name} traverse ${z.label} !`);
    lines.push(...applyZoneEffect(mover, z.label, z.onCross, resolveCaster(z.casterId), rng));
  }
  return lines;
}

/** Franchissement de Round : applique le `perRound` de chaque zone à chaque combattant DANS la
 *  zone (« Quiconque se trouve dans la Zone d'Effet au début d'un Round »). Chaque ligne porte
 *  son COMBATTANT — l'entretien de Round partitionne héros (modale) / ennemis (journal seul). */
export function zonesRoundTick(
  zones: BattleZone[] | undefined,
  combatants: Combatant[],
  rng: RNG,
): { line: string; combatant: Combatant }[] {
  const out: { line: string; combatant: Combatant }[] = [];
  for (const z of zones ?? []) {
    if (!z.perRound) continue;
    const caster = z.casterId ? combatants.find((c) => c.id === z.casterId) : undefined;
    for (const c of combatants) {
      if (!c.pos || c.dead || isOutOfAction(c)) continue;
      if (!zoneCovers(z, c.pos)) continue;
      for (const line of applyZoneEffect(c, z.label, z.perRound, caster, rng)) out.push({ line, combatant: c });
    }
  }
  return out;
}

/** Résout une formule de longueur/rayon en MÈTRES vers des cases (1 case = 2 m, min 1). */
export function metersToTiles(meters: number): number {
  return Math.max(1, Math.ceil(meters / 2));
}

/** Longueur d'un mur en mètres : base + extension « +X m par +N DR » (Mur de feu, LDB 47). */
export function resolveZoneMeters(
  base: Formula,
  perSL: { every: number; metersFormula: Formula } | undefined,
  ref: Combatant,
  sl: number,
  rng: RNG,
): number {
  let m = Math.max(0, resolveFormula(base, ref, rng));
  if (perSL) m += Math.floor(Math.max(0, sl) / Math.max(1, perSL.every)) * Math.max(0, resolveFormula(perSL.metersFormula, ref, rng));
  return m;
}
