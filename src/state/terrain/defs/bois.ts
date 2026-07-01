import type { TerrainDef } from '../types';

export const terrain: TerrainDef = { id: 'bois', label: 'Sous-bois', walkable: false, priority: 1, gradient: 'g_grass', swatch: '#2f4d20', stops: [{ off: '0%', color: '#4d7a38' }, { off: '100%', color: '#2f4d20' }] };
