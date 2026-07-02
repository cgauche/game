import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'fosse',
  label: 'Fosse',
  walkable: false,
  priority: 0,
  gradient: 'g_fosse',
  swatch: '#16141a',
  stops: [{ off: '0%', color: '#221e2a' }, { off: '100%', color: '#0c0a10' }],
  // Matériaux v2 : variance de teinte seule — le noir du vide n'appelle aucun accent.
  detail: { seedScope: 'tile', tintVar: 0.05 },
};
