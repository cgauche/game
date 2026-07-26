import type { RoofMaterialDef } from './types';
import { roofMaterials } from '../../../data';
import { catalogEntry, MISSING_ID, MISSING_TONE, MISSING_TONE_DARK } from '../missing';
export type { RoofMaterialDef } from './types';

const MAP: Record<string, RoofMaterialDef> = Object.fromEntries(roofMaterials.map((m) => [m.id, m]));

/** Entrée de REPLI VISIBLE (#877) : une couverture au ton d'alarme sur tous ses pans et sur son plan vu
 *  du dessus, jamais l'apparence d'un autre matériau. */
const MISSING: RoofMaterialDef = {
  id: MISSING_ID,
  N: MISSING_TONE,
  E: MISSING_TONE,
  S: MISSING_TONE,
  O: MISSING_TONE,
  line: MISSING_TONE_DARK,
  planBody: MISSING_TONE,
  planEdge: MISSING_TONE_DARK,
  planInner: MISSING_TONE_DARK,
  planText: MISSING_TONE,
};

/** Matériau de toit par id ; id absent du registre → repli VISIBLE + avertissement DEV. */
export function roofMaterial(id: string): RoofMaterialDef {
  return catalogEntry(MAP, id, 'toiture', MISSING);
}
