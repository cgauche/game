import type { StructureAppearanceDef } from './types';
import type { WallSeg } from '../../../state/scene';
import { structureAppearances } from '../../../data';
export type { StructureAppearanceDef } from './types';

const MAP: Record<string, StructureAppearanceDef> = Object.fromEntries(structureAppearances.map((s) => [s.id, s]));

/** Apparence d'une structure par id ; repli sur 'plain' (mur nu / id inconnu). */
export function structureAppearance(id?: string): StructureAppearanceDef {
  return (id && MAP[id]) || MAP['plain'];
}

/** Apparence d'un mur d'arête — SOURCE UNIQUE iso + POV : sa structure, sinon rempart de pierre si
 *  surélevé (base > 1 m), sinon mur nu. */
export function wallApp(seg: WallSeg, baseH: number): StructureAppearanceDef {
  return seg.structure ? structureAppearance(seg.structure) : structureAppearance(baseH > 1 ? 'mur-en-pierre' : 'plain');
}
