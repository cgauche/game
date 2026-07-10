/**
 * Gabarit ARACHNIDE (araignée géante). Vue de dessus-3/4 : gros abdomen à l'arrière (qui PULSE),
 * céphalothorax devant avec yeux + chélicères, 8 pattes arquées rayonnant de part et d'autre.
 * Anim propre au plan : pulsation de l'abdomen + frémissement au repos, ruée à l'attaque, pattes
 * recroquevillées à la mort. Réutilise la machinerie (FK générique, palette tokenisée, rendu).
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { SPIDER_SPECIES } from '../creatures';
import { sortByZ } from '../composite';

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

// une patte ARTICULÉE d'un côté (sx=±1) : coxa au corps → GENOU HAUT marqué (pli anguleux,
// fini la courbe molle « méduse ») → tibia qui plonge au pied. dx = biais directionnel (profil).
function leg(sx: number, ay: number, kneeX: number, footX: number, footY: number, dx = 0): string {
  const kx = sx * kneeX + dx, fx = sx * footX + dx * 1.6;
  const ky = ay - 15;
  const d = `M${sx * 9} ${ay} Q${(sx * 9 + (kx - sx * 9) * 0.7).toFixed(1)} ${ay - 12} ${kx.toFixed(1)} ${ky} Q${(kx + (fx - kx) * 0.3).toFixed(1)} ${(ky + (footY - ky) * 0.55).toFixed(1)} ${fx.toFixed(1)} ${footY}`;
  return `<path d="${d}" fill="none" stroke="@corps" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="@corpsO" stroke-width="0.9" opacity="0.45" stroke-linecap="round"/>` +
    `<circle cx="${kx.toFixed(1)}" cy="${ky}" r="1.7" fill="@corps" stroke="@corpsO" stroke-width="0.4"/>` + // genou
    `<circle cx="${fx.toFixed(1)}" cy="${footY}" r="1.1" fill="@corpsO"/>`;
}
const LEGS = [
  { ay: -8, kneeX: 24, footX: 23, footY: 16 },
  { ay: -3, kneeX: 31, footX: 31, footY: 27 },
  { ay: 3, kneeX: 31, footX: 31, footY: 38 },
  { ay: 8, kneeX: 25, footX: 21, footY: 48 },
];
function cephalo(view: View): string {
  // PROFIL : sprawl DIRECTIONNEL (les paires avant tendues vers +x, les arrière en arrière)
  // + face décalée vers l'avant — la roue radiale identique à la face tuait l'orientation.
  const prof = view === 'profile';
  const legs = LEGS.map((l, i) => {
    const bias = prof ? (i < 2 ? 6 : -6) : 0;
    return leg(1, l.ay, l.kneeX, l.footX, l.footY, bias) + leg(-1, l.ay, l.kneeX * (prof ? 0.8 : 1), l.footX * (prof ? 0.78 : 1), l.footY, bias);
  }).join('');
  // chélicères ÉPAISSES + crochets COURBÉS vers l'intérieur (les bâtonnets droits lisaient inoffensifs)
  const chelicerae = `<path d="M-3.2 14 Q-5 18 -2.8 20.6 M3.2 14 Q5 18 2.8 20.6" fill="none" stroke="@corpsO" stroke-width="2.7" stroke-linecap="round"/>` +
    `<path d="M-2.8 20 Q-3.6 23.4 -0.8 24.6 Q-2.8 22.8 -1.7 20.2 Z" fill="#e8e0c8" stroke="#9a8f78" stroke-width="0.3"/>` +
    `<path d="M2.8 20 Q3.6 23.4 0.8 24.6 Q2.8 22.8 1.7 20.2 Z" fill="#e8e0c8" stroke="#9a8f78" stroke-width="0.3"/>`;
  const eyeCluster = `<circle cx="-3.4" cy="9" r="1.5" fill="#9a1818"/><circle cx="3.4" cy="9" r="1.5" fill="#9a1818"/>` +
    `<circle cx="-1.4" cy="11" r="1" fill="#b83030"/><circle cx="1.4" cy="11" r="1" fill="#b83030"/>` +
    `<circle cx="-4.6" cy="11.4" r="0.8" fill="#7a1010"/><circle cx="4.6" cy="11.4" r="0.8" fill="#7a1010"/>` +
    `<circle cx="-2.4" cy="13" r="0.7" fill="#7a1010"/><circle cx="2.4" cy="13" r="0.7" fill="#7a1010"/>`;
  const face = view === 'back'
    ? '' // de dos : pas d'yeux/chélicères (on voit la nuque)
    : prof
      ? `<g transform="translate(5,0)">${eyeCluster}${chelicerae}</g>`
      : `<g>${eyeCluster}${chelicerae}</g>`;
  return `<g>${legs}` +
    `<ellipse cx="${prof ? 2 : 0}" cy="3" rx="11" ry="13" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<ellipse cx="${prof ? 1 : 0}" cy="0" rx="7" ry="8" fill="@corpsH" opacity="0.3"/>` +
    face + `</g>`;
}
function abdomen(p: SpiderProps, view: View): string {
  const g = p.girth, rx = 15 * g, ry = 17 * g;
  const off = view === 'profile' ? -5 : 0; // profil : l'abdomen TRAÎNE derrière (-x)
  const mark = view === 'back'
    ? `<path d="M0 ${-ry + 4} L0 ${ry - 4}" stroke="@corpsO" stroke-width="1.2" opacity="0.6"/>` // sillon dorsal
    : `<path d="M${off} ${-8} l-3 5 l3 4 l-3 5 M${off} -8 l3 5 l-3 4 l3 5" stroke="@corpsH" stroke-width="1.2" fill="none" opacity="0.6"/>`; // chevrons pâles (sablier)
  return `<g>` +
    `<ellipse cx="${off}" cy="0" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
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
  return sortByZ((Object.keys(sk) as SpiderBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    })));
}

export const SPIDER_DEFAULT: SpiderProps = {
  sl: 1.0, girth: 1.0,
  stored: { corps: '#2e2622', corpsO: '#181210', corpsH: '#574438', cheveux: '#181210', cheveuxO: '#0e0a08', cuir: '#7a1010' },
};

export function resolveSpider(species: string, view: View = 'front', pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  return resolveSpiderFromProps(SPIDER_SPECIES[species] ?? SPIDER_DEFAULT, view, pose, colors);
}
export const arachnidPlan: BodyPlan = {
  id: 'arachnid',
  resolve: (sp, view, pose, opts) => resolveSpider(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(SPIDER_SPECIES),
  restPose: () => SPIDER_REST,
  idlePose: (phase) => spiderIdle(phase * 0.5), // frémissement de l'abdomen au repos
  walkPose: spiderIdle, // scuttle = pulsation ample
  attackPose: spiderRush,
  deathPose: () => SPIDER_DEATH,
  hasView: () => true,
};

export function spiderSvg(
  p: SpiderProps,
  view: View,
  opts: { dead?: boolean; idlePhase?: number; colors?: Palette } = {},
): string {
  const pose = opts.dead ? SPIDER_DEATH : opts.idlePhase != null ? spiderIdle(opts.idlePhase) : {};
  return bonesToSvg(resolveSpiderFromProps(p, view, pose, opts.colors));
}
