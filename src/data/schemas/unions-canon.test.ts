/**
 * CONTRAT des unions PARTAGÉES entre le moteur et les schémas de donnée (#1440) : `Availability`
 * (LDB 59) et `StakeForm` (forme déclarée d'un enjeu) ont chacune UN tuple canon dans
 * `src/engine/types.ts`, dont le schéma zod de `schemas/common.ts` DÉRIVE. Ce fichier verrouille
 * les deux moitiés du lien :
 *  - au TYPE (`Eq<…>` ci-dessous, gaté par `npm run typecheck`) : le type inféré du schéma et le
 *    type moteur sont mutuellement assignables — un palier ajouté d'un seul côté ne compile pas ;
 *  - au RUNTIME : les options du schéma sont EXACTEMENT le tuple canon, et aucun def ne re-tape le
 *    littéral à côté (c'était l'état d'avant : 6 recopies pour `StakeForm`, 4 pour `Availability`).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import { AVAILABILITIES, STAKE_FORMS, type Availability, type StakeForm } from '../../engine/types';
import { availabilitySchema, harvestRaritySchema, stakeFormSchema } from './common';
import type { HarvestRarity } from '../index';

const SCHEMAS_DIR = fileURLToPath(new URL('.', import.meta.url));

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _availabilityExact: Eq<Availability, z.infer<typeof availabilitySchema>> = true;
const _stakeFormExact: Eq<StakeForm, z.infer<typeof stakeFormSchema>> = true;
const _harvestRarityExact: Eq<HarvestRarity, z.infer<typeof harvestRaritySchema>> = true;
void _availabilityExact; void _stakeFormExact; void _harvestRarityExact;

function schemaSources(dir = SCHEMAS_DIR, rel = ''): { rel: string; code: string }[] {
  const out: { rel: string; code: string }[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...schemaSources(`${dir}/${ent.name}`, relPath));
    else if (ent.name.endsWith('.ts') && !ent.name.endsWith('.test.ts')) out.push({ rel: relPath, code: readFileSync(`${dir}/${ent.name}`, 'utf8') });
  }
  return out;
}

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
    const fautifs: string[] = [];
    for (const { rel, code } of schemaSources()) {
      if (rel === 'common.ts') continue; // le foyer DÉRIVE du tuple moteur, il ne tape aucun littéral
      for (const [concept, first, last] of [['Availability', 'Commune', 'Exotique'], ['StakeForm', 'verbatim', 'descripteur']] as const) {
        const re = new RegExp(`z\\.enum\\(\\[[^\\]]*'${first}'[^\\]]*'${last}'`);
        code.split('\n').forEach((l, i) => { if (re.test(l)) fautifs.push(`${rel}:${i + 1} — ${concept} recopiée`); });
      }
    }
    expect(fautifs, 'importer `availabilitySchema`/`stakeFormSchema` de `schemas/common.ts` (#1440)').toEqual([]);
  });

  it('le scan couvre bien les defs (sanity : > 40 schémas)', () => {
    expect(schemaSources().length).toBeGreaterThan(40);
  });
});
