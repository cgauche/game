import type { Slot } from './bones';
import type { Combatant } from '../../engine/types';
import { hashSeed } from '../appearance';
import { findSpeciesById } from '../../data';
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
  eyes?: { G?: string; D?: string };               // remplacement d'œil EN PLACE (art centré, cf. parts/eyes.ts)
  parts?: Partial<Record<Slot, number>>;           // overrides éditeur
  monster?: MonsterParts;                          // parts monstrueux par slot (mutant modulaire)
  features?: string[];                             // CLÉS du catalogue d'éléments (parts/elements.ts) — traits ADDITIFS (queue, cornes, crocs…)
  colors?: Palette;                                // personnalisation couleur (peau/cheveux/vêtements)
  seed?: number;
}

/** Apparence par défaut dérivée d'un Combatant (espèce + seed stable sur l'id). `Combatant.species`
 *  est un `id` (rules) → résolu en LIBELLÉ d'espèce ici (clé d'espèce du rig, contrat « label ») ;
 *  un id de créature/non-espèce retombe tel quel (le rig le résout par mot-clé). */
export function defaultAppearance(c: Combatant): Appearance {
  return {
    species: findSpeciesById(c.species)?.label ?? c.species ?? 'Humain',
    sex: 'M',
    build: 0.5,
    seed: hashSeed(c.id),
  };
}
