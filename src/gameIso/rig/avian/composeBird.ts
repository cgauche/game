/**
 * Gabarit AVIAIRE (pigeon / petit oiseau). Corps dodu sur 2 pattes fines, aile repliée, queue
 * en éventail, petite tête à bec qui DODELINE (le tell de l'oiseau). Anim propre au plan :
 * hochement de tête au repos, sautillement+frémissement d'aile au déplacement, coup de bec à
 * l'attaque, sur le flanc à la mort. Réutilise la machinerie (FK, palette tokenisée, rendu).
 */
import type { ResolvedBone } from '../composeRig';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';

export type BirdBoneId = 'corps' | 'tete';
type BBone = FKBone & { z: number };
export interface BirdProps {
  sl: number;
  girth: number; // rondeur du corps
  stored: StoredPalette; // plumage (corps/corpsO/corpsH) ; cuir = pattes/bec
}

function buildSkeleton(): Record<BirdBoneId, BBone> {
  return {
    corps: { parent: null, pivot: { x: 60, y: 112 }, angle: 0, z: 3 }, // corps + aile + queue + pattes
    tete: { parent: 'corps', pivot: { x: 11, y: -13 }, angle: 0, z: 4 }, // tête + bec + œil
  };
}

function legs(): string { // 2 pattes fines + doigts (couleur cuir)
  return `<g>` +
    `<path d="M-3 9 L-4 26 M-4 26 l-3 3 M-4 26 l1 4 M-4 26 l3 2" stroke="@cuir" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<path d="M3 9 L4 26 M4 26 l-3 2 M4 26 l-1 4 M4 26 l3 3" stroke="@cuir" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `</g>`;
}
function bodyProfile(p: BirdProps): string {
  const g = p.girth;
  return `<g>${legs()}` +
    // queue en éventail (arrière -x, légèrement relevée)
    `<path d="M${-12 * g} -2 L-30 -8 L-29 -2 L-31 4 L-28 6 L-12 6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M-28 -7 L-13 -1 M-29 0 L-13 2 M-28 5 L-13 5" stroke="@corpsO" stroke-width="0.5" opacity="0.5"/>` +
    // corps dodu
    `<ellipse cx="0" cy="0" rx="${(15 * g).toFixed(1)}" ry="12" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<ellipse cx="3" cy="-3" rx="${(9 * g).toFixed(1)}" ry="7" fill="@corpsH" opacity="0.35"/>` + // poitrail clair
    // aile repliée (sur le flanc) + rémiges
    `<path d="M2 -5 Q-8 -7 -16 0 Q-10 5 -2 4 Q4 2 2 -5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M-3 -2 Q-9 -2 -14 1 M-3 1 Q-9 1 -13 3" stroke="@corpsO" stroke-width="0.6" fill="none" opacity="0.6"/>` +
    `</g>`;
}
function bodyFront(p: BirdProps): string {
  const g = p.girth;
  return `<g>${legs()}` +
    `<ellipse cx="0" cy="0" rx="${(12 * g).toFixed(1)}" ry="13" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<ellipse cx="0" cy="1" rx="${(7 * g).toFixed(1)}" ry="9" fill="@corpsH" opacity="0.4"/>` + // poitrail
    `<path d="M${-10 * g} -6 Q${-14 * g} 2 ${-8 * g} 9 Q${-6 * g} 4 ${-7 * g} -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` + // aile G
    `<path d="M${10 * g} -6 Q${14 * g} 2 ${8 * g} 9 Q${6 * g} 4 ${7 * g} -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` + // aile D
    `</g>`;
}
function bodyBack(p: BirdProps): string {
  const g = p.girth;
  return `<g>${legs()}` +
    `<path d="M-9 4 L-2 -2 L2 -2 L9 4 L4 16 L-4 16 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` + // queue en éventail vers le bas
    `<path d="M0 -2 L0 15 M-5 0 L-3 14 M5 0 L3 14" stroke="@corpsO" stroke-width="0.5" opacity="0.5"/>` +
    `<ellipse cx="0" cy="-2" rx="${(12 * g).toFixed(1)}" ry="12" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M0 -12 L0 6" stroke="@corpsO" stroke-width="0.6" opacity="0.4"/>` +
    `</g>`;
}
function head(p: BirdProps, view: View): string {
  const irid = `<path d="M-4 6 Q0 9 4 6 Q3 9 0 10 Q-3 9 -4 6 Z" fill="@corpsH" opacity="0.5"/>`; // cou irisé
  if (view === 'front')
    return `<g><circle cx="0" cy="0" r="6" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<path d="M-1.6 4 L1.6 4 L0 8 Z" fill="@cuir"/>` + // bec (face)
      `<circle cx="-2.6" cy="-1" r="1.3" fill="#1a0e08"/><circle cx="2.6" cy="-1" r="1.3" fill="#1a0e08"/>` +
      `<circle cx="-2.6" cy="-1" r="2" fill="none" stroke="#c86018" stroke-width="0.5"/><circle cx="2.6" cy="-1" r="2" fill="none" stroke="#c86018" stroke-width="0.5"/>${irid}</g>`;
  if (view === 'back')
    return `<g><circle cx="0" cy="0" r="6" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M0 -5 L0 4" stroke="@corpsO" stroke-width="0.5" opacity="0.4"/></g>`;
  // profil : tête + bec court vers +x + œil cerclé orange
  return `<g><circle cx="0" cy="0" r="6" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M5 -1 L12 1 L5 3 Z" fill="@cuir" stroke="#8a4010" stroke-width="0.4"/>` + // bec court
    `<circle cx="2" cy="-1" r="1.4" fill="#c86018"/><circle cx="2" cy="-1" r="0.8" fill="#1a0e08"/>` +
    `<circle cx="2.3" cy="-1.4" r="0.3" fill="#fff" opacity="0.7"/>${irid}</g>`;
}

