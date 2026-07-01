import type { StructureAppearanceDef } from './types';
import { STRUCTURE_APPEARANCE_DEFS } from './_registry.generated';
export type { StructureAppearanceDef } from './types';
export const STRUCTURE_APPEARANCES: Record<string, StructureAppearanceDef> =
  Object.fromEntries(STRUCTURE_APPEARANCE_DEFS.map((s) => [s.id, s]));
/** Apparence d'une structure par id ; repli sur 'plain' (mur sans structure / id inconnu). */
export function structureAppearance(id?: string): StructureAppearanceDef {
  return (id && STRUCTURE_APPEARANCES[id]) || STRUCTURE_APPEARANCES['plain'];
}
