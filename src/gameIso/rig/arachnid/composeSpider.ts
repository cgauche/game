/**
 * Gabarit ARACHNIDE (araignée géante). Vue de dessus-3/4 : gros abdomen à l'arrière (qui PULSE),
 * céphalothorax devant avec yeux + chélicères, 8 pattes arquées rayonnant de part et d'autre.
 * Anim propre au plan : pulsation de l'abdomen + frémissement au repos, ruée à l'attaque, pattes
 * recroquevillées à la mort. Réutilise la machinerie (FK générique, palette tokenisée, rendu).
 */
import type { ResolvedBone } from '../composeRig';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';

export type SpiderBoneId = 'corps' | 'abdomen';
type SBone = FKBone & { z: number };
export interface SpiderProps {
  sl: number; // échelle token
  girth: number; // grosseur de l'abdomen
  stored: StoredPalette; // robe (corps/corpsO/corpsH…)
}

function buildSkeleton(): Record<SpiderBoneId, SBone> {
  return {
    corps: { parent: null, pivot: { x: 60, y: 96 }, angle: 0, z: 3 }, // céphalothorax + pattes + face
    abdomen: { parent: 'corps', pivot: { x: 0, y: -15 }, angle: 0, z: 2 }, // gros bulbe arrière (derrière)
  };
}

// une patte arquée (genou relevé) d'un côté (sx=±1) : coxa au corps → genou haut → pied au sol
function leg(sx: number, ay: number, kneeX: number, footX: number, footY: number): string {
  const d = `M${sx * 9} ${ay} Q${sx * kneeX} ${ay - 13} ${sx * footX} ${footY}`;
  return `<path d="${d}" fill="none" stroke="@corps" stroke-width="3.1" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="@corpsO" stroke-width="0.9" opacity="0.45" stroke-linecap="round"/>` +
    `<circle cx="${sx * footX}" cy="${footY}" r="1.1" fill="@corpsO"/>`;
}
const LEGS = [
  { ay: -8, kneeX: 24, footX: 23, footY: 16 },
  { ay: -3, kneeX: 31, footX: 31, footY: 27 },
  { ay: 3, kneeX: 31, footX: 31, footY: 38 },
  { ay: 8, kneeX: 25, footX: 21, footY: 48 },
];
function cephalo(view: View): string {
  const legs = LEGS.map((l) => leg(1, l.ay, l.kneeX, l.footX, l.footY) + leg(-1, l.ay, l.kneeX, l.footX, l.footY)).join('');
  const face = view === 'back'
    ? '' // de dos : pas d'yeux/chélicères (on voit la nuque)
    : `<g>` + // yeux (grappe de 8, AMR rougeoyants) + chélicères à crochets
      `<circle cx="-3.4" cy="9" r="1.5" fill="#9a1818"/><circle cx="3.4" cy="9" r="1.5" fill="#9a1818"/>` +
      `<circle cx="-1.4" cy="11" r="1" fill="#b83030"/><circle cx="1.4" cy="11" r="1" fill="#b83030"/>` +
      `<circle cx="-4.6" cy="11.4" r="0.8" fill="#7a1010"/><circle cx="4.6" cy="11.4" r="0.8" fill="#7a1010"/>` +
      `<circle cx="-2.4" cy="13" r="0.7" fill="#7a1010"/><circle cx="2.4" cy="13" r="0.7" fill="#7a1010"/>` +
      `<path d="M-3 14 Q-4 18 -2 20 M3 14 Q4 18 2 20" fill="none" stroke="@corpsO" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M-2 19.6 l-0.6 2.2 M2 19.6 l0.6 2.2" stroke="#e8e0c8" stroke-width="0.8" stroke-linecap="round"/></g>`;
  return `<g>${legs}` +
    `<ellipse cx="0" cy="3" rx="11" ry="13" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<ellipse cx="0" cy="0" rx="7" ry="8" fill="@corpsH" opacity="0.3"/>` +
    face + `</g>`;
}
function abdomen(p: SpiderProps, view: View): string {
  const g = p.girth, rx = 15 * g, ry = 17 * g;
  const mark = view === 'back'
    ? `<path d="M0 ${-ry + 4} L0 ${ry - 4}" stroke="@corpsO" stroke-width="1.2" opacity="0.6"/>` // sillon dorsal
    : `<path d="M0 ${-8} l-3 5 l3 4 l-3 5 M0 -8 l3 5 l-3 4 l3 5" stroke="@corpsH" stroke-width="1.2" fill="none" opacity="0.6"/>`; // chevrons pâles (sablier)
  return `<g>` +
    `<ellipse cx="0" cy="0" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<ellipse cx="-3" cy="-4" rx="${(rx * 0.5).toFixed(1)}" ry="${(ry * 0.5).toFixed(1)}" fill="@corpsH" opacity="0.28"/>` +
    mark +
    // pilosité (petits poils dressés sur le pourtour)
    `<path d="M${-rx + 1} -2 l-2 -1 M${rx - 1} -2 l2 -1 M-6 ${-ry + 1} l-1 -2 M6 ${-ry + 1} l1 -2 M0 ${-ry} l0 -2.4" stroke="@corpsO" stroke-width="0.7" stroke-linecap="round"/>` +
    `</g>`;
}

// --- poses (DELTA additif) ------------------------------------------------
export const SPIDER_REST: Record<string, number> = {};
/** Frémissement au repos : l'abdomen pulse (léger balancement). phase ∈ [0,1). */
export function spiderIdle(phase: number): Record<string, number> {
  return { abdomen: Math.sin(phase * Math.PI * 2) * 4 };
}
/** Ruée : le corps se penche en avant, l'abdomen se relève. phase ∈ [0,1]. */
export function spiderRush(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { corps: k * 10, abdomen: -k * 8 };
}
/** Mort : sur le dos (corps basculé), pattes en l'air. */
export const SPIDER_DEATH: Record<string, number> = { corps: 168 };

export function resolveSpiderFromProps(
  p: SpiderProps,
  view: View = 'front',
  pose: Record<string, number> = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<SpiderBoneId, Matrix>;
  const tmap = buildTokenMap(p.stored, colors ?? {});
  const art: Record<SpiderBoneId, string> = { corps: cephalo(view), abdomen: abdomen(p, view) };
  return (Object.keys(sk) as SpiderBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    }))
    .sort((a, b) => a.z - b.z);
}

export const SPIDER_DEFAULT: SpiderProps = {
  sl: 1.0, girth: 1.0,
  stored: { corps: '#2e2622', corpsO: '#181210', corpsH: '#574438', cheveux: '#181210', cheveuxO: '#0e0a08', cuir: '#7a1010' },
};

export function spiderSvg(
  p: SpiderProps,
  view: View,
  opts: { dead?: boolean; idlePhase?: number; colors?: Palette } = {},
): string {
  const pose = opts.dead ? SPIDER_DEATH : opts.idlePhase != null ? spiderIdle(opts.idlePhase) : {};
  return bonesToSvg(resolveSpiderFromProps(p, view, pose, opts.colors));
}
