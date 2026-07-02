import type { TerrainDef } from '../types';

// solidHeightM = 2.25 m ≈ WALL_H_M (iso.ts : isoPxToM(54) = 54/96·4) → bloc plein d'une hauteur de mur
// crédible, dérivé du relief EXISTANT (faces verticales + dessus), sans toucher `heightAt` (combat = 0).
export const terrain: TerrainDef = { id: 'mur', label: 'Mur', walkable: false, priority: 9, opaque: true, solidHeightM: 2.25, gradient: 'g_sol', swatch: '#9b8e72', stops: [{ off: '0%', color: '#6b5d4f' }, { off: '100%', color: '#52463a' }] };
