/**
 * Catalogue des bâtiments — DÉRIVÉ du registre `defs/` (gen-registry.mjs).
 * Ajouter un bâtiment = déposer `defs/<id>.ts` (`export const building: BuildingDef = { id, label, defaultFoot,
 * roofMaterial }`) puis `npm run gen` (auto en dev via le plugin Vite). `BUILDINGS_META` (méta sémantique,
 * pour l'éditeur) en dérive — un seul fichier par bâtiment à tenir.
 */
import type { BuildingDef, BuildingFeature } from '../types';
import { BUILDING_DEFS } from './_registry.generated';

/** Méta sémantique d'un bâtiment pour l'éditeur (libellé d'outil, empreinte par défaut à la pose,
 *  matériau de toit par défaut). */
export type BuildingMeta = Pick<BuildingDef, 'id' | 'label' | 'defaultFoot' | 'roofMaterial'>;

export const BUILDINGS_META: Record<string, BuildingMeta> = Object.fromEntries(
  BUILDING_DEFS.map((b) => [b.id, { id: b.id, label: b.label, defaultFoot: b.defaultFoot, roofMaterial: b.roofMaterial }]),
);

/** Matériau de toit par DÉFAUT d'un style de bâtiment (id `RoofMaterialDef`, porté par le `BuildingDef`).
 *  Style absent du registre → `undefined` : l'appelant tranche, aucun matériau ne se substitue à un autre. */
export function styleRoofMaterial(style: string): string | undefined {
  return BUILDINGS_META[style]?.roofMaterial;
}

const BY_ID: Record<string, BuildingDef> = Object.fromEntries(BUILDING_DEFS.map((b) => [b.id, b]));

/** Ornements d'identité d'un style de bâtiment (clocheton/cheminée/enseigne/étal), repli `[]` — lus par
 *  `builders/props` pour émettre un billboard par ornement. SÉPARÉ de `BUILDINGS_META` (méta éditeur). */
export function buildingFeatures(style: string): BuildingFeature[] {
  return BY_ID[style]?.features ?? [];
}
