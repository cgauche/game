/**
 * Compose du gabarit QUADRUPÈDE → ResolvedBone[] (MÊME format que le rig héros) : chaque
 * créature devient des os animables par-bone, recoloriés via le moteur de palette partagé.
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import { worldTransformsG, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap, DEFAULT_PALETTE, type Palette } from '../palette';
import {
  QUAD_SPECIES, buildQuadSkeleton, groundQuad, quadSkeletonForView,
  type QuadBoneId, type QuadProps,
} from './quadSkeleton';
import { quadParts } from './quadParts';
import { applyEyes } from '../parts/eyes';
import { QUAD_REST, quadWalkPose, quadBitePose, quadLeapPose, QUAD_DEATH } from './quadPose';
import { sortByZ } from '../composite';

const LEG_REF_TH = 9; // épaisseur de réf d'un os porteur (haut) → léger scale x des membres

/** (espèce, vue, pose, couleurs, ailes) → os résolus, triés z croissant (peintre). PUR. */
export function resolveQuad(
  species: string,
  view: View = 'profile',
  pose: Record<string, number> = {},
  colors?: Palette,
  wings: 'folded' | 'spread' = 'folded',
  eyes?: { G?: string; D?: string },
): ResolvedBone[] {
  return resolveQuadFromProps(QUAD_SPECIES[species] ?? QUAD_SPECIES.cheval, view, pose, colors, wings, eyes);
}

/** Même rendu, mais à partir d'un PROPS direct (réutilisé par le gabarit AILÉ qui a son propre
 *  catalogue d'espèces : un ailé = quadrupède + ailes via la même machinerie). PUR. */
export function resolveQuadFromProps(
  p: QuadProps,
  view: View = 'profile',
  pose: Record<string, number> = {},
  colors?: Palette,
  wings: 'folded' | 'spread' = 'folded',
  eyes?: { G?: string; D?: string },
): ResolvedBone[] {
  // Posture propre (p.stance) : deltas additifs SOUS la pose d'anim, en PROFIL seulement
  // (les vues de bout refigent leurs angles dans quadSkeletonForView).
  if (p.stance && view === 'profile') {
    const merged: Record<string, number> = { ...p.stance } as Record<string, number>;
    for (const [id, d] of Object.entries(pose)) merged[id] = (merged[id] ?? 0) + (d ?? 0);
    pose = merged;
  }
  const sk = groundQuad(quadSkeletonForView(buildQuadSkeleton(p), view), pose);
  const world = worldTransformsG(sk, pose) as Record<QuadBoneId, Matrix>;
  const parts = quadParts(p, view, wings);
  // Yeux custom (catalogue) sur les ancres data-eye de la tête (no-op sans ancre — hydre…).
  if (eyes && parts.tete) parts.tete = applyEyes(parts.tete, eyes);
  // Famille de jetons d'AILE (@aile*) : base custom `aile` de `stored` si la def en donne une
  // (pégase : ailes brun/doré ≠ robe blanche) ; SINON repli sur la famille `corps` — y compris
  // sous recoloriage utilisateur du slot `corps` (les ailes suivent la robe, comme avant).
  const ownWingTint = p.stored.aile != null;
  const stored = ownWingTint ? p.stored : {
    ...p.stored,
    aile: p.stored.corps ?? DEFAULT_PALETTE.corps,
    ...(p.stored.corpsO != null && { aileO: p.stored.corpsO }),
    ...(p.stored.corpsH != null && { aileH: p.stored.corpsH }),
  };
  const ov = colors ?? {};
  const tmap = buildTokenMap(stored, !ownWingTint && ov.corps != null ? ({ ...ov, aile: ov.corps } as Palette) : ov);
  const legW = 0.7 + 0.4 * p.girth; // pattes plus épaisses pour les bêtes trapues
  return sortByZ((Object.keys(parts) as QuadBoneId[])
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
    }));
}

export const quadrupedPlan: BodyPlan = {
  id: 'quadruped',
  resolve: (sp, view, pose, opts) => resolveQuad(sp, view, pose, opts?.colors, opts?.wings, opts?.eyes),
  speciesNames: () => Object.keys(QUAD_SPECIES),
  restPose: () => QUAD_REST,
  walkPose: quadWalkPose,
  attackPose: quadBitePose,
  deathPose: () => QUAD_DEATH,
  leapPose: quadLeapPose, // Bond (LDB 85) : démarche bondissante
  hasView: () => true,
};

