import type { BuildingDef } from '../../types';
import { colombage, HOUSE_SCHEMA } from '../render-helpers';

export const building: BuildingDef = {
  id: 'maison',
  label: 'Maison à colombages',
  category: 'petit',
  defaultFoot: { w: 3, h: 3 },
  defaultReveal: 'cutaway',
  paramsSchema: HOUSE_SCHEMA,
  render: colombage,
};
