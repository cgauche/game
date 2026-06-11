import type { TerrainDef } from '../types';

// Neige tassée (zone hivernale) — marchable ; se marie à la météo `neige` (sceneCombatModifiers).
export const terrain: TerrainDef = { id: 'neige', label: 'Neige', walkable: true, priority: 2, gradient: 'g_neige', swatch: '#d8dce2' };
