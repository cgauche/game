/**
 * CONTRAT des unions PARTAGÉES entre le moteur et les schémas de donnée (#1440) : `Availability`
 * (LDB 59) et `StakeForm` (forme déclarée d'un enjeu) ont chacune UN tuple canon dans
 * `src/engine/types.ts`, dont le schéma zod de `schemas/grammaire/valeurs.ts` DÉRIVE. Ce fichier verrouille
 * les deux moitiés du lien :
 *  - au TYPE (`Eq<…>` ci-dessous, gaté par `npm run typecheck`) : le type inféré du schéma et le
 *    type moteur sont mutuellement assignables — un palier ajouté d'un seul côté ne compile pas ;
 *  - au RUNTIME : les options du schéma sont EXACTEMENT le tuple canon, et PERSONNE dans `src/` ne
 *    re-tape le littéral à côté (c'était l'état d'avant : 6 recopies pour `StakeForm`, 4 pour
 *    `Availability` ; puis 10 de plus, hors des schémas, que le scan élargi a mesurées et migrées).
 *
 * Le volet « re-tape » se lit à l'AST (`scanUnionRecopies`, TypeScript compiler API) et par FORME, pas
 * par nom : ≥2 membres du canon reproduits ensemble en TABLEAU, en union de types, en CLÉS d'objet
 * (zod compris), en membres de type littéral, en `case` d'un `switch` ou en CHAÎNE de comparaisons.
 * Le scan couvre `src/**` — PROD ET TESTS : un test qui recopie l'union verrouille une divergence
 * aussi sûrement qu'un module. N'en sont exclues que les deux formes que le COMPILATEUR borne déjà :
 * la sélection zod `.extract([…])` posée sur un schéma DU canon, et la table `Record<UnionNommée, …>`
 * annotée (dont il exige les clés). Les sous-ensembles MÉTIER (`TestedAvailability`,
 * `APPRAISED_AVAILABILITIES`) sont nommés au foyer, jamais re-tapés au site.
 */
import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';
import { scanUnionRecopies } from '../../../scripts/guards/lib/canonUnique.mjs';
import { AVAILABILITIES, STAKE_FORMS, type Availability, type StakeForm, type TestedAvailability } from '../../engine/types';
import { availabilitySchema, harvestRaritySchema, stakeFormSchema } from './grammaire/valeurs';
import { dispoPctAvailabilitySchema } from './defs/disponibilite';
import type { HarvestRarity } from '../index';

/** Les deux canons verrouillés, sous la forme attendue par le scan. */
const CANONS = [
  { nom: 'AVAILABILITIES', membres: AVAILABILITIES },
  { nom: 'STAKE_FORMS', membres: STAKE_FORMS },
];
/** Les deux SEULS fichiers qui ont le droit de taper les membres : le foyer du tuple (`types.ts`, où
 *  vivent AUSSI les sous-ensembles métier, chacun `satisfies` le canon) et ce fichier-ci (ses
 *  fixtures SONT des recopies, c'est leur métier). `grammaire/valeurs.ts` n'y figure pas : il DÉRIVE
 *  (`z.enum(AVAILABILITIES)`), il ne tape rien. */
const FOYERS = ['src/engine/types.ts', 'src/data/schemas/unions-canon.test.ts'];
/** Corpus MÉMOÏSÉ pour tout le fichier : la lecture disque (~3 s, 3300 fichiers) et les AST (keyés
 *  sur l'identité des objets par `canonUnique`) sont payés UNE fois, pas une fois par `it`. */
let cacheCorpus: { rel: string; text: string }[] | null = null;
const corpus = () => (cacheCorpus ??= readCorpus(['src'], { tests: true }).filter(({ rel }) => !FOYERS.includes(rel)));
/** Fixture de scan : un fichier de corpus fabriqué à la main. */
const fixture = (text: string) => ({ rel: 'fixture.ts', text });

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _availabilityExact: Eq<Availability, z.infer<typeof availabilitySchema>> = true;
const _stakeFormExact: Eq<StakeForm, z.infer<typeof stakeFormSchema>> = true;
const _harvestRarityExact: Eq<HarvestRarity, z.infer<typeof harvestRaritySchema>> = true;
const _testedExact: Eq<TestedAvailability, z.infer<typeof dispoPctAvailabilitySchema>> = true;
void _availabilityExact; void _stakeFormExact; void _harvestRarityExact; void _testedExact;

