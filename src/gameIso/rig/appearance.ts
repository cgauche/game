import type { Slot } from './bones';
import type { Combatant } from '../../engine/types';
import { hashSeed } from '../../engine/dice';
import { rigSpeciesId } from '../../data';
import type { MonsterParts } from './parts/monstrous';
import type { Palette } from './palette';

/** Vocabulaire (marque NOMINALE, #406) : id RIG (slug d'espèce `species.json`, id de créature/race/
 *  véhicule/affût-de-siège) — jamais un `SpeciesData.label` (« Humains (Reiklander) »). UNE seule
 *  monnaie : un littéral `string` (dont un `.label`) n'est plus assignable à `Appearance.species`
 *  (échec STRUCTUREL) — la seule production sanctionnée pour un id RULES est `rigSpeciesId` ; les
 *  autres sites partent déjà d'un id RIG (race/créature/véhicule/affût) et l'assertent `as RigSpeciesId`. */
export type RigSpeciesId = string & { readonly __rigSpeciesId: unique symbol };

/** Descripteur d'apparence COSMÉTIQUE (type pur ; l'engine ne le lit jamais). */
export interface Appearance {
  species: RigSpeciesId;
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

/** Apparence par défaut dérivée d'un Combatant (espèce + seed stable sur l'id). `appearance.species`
 *  est un id d'espèce RIG (slug) : `rigSpeciesId` mappe un id rules (héros) vers son slug d'espèce, et
 *  laisse passer un slug déjà rig (ennemi/créature) tel quel (idempotent). */
export function defaultAppearance(c: Combatant): Appearance {
  return {
    species: rigSpeciesId(c.species),
    sex: 'M',
    build: 0.5,
    seed: hashSeed(c.id),
  };
}
