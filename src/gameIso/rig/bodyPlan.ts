/**
 * Registre des GABARITS CORPORELS — indirige le rendu d'une créature vers son plan corporel.
 * UNE machinerie (FK générique + palette + facing) ; chaque
 * plan apporte son squelette + ses anims (poses). TOUT est registry-driven : `bodyPlanById` dérive
 * le plan de l'espèce EXPLICITE du record via `creatures/defs/`, et la table PLANS est AUTO-ENREGISTRÉE depuis
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
import { defById, speciesScale } from './creatures';
import { findCreatureById, vehicles } from '../../data';
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
  /** viewBox du DISQUE-PORTRAIT (vue du dessus / inspection / VsHeader) cadrant ce gabarit, dans le
   *  repère de corps 120×150. Absent → défaut générique créature (`CREATURE_BOX`, haut-avant). Un corps
   *  STATIQUE ANCRÉ AU SOL (engin de siège) occupe le BAS de la boîte → il cadre son PROPRE bloc, sinon
   *  le portrait est vide (l'art tombe sous le cadre haut-avant). */
  portraitBox?: string;
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
 * Plan corporel d'un id de créature (RECORD). ENTIÈREMENT dérivé des `defs/` : chaque def
 * non-bipède porte son `plan` (gabarit rigué). Ajouter/router une créature = un fichier def, ZÉRO
 * édition ici. La résolution lit l'espèce EXPLICITE du record (`appearance.species`) — plus AUCUNE
 * devinette par libellé. Défaut = bipède Humain (record sans espèce).
 */
export function bodyPlanById(id: string): BodyPlanId {
  return resolveById(id).plan; // délègue au résolveur unique
}

/** Résolution de rendu d'un id de créature (RECORD) — = `resolveRender(undefined, traits du record, id)`.
 *  L'espèce vient de `appearance.species` du record ; sans espèce explicite → bipède Humain. */
export function resolveById(id: string): RenderResolution {
  return resolveRender(undefined, findCreatureById(id)?.traits, id);
}

/** Résout une ESPÈCE CANONIQUE connue (nom de def, lookup EXACT) → {kind,plan,species,scale}. Pour les
 *  OUTILS dev (galeries/QC) et tests qui partent d'un NOM D'ESPÈCE, jamais d'un id de record. Passe par
 *  la branche espèce-explicite (l'arg gagne) → EXACT-only, plus aucun match flou par libellé. */
export function resolveSpecies(species: string): RenderResolution {
  return resolveRender(species, undefined, species);
}

/** Résolution de rendu UNIFIÉE et 100% DATA-DRIVEN (de-POC P5/5d) : classe (rig/gabarit), id de
 *  gabarit, espèce canonique et échelle de token. Résout par la DONNÉE — espèce explicite (arg) →
 *  espèce du RECORD (`findCreatureById(id).appearance.species`) → bipède Humain. Trait Nuée → 'swarm'.
 *  PLUS aucun repli par libellé/nom d'auteur (le 3ᵉ arg ne sert qu'au record + match véhicule).
 *  3ᵉ arg = `id` de créature (scènes/spawn) ; une ESPÈCE explicite passe par le 1er arg (cf. resolveSpecies). */
export interface RenderResolution {
  kind: 'rig' | 'plan';
  plan: BodyPlanId;
  species: string;
  scale: number;
}
export function resolveRender(species: string | undefined, traits: import('../../engine/statEntry').TraitList | undefined, idOrName: string): RenderResolution {
  // Véhicule À COQUE (navire) → gabarit `navire`, DATA-DRIVEN : le gréement (`hull.rig`) devient l'« espèce »
  // qui pilote la silhouette, l'échelle vient de la longueur (`ship.lengthM`). Prioritaire (un nom de
  // vaisseau ne tombe pas sur la résolution créature).
  const veh = vehicles.find((v) => v.hull && (v.id === idOrName || v.label === idOrName));
  if (veh) return { kind: 'plan', plan: 'navire', species: veh.hull!.rig ?? 'mixte', scale: Math.max(0.7, Math.min(2.4, (veh.ship?.lengthM ?? 20) / 20)) };
  const rec = findCreatureById(idOrName);
  // Nuée NON typée (aucune espèce de forme) → forme GÉNÉRIQUE (DEFAULT_FORM de composeSwarm via ''),
  // jamais la 1re forme du registre (speciesNames() alimente le picker d'éditeur, pas ce défaut).
  const swarmSp = '';
  if (isSwarm(traits)) {
    // Même résolution que la branche bipède : espèce explicite → espèce du RECORD → défaut Nuée.
    // (Sans ça, une Nuée au record typé — « Nuée de squigs » → Squig — perdait son espèce.)
    const sp = species ?? rec?.appearance?.species ?? swarmSp;
    return { kind: 'plan', plan: 'swarm', species: sp, scale: speciesScale(sp) };
  }
  // Résolution par la DONNÉE : espèce EXPLICITE (arg) → espèce du record. PLUS de repli par libellé.
  const resolved = species ?? rec?.appearance?.species;
  if (resolved) {
    const d = defById(resolved);
    if (d && d.plan !== 'biped') return { kind: 'plan', plan: d.plan, species: resolved, scale: speciesScale(resolved) };
    return { kind: 'rig', plan: 'biped', species: resolved, scale: speciesScale(resolved) };
  }
  // Record sans espèce mais trait Nuée (les records Nuée, si le caller n'a pas passé les traits).
  if (isSwarm(rec?.traits)) return { kind: 'plan', plan: 'swarm', species: swarmSp, scale: speciesScale(swarmSp) };
  // Inconnu (rôle générique : Bandit/Cultiste/Villageois…) → bipède Humain par défaut.
  return { kind: 'rig', plan: 'biped', species: 'humain', scale: speciesScale('humain') };
}
