import type { TerrainDef } from '../types';

// solidHeightM = 4 m = WALL_H_M = METRES_PER_LEVEL (échelle unifiée : un bloc plein = un mur d'arête = un
// étage). Dérivé du relief EXISTANT (faces verticales + dessus), sans toucher `heightAt` (combat = 0). Sert
// aussi de MASSE de rempart (recette `cells`) : le chemin de ronde est une couche de sol posée par-dessus.
export const terrain: TerrainDef = { id: 'mur', label: 'Mur', walkable: false, priority: 9, opaque: true, built: true, solidHeightM: 4, gradient: 'g_sol', swatch: '#9b8e72', stops: [{ off: '0%', color: '#6b5d4f' }, { off: '100%', color: '#52463a' }] };
