/**
 * Registre UNIQUE des appendices (cornes/queue), DÉRIVÉ des `defs/` (1 appendice = 1 fichier).
 * Source unique de l'art de corne/queue : plus aucune string SVG inline hors des defs. Résolu partout
 * par la primitive `pickView` (référence-par-id → art par vue, comme têtes/tenues).
 */
import type { PartArt } from '../types';
import type { BoneId } from '../../bones';
import type { RaceFeature } from '../../races/types';
import { APPENDAGE_DEFS, type AppendageId } from './_registry.generated';

export type { AppendageId };
export type { AppendageDef } from './types';

/** id → art multi-vues (back = front par défaut, cornes symétriques). */
export const APPENDAGES: Record<string, PartArt> = Object.fromEntries(
  APPENDAGE_DEFS.map((a) => [a.id, { front: a.front, back: a.back ?? a.front, profile: a.profile }]),
);

/** Art multi-vues d'un appendice par id (repli générique cornes si id inconnu). */
export function appendageArt(id: string): PartArt {
  return APPENDAGES[id] ?? APPENDAGES['cornes-generique'];
}

/** Feature de créature portant un appendice MULTI-VUES du registre (cornes/queue). Remplace
 *  `features: [{ bone, svg: OV_CORNES_X }]` (art brut 1-vue) par une réf de type résolue par vue. */
export const appendageFeature = (appendage: AppendageId, bone: BoneId = 'tete', layer = -2): RaceFeature =>
  ({ bone, appendage, svg: '', layer });
