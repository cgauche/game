/**
 * Gabarit CÉPHALOPODE (pieuvre des tourbières — artwork LDB p.325). Masse charnue BASSE et
 * grumeleuse posée au sol (verrues, marbrures @cheveux), petit œil discret noyé dans les replis
 * (iris @cuir), HUIT tentacules EFFILÉS dressés en volutes au-dessus du corps — les bras avant
 * s'enroulent devant le manteau ou rampent au sol. Anim propre au plan : ondulation des volutes
 * au repos, projection à l'attaque, affaissement à la mort. Réutilise la machinerie (FK, palette
 * tokenisée, rendu).
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { OCTOPUS_SPECIES } from '../creatures';
import { sortByZ } from '../composite';

export type OctoBoneId = 'tentacules' | 'corps' | 'bras';
type OBone = FKBone & { z: number };
export interface OctopusProps {
  sl: number;
  girth: number; // grosseur du manteau
  stored: StoredPalette;
}

function buildSkeleton(): Record<OctoBoneId, OBone> {
  return {
    tentacules: { parent: 'corps', pivot: { x: 0, y: 16 }, angle: 0, z: 2 }, // volutes ARRIÈRE, derrière le manteau
    corps: { parent: null, pivot: { x: 60, y: 133 }, angle: 0, z: 3 }, // masse charnue posée au sol (base ≈ y150)
    bras: { parent: 'corps', pivot: { x: 0, y: 15 }, angle: 0, z: 4 }, // bras AVANT, devant le manteau
  };
}

// --- tentacule effilé en volute -------------------------------------------
type Pt = readonly [number, number];
const P = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
function norm(a: Pt, b: Pt): Pt {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return [dy / l, -dx / l];
}
const off = (p: Pt, n: Pt, w: number): Pt => [p[0] + n[0] * w, p[1] + n[1] * w];
/** Ruban EFFILÉ le long d'une cubique p0→c1→c2→p3 : large (w) à la base, pointe fine recourbée
 *  en crosse via `curl` (contrôle du bout). + ventouses (tirets clairs) et rugosités (taches
 *  sombres) le long de l'axe — le tentacule est charnu et grumeleux, pas un tube lisse. */
function volute(p0: Pt, c1: Pt, c2: Pt, p3: Pt, w: number, curl: Pt): string {
  const n0 = norm(p0, c1), n1 = norm(p0, c2), n2 = norm(c1, p3), n3 = norm(c2, p3);
  const w1 = w * 0.72, w2 = w * 0.42, w3 = w * 0.16;
  const d =
    `M${P(off(p0, n0, w))} C${P(off(c1, n1, w1))} ${P(off(c2, n2, w2))} ${P(off(p3, n3, w3))} ` +
    `Q${P(curl)} ${P(off(p3, n3, -w3))} ` +
    `C${P(off(c2, n2, -w2))} ${P(off(c1, n1, -w1))} ${P(off(p0, n0, -w))} Z`;
  const axis = `M${P(p0)} C${P(c1)} ${P(c2)} ${P(p3)}`;
  return `<path d="${d}" fill="@corps" stroke="@corpsO" stroke-width="0.7" stroke-linejoin="round"/>` +
    `<path d="${axis}" fill="none" stroke="@corpsO" stroke-width="${(w * 0.5).toFixed(1)}" opacity="0.18" stroke-dasharray="2.8 4.2"/>` +
    `<path d="${axis}" fill="none" stroke="@corpsH" stroke-width="0.9" opacity="0.45" stroke-dasharray="0.9 2.4"/>`;
}

