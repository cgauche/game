/**
 * Gabarit CÉPHALOPODE (pieuvre des tourbières). Manteau bulbeux (tête-sac) + 2 grands yeux à
 * pupille horizontale, 8 tentacules qui ONDULENT en éventail sous le corps (ventouses suggérées).
 * Anim propre au plan : ondulation des tentacules + pulsation du manteau au repos, projection à
 * l'attaque, affaissement à la mort. Réutilise la machinerie (FK, palette tokenisée, rendu).
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { OCTOPUS_SPECIES } from '../creatures';

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
function tentacles(view: View): string {
  if (view === 'profile') {
    // PROFIL directionnel : les bras AVANT (+x) tendus en éclaireurs, les arrière en traîne
    // courte — l'éventail symétrique identique à la face tuait l'orientation. Courbes variées
    // (un bras s'enroule en crosse) pour casser le « rayons de roue ».
    return `<g>` +
      arm(1, 6, 26, 10, 44, -2, 5.4) + // bras de tête, tendu loin devant
      arm(1, 8, 22, 24, 36, 26, 5.6) +
      arm(1, 5, 12, 30, 16, 44, 5) +
      `<path d="M40 6 q6 -7 1 -11 q-4 -2 -5 2 q3 0 3 3 q0 3 -3 4 z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` + // crosse enroulée
      arm(-1, 4, 10, 24, 8, 45, 5.2) +
      arm(-1, 7, 18, 16, 24, 36, 5) +
      arm(-1, 9, 22, 8, 30, 14, 4.4) +
      `</g>`;
  }
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
  if (view === 'profile') {
    // PROFIL : UN seul œil saillant côté avant (+x), manteau incliné vers l'avant
    const eye = `<ellipse cx="${(rx * 0.55).toFixed(1)}" cy="3" rx="4.2" ry="3.6" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<ellipse cx="${(rx * 0.55).toFixed(1)}" cy="3" rx="2.7" ry="2.3" fill="#e8d44a"/>` +
      `<rect x="${(rx * 0.55 - 1.7).toFixed(1)}" y="2.2" width="3.4" height="1.5" rx="0.6" fill="#0a0603"/>`;
    return `<g transform="rotate(-6)">${body}${sheen}${blotch}${eye}</g>`;
  }
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
  const art: Record<OctoBoneId, string> = { tentacules: tentacles(view), corps: mantle(p, view) };
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

export function resolveOctopus(species: string, view: View = 'front', pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  return resolveOctopusFromProps(OCTOPUS_SPECIES[species] ?? OCTOPUS_DEFAULT, view, pose, colors);
}
export const cephalopodPlan: BodyPlan = {
  id: 'cephalopod',
  resolve: (sp, view, pose, opts) => resolveOctopus(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(OCTOPUS_SPECIES),
  restPose: () => OCTO_REST,
  idlePose: (phase) => octoWrithe(phase * 0.5), // ondulation douce des bras au repos
  walkPose: octoWrithe,
  attackPose: octoLunge,
  deathPose: () => OCTO_DEATH,
  hasView: () => true,
};

export function octopusSvg(
  p: OctopusProps,
  view: View,
  opts: { dead?: boolean; writhePhase?: number; colors?: Palette } = {},
): string {
  const pose = opts.dead ? OCTO_DEATH : opts.writhePhase != null ? octoWrithe(opts.writhePhase) : {};
  return bonesToSvg(resolveOctopusFromProps(p, view, pose, opts.colors));
}
