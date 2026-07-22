// ── Bloc NARRATIF d'un paquet de campagne (schema 3, #765) ──────────────────────────────────────
// Frontière RÉFÉRENCE vs NARRATIF (doctrine `game-campagne-json-portable-frontiere-reference-narratif`) :
// le narratif est EMBARQUÉ dans le JSON du projet (auto-suffisant, révélé seulement en jeu) et RÉFÉRENCE
// la règle globale (`src/data`) PAR ID — jamais copiée, jamais réinjectée dans `src/data` global. Cet
// invariant est GARDÉ ici (`validateNarratif` refuse toute collision d'id narratif ↔ id global).

import type { TrappingData, CreatureData } from '../data/index';
import { findCreatureById, findTrappingById } from '../data/index';
import type { EntityAppearance } from '../engine/authoringAppearance';
import type { SourceRef } from '../data/schemas/common';

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

/** Un id narratif COLLISIONNE avec la règle globale s'il résout déjà comme créature OU comme possession. */
function collidesWithGlobal(id: string): boolean {
  return !!findCreatureById(id) || !!findTrappingById(id);
}

/**
 * Validation FAIL-FAST du bloc narratif (throw `Error` avec l'id fautif). Garde l'invariant de doctrine
 * (aucun id narratif ne collisionne avec un id global) et la cohérence interne des références par id.
 */
export function validateNarratif(n: unknown): asserts n is NarratifBlock {
  if (!n || typeof n !== 'object') throw new Error('Narratif invalide : bloc absent ou mal formé.');
  for (const k of ['affaires', 'indices', 'presetsPnj', 'objets'] as const) {
    if (!Array.isArray((n as Record<string, unknown>)[k])) {
      throw new Error(`Narratif invalide : « ${k} » doit être un tableau.`);
    }
  }
  const nb = n as NarratifBlock;
  const affaireIds = new Set<string>();
  for (const a of nb.affaires) {
    if (!a.id) throw new Error('Narratif invalide : une affaire n\'a pas d\'id.');
    if (affaireIds.has(a.id)) throw new Error(`Narratif invalide : id d'affaire dupliqué « ${a.id} ».`);
    if (collidesWithGlobal(a.id)) throw new Error(`Narratif invalide : l'id d'affaire « ${a.id} » collisionne avec un id de la règle globale (créature/possession).`);
    affaireIds.add(a.id);
  }

  const indiceIds = new Set<string>();
  for (const i of nb.indices) {
    if (!i.id) throw new Error('Narratif invalide : un indice n\'a pas d\'id.');
    if (indiceIds.has(i.id)) throw new Error(`Narratif invalide : id d'indice dupliqué « ${i.id} ».`);
    if (affaireIds.has(i.id)) throw new Error(`Narratif invalide : l'id d'indice « ${i.id} » collisionne avec un id d'affaire.`);
    if (collidesWithGlobal(i.id)) throw new Error(`Narratif invalide : l'id d'indice « ${i.id} » collisionne avec un id de la règle globale (créature/possession).`);
    if (!affaireIds.has(i.affaireId)) throw new Error(`Narratif invalide : l'indice « ${i.id} » référence une affaire inconnue « ${i.affaireId} ».`);
    if (!Array.isArray(i.stades) || !i.stades.length) throw new Error(`Narratif invalide : l'indice « ${i.id} » n'a aucun stade.`);
    const stadeIds = new Set<string>();
    for (const s of i.stades) {
      if (!s.id) throw new Error(`Narratif invalide : un stade de l'indice « ${i.id} » n'a pas d'id.`);
      if (stadeIds.has(s.id)) throw new Error(`Narratif invalide : id de stade dupliqué « ${s.id} » dans l'indice « ${i.id} ».`);
      stadeIds.add(s.id);
    }
    indiceIds.add(i.id);
  }
  for (const i of nb.indices) {
    for (const r of i.refs ?? []) {
      if (!indiceIds.has(r)) throw new Error(`Narratif invalide : l'indice « ${i.id} » référence un indice inconnu « ${r} ».`);
    }
  }

  const presetIds = new Set<string>();
  for (const p of nb.presetsPnj) {
    if (!p.id) throw new Error('Narratif invalide : un preset de PNJ n\'a pas d\'id.');
    if (presetIds.has(p.id)) throw new Error(`Narratif invalide : id de preset PNJ dupliqué « ${p.id} ».`);
    if (affaireIds.has(p.id) || indiceIds.has(p.id)) throw new Error(`Narratif invalide : l'id de preset PNJ « ${p.id} » collisionne avec un autre id du narratif.`);
    if (collidesWithGlobal(p.id)) throw new Error(`Narratif invalide : l'id de preset PNJ « ${p.id} » collisionne avec un id de la règle globale (créature/possession).`);
    if (p.base !== undefined && !findCreatureById(p.base)) throw new Error(`Narratif invalide : le preset PNJ « ${p.id} » a une base inconnue « ${p.base} ».`);
    if (p.base === undefined && p.profil === undefined) throw new Error(`Narratif invalide : le preset PNJ « ${p.id} » n'a ni base ni profil (au moins l'un des deux est requis).`);
    if (p.base === undefined) {
      if (!p.profil!.char || typeof p.profil!.char !== 'object') throw new Error(`Narratif invalide : le preset PNJ « ${p.id} » a un profil sans base et sans « char ».`);
      if (!Array.isArray(p.profil!.traits)) throw new Error(`Narratif invalide : le preset PNJ « ${p.id} » a un profil sans base et sans « traits ».`);
    }
    presetIds.add(p.id);
  }

  const objetIds = new Set<string>();
  for (const o of nb.objets) {
    if (!o.id) throw new Error('Narratif invalide : un objet n\'a pas d\'id.');
    if (objetIds.has(o.id)) throw new Error(`Narratif invalide : id d'objet dupliqué « ${o.id} ».`);
    if (affaireIds.has(o.id) || indiceIds.has(o.id) || presetIds.has(o.id)) throw new Error(`Narratif invalide : l'id d'objet « ${o.id} » collisionne avec un autre id du narratif.`);
    if (collidesWithGlobal(o.id)) throw new Error(`Narratif invalide : l'id d'objet « ${o.id} » collisionne avec un id de la règle globale (créature/possession).`);
    objetIds.add(o.id);
  }
}
