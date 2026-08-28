import type { ReliefMaterialDef } from './types';
import { reliefMaterials } from '../../../data';
import { catalogEntry, MISSING_ID, MISSING_LABEL, MISSING_TONE, MISSING_TONE_DARK } from '../missing';
export type { ReliefMaterialDef } from './types';

const MAP: Record<string, ReliefMaterialDef> = Object.fromEntries(reliefMaterials.map((m) => [m.id, m]));

/** Entrée de REPLI VISIBLE (#877) : un relief au ton d'alarme, jamais l'apparence d'un autre matériau. */
const MISSING: ReliefMaterialDef = {
  id: MISSING_ID,
  label: MISSING_LABEL,
  face: MISSING_TONE,
  foot: MISSING_TONE_DARK,
  slopeTop: MISSING_TONE,
  shadeDark: 1,
};

/** Matériau de relief par id ; id absent du registre → repli VISIBLE + avertissement DEV. */
export function reliefMaterial(id: string): ReliefMaterialDef {
  return catalogEntry(MAP, id, 'relief', MISSING);
}
