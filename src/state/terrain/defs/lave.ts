import type { TerrainDef } from '../types';

// Coulée de lave : INFRANCHISSABLE (comme l'eau) — canalise le combat dans l'antre du dragon.
export const terrain: TerrainDef = { id: 'lave', label: 'Lave', walkable: false, priority: 8, gradient: 'g_lave', swatch: '#c43a10' };
