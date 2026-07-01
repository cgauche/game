import type { TerrainDef } from '../types';

export const terrain: TerrainDef = { id: 'lave', label: 'Lave', walkable: false, priority: 8, gradient: 'g_lave', swatch: '#c43a10', stops: [{ off: '0%', color: '#ff7a1a' }, { off: '45%', color: '#c4300a' }, { off: '100%', color: '#4a0e04' }] };