// --- poses (DELTA additif) ------------------------------------------------
export const BIRD_REST: Record<string, number> = {};
/** Dodelinement de tête (le tell de l'oiseau). phase ∈ [0,1). */
export function birdBob(phase: number): Record<string, number> {
  return { tete: Math.sin(phase * Math.PI * 2) * 9 };
}
/** Coup de bec : la tête plonge en avant. phase ∈ [0,1]. */
export function birdPeck(phase: number): Record<string, number> {
  return { tete: Math.sin(Math.min(1, phase) * Math.PI) * 38 };
}
/** Mort : sur le flanc (corps basculé), tête tombée. */
export const BIRD_DEATH: Record<string, number> = { corps: 84, tete: 20 };

export function resolveBirdFromProps(
  p: BirdProps,
  view: View = 'profile',
  pose: Record<string, number> = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<BirdBoneId, Matrix>;
  const tmap = buildTokenMap(p.stored, colors ?? {});
  const body = view === 'front' ? bodyFront(p) : view === 'back' ? bodyBack(p) : bodyProfile(p);
  const art: Record<BirdBoneId, string> = { corps: body, tete: head(p, view) };
  return (Object.keys(sk) as BirdBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    }))
    .sort((a, b) => a.z - b.z);
}

export const BIRD_DEFAULT: BirdProps = {
  sl: 0.62, girth: 1.0,
  stored: { corps: '#7c8a99', corpsO: '#4e5a66', corpsH: '#c2ccd4', cheveux: '#3a444e', cheveuxO: '#222a30', cuir: '#d06a26' },
};

export function birdSvg(
  p: BirdProps,
  view: View,
  opts: { dead?: boolean; bobPhase?: number; colors?: Palette } = {},
): string {
  const pose = opts.dead ? BIRD_DEATH : opts.bobPhase != null ? birdBob(opts.bobPhase) : {};
  return bonesToSvg(resolveBirdFromProps(p, view, pose, opts.colors));
}
