/**
 * CONTRAT des unions PARTAGÉES entre le moteur et les schémas de donnée (#1440) : `Availability`
 * (LDB 59) et `StakeForm` (forme déclarée d'un enjeu) ont chacune UN tuple canon dans
 * `src/engine/types.ts`, dont le schéma zod de `schemas/common.ts` DÉRIVE. Ce fichier verrouille
 * les deux moitiés du lien :
 *  - au TYPE (`Eq<…>` ci-dessous, gaté par `npm run typecheck`) : le type inféré du schéma et le
 *    type moteur sont mutuellement assignables — un palier ajouté d'un seul côté ne compile pas ;
 *  - au RUNTIME : les options du schéma sont EXACTEMENT le tuple canon, et aucun def ne re-tape le
 *    littéral à côté (c'était l'état d'avant : 6 recopies pour `StakeForm`, 4 pour `Availability`).
 *
 * Le volet « re-tape » se lit à l'AST (`scanUnionRecopies`, TypeScript compiler API) : un littéral de
 * tableau ou une union de types littéraux portant ≥2 membres du canon est une recopie, quelle que soit
 * sa mise en page. Une SÉLECTION dérivée (`availabilitySchema.extract([…])`) n'en est pas une : le
 * compilateur borne son argument au canon.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import { tsSources, scanUnionRecopies } from '../../../scripts/guards/lib/canonUnique.mjs';
import { AVAILABILITIES, STAKE_FORMS, type Availability, type StakeForm } from '../../engine/types';
import { availabilitySchema, harvestRaritySchema, stakeFormSchema } from './common';
import type { HarvestRarity } from '../index';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const SCHEMAS = 'src/data/schemas';
/** Les deux canons verrouillés, sous la forme attendue par le scan. */
const CANONS = [
  { nom: 'AVAILABILITIES', membres: AVAILABILITIES },
  { nom: 'STAKE_FORMS', membres: STAKE_FORMS },
];
/** Defs scannés : tout `.ts` de `schemas/`, SAUF le foyer `common.ts` (il DÉRIVE du tuple moteur) et
 *  les tests (dont celui-ci, qui porte des fixtures de recopie). */
const schemaDefs = () => tsSources(ROOT, [SCHEMAS]).filter(({ rel }) => !rel.endsWith('.test.ts') && rel !== `${SCHEMAS}/common.ts`);

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _availabilityExact: Eq<Availability, z.infer<typeof availabilitySchema>> = true;
const _stakeFormExact: Eq<StakeForm, z.infer<typeof stakeFormSchema>> = true;
const _harvestRarityExact: Eq<HarvestRarity, z.infer<typeof harvestRaritySchema>> = true;
void _availabilityExact; void _stakeFormExact; void _harvestRarityExact;

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

  it('aucun def ne re-tape le littéral des unions partagées — il importe le schéma dérivé', () => {
    const fautifs = schemaDefs().flatMap(({ rel, code }) => scanUnionRecopies(rel, code, CANONS).map((f) => `${rel}:${f.line} — ${f.detail}`));
    expect(fautifs, 'importer `availabilitySchema`/`stakeFormSchema` de `schemas/common.ts` (#1440)').toEqual([]);
  });

  it('le scan LIT L’AST : une recopie MULTI-LIGNE et DIVERGENTE est vue (une regex de ligne ne la voit pas)', () => {
    const multi = `export const s = z.enum([
      'verbatim',
      'descripteur',
      'resume',
    ]);`;
    expect(scanUnionRecopies('fixture.ts', multi, CANONS)).toEqual([{ line: 1, detail: "STAKE_FORMS recopiée ('verbatim', 'descripteur')" }]);
    const union = `type F =
      | 'verbatim'
      | 'descripteur';`;
    expect(scanUnionRecopies('fixture.ts', union, CANONS)).toHaveLength(1);
    const partiel = `const a = [
      'Rare',
      'Exotique',
    ];`;
    expect(scanUnionRecopies('fixture.ts', partiel, CANONS)).toHaveLength(1);
  });

  it('une SÉLECTION dérivée du canon n’est pas une recopie (le compilateur borne l’argument)', () => {
    const derive = `const s = availabilitySchema.extract([
      'Limitée',
      'Rare',
    ]);`;
    expect(scanUnionRecopies('fixture.ts', derive, CANONS)).toEqual([]);
  });

  it('le scan couvre bien les defs (sanity : > 40 schémas)', () => {
    expect(schemaDefs().length).toBeGreaterThan(40);
  });
});
