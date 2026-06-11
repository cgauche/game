import type { TerrainDef } from '../types';

// Planches de bois (ponton, passerelle sur l'eau des égouts/marais) — marchable, déborde sur l'eau.
export const terrain: TerrainDef = { id: 'planches', label: 'Planches', walkable: true, priority: 3, gradient: 'g_planches', swatch: '#8a6a3c' };
