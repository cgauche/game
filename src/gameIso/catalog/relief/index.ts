import type { ReliefMaterialDef } from './types';
import { reliefMaterials } from '../../../data';
export type { ReliefMaterialDef } from './types';

const MAP: Record<string, ReliefMaterialDef> = Object.fromEntries(reliefMaterials.map((m) => [m.id, m]));

/** Matériau de relief par id ; repli sur 'pierre' (id inconnu). */
export function reliefMaterial(id: string): ReliefMaterialDef {
  return MAP[id] ?? MAP['pierre'];
}
