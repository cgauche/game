import type { TerrainDef } from '../types';

export const terrain: TerrainDef = { id: 'route', label: 'Chemin', walkable: true, priority: 3, gradient: 'g_route', swatch: '#8a744c', stops: [{ off: '0%', color: '#9a8358' }, { off: '100%', color: '#7d6a45' }] };
