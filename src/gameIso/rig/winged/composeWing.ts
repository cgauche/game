/**
 * Gabarit AILÉ (griffon / pégase / hippogriffe / dragon). Un ailé = QUADRUPÈDE + ailes :
 * on réutilise INTÉGRALEMENT la machinerie quadrupède (squelette, parts, FK, palette) via
 * resolveQuadFromProps ; seules changent les PROPS (tête aigle/dragon, serres, ailes, queue).
 * Le dragon est un ailé à grande taille (sl) — la taille est un simple paramètre, pas un modèle
 * dédié, conformément au but « ajouter facilement des monstres de toute taille ».
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette } from '../palette';
import { resolveQuadFromProps } from '../quadruped/composeQuad';
import { QUAD_REST, quadWalkPose, quadBitePose, QUAD_DEATH } from '../quadruped/quadPose';
import { bonesToSvg } from '../renderBones';
import { WINGED_SPECIES, wingSpeciesMatch, wingedSpeciesNames } from '../creatures';

// La DATA des espèces ailées (Griffon/Pégase/Hippogriffe/Dragon + alias) vit dans
// `creatures/defs/<Nom>.ts` (plan: 'winged'). Ce module ne garde que le RENDU (resolveWing,
// plan, svg, échelle). On re-exporte la table/matcher dérivés (consommateurs inchangés).
export { WINGED_SPECIES, wingSpeciesMatch, wingedSpeciesNames };

/** (espèce ailée, vue, pose, couleurs) → os résolus (réutilise le pipeline quadrupède). */
export function resolveWing(
  species: string,
  view: View = 'profile',
  pose: Record<string, number> = {},
  colors?: Palette,
): ResolvedBone[] {
  return resolveQuadFromProps(WINGED_SPECIES[species] ?? WINGED_SPECIES.Griffon, view, pose, colors);
}

// Battement d'ailes (sinusoïde sur aileD/aileG, signes opposés). Vit DANS le plan : l'idle bat
// doucement (créature vivante), la marche/vol bat ample. AnimatedPlanToken l'anime — plus de
// token ailé dédié.
const wingFlap = (phase: number, amp: number): Record<string, number> => {
  const f = Math.sin(phase * Math.PI * 2) * amp;
  return { aileD: -f, aileG: f };
};
export const wingedPlan: BodyPlan = {
  id: 'winged',
  resolve: (sp, view, pose, opts) => resolveWing(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(WINGED_SPECIES),
  restPose: () => QUAD_REST,
  idlePose: (phase) => wingFlap(phase, 7), // battement doux au repos
  walkPose: (phase) => ({ ...quadWalkPose(phase), ...wingFlap(phase, 26) }), // pattes + battement ample
  attackPose: quadBitePose,
  deathPose: () => QUAD_DEATH,
  hasView: () => true,
};

/** Espèce ailée déduite d'un nom (clé/alias de WINGED_SPECIES ; défaut Griffon). Routage
 *  dérivé de la table (aliases) — plus aucune regex de noms à re-maintenir. */
export function wingSpeciesFromName(name: string): string {
  return wingSpeciesMatch(name) ?? 'Griffon';
}
/** Échelle globale de l'espèce (le dragon est géant) — à multiplier au token scale en jeu. */
export function wingSpeciesScale(name: string): number {
  return (WINGED_SPECIES[wingSpeciesFromName(name)] ?? WINGED_SPECIES.Griffon).sl;
}

/** SVG (string) d'un ailé prêt à injecter — pose mort/marche intégrée. */
export function wingedSvg(
  name: string,
  view: View,
  opts: { dead?: boolean; walkPhase?: number; colors?: Palette } = {},
): string {
  const sp = wingSpeciesFromName(name);
  const pose = opts.dead ? QUAD_DEATH : opts.walkPhase != null ? quadWalkPose(opts.walkPhase) : {};
  return bonesToSvg(resolveWing(sp, view, pose, opts.colors));
}
