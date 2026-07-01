import type { BuildingDef } from '../../types';
import { colombage, HOUSE_SCHEMA } from '../render-helpers';

export const building: BuildingDef = {
  id: 'maison',
  label: 'Maison à colombages',
  defaultFoot: { w: 3, h: 3 },
  paramsSchema: HOUSE_SCHEMA,
  render: colombage,
};
