import type { TerrainDef } from '../types';

export const terrain: TerrainDef = { id: 'mur', label: 'Mur', walkable: false, priority: 9, opaque: true, gradient: 'g_sol', swatch: '#9b8e72', stops: [{ off: '0%', color: '#6b5d4f' }, { off: '100%', color: '#52463a' }] };
