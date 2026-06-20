/**
 * Registre des GABARITS CORPORELS — indirige le rendu d'une créature vers son plan corporel.
 * UNE machinerie (FK générique + palette + facing) ; chaque
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
import { defByName, speciesScale } from './creatures';
import { findCreatureById } from '../../data';
import { isSwarm } from '../../engine/traits/dispatch';

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
 * non-bipède porte son `plan` (gabarit rigué). Ajouter/router une créature =
 * un fichier def, ZÉRO édition ici (plus aucune liste de noms en dur). Défaut = bipède (tout
 * humanoïde nommé ou générique non couvert par un def rigué).
 */
export function bodyPlanOf(name: string): BodyPlanId {
  return resolveByName(name).plan; // délègue au résolveur unique
}

/** Résolution de rendu d'un id de créature (sans espèce explicite) — sucre data-driven pour les outils
 *  DEV (galeries/QC) et chemins legacy : = `resolveRender(undefined, traits du record, id)`. */
export function resolveByName(idOrName: string): RenderResolution {
  return resolveRender(undefined, findCreatureById(idOrName)?.traits, idOrName);
}

/** Résolution de rendu UNIFIÉE et 100% DATA-DRIVEN (de-POC P5/5d) : classe (rig/gabarit), id de
 *  gabarit, espèce canonique et échelle de token. Résout par la DONNÉE — espèce explicite → espèce du
 *  RECORD (`findCreatureById`) → le LIBELLÉ du record (ou l'entrée brute = nom d'auteur) s'il EST une
 *  espèce canonique (lookup EXACT `defByName`) → bipède Humain. Trait Nuée → 'swarm'. PLUS de match flou.
 *  3ᵉ arg = `id` de créature (scènes/spawn) OU un nom d'auteur (statbloc custom nommé d'après une espèce). */
export interface RenderResolution {
  kind: 'rig' | 'plan';
  plan: BodyPlanId;
  species: string;
  scale: number;
}
export function resolveRender(species: string | undefined, traits: import('../../engine/statEntry').TraitList | undefined, idOrName: string): RenderResolution {
  const rec = findCreatureById(idOrName);
  // Pour le repli « nom EST une espèce » : le LIBELLÉ du record (ou l'entrée brute si pas de record —
  // statbloc custom nommé « Nain »). Jamais un id (lowercase) ⇒ defByName(id) ne matche pas par accident.
  const nameSp = rec?.label ?? idOrName;
  const swarmSp = PLANS.swarm?.speciesNames()[0] ?? '';
  if (isSwarm(traits)) {
    // Même résolution que la branche bipède : espèce explicite → espèce du RECORD → défaut Nuée.
    // (Sans ça, une Nuée au record typé — « Nuée de squigs » → Squig — perdait son espèce.)
    const sp = species ?? rec?.appearance?.species ?? swarmSp;
    return { kind: 'plan', plan: 'swarm', species: sp, scale: speciesScale(sp) };
  }
  // Résolution par la DONNÉE : espèce explicite → espèce du record → le libellé s'il EST une espèce
  // canonique (lookup EXACT, pas de fuzzy). Tout vient de `defByName`/`findCreatureById`.
  const resolved = species ?? rec?.appearance?.species ?? (defByName(nameSp) ? nameSp : undefined);
  if (resolved) {
    const d = defByName(resolved);
    if (d && d.plan !== 'biped') return { kind: 'plan', plan: d.plan, species: resolved, scale: speciesScale(resolved) };
    return { kind: 'rig', plan: 'biped', species: resolved, scale: speciesScale(resolved) };
  }
  // Record sans espèce mais trait Nuée (les records Nuée, si le caller n'a pas passé les traits).
  if (isSwarm(rec?.traits)) return { kind: 'plan', plan: 'swarm', species: swarmSp, scale: speciesScale(swarmSp) };
  // Inconnu (rôle générique : Bandit/Cultiste/Villageois…) → bipède Humain par défaut.
  return { kind: 'rig', plan: 'biped', species: 'Humain', scale: speciesScale('Humain') };
}
