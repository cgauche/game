import type { BuildingDef } from '../../types';

export const building: BuildingDef = {
  id: 'forge',
  label: 'Forge',
  defaultFoot: { w: 3, h: 2 },
  roofMaterial: 'toit-ardoise',
  features: [{ prop: 'cheminee', anchor: 'ridge' }],
};
