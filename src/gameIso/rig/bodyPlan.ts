/**
 * Registre des GABARITS CORPORELS — indirige le rendu d'une créature vers son plan, ou
 * 'monolithic' (legacy : pas de plan). UNE machinerie (FK générique + palette + facing) ; chaque
 * plan apporte son squelette + ses anims (poses). Le ROUTAGE est registry-driven : `bodyPlanOf`
 * dérive le plan du nom via les `defs/` (plus aucune chaîne de matchers par-plan à maintenir) ;
 * AJOUTER un gabarit = un module compose (BodyPlan exporté) + 1 entrée PLANS + des defs.
 */
import type { ResolvedBone } from './composeRig';
import type { View } from './facing';
import type { Palette } from './palette';
import type { Appearance } from './appearance';
import type { EquipCtx } from './parts/equipment';
import { bonesToSvg } from './renderBones';
import { bipedPlan } from './bipedPlan';
import { quadrupedPlan } from './quadruped/composeQuad';
import { wingedPlan } from './winged/composeWing';
import { serpentinePlan } from './serpentine/composeSerpent';
import { arachnidPlan } from './arachnid/composeSpider';
import { avianPlan } from './avian/composeBird';
import { cephalopodPlan } from './cephalopod/composeOctopus';
import { creaturePlanMatch, creatureMatch } from './creatures';

export type BodyPlanId = 'biped' | 'quadruped' | 'winged' | 'serpentine' | 'arachnid' | 'avian' | 'cephalopod';

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
  /** Anim de repos jouée EN CONTINU par AnimatedPlanToken (battement d'ailes, ondulation de
   *  serpent/pieuvre, dodelinement d'oiseau, frémissement d'araignée). Absente → idle figé. */
  idlePose?(phase: number): Record<string, number>;
  hasView(species: string, view: View): boolean;
}

const PLANS: Record<BodyPlanId, BodyPlan> = {
  biped: bipedPlan,
  quadruped: quadrupedPlan,
  winged: wingedPlan,
  serpentine: serpentinePlan,
  arachnid: arachnidPlan,
  avian: avianPlan,
  cephalopod: cephalopodPlan,
};
export function planById(id: BodyPlanId): BodyPlan {
  return PLANS[id];
}

/**
 * Plan corporel cosmétique d'un nom de créature. ENTIÈREMENT dérivé des `defs/` : chaque def
 * non-bipède porte son `plan` (gabarit rigué OU `monolithic`). Ajouter/router une créature =
 * un fichier def, ZÉRO édition ici (plus aucune liste de noms en dur). Défaut = bipède (tout
 * humanoïde nommé ou générique non couvert par un def rigué).
 */
export function bodyPlanOf(name: string): BodyPlanId | 'monolithic' {
  return creaturePlanMatch(name) ?? 'biped';
}

/** SVG statique (pose de repos) d'une créature NON-bipède rigée, pour l'exploration/l'éditeur.
 *  null si bipède (rendu via le rig héros) ou monolithique (sprite legacy). */
export function planStaticSvg(name: string, view: View, colors?: Palette): string | null {
  const id = bodyPlanOf(name);
  if (id === 'monolithic' || id === 'biped') return null;
  const plan = PLANS[id];
  const species = creatureMatch(name)?.name ?? plan.speciesNames()[0] ?? '';
  return bonesToSvg(plan.resolve(species, view, plan.restPose(), { colors }));
}
