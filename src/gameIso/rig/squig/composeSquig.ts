/**
 * Gabarit SQUIG (peau-verte fongoïde) — « une bouche sur pattes » : corps quasi sphérique
 * dominé par une ÉNORME gueule à crocs (mâchoire inférieure articulée qui CLAQUE), gros yeux,
 * crête d'épines dorsale, deux petites pattes griffues. Anim propre au plan : claquement de
 * mâchoire au repos, bonds (lean) au déplacement, gueule grande ouverte à l'attaque, sur le dos
 * à la mort. Réutilise la machinerie (FK générique, palette tokenisée, rendu).
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { SQUIG_SPECIES } from '../creatures';

export type SquigBoneId = 'corps' | 'machoire';
type SBone = FKBone & { z: number };
export interface SquigProps {
  sl: number;
  girth: number; // rondeur du corps
  stored: StoredPalette;
}

function buildSkeleton(): Record<SquigBoneId, SBone> {
  return {
    corps: { parent: null, pivot: { x: 60, y: 100 }, angle: 0, z: 3 },
    machoire: { parent: 'corps', pivot: { x: -16, y: 7 }, angle: 0, z: 4 }, // charnière au coin gauche
  };
}

function body(p: SquigProps, view: View): string {
  const g = p.girth, rx = 23 * g, ry = 25 * g;
  const feet = `<path d="M-10 ${ry - 4} q-4 7 -1 12 l7 0 q1 -6 -2 -11 Z" fill="@cuir" stroke="@corpsO" stroke-width="0.5"/>` +
    `<path d="M10 ${ry - 4} q4 7 1 12 l-7 0 q-1 -6 2 -11 Z" fill="@cuir" stroke="@corpsO" stroke-width="0.5"/>`;
  // crête d'épines dorsale
  const crest = `<path d="M-13 ${-ry + 6} l-3 -9 l7 5 M-3 ${-ry + 2} l-1 -11 l6 7 M7 ${-ry + 4} l2 -10 l3 8 M15 ${-ry + 9} l4 -7 l1 7" fill="@corpsO" stroke="@corpsO" stroke-width="0.5"/>`;
  const ball = `<ellipse cx="0" cy="0" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<ellipse cx="-6" cy="-8" rx="${(rx * 0.5).toFixed(1)}" ry="${(ry * 0.45).toFixed(1)}" fill="@corpsH" opacity="0.3"/>`;
  if (view === 'back') return `<g>${feet}${ball}${crest}<path d="M0 ${-ry + 6} L0 ${ry - 6}" stroke="@corpsO" stroke-width="1" opacity="0.4"/></g>`;
  // gueule : intérieur sombre (béant) + lèvre supérieure à crocs pointant vers le bas + gros yeux
  const maw = `<path d="M-16 7 Q0 2 17 7 Q16 16 0 17 Q-15 16 -16 7 Z" fill="#2a0e0c"/>`; // cavité (derrière la mâchoire)
  const upperFangs = `<path d="M-13 6 l1.6 6 l2 -5.4 Z M-7 6.4 l1.4 7 l2 -6.4 Z M0 6.6 l1.2 6.6 l1.8 -6.4 Z M7 6.2 l1.2 6 l1.8 -5.6 Z M13 6 l1 5 l1.6 -4.6 Z" fill="#efe6cf"/>`;
  const eyes = `<ellipse cx="-8" cy="-7" rx="5" ry="5.4" fill="#f4ecd8"/><circle cx="-7" cy="-6" r="2.4" fill="#1a0a06"/><circle cx="-6.2" cy="-7" r="0.8" fill="#fff"/>` +
    `<ellipse cx="8" cy="-7" rx="5" ry="5.4" fill="#f4ecd8"/><circle cx="7" cy="-6" r="2.4" fill="#1a0a06"/><circle cx="7.8" cy="-7" r="0.8" fill="#fff"/>` +
    `<path d="M-13 -12 Q-8 -15 -3 -12 M3 -12 Q8 -15 13 -12" stroke="@corpsO" stroke-width="1.2" fill="none"/>`; // sourcils agressifs
  return `<g>${feet}${ball}${crest}${maw}${upperFangs}${eyes}</g>`;
}
function jaw(p: SquigProps, view: View): string {
  if (view === 'back') return '';
  // mâchoire inférieure : lèvre + crocs pointant vers le HAUT (repère charnière coin gauche)
  return `<g><path d="M0 0 Q16 1 33 0 Q34 9 17 12 Q4 12 0 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M4 0.5 l1.4 -5.6 l2 5 M11 0 l1.2 -6 l2 5.4 M18 0 l1.2 -6 l2 5.4 M25 0.5 l1.2 -5.4 l1.8 5 M31 1 l1 -4.8 l1.6 4.4" fill="#efe6cf"/></g>`;
}

// --- poses (DELTA additif ; mâchoire s'ouvre en angle +) ------------------
export const SQUIG_REST: Record<string, number> = {};
/** Claquement de mâchoire + dandinement au repos. phase ∈ [0,1). */
export function squigChomp(phase: number): Record<string, number> {
  const s = (Math.sin(phase * Math.PI * 2) + 1) / 2; // 0..1
  return { machoire: s * 14, corps: Math.sin(phase * Math.PI * 4) * 2 };
}
/** Bond : le corps s'incline d'avant en arrière (sautillement). phase ∈ [0,1). */
export function squigHop(phase: number): Record<string, number> {
  return { corps: Math.sin(phase * Math.PI * 2) * 9, machoire: 6 };
}
/** Morsure : gueule grande ouverte. phase ∈ [0,1]. */
export function squigBite(phase: number): Record<string, number> {
  return { machoire: Math.sin(Math.min(1, phase) * Math.PI) * 30 };
}
/** Mort : sur le dos (corps basculé), mâchoire molle. */
export const SQUIG_DEATH: Record<string, number> = { corps: 165, machoire: 8 };

export function resolveSquigFromProps(
  p: SquigProps,
  view: View = 'front',
  pose: Record<string, number> = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<SquigBoneId, Matrix>;
  const tmap = buildTokenMap(p.stored, colors ?? {});
  const art: Record<SquigBoneId, string> = { corps: body(p, view), machoire: jaw(p, view) };
  return (Object.keys(sk) as SquigBoneId[])
    .filter((id) => art[id])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    }))
    .sort((a, b) => a.z - b.z);
}

export const SQUIG_DEFAULT: SquigProps = {
  sl: 0.85, girth: 1.0,
  stored: { corps: '#a82828', corpsO: '#6e1616', corpsH: '#d85a4a', cheveux: '#5a1010', cheveuxO: '#3a0a0a', cuir: '#2a2018' },
};

export function resolveSquig(species: string, view: View = 'front', pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  return resolveSquigFromProps(SQUIG_SPECIES[species] ?? SQUIG_DEFAULT, view, pose, colors);
}

export const squigPlan: BodyPlan = {
  id: 'squig',
  resolve: (sp, view, pose, opts) => resolveSquig(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(SQUIG_SPECIES),
  restPose: () => SQUIG_REST,
  idlePose: squigChomp, // mâchoire qui claque
  walkPose: squigHop,
  attackPose: squigBite,
  deathPose: () => SQUIG_DEATH,
  hasView: () => true,
};

export function squigSvg(p: SquigProps, view: View, opts: { dead?: boolean; phase?: number; colors?: Palette } = {}): string {
  const pose = opts.dead ? SQUIG_DEATH : opts.phase != null ? squigChomp(opts.phase) : {};
  return bonesToSvg(resolveSquigFromProps(p, view, pose, opts.colors));
}
