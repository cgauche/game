import { describe, it, expect } from 'vitest';
import { isNamed, creatures, findCreatureById, type CreatureData } from './index';

/** Fabrique un `CreatureData` synthétique minimal — seul `named` est lu par `isNamed`,
 *  le reste est rempli avec des valeurs neutres puis surchargé par `over`. */
const creature = (over: Partial<CreatureData>): CreatureData =>
  ({
    id: 'x', label: 'X', title: null, folder: null, char: {},
    traits: [], optionals: [], skills: [], talents: [], trappings: [], spells: [],
    desc: null, source: { book: 'LDB', page: 0 },
    ...over,
  } as CreatureData);

describe('isNamed — source UNIQUE de la nommé-ité (jamais via `title`)', () => {
  it('`named: true` → true', () => {
    expect(isNamed(creature({ named: true }))).toBe(true);
  });
  it('`named: false` → false', () => {
    expect(isNamed(creature({ named: false }))).toBe(false);
  });
  it('champ `named` absent → false (générique par défaut)', () => {
    expect(isNamed(creature({}))).toBe(false);
  });
});

/** Garde de DONNÉE : les 21 individus nommés validés contre le RAW (desc verbatim singulier = individu)
 *  portent `named:true`, et rien d'autre. Les ex-« douteux » (sous-espèces/templates ZI décrits au
 *  PLURIEL) restent génériques — régression à garder si on retouche le backfill. */
describe('creatures.json — backfill `named`', () => {
  const NAMED_IDS = [
    'bella-la-noire', 'pol-dankels', 'eusapia-balacanon',
    'slenderthigh-whiptongue', 'fr-hough-mournbreath',
    'isrogdal-lempresse', 'ugrik-legaree', 'nazzaalta-affabule', 'artur-piedmarteau',
    'l-ombre-du-fleuve', 'raukos', 'le-vieux-dos-de-pus', 'brise-krag',
    'caledair-la-faux-de-feu', 'l-abominable-halagrundsor', 'jetsam-la-gelee-intelligente',
    'le-dechiqueteur-de-cadavres', 'la-bete-de-l-oblast', 'il-potente-granchio',
    'le-fantasma', 'prototype-du-clan-skryre',
  ];
  const GENERIC_IDS = [
    'brochet-du-stir', 'heomreth-hibou-geant', 'peau-de-loup', 'tregara',
    'experience-unique-du-clan-moulder', 'mangeuse-d-hommes-de-la-drakwald-araignee-geante',
  ];

  it('les 21 nommés validés portent named:true (ids résolus)', () => {
    const bad = NAMED_IDS.filter((id) => { const c = findCreatureById(id); return !c || !isNamed(c); });
    expect(bad).toEqual([]);
  });
  it('exactement 21 nommés dans la base (zéro générique flaggé)', () => {
    expect(creatures.filter(isNamed).length).toBe(21);
  });
  it('les ex-douteux (sous-espèces/templates au pluriel) restent génériques', () => {
    const bad = GENERIC_IDS.filter((id) => { const c = findCreatureById(id); return !c || isNamed(c); });
    expect(bad).toEqual([]);
  });
});
