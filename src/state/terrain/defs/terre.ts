import type { TerrainDef } from '../types';

export const terrain: TerrainDef = { id: 'terre', label: 'Terre battue', walkable: true, priority: 2, gradient: 'g_terre', swatch: '#6b5436', stops: [{ off: '0%', color: '#7a5f3c' }, { off: '100%', color: '#57452b' }] };
