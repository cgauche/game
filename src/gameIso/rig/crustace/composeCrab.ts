/**
 * Gabarit CRUSTACÉ (crabe/homard géant : Léviathan, Il Potente Granchio, Trégara — ZI). Vue 3/4
 * dessus : carapace bombée BASSE et LARGE au centre, 4 pattes articulées rayonnant de chaque côté,
 * DEUX grosses pinces frontales (chélae) ouvrantes = arme signature, yeux pédonculés + mandibules.
 * Anim propre au plan : léger balancement au repos, scuttle latéral à la marche, pinces qui claquent
 * vers l'avant à l'attaque, carapace retournée à la mort. Réutilise la machinerie (FK générique,
 * palette tokenisée, rendu) — comme composeSpider, dont c'est le pendant à pinces.
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { CRAB_SPECIES } from '../creatures';

export type CrabBoneId = 'corps' | 'pinceG' | 'pinceD';
type CBone = FKBone & { z: number };
export interface CrabProps {
  sl: number; // échelle token
  girth: number; // largeur/bombé de la carapace
  stored: StoredPalette; // carapace (corps/corpsO/corpsH) ; cuir = articulations/pinces internes
}

function buildSkeleton(): Record<CrabBoneId, CBone> {
  return {
    corps: { parent: null, pivot: { x: 60, y: 84 }, angle: 0, z: 3 }, // carapace + pattes + face
    pinceG: { parent: 'corps', pivot: { x: -15, y: 9 }, angle: 0, z: 4 }, // grosse pince avant-gauche
    pinceD: { parent: 'corps', pivot: { x: 15, y: 9 }, angle: 0, z: 4 },
  };
}

// patte marcheuse arquée d'un côté (sx=±1) : coxa au flanc → genou haut anguleux → dactyle au sol.
function leg(sx: number, ay: number, kneeX: number, footX: number, footY: number, dx = 0): string {
  const kx = sx * kneeX + dx, fx = sx * footX + dx * 1.5;
  const ky = ay - 11;
  const d = `M${sx * 9} ${ay} Q${(sx * 9 + (kx - sx * 9) * 0.7).toFixed(1)} ${(ay - 9).toFixed(1)} ${kx.toFixed(1)} ${ky} Q${(kx + (fx - kx) * 0.35).toFixed(1)} ${(ky + (footY - ky) * 0.5).toFixed(1)} ${fx.toFixed(1)} ${footY}`;
  return `<path d="${d}" fill="none" stroke="@corps" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="@corpsO" stroke-width="1" opacity="0.45" stroke-linecap="round"/>` +
    `<circle cx="${kx.toFixed(1)}" cy="${ky}" r="1.7" fill="@corps" stroke="@corpsO" stroke-width="0.4"/>` + // genou
    `<path d="M${(fx - sx).toFixed(1)} ${(footY - 2).toFixed(1)} L${fx.toFixed(1)} ${(footY + 2).toFixed(1)} L${(fx + sx).toFixed(1)} ${(footY - 2).toFixed(1)}" fill="none" stroke="@corpsO" stroke-width="1.3" stroke-linecap="round"/>`; // dactyle pointu
}
const LEGS = [
  { ay: -8, kneeX: 24, footX: 30, footY: -2 },
  { ay: -3, kneeX: 27, footX: 35, footY: 8 },
  { ay: 2, kneeX: 27, footX: 35, footY: 18 },
  { ay: 7, kneeX: 24, footX: 30, footY: 28 },
];

/** Grosse pince (chéla) dessinée au repère de son os (épaule au coin avant du corps) : bras épais +
 *  main (propodus) en « C » béant vers l'avant (doigt fixe bas + doigt mobile haut, interstice net). */
