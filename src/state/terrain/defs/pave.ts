import type { TerrainDef } from '../types';

export const terrain: TerrainDef = { id: 'pave', label: 'Pavés', walkable: true, priority: 5, gradient: 'g_pave', swatch: '#7c7a82', stops: [{ off: '0%', color: '#8f8d96' }, { off: '100%', color: '#63616b' }] };
