import type { TraitDef } from '../types';

// LDB 85 p.338 : défense à l'Esquive seulement ; Brisé si touchée par le feu ; fuit si elle perd
// plus de la moitié de ses Blessures, sauf Territorial (→ Frénésie).
export const trait: TraitDef = { key: 'Bestial', bestial: true, note: 'Peur du feu (Brisé si touchée) ; pas de Soc ; fuit sous la moitié de ses PB sauf Territorial/acculée (→ Frénésie).' };
