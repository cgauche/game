import type { TerrainDef } from '../types';

export const terrain: TerrainDef = { id: 'roche', label: 'Roche', walkable: true, priority: 2, gradient: 'g_roche', swatch: '#5c5850', stops: [{ off: '0%', color: '#6e6a62' }, { off: '100%', color: '#4a463e' }] };
