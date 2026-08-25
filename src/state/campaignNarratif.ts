// ── Bloc NARRATIF d'un paquet de campagne (schema 3, #765) ──────────────────────────────────────
// Frontière RÉFÉRENCE vs NARRATIF (doctrine `game-campagne-json-portable-frontiere-reference-narratif`) :
// le narratif est EMBARQUÉ dans le JSON du projet (auto-suffisant, révélé seulement en jeu) et RÉFÉRENCE
// la règle globale (`src/data`) PAR ID — jamais copiée, jamais réinjectée dans `src/data` global. Cet
// invariant est GARDÉ par le schéma du document (`narratifSchema`, `src/data/schemas/defs-scenes/`),
// qui refuse toute collision d'id narratif ↔ id global.

import type { TrappingData, CreatureData } from '../data/index';
import type { EntityAppearance } from '../engine/authoringAppearance';
import type { SourceRef } from '../data/schemas/grammaire/valeurs';

/** Un stade RÉVÉLABLE d'un indice : la prose (verbatim source) qui se dévoile à ce palier d'enquête. */
export interface IndiceStade {
  /** id STABLE du stade, unique DANS l'indice. */
  id: string;
  /** Prose révélée (verbatim source, règle stricte 5). */
  prose: string;
  source?: SourceRef;
}

/** Un indice ou une rumeur d'une affaire — révélé par stades. */
export interface Indice {
  /** id STABLE, unique dans le narratif ET non-colluant avec un id global. */
  id: string;
  /** id de l'`Affaire` à laquelle l'indice se rattache. */
  affaireId: string;
  kind: 'indice' | 'rumeur';
  titre: string;
  /** Stades révélables (au moins un). */
  stades: IndiceStade[];
  /** Autres indices (ids) que celui-ci recoupe/débloque. */
  refs?: string[];
}

/** Une affaire (fil d'enquête) de la campagne. */
export interface Affaire {
  id: string;
  titre: string;
  desc?: string;
}

/** Un PNJ pré-composé de la campagne : soit une créature globale surchargée (`base` = id global), soit
 *  un profil ad hoc embarqué (`profil`). L'apparence réutilise la structure UNIQUE `EntityAppearance`. */
export interface PresetPnj {
  id: string;
  /** id d'une créature GLOBALE (`findCreatureById`) servant de base — surchargée par `profil`/`apparence`. */
  base?: string;
  profil?: Partial<CreatureData>;
  apparence?: EntityAppearance;
  /** id d'illustration (registre d'art), affichage seul. */
  portrait?: string;
  source?: SourceRef;
}

/** Le bloc narratif au NIVEAU PROJET (frère de `scenes`/`worldMap`), jamais per-scène. `objets` réutilise
 *  le schéma `TrappingData` global (mêmes champs), sans jamais entrer dans `src/data` global. */
export interface NarratifBlock {
  affaires: Affaire[];
  indices: Indice[];
  presetsPnj: PresetPnj[];
  objets: TrappingData[];
}

/** Narratif vide — injecté par la migration 2→3 et posé par `newProject`. */
export function emptyNarratif(): NarratifBlock {
  return { affaires: [], indices: [], presetsPnj: [], objets: [] };
}
