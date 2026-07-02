/**
 * Catalogue des bâtiments — DÉRIVÉ du registre `defs/` (gen-registry.mjs).
 * Ajouter un bâtiment = déposer `defs/<id>.ts` (`export const building: BuildingDef = { id, label, defaultFoot,
 * roofMaterial }`) puis `npm run gen` (auto en dev via le plugin Vite). `BUILDINGS_META` (méta sémantique,
 * pour l'éditeur) en dérive — un seul fichier par bâtiment à tenir.
 */
import type { BuildingDef } from '../types';
import { BUILDING_DEFS } from './_registry.generated';

/** Méta sémantique d'un bâtiment pour l'éditeur (libellé d'outil, empreinte par défaut à la pose,
 *  matériau de toit par défaut). */
export type BuildingMeta = Pick<BuildingDef, 'id' | 'label' | 'defaultFoot' | 'roofMaterial'>;

export const BUILDINGS_META: Record<string, BuildingMeta> = Object.fromEntries(
  BUILDING_DEFS.map((b) => [b.id, { id: b.id, label: b.label, defaultFoot: b.defaultFoot, roofMaterial: b.roofMaterial }]),
);

/** Matériau de toit par défaut d'un style de bâtiment (id `RoofMaterialDef`), repli 'tuile' — remplace
 *  l'ancienne table `STYLE_MATERIAL` (méta désormais portée par chaque `BuildingDef`). */
export function styleRoofMaterial(style: string): string {
  return BUILDINGS_META[style]?.roofMaterial ?? 'tuile';
}
