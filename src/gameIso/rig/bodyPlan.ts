/**
 * Registre des GABARITS CORPORELS — indirige le rendu d'une créature vers son plan
 * (bipède / quadrupède / ailé), ou 'monolithic' (legacy : pas encore de plan). Une seule
 * machinerie (FK générique + palette + facing) ; chaque plan apporte son squelette + ses anims.
 */
import type { ResolvedBone } from './composeRig';
import type { View } from './facing';
import type { Palette } from './palette';
import type { Appearance } from './appearance';
import type { EquipCtx } from './parts/equipment';
import { classifyEnemy } from './enemyProfile';
import { bipedPlan } from './bipedPlan';
import { quadrupedPlan } from './quadruped/composeQuad';
import { quadSpeciesMatch } from './quadruped/quadSkeleton';
import { wingedPlan, wingSpeciesMatch } from './winged/composeWing';

export type BodyPlanId = 'biped' | 'quadruped' | 'winged';

/** Options de résolution communes (le bipède lit appearance/equip/career ; tous lisent colors). */
export interface ResolveOpts {
  colors?: Palette;
  career?: string;
  appearance?: Appearance;
  equip?: EquipCtx;
}

export interface BodyPlan {
  id: BodyPlanId;
  /** (espèce, vue, pose, opts) → os résolus (boîte 120×150, pieds au sol), triés z. */
  resolve(species: string, view: View, pose: Record<string, number>, opts?: ResolveOpts): ResolvedBone[];
  speciesNames(): string[];
  restPose(): Record<string, number>;
  walkPose(phase: number): Record<string, number>;
  attackPose(phase: number): Record<string, number>;
  deathPose(): Record<string, number>;
  hasView(species: string, view: View): boolean;
}

const PLANS: Record<BodyPlanId, BodyPlan> = {
  biped: bipedPlan,
  quadruped: quadrupedPlan,
  winged: wingedPlan, // Phase C : gabarit ailé (griffon/pégase/hippogriffe/dragon)
};
export function planById(id: BodyPlanId): BodyPlan {
  return PLANS[id];
}

/**
 * Plan corporel cosmétique d'un nom de créature. 'monolithic' = pas (encore) de plan dédié.
 * Le routage par NOM est ENTIÈREMENT dérivé des tables d'espèces (WINGED_SPECIES / QUAD_SPECIES
 * + leurs `aliases`) : ajouter une créature ailée/quadrupède = UNE entrée dans sa table, et elle
 * est routée ici sans toucher à ce fichier. L'ordre ailé→quad→bipède préserve les priorités
 * (un griffon n'est ni un quadrupède nu ni un humanoïde).
 */
export function bodyPlanOf(name: string): BodyPlanId | 'monolithic' {
  if (wingSpeciesMatch(name)) return 'winged';
  if (quadSpeciesMatch(name)) return 'quadruped';
  return classifyEnemy(name) === 'rig' ? 'biped' : 'monolithic';
}
