import type { Slot } from './bones';
import type { Combatant } from '../../engine/types';
import { hashSeed } from '../appearance';
import type { MonsterParts } from './parts/monstrous';
import type { Palette } from './palette';

/** Descripteur d'apparence COSMÉTIQUE (type pur ; l'engine ne le lit jamais). */
export interface Appearance {
  species: string;
  gabarit?: string;                                 // id de carrure résolu (sinon dérivé de l'espèce)
  sex: 'M' | 'F';
  build: number;                                   // 0..1
  legs?: number;                                   // multiplicateur de longueur de jambes (mutation Court sur pattes)
  faceFlip?: boolean;                              // visage retourné tête en bas (mutation Visage inversé)
  parts?: Partial<Record<Slot, number>>;           // overrides éditeur
  monster?: MonsterParts;                          // parts monstrueux par slot (mutant modulaire)
  colors?: Palette;                                // personnalisation couleur (peau/cheveux/vêtements)
  seed?: number;
}

/** Apparence par défaut dérivée d'un Combatant (espèce + seed stable sur l'id). */
export function defaultAppearance(c: Combatant): Appearance {
  return {
    species: c.species ?? 'Humain',
    sex: 'M',
    build: 0.5,
    seed: hashSeed(c.id),
  };
}
