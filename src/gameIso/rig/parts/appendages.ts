/**
 * Registre UNIQUE des cornes/queue MULTI-VUES (id → art 3 vues). SOURCE unique de l'art d'appendice :
 * référencé PAR ID depuis les têtes monstrueuses (`monster/defs`), depuis les `features` de créature
 * (via `RaceFeature.appendage`), et depuis `monsterInjection`. Résolu PARTOUT par `pickView` — la même
 * primitive que têtes/tenues (référence-par-clé → art par vue), donc aucun mécanisme parallèle.
 *
 * back = front par défaut (cornes symétriques : lues juste de dos) ; le profil est dédié (une corne
 * de face plaquée sur une tête tournée lit faux). Ajouter un type d'appendice = une entrée ici + son
 * profil dans `monsterOverlays.ts`.
 */
import type { PartArt } from './types';
import type { BoneId } from '../bones';
import type { RaceFeature } from '../races/types';
import {
  OV_CORNES, OV_CORNES_PROFILE, OV_CORNES_TAUREAU, OV_CORNES_TAUREAU_PROFILE,
  OV_CORNES_DEMON, OV_CORNES_DEMON_PROFILE, OV_CORNES_CAPRIN, OV_CORNES_CAPRIN_PROFILE,
  OV_CORNES_GOR, OV_CORNES_GOR_PROFILE, OV_CORNES_VESTIGIALES, OV_CORNES_VESTIGIALES_PROFILE,
  OV_QUEUE, OV_QUEUE_PROFILE, OV_QUEUE_RAT, OV_QUEUE_RAT_PROFILE,
} from './monsterOverlays';

const mv = (front: string, profile: string, back = front): PartArt => ({ front, back, profile });

export const APPENDAGES = {
  'cornes-generique': mv(OV_CORNES, OV_CORNES_PROFILE),
  'cornes-taureau': mv(OV_CORNES_TAUREAU, OV_CORNES_TAUREAU_PROFILE),
  'cornes-demon': mv(OV_CORNES_DEMON, OV_CORNES_DEMON_PROFILE),
  'cornes-caprin': mv(OV_CORNES_CAPRIN, OV_CORNES_CAPRIN_PROFILE),
  'cornes-gor': mv(OV_CORNES_GOR, OV_CORNES_GOR_PROFILE),
  'cornes-vestigiales': mv(OV_CORNES_VESTIGIALES, OV_CORNES_VESTIGIALES_PROFILE),
  'queue-generique': mv(OV_QUEUE, OV_QUEUE_PROFILE),
  'queue-rat': mv(OV_QUEUE_RAT, OV_QUEUE_RAT_PROFILE),
} satisfies Record<string, PartArt>;

export type AppendageId = keyof typeof APPENDAGES;

/** Art multi-vues d'un appendice par id (repli générique cornes si id inconnu). */
export function appendageArt(id: string): PartArt {
  return (APPENDAGES as Record<string, PartArt>)[id] ?? APPENDAGES['cornes-generique'];
}

/** Feature de créature portant un appendice MULTI-VUES du registre (cornes/queue). Remplace
 *  `features: [{ bone, svg: OV_CORNES_X }]` (art brut 1-vue) par une réf de type résolue par vue. */
export const appendageFeature = (appendage: AppendageId, bone: BoneId = 'tete', layer = -2): RaceFeature =>
  ({ bone, appendage, svg: '', layer });
