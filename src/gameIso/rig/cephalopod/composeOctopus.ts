/**
 * Gabarit CÉPHALOPODE (pieuvre des tourbières). Manteau bulbeux (tête-sac) + 2 grands yeux à
 * pupille horizontale, 8 tentacules qui ONDULENT en éventail sous le corps (ventouses suggérées).
 * Anim propre au plan : ondulation des tentacules + pulsation du manteau au repos, projection à
 * l'attaque, affaissement à la mort. Réutilise la machinerie (FK, palette tokenisée, rendu).
 */
import type { ResolvedBone } from '../composeRig';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';

export type OctoBoneId = 'tentacules' | 'corps';
type OBone = FKBone & { z: number };
export interface OctopusProps {
  sl: number;
  girth: number; // grosseur du manteau
  stored: StoredPalette;
}

function buildSkeleton(): Record<OctoBoneId, OBone> {
  return {
    tentacules: { parent: 'corps', pivot: { x: 0, y: 16 }, angle: 0, z: 2 }, // 8 bras, sous/derrière le manteau
    corps: { parent: null, pivot: { x: 60, y: 86 }, angle: 0, z: 3 }, // manteau + yeux
  };
}

// un tentacule : tube galbé (cap rond) + rangée de ventouses (tirets clairs sur la face interne)
function arm(sx: number, x0: number, ctrlX: number, ctrlY: number, tipX: number, tipY: number, w: number): string {
  const d = `M${(sx * x0).toFixed(1)} 0 Q${(sx * ctrlX).toFixed(1)} ${ctrlY} ${(sx * tipX).toFixed(1)} ${tipY}`;
  return `<path d="${d}" fill="none" stroke="@corps" stroke-width="${w}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="@corpsO" stroke-width="${(w * 0.45).toFixed(1)}" opacity="0.4" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="@corpsH" stroke-width="1.1" opacity="0.45" stroke-dasharray="1.1 3.4"/>`;
}
function tentacles(): string {
  // 4 par côté : intérieurs courts/avant, extérieurs longs/écartés ; courbures alternées (writhe)
  const L = arm(-1, 4, 8, 22, 4, 46, 5.2) + arm(-1, 7, 20, 18, 26, 40, 5.6) + arm(-1, 9, 26, 30, 34, 22, 5) + arm(-1, 10, 30, 14, 40, 4, 4.4);
  const R = arm(1, 4, 8, 22, 4, 46, 5.2) + arm(1, 7, 20, 18, 26, 40, 5.6) + arm(1, 9, 26, 30, 34, 22, 5) + arm(1, 10, 30, 14, 40, 4, 4.4);
  return `<g>${L}${R}</g>`;
}
function mantle(p: OctopusProps, view: View): string {
  const g = p.girth, rx = 17 * g, ry = 21 * g;
  // tête-sac bulbeuse (haute, arrondie, rétrécie à la base)
  const body = `<path d="M${-rx} 2 Q${-rx} ${-ry} 0 ${-ry} Q${rx} ${-ry} ${rx} 2 Q${rx * 0.7} 16 0 18 Q${-rx * 0.7} 16 ${-rx} 2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
  const sheen = `<ellipse cx="-4" cy="${(-ry * 0.4).toFixed(1)}" rx="${(rx * 0.45).toFixed(1)}" ry="${(ry * 0.4).toFixed(1)}" fill="@corpsH" opacity="0.3"/>`;
  const blotch = `<circle cx="6" cy="-6" r="2.4" fill="@corpsO" opacity="0.5"/><circle cx="-7" cy="-12" r="1.8" fill="@corpsO" opacity="0.45"/><circle cx="3" cy="-15" r="1.5" fill="@corpsO" opacity="0.4"/>`;
  if (view === 'back') return `<g>${body}${sheen}${blotch}<path d="M0 ${-ry + 3} L0 14" stroke="@corpsO" stroke-width="0.7" opacity="0.4"/></g>`;
  // yeux saillants à pupille HORIZONTALE (tell céphalopode)
  const eyes = `<ellipse cx="-6.5" cy="4" rx="4" ry="3.4" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><ellipse cx="6.5" cy="4" rx="4" ry="3.4" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<ellipse cx="-6.5" cy="4" rx="2.6" ry="2.2" fill="#e8d44a"/><ellipse cx="6.5" cy="4" rx="2.6" ry="2.2" fill="#e8d44a"/>` +
    `<rect x="-8.1" y="3.2" width="3.2" height="1.5" rx="0.6" fill="#0a0603"/><rect x="4.9" y="3.2" width="3.2" height="1.5" rx="0.6" fill="#0a0603"/>`;
  return `<g>${body}${sheen}${blotch}${eyes}</g>`;
}

// --- poses (DELTA additif) ------------------------------------------------
export const OCTO_REST: Record<string, number> = {};
/** Ondulation : les bras ondulent, le manteau pulse doucement. phase ∈ [0,1). */
export function octoWrithe(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { tentacules: s * 6, corps: s * 2 };
}
/** Projection : le corps fonce, les bras se tendent en avant. phase ∈ [0,1]. */
export function octoLunge(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { corps: k * 14, tentacules: k * 22 };
}
/** Mort : manteau affaissé, bras retombés. */
export const OCTO_DEATH: Record<string, number> = { corps: 22, tentacules: 30 };

export function resolveOctopusFromProps(
  p: OctopusProps,
  view: View = 'front',
  pose: Record<string, number> = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<OctoBoneId, Matrix>;
  const tmap = buildTokenMap(p.stored, colors ?? {});
  const art: Record<OctoBoneId, string> = { tentacules: tentacles(), corps: mantle(p, view) };
  return (Object.keys(sk) as OctoBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    }))
    .sort((a, b) => a.z - b.z);
}

export const OCTOPUS_DEFAULT: OctopusProps = {
  sl: 1.05, girth: 1.0,
  stored: { corps: '#7a4a5e', corpsO: '#4e2c3c', corpsH: '#a86e80', cheveux: '#3a2230', cheveuxO: '#241218', cuir: '#d8c64a' },
};

export function octopusSvg(
  p: OctopusProps,
  view: View,
  opts: { dead?: boolean; writhePhase?: number; colors?: Palette } = {},
): string {
  const pose = opts.dead ? OCTO_DEATH : opts.writhePhase != null ? octoWrithe(opts.writhePhase) : {};
  return bonesToSvg(resolveOctopusFromProps(p, view, pose, opts.colors));
}
