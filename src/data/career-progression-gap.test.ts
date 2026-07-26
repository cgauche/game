/**
 * Garde-fou « Schéma de Progression incomplet » (cliquet, patron `obtainability-guard.test.ts`).
 *
 * FAIT MESURÉ (2026-07-26) : dans TOUTE extraction Marker d'un livre WFRP4, le « Schéma de
 * Progression » d'une Carrière se réduit à UNE ligne de marqueurs (`| h | | … | h | h |`) —
 * exactement les 3 Caractéristiques du NIVEAU 1. Les Caractéristiques ajoutées aux niveaux 2, 3 et 4
 * (une par niveau) ne sont portées que par des pastilles de la maquette, que l'extraction ne rend
 * pas. Vérifiable au LDB : `Source/Warhammer v4 - Livre de base version corrigée/08 - Statut.md`
 * l.2380-2384 (Sorcier) n'imprime que `CC / Int / FM`, alors que `careerLevels.json` porte en plus
 * `Ag`, `I` et `Soc` aux niveaux 2-4 — ces trois-là viennent de la maquette, pas du Markdown.
 *
 * Les Carrières du LDB/AA/MDG ont donc été curées sur la maquette PDF ; les Carrières des *Vents de
 * Magie* (#730) ne le sont pas encore, et pour six d'entre elles même la ligne de niveau 1 est
 * illisible (colonnes fusionnées par Marker : `VDM 04 l.73`, `VDM 07 l.61-65`, `VDM 09 l.65-68`) ou
 * absente (`bedeau`, aucun schéma dans `VDM 03`).
 *
 * Ce cliquet fige la liste EXACTE des niveaux dont `characteristics` est vide. Il ne peut que
 * RÉTRÉCIR : curer un schéma au PDF retire sa clé ici. Toute NOUVELLE entrée vide — d'où qu'elle
 * vienne — fait échouer la garde, au lieu de se dissimuler dans un `[]` indistinguable d'un
 * « ce niveau n'augmente aucune Caractéristique ».
 */
import { describe, it, expect } from 'vitest';
import { careerLevels } from './index';

/** Clés `carrière/niveau` dont le Schéma de Progression n'est pas extractible du corpus. */
const SCHEMA_MANQUANT: ReadonlySet<string> = new Set([
  // VDM 03 — aucun schéma extrait pour Bedeau ; niveaux 2-4 des trois carrières du chapitre
  'alchimiste-ordinaire/2', 'alchimiste-ordinaire/3', 'alchimiste-ordinaire/4',
  'bedeau/1', 'bedeau/2', 'bedeau/3', 'bedeau/4',
  'devin/2', 'devin/3', 'devin/4',
  // VDM 04 — schéma du Hiérophante recollé en une phrase, positions perdues
  'hierophante/1', 'hierophante/2', 'hierophante/3', 'hierophante/4',
  // VDM 05 / 06 / 10 / 11 — niveau 1 lisible, niveaux 2-4 hors extraction
  'alchimiste/2', 'alchimiste/3', 'alchimiste/4',
  'druide/2', 'druide/3', 'druide/4',
  'pyromancien/2', 'pyromancien/3', 'pyromancien/4',
  'chamane/2', 'chamane/3', 'chamane/4',
  // VDM 07 / 09 — tables aux colonnes fusionnées, niveau 1 lui-même illisible
  'astromancien/1', 'astromancien/2', 'astromancien/3', 'astromancien/4',
  'spirite/1', 'spirite/2', 'spirite/3', 'spirite/4',
]);

describe('Schéma de Progression — aucun niveau ne perd ses Caractéristiques en silence', () => {
  it('les niveaux sans Caractéristique sont exactement ceux dont le schéma est hors extraction', () => {
    const vides = careerLevels
      .filter((l) => l.characteristics.length === 0)
      .map((l) => `${l.career}/${l.level}`)
      .sort();
    expect(vides).toEqual([...SCHEMA_MANQUANT].sort());
  });

  it('le cliquet ne peut que RÉTRÉCIR — aucune clé soldée n’y traîne', () => {
    const vides = new Set(careerLevels.filter((l) => l.characteristics.length === 0).map((l) => `${l.career}/${l.level}`));
    expect([...SCHEMA_MANQUANT].filter((k) => !vides.has(k))).toEqual([]);
  });
});
