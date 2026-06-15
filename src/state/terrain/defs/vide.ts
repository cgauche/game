import type { TerrainDef } from '../types';

// « Vide » : absence de sol sur un étage (les tuiles non construites d'un niveau z>0). Non praticable,
// priorité 0 (ne déborde sur rien) et NON rendu par groundTile (transparent → on voit l'étage du dessous).
export const terrain: TerrainDef = { id: 'vide', label: 'Vide (étage)', walkable: false, priority: 0, gradient: 'g_sol', swatch: '#11141c' };
