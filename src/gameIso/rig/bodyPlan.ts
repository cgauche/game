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
import { creaturePlanMatch, creatureMatch, defByName, speciesScale, bipedSpeciesMatch, bipedSpeciesScale, creatureSpeciesScale } from './creatures';
import { findCreature } from '../../data';
import { isSwarm } from '../../engine/traits/dispatch';

/** Essaim depuis un NOM (lookup record → traits) — repli pour les chemins qui n'ont que le nom.
 *  La détection canonique est `isSwarm(traits)` (registre des Traits) ; ici on résout les traits. */
const isSwarmName = (name: string): boolean => isSwarm(findCreature(name)?.traits);

/** Identifiant de gabarit — chaîne libre dérivée des `plans/defs/` (data-driven : chaque plan
 *  déclare son `id`). Le monolithique n'est PAS un BodyPlan (fallback legacy hors registre). */
export type BodyPlanId = string;

/** État des AILES d'un gabarit ailé : REPLIÉES le long du dos (repos) ou DÉPLOYÉES (vol/
 *  attaque/mort étalée). Décidé par l'animation (usePlanAnim) — l'art change, pas que l'angle. */
export type WingState = 'folded' | 'spread';

/** Options de résolution communes (le bipède lit appearance/equip/tenue ; tous lisent colors). */
export interface ResolveOpts {
  colors?: Palette;
  tenue?: string;
  appearance?: Appearance;
  equip?: EquipCtx;
  /** Gabarit AILÉ seulement : état des ailes (défaut 'folded' — une bête posée replie). */
  wings?: WingState;
  /** Yeux personnalisés (ARTS du catalogue, déjà résolus) — appliqués sur les ancres
   *  `data-eye` des têtes de gabarit (quad/ailé). Sans ancre → no-op. */
  eyes?: { G?: string; D?: string };
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
  /** BOND (trait LDB 85) : démarche bondissante jouée à la place de walkPose quand le
   *  combattant a le trait — ramassé/détente cyclique. Absente → walkPose (repli). */
  leapPose?(phase: number): Record<string, number>;
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
  return resolveRender(undefined, findCreature(name)?.traits, name).plan; // délègue au résolveur unique
}

/** Résolution de rendu UNIFIÉE et DATA-DRIVEN (de-POC P5) : classe (rig/gabarit), id de gabarit,
 *  espèce canonique et échelle de token — depuis l'ESPÈCE EXPLICITE (lookup exact) + le trait Nuée.
 *  `name` n'est qu'un REPLI transitoire (entités/spawns sans espèce explicite) retiré en 5d avec le
 *  matcher flou. UNE source pour pickBackend / usePlanAnim / CreaturePreview / MountedToken. */
export interface RenderResolution {
  kind: 'rig' | 'plan';
  plan: BodyPlanId | 'monolithic';
  species: string;
  scale: number;
}
export function resolveRender(species: string | undefined, traits: string[] | undefined, name: string): RenderResolution {
  if (isSwarm(traits)) {
    const sp = species || PLANS.swarm?.speciesNames()[0] || '';
    return { kind: 'plan', plan: 'swarm', species: sp, scale: species ? speciesScale(species) : creatureSpeciesScale(name) };
  }
  if (species) {
    const d = defByName(species);
    if (d && d.plan !== 'biped') return { kind: 'plan', plan: d.plan, species, scale: speciesScale(species) };
    return { kind: 'rig', plan: 'biped', species, scale: speciesScale(species) };
  }
  // Repli name-match (transitoire — retiré en 5d) : nuée → 'swarm' ; non-bipède → son plan ; sinon rig.
  const swarm = isSwarmName(name);
  const nbPlan = creaturePlanMatch(name);
  if (swarm || nbPlan) {
    const plan = swarm ? 'swarm' : nbPlan!;
    const sp = creatureMatch(name)?.name ?? (plan !== 'monolithic' ? PLANS[plan]?.speciesNames()[0] : '') ?? '';
    return { kind: 'plan', plan, species: sp, scale: creatureSpeciesScale(name) };
  }
  return { kind: 'rig', plan: 'biped', species: bipedSpeciesMatch(name) ?? 'Humain', scale: bipedSpeciesScale(name) };
}