function claw(sx: number): string {
  const hx = sx * 8, hy = 14;
  const arm = `<path d="M0 -4 Q${sx * 4} 2 ${sx * 6} 8" fill="none" stroke="@corps" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="M0 -4 Q${sx * 4} 2 ${sx * 6} 8" fill="none" stroke="@corpsO" stroke-width="1.2" opacity="0.4" stroke-linecap="round"/>`;
  // pince ouverte = un seul tracé avec une ENCOCHE (le gap entre les deux doigts), pointant vers +y
  const hand = `<path d="M${hx} ${hy - 9} Q${hx + sx * 10} ${hy - 8} ${hx + sx * 11} ${hy + 1} Q${hx + sx * 11} ${hy + 10} ${hx + sx * 4} ${hy + 13} L${hx + sx * 6} ${hy + 5} L${hx + sx * 1} ${hy + 4} L${hx + sx * 4} ${hy} Q${hx - sx * 2} ${hy - 6} ${hx} ${hy - 9} Z" fill="@corps" stroke="@corpsO" stroke-width="0.9" stroke-linejoin="round"/>`;
  const hi = `<ellipse cx="${hx + sx * 5}" cy="${hy - 2}" rx="3.2" ry="5" fill="@corpsH" opacity="0.3"/>`;
  const serr = `<path d="M${hx + sx * 5} ${hy + 4.5} l${sx * 1.5} 0.6 m${-sx * 1.5} 1.4 l${sx * 1.5} 0.6" stroke="@corpsO" stroke-width="0.6" fill="none" opacity="0.7"/>`; // dents internes
  return `<g>${arm}${hand}${hi}${serr}</g>`;
}

function carapace(p: CrabProps, view: View): string {
  const g = p.girth, rx = 21 * g, ry = 12.5 * g;
  const prof = view === 'profile';
  const legs = LEGS.map((l, i) => {
    const bias = prof ? (i < 2 ? 7 : -7) : 0;
    return leg(1, l.ay, l.kneeX, l.footX, l.footY, bias) + leg(-1, l.ay, l.kneeX * (prof ? 0.82 : 1), l.footX * (prof ? 0.8 : 1), l.footY, bias);
  }).join('');
  // carapace large bombée, bord avant (+y) légèrement débordant, denté aux angles
  const shell = `<path d="M${-rx} 0 Q${-rx} ${-ry} ${-rx * 0.5} ${-ry * 1.04} Q0 ${-ry * 1.16} ${rx * 0.5} ${-ry * 1.04} Q${rx} ${-ry} ${rx} 0 Q${rx} ${ry * 0.95} ${rx * 0.52} ${ry * 1.04} Q0 ${ry * 1.12} ${-rx * 0.52} ${ry * 1.04} Q${-rx} ${ry * 0.95} ${-rx} 0 Z" fill="@corps" stroke="@corpsO" stroke-width="1.1"/>`;
  const hi = `<ellipse cx="-4" cy="-3" rx="${(rx * 0.46).toFixed(1)}" ry="${(ry * 0.46).toFixed(1)}" fill="@corpsH" opacity="0.26"/>`;
  const ridges = `<path d="M${-rx * 0.7} ${ry * 0.45} Q0 ${ry * 0.72} ${rx * 0.7} ${ry * 0.45}" fill="none" stroke="@corpsO" stroke-width="0.9" opacity="0.5"/>` +
    `<circle cx="${-rx * 0.55}" cy="-2" r="2" fill="@corpsO" opacity="0.32"/><circle cx="${rx * 0.55}" cy="-2" r="2" fill="@corpsO" opacity="0.32"/><circle cx="0" cy="${-ry * 0.5}" r="1.6" fill="@corpsO" opacity="0.3"/>`;
  // bord denté avant (épines de carapace)
  const teeth = view === 'back' ? '' : `<path d="M${-rx * 0.55} ${ry} l-2 3 M${-rx * 0.2} ${ry * 1.05} l-1 3 M${rx * 0.2} ${ry * 1.05} l1 3 M${rx * 0.55} ${ry} l2 3" stroke="@corpsO" stroke-width="1.1" stroke-linecap="round"/>`;
  // yeux pédonculés + mandibules (front = +y) ; de dos : rien
  let face = '';
  if (view !== 'back') {
    const ex = prof ? 3 : 5;
    face = `<line x1="${-ex}" y1="${ry * 0.8}" x2="${-ex - 1}" y2="${ry + 5}" stroke="@corps" stroke-width="2.2" stroke-linecap="round"/>` +
      `<line x1="${ex}" y1="${ry * 0.8}" x2="${ex + 1}" y2="${ry + 5}" stroke="@corps" stroke-width="2.2" stroke-linecap="round"/>` +
      `<circle cx="${-ex - 1}" cy="${ry + 6}" r="2.4" fill="#1a0e08"/><circle cx="${ex + 1}" cy="${ry + 6}" r="2.4" fill="#1a0e08"/>` +
      `<circle cx="${-ex - 1.6}" cy="${ry + 5.4}" r="0.8" fill="#d8c8a0"/><circle cx="${ex + 0.4}" cy="${ry + 5.4}" r="0.8" fill="#d8c8a0"/>` +
      `<path d="M-3 ${ry + 2} q3 3 6 0" fill="none" stroke="@corpsO" stroke-width="1" opacity="0.7"/>`; // mandibules
  }
  return `<g>${legs}${shell}${hi}${ridges}${teeth}${face}</g>`;
}