describe('unions partagées moteur ⇄ schémas de donnée (#1440)', () => {
  it('`availabilitySchema` expose EXACTEMENT les paliers de `AVAILABILITIES`', () => {
    expect(availabilitySchema.options).toEqual([...AVAILABILITIES]);
  });

  it('`harvestRaritySchema` = les paliers canon + le 5ᵉ palier RAW `Unique` (`ZI 13 l.286`)', () => {
    expect(harvestRaritySchema.options).toEqual([...AVAILABILITIES, 'Unique']);
  });

  it('`stakeFormSchema` expose EXACTEMENT `STAKE_FORMS`', () => {
    expect(stakeFormSchema.options).toEqual([...STAKE_FORMS]);
  });

  it('PERSONNE dans `src/` ne re-tape le littéral des unions partagées — prod ET tests', () => {
    const fautifs = corpus().flatMap((f) => scanUnionRecopies(f, CANONS).map((x) => `${f.rel}:${x.line} — ${x.detail}`));
    expect(fautifs, 'importer le tuple `engine/types` (ou le schéma dérivé de `schemas/grammaire/valeurs.ts`) — #1440').toEqual([]);
  });

  it('`TestedAvailability` et sa sélection zod nomment le MÊME couple (le sous-ensemble n’a qu’un site)', () => {
    expect(dispoPctAvailabilitySchema.options).toEqual(['Limitée', 'Rare']);
    expect(AVAILABILITIES.filter((a) => !dispoPctAvailabilitySchema.options.includes(a as never))).toEqual(['Commune', 'Exotique']);
  });

  it('le scan LIT L’AST : les six FORMES de recopie sont vues, quelle que soit la mise en page', () => {
    const forme = (text: string) => scanUnionRecopies(fixture(text), CANONS).map((x) => x.detail);
    expect(forme(`export const s = z.enum([
      'verbatim',
      'descripteur',
      'resume',
    ]);`), 'tableau MULTI-LIGNE et divergent').toEqual(["STAKE_FORMS recopiée en tableau ('verbatim', 'descripteur')"]);
    expect(forme(`type F =
      | 'verbatim'
      | 'descripteur';`), 'union de types').toHaveLength(1);
    expect(forme(`const rang = { Commune: 0, Limitée: 1, Rare: 2, Exotique: 3 };`), 'clés d’objet nues').toHaveLength(1);
    expect(forme(`const s = z.strictObject({ Commune: r, Limitée: r, Rare: r, Exotique: r });`), 'clés d’un objet zod').toHaveLength(1);
    expect(forme(`type T = { Commune: number; Exotique: number };`), 'membres de type littéral').toHaveLength(1);
    expect(forme(`switch (f) {
      case 'verbatim': return 1;
      case 'descripteur': return 2;
    }`), 'case d’un switch').toHaveLength(1);
    expect(forme(`const ok = av === 'Rare' || av === 'Exotique';`), 'chaîne de comparaisons').toHaveLength(1);
    expect(forme(`const ko = f !== 'verbatim' && f !== 'descripteur';`), 'chaîne de NON-égalités').toHaveLength(1);
    expect(forme(`const un = ['Rare'];`), 'UN seul membre n’est pas une union recopiée').toEqual([]);
  });

  it('ce que le COMPILATEUR borne déjà n’est pas une recopie — et rien d’autre ne se blanchit', () => {
    const forme = (text: string) => scanUnionRecopies(fixture(text), CANONS);
    expect(forme(`const s = availabilitySchema.extract([
      'Limitée',
      'Rare',
    ]);`), 'sélection zod sur un schéma DU canon').toEqual([]);
    expect(forme(`const s = grilleMaison.extract(['Limitée', 'Rare']);`), 'même appel sur un récepteur ÉTRANGER : rien n’est prouvé').toHaveLength(1);
    expect(forme(`const t: Record<Availability, number> = { Commune: 0, Limitée: 1, Rare: 2, Exotique: 3 };`), 'table exhaustive keyée par l’union NOMMÉE').toEqual([]);
    expect(forme(`const t: Record<string, number> = { Commune: 0, Limitée: 1, Rare: 2, Exotique: 3 };`), 'Record<string, …> n’exige aucune exhaustivité').toHaveLength(1);
    expect(forme(`const t = { Commune: 0, Limitée: 1 } as Record<Availability, number>;`), 'une ASSERTION ne vérifie pas les clés manquantes').toHaveLength(1);
  });

  it('le scan couvre bien `src/` (sanity : > 1500 fichiers, tests ET defs de schémas compris)', () => {
    const vus = corpus();
    expect(vus.length).toBeGreaterThan(1500);
    expect(vus.filter(({ rel }) => rel.startsWith('src/data/schemas/defs/')).length).toBeGreaterThan(40);
    expect(vus.filter(({ rel }) => rel.endsWith('.test.ts')).length).toBeGreaterThan(100);
  });
});
