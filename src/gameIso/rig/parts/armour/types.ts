import type { PartArt } from '../types';
import type { StoredPalette } from '../../palette';

/** Slots couverts par une armure. Valeurs = PartArt (SVG dans le repère LOCAL de l'os porteur). */
export type ArmourSet = Partial<Record<'tete' | 'torse' | 'bras' | 'jambes', PartArt>>;

/**
 * Une armure = un fichier `defs/<Nom>.ts`. `name` = la CLÉ de lookup : le MATÉRIAU en minuscules
 * ('rembourre' | 'cuir' | 'maille' | 'plaque') — `armourPart` (equipment.ts) résout le matériau
 * inféré du nom de l'objet vers ce `name`.
 *
 * `palette` : couleurs par défaut des `@tokens` de l'art (StoredPalette = hex exact) → rendu sans
 * perte + recoloriage cohérent par le skin d'objet, EXACTEMENT comme les tenues.
 */
export interface ArmourDef { name: string; set: ArmourSet; palette?: StoredPalette }
