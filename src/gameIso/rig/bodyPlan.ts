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
import { wingedPlan } from './winged/composeWing';

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

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Quadrupèdes couverts par le gabarit (testé AVANT le classifieur humanoïde).
const QUAD_RE = /\b(cheval|chevaux|destrier|poney|jument|etalon|loup|louve|chien|matin|dogue|mastiff|charognard|sanglier|laie|marcassin|ours|ourse|rat geant|grand rat|felin|panthere|lion|lionne|tigre)\b/;
// Ailés (testés AVANT quad/bipède : un griffon n'est ni un quadrupède nu ni un humanoïde).
const WINGED_RE = /\b(griffon|gryphon|demigriffon|hippogriffe|hippogryphe|pegase|pégase|cheval aile|cheval ailé|dragon|wyverne|vouivre|drake)\b/;

/** Plan corporel cosmétique d'un nom de créature. 'monolithic' = pas (encore) de plan dédié. */
export function bodyPlanOf(name: string): BodyPlanId | 'monolithic' {
  const n = norm(name);
  if (WINGED_RE.test(n)) return 'winged';
  if (QUAD_RE.test(n)) return 'quadruped';
  return classifyEnemy(name) === 'rig' ? 'biped' : 'monolithic';
}
