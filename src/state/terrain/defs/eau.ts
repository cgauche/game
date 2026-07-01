import type { TerrainDef } from '../types';

export const terrain: TerrainDef = { id: 'eau', label: 'Eau', walkable: false, priority: 0, gradient: 'g_eau', swatch: '#2f5a8a', stops: [{ off: '0%', color: '#2f5a8a' }, { off: '100%', color: '#234a74' }] };
