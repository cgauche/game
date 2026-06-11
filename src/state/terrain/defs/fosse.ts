import type { TerrainDef } from '../types';

// Fosse/gouffre : INFRANCHISSABLE (comme l'eau/la lave) — découpe tactique des grandes cartes
// (éboulis, crevasse, fosse aux pieux). Priorité 0 : les sols voisins débordent sur son bord.
export const terrain: TerrainDef = { id: 'fosse', label: 'Fosse', walkable: false, priority: 0, gradient: 'g_fosse', swatch: '#16141a' };
