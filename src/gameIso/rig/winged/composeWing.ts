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
import type { QuadProps } from '../quadruped/quadSkeleton';
import { resolveQuadFromProps } from '../quadruped/composeQuad';
import { QUAD_REST, quadWalkPose, quadBitePose, QUAD_DEATH } from '../quadruped/quadPose';
import { bonesToSvg } from '../renderBones';

/** Catalogue des espèces ailées (QuadProps + ailes + tête/membres adaptés). */
export const WINGED_SPECIES: Record<string, QuadProps> = {
  // Griffon : avant-train d'AIGLE (tête + serres + plumes dorées), arrière-train de LION
  // (pattes + queue à toupet). Encolure mi-dressée, ailes emplumées.
  Griffon: {
    sl: 1.15, build: 'feline', girth: 0.92, bodyLen: 1.0, neckLen: 0.72, neckAngle: -42, legLen: 1.02,
    head: 'aigle', tail: 'leonine', ears: 'pointues', foot: 'patte', frontFoot: 'serre', wings: 'plumes',
    stored: { corps: '#b08c44', corpsO: '#7e6128', corpsH: '#d6b362', cheveux: '#6a4f22', cheveuxO: '#3e2d12', cuir: '#caa23a' },
  },
  // Pégase : cheval ailé blanc — tête/queue/crinière équines, sabots, ailes emplumées claires.
  Pégase: {
    sl: 1.06, build: 'equine', girth: 0.94, bodyLen: 1.05, neckLen: 1.08, neckAngle: -48, legLen: 1.18,
    head: 'cheval', tail: 'crin', ears: 'courtes', foot: 'sabot', wings: 'plumes',
    stored: { corps: '#e6e2d6', corpsO: '#bab5a4', corpsH: '#f6f3ea', cheveux: '#cfc7b2', cheveuxO: '#a39a82', cuir: '#3a3630' },
  },
  // Hippogriffe : avant-train d'aigle (tête + serres), arrière-train de CHEVAL (sabots),
  // brun fauve, ailes emplumées.
  Hippogriffe: {
    sl: 1.08, build: 'equine', girth: 0.92, bodyLen: 1.02, neckLen: 0.84, neckAngle: -44, legLen: 1.12,
    head: 'aigle', tail: 'crin', ears: 'pointues', foot: 'sabot', frontFoot: 'serre', wings: 'plumes',
    stored: { corps: '#8a7048', corpsO: '#5e4a2c', corpsH: '#a98e5c', cheveux: '#4a3a22', cheveuxO: '#2c2114', cuir: '#caa23a' },
  },
  // Dragon : reptile ailé GÉANT (sl élevé) — tête à museau/cornes, queue écailleuse, serres,
  // ailes membraneuses. Écailles vertes (recoloriable → rouge/noir via la palette).
  Dragon: {
    sl: 1.95, build: 'draconic', girth: 1.08, bodyLen: 1.22, neckLen: 1.0, neckAngle: -34, legLen: 1.0,
    head: 'dragon', tail: 'reptile', ears: 'pointues', foot: 'serre', wings: 'membrane',
    stored: { corps: '#5c6e3c', corpsO: '#3a4724', corpsH: '#7c9152', cheveux: '#2c3618', cheveuxO: '#1a2010', cuir: '#caa23a' },
  },
};

export function wingedSpeciesNames(): string[] {
  return Object.keys(WINGED_SPECIES);
}

/** (espèce ailée, vue, pose, couleurs) → os résolus (réutilise le pipeline quadrupède). */
export function resolveWing(
  species: string,
  view: View = 'profile',
  pose: Record<string, number> = {},
  colors?: Palette,
): ResolvedBone[] {
  return resolveQuadFromProps(WINGED_SPECIES[species] ?? WINGED_SPECIES.Griffon, view, pose, colors);
}

export const wingedPlan: BodyPlan = {
  id: 'winged',
  resolve: (sp, view, pose, opts) => resolveWing(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(WINGED_SPECIES),
  restPose: () => QUAD_REST,
  walkPose: quadWalkPose,
  attackPose: quadBitePose,
  deathPose: () => QUAD_DEATH,
  hasView: () => true,
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const NAME_TO_SPECIES: [RegExp, string][] = [
  [/dragon|wyverne|vouivre|drake/, 'Dragon'],
  [/hippogriffe|hippogryphe/, 'Hippogriffe'], // AVANT griffon (sous-chaîne « griff »)
  [/pegase|pégase|cheval aile|cheval ailé/, 'Pégase'],
  [/griffon|gryphon|griffe ailee|demigriffon/, 'Griffon'],
];
/** Espèce ailée déduite d'un nom (défaut Griffon). */
export function wingSpeciesFromName(name: string): string {
  const n = norm(name);
  for (const [re, sp] of NAME_TO_SPECIES) if (re.test(n)) return sp;
  return 'Griffon';
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
