import type { RoofMaterialDef } from './types';
import { roofMaterials } from '../../../data';
export type { RoofMaterialDef } from './types';

const MAP: Record<string, RoofMaterialDef> = Object.fromEntries(roofMaterials.map((m) => [m.id, m]));

/** Matériau de toit par id ; repli sur 'tuile' (id inconnu). */
export function roofMaterial(id: string): RoofMaterialDef {
  return MAP[id] ?? MAP['tuile'];
}
