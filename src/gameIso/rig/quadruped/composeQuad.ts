/**
 * Compose du gabarit QUADRUPÈDE → ResolvedBone[] (MÊME format que le rig héros) : chaque
 * créature devient des os animables par-bone, recoloriés via le moteur de palette partagé.
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import { bonesToSvg } from '../renderBones';
import { worldTransformsG, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap, type Palette } from '../palette';
import {
  QUAD_SPECIES, buildQuadSkeleton, groundQuad, quadSkeletonForView, type QuadBoneId, type QuadProps,
} from './quadSkeleton';
import { quadParts } from './quadParts';
import { QUAD_REST, quadWalkPose, quadBitePose, QUAD_DEATH } from './quadPose';

const LEG_REF_TH = 9; // épaisseur de réf d'un os porteur (haut) → léger scale x des membres

/** (espèce, vue, pose, couleurs) → os résolus, triés z croissant (peintre). PUR. */
export function resolveQuad(
  species: string,
  view: View = 'profile',
  pose: Record<string, number> = {},
  colors?: Palette,
): ResolvedBone[] {
  return resolveQuadFromProps(QUAD_SPECIES[species] ?? QUAD_SPECIES.Cheval, view, pose, colors);
}

/** Même rendu, mais à partir d'un PROPS direct (réutilisé par le gabarit AILÉ qui a son propre
 *  catalogue d'espèces : un ailé = quadrupède + ailes via la même machinerie). PUR. */
export function resolveQuadFromProps(
  p: QuadProps,
  view: View = 'profile',
  pose: Record<string, number> = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = groundQuad(quadSkeletonForView(buildQuadSkeleton(p), view), pose);
  const world = worldTransformsG(sk, pose) as Record<QuadBoneId, Matrix>;
  const parts = quadParts(p, view);
  const tmap = buildTokenMap(p.stored, colors ?? {});
  const legW = 0.7 + 0.4 * p.girth; // pattes plus épaisses pour les bêtes trapues
  return (Object.keys(parts) as QuadBoneId[])
    .filter((id) => parts[id])
    .map((id) => {
      const b = sk[id];
      const isLeg = id.startsWith('haut') || id.startsWith('bas');
      const isBody = id === 'tronc' || id === 'croupe';
      const sx = isLeg ? (b.thickness / LEG_REF_TH) * legW : 1;
      const sy = isBody ? p.girth : 1; // carrure = profondeur du corps
      return {
        id,
        matrix: world[id],
        scale: [sx, sy] as [number, number],
        z: b.z,
        parts: [{ svg: applyTokenMap(parts[id]!, tmap), layer: 0 }],
      };
    })
    .sort((a, b) => a.z - b.z);
}

export const quadrupedPlan: BodyPlan = {
  id: 'quadruped',
  resolve: (sp, view, pose, opts) => resolveQuad(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(QUAD_SPECIES),
  restPose: () => QUAD_REST,
  walkPose: quadWalkPose,
  attackPose: quadBitePose,
  deathPose: () => QUAD_DEATH,
  hasView: () => true,
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Nom de bestiaire → espèce quadrupède (le 1er match gagne ; ordre = priorité).
const NAME_TO_SPECIES: [RegExp, string][] = [
  [/cheval|chevaux|destrier|poney|jument|etalon|monture|palefroi/, 'Cheval'],
  [/sanglier|laie|marcassin|truie|cochon|porc/, 'Sanglier'],
  [/\brat\b|rat geant|rongeur/, 'Rat géant'],
  [/ours|ourse|ursin/, 'Ours'],
  [/charognard/, 'Charognard'],
  [/chien|matin|dogue|mastiff|limier|molosse/, 'Chien'],
  [/loup|louve|warg|patrouille/, 'Loup'],
];
/** Espèce quadrupède déduite d'un nom de créature (défaut Loup). */
export function quadSpeciesFromName(name: string): string {
  const n = norm(name);
  for (const [re, sp] of NAME_TO_SPECIES) if (re.test(n)) return sp;
  return 'Loup';
}
/** Échelle globale de l'espèce (rat petit, ours grand) — à multiplier au token scale en jeu
 *  pour des TAILLES RELATIVES cohérentes (un rat n'a pas la taille d'un cheval). */
export function quadSpeciesScale(name: string): number {
  return (QUAD_SPECIES[quadSpeciesFromName(name)] ?? QUAD_SPECIES.Cheval).sl;
}

/** SVG (string, boîte 120×150) d'un quadrupède prêt à injecter — pose mort/marche INTÉGRÉE
 *  (la mort s'aplatit sur le flanc dans la pose, PAS de bascule 78° du rendu). */
export function quadrupedSvg(
  name: string,
  view: View,
  opts: { dead?: boolean; walkPhase?: number; colors?: Palette } = {},
): string {
  const sp = quadSpeciesFromName(name);
  const pose = opts.dead ? QUAD_DEATH : opts.walkPhase != null ? quadWalkPose(opts.walkPhase) : {};
  return bonesToSvg(resolveQuad(sp, view, pose, opts.colors));
}