/** Volutes ARRIÈRE (5 bras) : dressées au-dessus du manteau, courbures alternées. */
function tentaclesArriere(view: View): string {
  if (view === 'profile') {
    // PROFIL : volutes de traîne côté dos (-x) + volutes hautes en crosse, l'avant vit dans `bras`
    return `<g>` +
      volute([-8, -8], [-23, -26], [-23, -52], [-12, -58], 5.4, [-5, -64]) +
      volute([-4, -10], [-13, -26], [-3, -38], [-11, -48], 4.6, [-17, -52]) +
      volute([2, -10], [7, -36], [-3, -52], [7, -60], 5.2, [13, -54]) +
      volute([-14, -2], [-26, -4], [-33, 0], [-38, 3], 4.6, [-41, -2]) +
      `</g>`;
  }
  return `<g>` +
    volute([-17, -8], [-31, -28], [-29, -58], [-18, -63], 5.4, [-11, -70]) +
    volute([-8, -10], [-17, -30], [-6, -44], [-13, -56], 4.8, [-18, -62]) +
    volute([2, -12], [7, -36], [-4, -54], [6, -62], 5, [13, -56]) +
    volute([10, -10], [21, -26], [13, -42], [21, -52], 4.8, [27, -46]) +
    volute([16, -8], [31, -24], [31, -54], [19, -60], 5.4, [12, -52]) +
    `</g>`;
}
/** Bras AVANT (3 bras) : s'enroulent devant le manteau, un bras rampe au sol. */
function tentaclesAvant(view: View): string {
  if (view === 'profile') {
    // PROFIL directionnel : un bras éclaireur rampe loin devant (+x), un bras se dresse en crosse
    return `<g>` +
      volute([12, 0], [24, 2], [34, 1], [42, -2], 5, [45, -7]) +
      volute([13, -4], [27, -14], [33, -30], [25, -38], 5, [18, -44]) +
      `</g>`;
  }
  return `<g>` +
    volute([-19, 0], [-28, -14], [-29, -34], [-20, -38], 5, [-13, -44]) +
    volute([19, 0], [28, -12], [29, -32], [21, -36], 5, [14, -42]) +
    volute([-13, 1], [-22, 2], [-30, 1], [-36, -2], 4.4, [-38, -7]) +
    `</g>`;
}

function mantle(p: OctopusProps, view: View): string {
  const g = p.girth;
  // masse BASSE et bosselée (pas de tête-sac dressée) : contour irrégulier, base large au sol
  const body = `<path d="M-20 8 C-22 2 -21 -4 -16 -7 Q-13 -11 -8 -9 Q-4 -13 1 -10 Q6 -13 10 -9 Q15 -11 17 -6 C21 -3 22 3 20 8 C15 13 6 14 0 14 C-7 14 -15 13 -20 8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8" stroke-linejoin="round"/>`;
  const warts = `<g fill="@corpsO" opacity="0.35"><circle cx="-11" cy="-3" r="1.2"/><circle cx="-5" cy="-7" r="0.9"/><circle cx="4" cy="-6" r="1.1"/><circle cx="12" cy="-2" r="0.9"/><circle cx="-15" cy="3" r="1"/><circle cx="9" cy="5" r="1.3"/><circle cx="-2" cy="2" r="0.8"/></g>` +
    `<g fill="@corpsH" opacity="0.5"><circle cx="-8" cy="-5" r="0.6"/><circle cx="2" cy="-8" r="0.55"/><circle cx="14" cy="1" r="0.6"/><circle cx="-13" cy="0" r="0.5"/></g>`;
  const marbling = `<g fill="@cheveux" opacity="0.45"><path d="M-17 -1 q4 -4 8 -2 q3 2 -1 4 q-5 2 -7 -2 z"/><path d="M3 6 q5 -3 9 0 q2 3 -3 4 q-6 1 -6 -4 z"/><path d="M6 -9 q4 -2 6 1 q1 2 -3 2 q-4 0 -3 -3 z"/></g>`;
  const sheen = `<ellipse cx="-3" cy="-5" rx="8" ry="3.5" fill="@corpsH" opacity="0.22"/>`;
  const flesh = body + warts + marbling + sheen;
  if (view === 'back') return `<g transform="scale(${g})">${flesh}<path d="M0 -10 L0 12" stroke="@corpsO" stroke-width="0.7" opacity="0.4"/></g>`;
  if (view === 'profile') {
    // PROFIL : UN seul PETIT œil noyé dans un repli, côté avant (+x)
    const eye = `<path d="M8.6 -4.4 q3.6 -2.2 6.8 -0.4" fill="none" stroke="@corpsO" stroke-width="0.7" opacity="0.6"/>` +
      `<ellipse cx="12" cy="-2" rx="2.2" ry="1.8" fill="@cuir" stroke="@corpsO" stroke-width="0.5"/>` +
      `<rect x="10.9" y="-2.5" width="2.2" height="1" rx="0.5" fill="#0a0603"/>`;
    return `<g transform="scale(${g}) rotate(-4)">${flesh}${eye}</g>`;
  }
  // FACE : deux PETITS yeux discrets sous des replis de chair, pupille horizontale (tell céphalopode)
  const eyes = `<path d="M2.6 -3.6 q4 -2.4 7.4 -0.6" fill="none" stroke="@corpsO" stroke-width="0.7" opacity="0.6"/>` +
    `<ellipse cx="6" cy="-1" rx="2.2" ry="1.8" fill="@cuir" stroke="@corpsO" stroke-width="0.5"/>` +
    `<rect x="4.9" y="-1.5" width="2.2" height="1" rx="0.5" fill="#0a0603"/>` +
    `<path d="M-9.4 -2.8 q2.4 -1.8 4.6 -0.6" fill="none" stroke="@corpsO" stroke-width="0.7" opacity="0.6"/>` +
    `<ellipse cx="-7" cy="-1.2" rx="1.8" ry="1.4" fill="@cuir" stroke="@corpsO" stroke-width="0.5"/>` +
    `<rect x="-7.9" y="-1.6" width="1.8" height="0.9" rx="0.45" fill="#0a0603"/>`;
  return `<g transform="scale(${g})">${flesh}${eyes}</g>`;
}