// --- poses (DELTA additif sur les angles d'os) ----------------------------
export const CRAB_REST: Record<string, number> = {};
/** Repos : léger balancement de la carapace + frémissement des pinces. phase ∈ [0,1). */
export function crabIdle(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { corps: s * 2, pinceG: s * 5, pinceD: -s * 5 };
}
/** Scuttle latéral : balancement ample de la carapace. phase ∈ [0,1). */
export function crabScuttle(phase: number): Record<string, number> {
  return { corps: Math.sin(phase * Math.PI * 2) * 7 };
}
/** Attaque : les deux pinces se projettent/claquent vers l'avant. phase ∈ [0,1]. */
export function crabSnap(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { pinceG: k * 26, pinceD: -k * 26, corps: k * 5 };
}
/** Mort : carapace retournée (sur le dos), pattes en l'air. */
export const CRAB_DEATH: Record<string, number> = { corps: 176 };

export function resolveCrabFromProps(
  p: CrabProps,
  view: View = 'front',
  pose: Record<string, number> = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<CrabBoneId, Matrix>;
  const tmap = buildTokenMap(p.stored, colors ?? {});
  const art: Record<CrabBoneId, string> = { corps: carapace(p, view), pinceG: claw(-1), pinceD: claw(1) };
  return (Object.keys(sk) as CrabBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    }))
    .sort((a, b) => a.z - b.z);
}

export const CRAB_DEFAULT: CrabProps = {
  sl: 1.0, girth: 1.0,
  stored: { corps: '#9a4a36', corpsO: '#5a261a', corpsH: '#d08660', cheveux: '#5a261a', cheveuxO: '#34140d', cuir: '#caa890' },
};

export function resolveCrab(species: string, view: View = 'front', pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  return resolveCrabFromProps(CRAB_SPECIES[species] ?? CRAB_DEFAULT, view, pose, colors);
}

export const crustacePlan: BodyPlan = {
  id: 'crustace',
  resolve: (sp, view, pose, opts) => resolveCrab(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(CRAB_SPECIES),
  restPose: () => CRAB_REST,
  idlePose: (phase) => crabIdle(phase),
  walkPose: crabScuttle,
  attackPose: crabSnap,
  deathPose: () => CRAB_DEATH,
  hasView: () => true,
};

export function crabSvg(p: CrabProps, view: View, opts: { dead?: boolean; idlePhase?: number; colors?: Palette } = {}): string {
  const pose = opts.dead ? CRAB_DEATH : opts.idlePhase != null ? crabIdle(opts.idlePhase) : {};
  return bonesToSvg(resolveCrabFromProps(p, view, pose, opts.colors));
}
