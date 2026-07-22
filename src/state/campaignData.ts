// Résolveur UNIQUE de la couche de campagne runtime (#767). Frontière RÉFÉRENCE vs NARRATIF
// (doctrine `game-campagne-json-portable-frontiere-reference-narratif`) : le narratif d'un paquet de
// campagne (`state.campaignNarratif`, posé par `loadProject`) est lu ICI par id STABLE, jamais copié
// dans `src/data` global. Les accesseurs d'affaire/indice/preset n'existent QUE dans la couche ; seul
// `trappingById` chaîne campagne-d'abord puis règle globale (`findTrappingById`).
import { findTrappingById, type TrappingData } from '../data';
import type { Affaire, Indice, NarratifBlock, PresetPnj } from './campaignNarratif';
// Import de `useGame` au top-level mais lu UNIQUEMENT dans les fonctions (usage runtime différé) :
// le cycle store → combatEffects → campaignData → store ne se résout que par la liaison vivante ESM.
import { useGame } from './store';

interface NarratifMaps {
  affaires: Map<string, Affaire>;
  indices: Map<string, Indice>;
  presets: Map<string, PresetPnj>;
  objets: Map<string, TrappingData>;
}

function emptyMaps(): NarratifMaps {
  return { affaires: new Map(), indices: new Map(), presets: new Map(), objets: new Map() };
}

// Mémoïsation par RÉFÉRENCE de `campaignNarratif` : on ne rebâtit les Maps que lorsque la couche
// change (chargement/déchargement de campagne). `campaignNarratif === null` → Maps vides, tout id
// d'objet tombe sur la règle globale.
let cachedRef: NarratifBlock | null = null;
let cached: NarratifMaps = emptyMaps();

function maps(): NarratifMaps {
  const n = useGame.getState().campaignNarratif;
  if (n === cachedRef) return cached;
  cachedRef = n;
  cached = n
    ? {
        affaires: new Map(n.affaires.map((a) => [a.id, a])),
        indices: new Map(n.indices.map((i) => [i.id, i])),
        presets: new Map(n.presetsPnj.map((p) => [p.id, p])),
        objets: new Map(n.objets.map((o) => [o.id, o])),
      }
    : emptyMaps();
  return cached;
}

/** Preset de PNJ pré-composé de la campagne chargée — couche-SEULEMENT (n'existe pas dans `src/data`). */
export function presetPnjById(id: string): PresetPnj | undefined {
  return maps().presets.get(id);
}

/** Affaire (fil d'enquête) de la campagne chargée — couche-SEULEMENT. */
export function affaireById(id: string): Affaire | undefined {
  return maps().affaires.get(id);
}

/** Indice/rumeur de la campagne chargée — couche-SEULEMENT. */
export function indiceById(id: string): Indice | undefined {
  return maps().indices.get(id);
}

/** Possession résolue par id STABLE, campagne-D'ABORD (`campaignNarratif.objets`) puis règle globale
 *  (`findTrappingById`). Les ids narratifs ne collisionnent jamais avec le global (garde `validateNarratif`,
 *  #765) → chaîne déterministe. Signature IDENTIQUE à `findTrappingById` : sert de résolveur injecté aux
 *  coutures d'objet du moteur (`engine/items`), qui restent PURES (elles reçoivent la fonction). */
export function trappingById(id: string): TrappingData | undefined {
  return maps().objets.get(id) ?? findTrappingById(id);
}