// --- poses (DELTA additif) ------------------------------------------------
export const OCTO_REST: Record<string, number> = {};
/** Ondulation : les volutes ondulent (avant/arrière en contre-phase), le manteau pulse. phase ∈ [0,1). */
export function octoWrithe(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { tentacules: s * 6, bras: -s * 5, corps: s * 2 };
}
/** Projection : le corps fonce, les bras se tendent en avant. phase ∈ [0,1]. */
export function octoLunge(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { corps: k * 14, tentacules: k * 22, bras: k * 26 };
}
/** Mort : manteau affaissé, volutes retombées. */
export const OCTO_DEATH: Record<string, number> = { corps: 22, tentacules: 30, bras: 34 };

export function resolveOctopusFromProps(
  p: OctopusProps,
  view: View = 'front',
  pose: Record<string, number> = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<OctoBoneId, Matrix>;
  const tmap = buildTokenMap(p.stored, colors ?? {});
  const art: Record<OctoBoneId, string> = { tentacules: tentaclesArriere(view), corps: mantle(p, view), bras: tentaclesAvant(view) };
  return sortByZ((Object.keys(sk) as OctoBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    })));
}

export const OCTOPUS_DEFAULT: OctopusProps = {
  sl: 1.05, girth: 1.0,
  stored: { corps: '#8a6238', corpsO: '#452e16', corpsH: '#c2a068', cheveux: '#6b6d3a', cheveuxO: '#3a3c1f', cuir: '#b98f47' },
};

export function resolveOctopus(species: string, view: View = 'front', pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  return resolveOctopusFromProps(OCTOPUS_SPECIES[species] ?? OCTOPUS_DEFAULT, view, pose, colors);
}
export const cephalopodPlan: BodyPlan = {
  id: 'cephalopod',
  resolve: (sp, view, pose, opts) => resolveOctopus(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(OCTOPUS_SPECIES),
  restPose: () => OCTO_REST,
  idlePose: (phase) => octoWrithe(phase * 0.5), // ondulation douce des volutes au repos
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
