import type { TerrainDef } from '../types';

export const terrain: TerrainDef = { id: 'plancher', label: 'Plancher', walkable: true, priority: 4, gradient: 'g_plancher', swatch: '#7a5a30', stops: [{ off: '0%', color: '#8a6638' }, { off: '100%', color: '#6a4d28' }] };
