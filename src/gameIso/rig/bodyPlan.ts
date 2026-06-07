/**
 * Registre des GABARITS CORPORELS — indirige le rendu d'une créature vers son plan, ou
 * 'monolithic' (legacy : pas de plan). UNE machinerie (FK générique + palette + facing) ; chaque
 * plan apporte son squelette + ses anims (poses). TOUT est registry-driven : `bodyPlanOf` dérive
 * le plan du nom via `creatures/defs/`, et la table PLANS est AUTO-ENREGISTRÉE depuis
 * `plans/defs/` — AJOUTER un gabarit = un module compose (BodyPlan exporté) + un `plans/defs/<id>.ts`
 * d'une ligne + des defs de créatures. ZÉRO édition de ce fichier.
 */
import type { ResolvedBone } from './composeRig';
import type { View } from './facing';
import type { Palette } from './palette';
import type { Appearance } from './appearance';
import type { EquipCtx } from './parts/equipment';
import { bonesToSvg } from './renderBones';
import { PLAN_LIST } from './plans/_registry.generated';
import { creaturePlanMatch, creatureMatch } from './creatures';

/** Identifiant de gabarit — chaîne libre dérivée des `plans/defs/` (data-driven : chaque plan
 *  déclare son `id`). Le monolithique n'est PAS un BodyPlan (fallback legacy hors registre). */
export type BodyPlanId = string;

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

/** Table des gabarits DÉRIVÉE des fichiers `plans/defs/` (auto-enregistrés via le codegen) —
 *  plus de registre central à éditer. Ajouter un gabarit = déposer `plans/defs/<id>.ts`. */
const PLANS: Record<string, BodyPlan> = Object.fromEntries(PLAN_LIST.map((p) => [p.id, p]));
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
