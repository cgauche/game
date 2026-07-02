import type { BuildingDef } from '../../types';

export const building: BuildingDef = {
  id: 'echoppe',
  label: 'Échoppe',
  defaultFoot: { w: 2, h: 2 },
  roofMaterial: 'chaume',
  features: [{ prop: 'etal-marche', anchor: 'front' }],
};
