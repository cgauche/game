/**
 * Gabarit NUÉE / ESSAIM (trait « Nuée », LDB 85) — une créature unique qui EST une masse grouillante
 * de petites bêtes (rats, araignées, marcassins, nurglings…). Rendu GÉNÉRIQUE piloté par le TRAIT,
 * pas par le nom : un amas bas de petits corps ovoïdes (pattes, œil luisant, queue) qui frémit.
 * La teinte vient de la palette du record (`appearance.colors.corps`) → un même gabarit sert toutes
 * les nuées (brun = rats, sombre = araignées, vert = nurglings…). Anim propre : frémissement au repos.
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';

type SwarmBoneId = 'corps';
type SBone = FKBone & { z: number };
export interface SwarmProps { sl: number; stored: StoredPalette; }

const buildSkeleton = (): Record<SwarmBoneId, SBone> => ({
  corps: { parent: null, pivot: { x: 60, y: 92 }, angle: 0, z: 1 },
});

/** Une petite bête de l'amas : corps ovoïde + ventre, pattes, queue grêle, œil luisant. */
function critter(cx: number, cy: number, s: number, flip: number): string {
  return `<g transform="translate(${cx},${cy}) scale(${s * flip},${s})">`
    + '<path d="M-2.6 4 l-1.6 3.4 M0 4.4 l0 3.4 M2.6 4 l1.6 3.4" stroke="@corpsO" stroke-width="0.7"/>'
    + '<ellipse cx="0" cy="0" rx="5.6" ry="3.7" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>'
    + '<ellipse cx="0" cy="1.3" rx="4" ry="1.7" fill="@corpsO" opacity="0.45"/>'
    + '<path d="M-5.4 -0.6 q-3.2 -0.8 -5 -2.8" stroke="@corpsO" stroke-width="0.8" fill="none"/>'
    + '<circle cx="4.2" cy="-1.1" r="1" fill="#160c06"/><circle cx="4.5" cy="-1.4" r="0.35" fill="#e8c84a"/>'
    + '</g>';
}

// Amas : rangée arrière (petite, sombre, haute) → avant (grosse, basse). y croissant = vers le sol.
const SPOTS: [number, number, number, number][] = [
  [-13, 18, 0.78, 1], [3, 16, 0.76, -1], [16, 19, 0.8, 1],
  [-21, 27, 0.96, -1], [-4, 26, 1.02, 1], [12, 28, 0.98, -1], [24, 25, 0.9, 1],
  [-12, 36, 1.12, 1], [7, 37, 1.14, -1],
];
function heap(): string {
  return `<g>${SPOTS.map(([x, y, s, f]) => critter(x, y, s, f)).join('')}</g>`;
}

// --- poses (delta additif) : la masse frémit / ondule légèrement ---------------
const SWARM_REST: Record<string, number> = {};
const swarmSeethe = (phase: number): Record<string, number> => ({ corps: Math.sin(phase * Math.PI * 2) * 2.5 });
const swarmScuttle = (phase: number): Record<string, number> => ({ corps: Math.sin(phase * Math.PI * 2) * 5 });
const swarmSurge = (phase: number): Record<string, number> => ({ corps: Math.sin(Math.min(1, phase) * Math.PI) * 7 });
const SWARM_DEATH: Record<string, number> = { corps: 10 };

const SWARM_DEFAULT: SwarmProps = {
  sl: 1, stored: { corps: '#6a5a44', corpsO: '#3e3424', corpsH: '#8a7a5e' },
};

function resolveSwarm(_species: string, view: View, pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  void view; // un amas se lit pareil sous tous les angles
  const p = SWARM_DEFAULT;
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<SwarmBoneId, Matrix>;
  const tmap = buildTokenMap(p.stored, colors ?? {});
  return [{ id: 'corps', matrix: world.corps, scale: [1, 1], z: sk.corps.z, parts: [{ svg: applyTokenMap(heap(), tmap), layer: 0 }] }];
}

export const swarmPlan: BodyPlan = {
  id: 'swarm',
  resolve: (sp, view, pose, opts) => resolveSwarm(sp, view, pose, opts?.colors),
  speciesNames: () => [],
  restPose: () => SWARM_REST,
  idlePose: swarmSeethe,
  walkPose: swarmScuttle,
  attackPose: swarmSurge,
  deathPose: () => SWARM_DEATH,
  hasView: () => true,
};
