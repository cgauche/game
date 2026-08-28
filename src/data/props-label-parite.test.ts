/**
 * PARITÉ des libellés de décor (#1467 L1b V-P0d) : le `label` de chaque entrée de `props.json` est le
 * MIROIR du `label` de la def d'ART du même id (`src/gameIso/catalog/decor/defs/<id>.ts`).
 *
 * La donnée le porte parce que l'enveloppe de document l'exige ; l'art le porte parce que le catalogue
 * gameIso dessine la vignette. Deux porteurs, une seule vérité — sans cette garde, renommer un décor
 * d'un côté laisserait l'autre mentir en silence.
 *
 * L'extraction du label d'art vient du foyer UNIQUE `scripts/guards/lib/propArtLabels.mjs`, celui-là
 * même dont la migration `2026-08-28-l1b-10a-props-labels.mjs` a DÉRIVÉ la donnée : la vérification ne
 * peut pas s'écarter de la dérivation.
 */
import { describe, it, expect } from 'vitest';
import propsJson from './props.json';
import { fileURLToPath } from 'node:url';
import { labelDArt } from '../../scripts/guards/lib/propArtLabels.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const entrees = propsJson as { id: string; label: string }[];

describe('props.json — parité des labels avec les defs d’art', () => {
  it('chaque entrée porte un label non vide', () => {
    const vides = entrees.filter((p) => typeof p.label !== 'string' || p.label.trim() === '').map((p) => p.id);
    expect(vides).toEqual([]);
    expect(entrees.length).toBeGreaterThan(0);
  });

  it('label de donnée === label de la def d’art du même id', () => {
    const divergents = entrees
      .map((p) => ({ id: p.id, donnee: p.label, art: labelDArt(RACINE, p.id) }))
      .filter((x) => x.donnee !== x.art)
      .map((x) => `${x.id} : donnée ${JSON.stringify(x.donnee)} ≠ art ${JSON.stringify(x.art)}`);
    expect(divergents).toEqual([]);
  });
});
