/**
 * Gabarit POISSON (brochet géant : Brochet du Stir — ZI). Corps fusiforme HORIZONTAL, longue gueule
 * dentée de brochet (à droite, +x), grande nageoire caudale fourchue (queue, -x) + dorsale/pectorale/
 * anale. Anim propre au plan : godille de la caudale au repos, ondulation à la nage, coup de queue
 * ample à l'attaque (« Queue mortelle »), affaissement à la mort. Réutilise la machinerie (FK générique,
 * palette tokenisée, rendu) — comme composeSerpent, mais squelette HORIZONTAL (≠ son tas lové).
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { FISH_SPECIES } from '../creatures';

export type FishBoneId = 'corps' | 'caudale';
type FBone = FKBone & { z: number };
export interface FishProps {
  sl: number; // échelle token
  girth: number; // épaisseur (hauteur) du corps fusiforme
  stored: StoredPalette; // dos (corps) / ventre (corpsH) / contour (corpsO)
}

function buildSkeleton(): Record<FishBoneId, FBone> {
  return {
    corps: { parent: null, pivot: { x: 52, y: 92 }, angle: 0, z: 3 }, // corps + tête + nageoires
    caudale: { parent: 'corps', pivot: { x: -30, y: 0 }, angle: 0, z: 2 }, // nageoire caudale (queue qui godille)
  };
}

function body(p: FishProps): string {
  const g = p.girth, H = (n: number) => (n * g).toFixed(1);
  // corps fusiforme : tête épaisse à droite (+x), effilé vers la queue (-x)
  const fish = `<path d="M-30 0 Q-22 ${H(-9)} -6 ${H(-11)} Q12 ${H(-12)} 26 ${H(-7)} Q33 ${H(-3)} 34 0 Q33 ${H(3)} 26 ${H(7)} Q12 ${H(12)} -6 ${H(11)} Q-22 ${H(9)} -30 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
  const belly = `<path d="M-24 ${H(5)} Q0 ${H(11)} 24 ${H(5)} Q12 ${H(8)} -6 ${H(8)} Z" fill="@corpsH" opacity="0.4"/>`;
  const lateral = `<path d="M-26 ${H(-2)} Q0 ${H(-3)} 28 ${H(-1)}" stroke="@corpsO" stroke-width="0.7" fill="none" opacity="0.5"/>` +
    `<path d="M-18 ${H(-6)} l3 2 M-8 ${H(-7)} l3 2 M2 ${H(-7)} l3 2 M12 ${H(-6)} l3 2" stroke="@corpsO" stroke-width="0.5" opacity="0.4"/>`; // mouchetures du dos
  // gueule de brochet : longues mâchoires dentées au bout (+x)
  const jaws = `<path d="M30 ${H(-5)} Q44 ${H(-5)} 50 ${H(-2)} L50 ${H(1)} Q44 ${H(5)} 30 ${H(5)} Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M34 ${H(-0.5)} Q42 ${H(-0.5)} 49 0" stroke="@corpsO" stroke-width="0.6" fill="none"/>` +
    `<path d="M37 ${H(-1)} l1 2 l1 -2 M41 ${H(-1)} l1 2 l1 -2 M45 ${H(-0.5)} l1 1.6 l1 -1.6 M38 ${H(2)} l1 -2 l1 2 M43 ${H(2)} l1 -2 l1 2" stroke="#e8e0c8" stroke-width="0.5" fill="none"/>`;
  const eye = `<circle cx="26" cy="${H(-4)}" r="2.4" fill="#d8c038"/><circle cx="26.7" cy="${H(-4)}" r="1.1" fill="#0a0603"/>`;
  const dorsal = `<path d="M-10 ${H(-9)} Q-2 ${H(-20)} 8 ${H(-9)} Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>`;
  const pectoral = `<path d="M16 ${H(5)} Q22 ${H(14)} 27 ${H(6)} Z" fill="@corps" stroke="@corpsO" stroke-width="0.6" opacity="0.85"/>`;
  const anal = `<path d="M-15 ${H(8)} Q-10 ${H(16)} -3 ${H(9)} Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>`;
  return `<g>${dorsal}${anal}${fish}${belly}${lateral}${pectoral}${jaws}${eye}</g>`;
}

function caudal(p: FishProps): string {
  const g = p.girth, v = (n: number) => (n * g).toFixed(1);
  // grande nageoire caudale FOURCHUE (verticale) au bout de la queue (-x)
  return `<path d="M0 0 Q-6 ${v(-3)} -17 ${v(-16)} Q-11 ${v(-6)} -5 0 Q-11 ${v(6)} -17 ${v(16)} Q-6 ${v(3)} 0 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M-5 0 Q-10 ${v(-6)} -15 ${v(-13)} M-5 0 Q-10 ${v(6)} -15 ${v(13)}" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.5"/>`;
}

// --- poses (DELTA additif sur les angles d'os) ----------------------------
export const FISH_REST: Record<string, number> = {};
/** Godille au repos : la caudale balaie doucement. phase ∈ [0,1). */
export function fishGodille(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { caudale: s * 16, corps: s * 2 };
}
/** Nage : ondulation ample. phase ∈ [0,1). */
export function fishSwim(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { caudale: s * 26, corps: s * 5 };
}
/** Coup de queue (« Queue mortelle ») : la caudale se projette d'un côté. phase ∈ [0,1]. */
export function fishLash(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { caudale: k * 42, corps: k * 8 };
}
/** Mort : la queue retombe, le corps s'affaisse (poisson échoué). */
export const FISH_DEATH: Record<string, number> = { corps: 10, caudale: -22 };

export function resolveFishFromProps(
  p: FishProps,
  view: View = 'profile',
  pose: Record<string, number> = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<FishBoneId, Matrix>;
  const tmap = buildTokenMap(p.stored, colors ?? {});
  const art: Record<FishBoneId, string> = { corps: body(p), caudale: caudal(p) };
  return (Object.keys(sk) as FishBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    }))
    .sort((a, b) => a.z - b.z);
}

export const FISH_DEFAULT: FishProps = {
  sl: 1.0, girth: 1.0,
  stored: { corps: '#5a6850', corpsO: '#32402a', corpsH: '#b2bea2', cheveux: '#32402a', cheveuxO: '#1e2818', cuir: '#7c8868' },
};

export function resolveFish(species: string, view: View = 'profile', pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  return resolveFishFromProps(FISH_SPECIES[species] ?? FISH_DEFAULT, view, pose, colors);
}

export const fishPlan: BodyPlan = {
  id: 'fish',
  resolve: (sp, view, pose, opts) => resolveFish(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(FISH_SPECIES),
  restPose: () => FISH_REST,
  idlePose: (phase) => fishGodille(phase),
  walkPose: fishSwim,
  attackPose: fishLash,
  deathPose: () => FISH_DEATH,
  hasView: () => true,
};

export function fishSvg(p: FishProps, view: View, opts: { dead?: boolean; idlePhase?: number; colors?: Palette } = {}): string {
  const pose = opts.dead ? FISH_DEATH : opts.idlePhase != null ? fishGodille(opts.idlePhase) : {};
  return bonesToSvg(resolveFishFromProps(p, view, pose, opts.colors));
}
