import type { Slot } from '../bones';
import type { PartArt } from './types';

/** Fallback neutre par slot (le rig rend toujours quelque chose pour les vêtements). */
export function genericPart(slot: Slot): PartArt {
  switch (slot) {
    case 'tete':    return ''; // pas de couvre-chef par défaut (tête nue)
    case 'visage':  return `<circle cx="0" cy="7" r="9" fill="#e2b48c"/>`;
    case 'cheveux': return `<path d="M-9 6 Q0 -6 9 6 Q4 0 0 0 Q-4 0 -9 6Z" fill="#5a4427"/>`;
    case 'torse':   return `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L10 34 Q0 38 -10 34 L-12 4 Z" fill="#6a5a3a"/>`;
    case 'bras':    return `<rect x="-3" y="-2" width="6" height="34" rx="3" fill="#6a5a3a"/>`;
    case 'jambes':  return `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#4c3a26"/>`;
    case 'arme':    return '';
    case 'bouclier':return '';
  }
}
