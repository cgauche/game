import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditDataset } from '../../scripts/guards/lib/citationCoverage.mjs';

/**
 * Garde-fou « une source RACINE rend le dataset AVEUGLE » (#1467 L1b V-Src).
 *
 * `auditDataset` (`scripts/guards/lib/citationCoverage.mjs:83`) donne la PRIORITÉ à la racine : dès
 * qu'un objet racine porte `source`/`_source`/`maison`, le verdict est `{ total: 1, cited: 1 }` et le
 * fichier ENTIER est réputé couvert — sous-tables comprises. C'est la convention documentée pour un
 * objet de config unique (`src/data/schemas/grammaire/valeurs.ts:49-54`), et c'est exactement ce qui
 * la rend dangereuse pour un dataset dont les VRAIES citations vivent PAR ENTRÉE : poser une source
 * racine sur l'un d'eux ferait sortir toutes ses sous-entrées du dénominateur de la garde de
 * couverture, sans qu'aucun test ne rougisse.
 *
 * Ce test verrouille la classe MESURÉE (2026-08-27) des datasets « cités par entrée, racine nue » :
 * chacun doit rester de forme `map-of-lists`, à 100 % de couverture, et ne JAMAIS acquérir de
 * citation racine. Le compte de sous-entrées réellement mesurées est gelé : il ne peut que monter
 * (nouvelle donnée) — s'il s'effondre, c'est qu'une racine a avalé le dataset.
 */

const DATA_DIR = fileURLToPath(new URL('.', import.meta.url));

/**
 * Datasets dont la racine est NUE et dont chaque sous-entrée porte sa propre citation — relevé au
 * geste (#1467 L1b V-Src) sur les 42 datasets de la classe « cité par entrée » : ce sont les seuls
 * dont la racine ne porte ni `source` ni `maison`, donc les seuls qu'une source racine rendrait
 * aveugles. Les autres portent déjà leur citation sur leurs entrées de premier niveau et sont
 * couverts par `citation-coverage-guard.test.ts`.
 */
const RACINE_NUE = [
  'sea-weather.json',
  'sea-events.json',
  'sea-navigation.json',
  'sea-perils.json',
  'sea-cargo.json',
  'land-cargo.json',
  'river-perils.json',
  'weather.json',
  'criticals.json',
  'miscast.json',
  'mass-battle.json',
  'arcane-phenomena.json',
  'ship-construction.json',
  'crew-test-types.json',
  'disponibilite.json',
  'naval-progression.json',
] as const;

/** Sous-entrées RÉELLEMENT mesurées par la garde de couverture au 2026-08-27 — plancher. */
const SOUS_ENTREES_MESUREES = 490;

const lire = (f: string): unknown => JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'));

describe('source RACINE aveugle — datasets cités par entrée (#1467 L1b)', () => {
  it('aucun dataset de la classe ne porte de citation à la RACINE', () => {
    const fautifs: string[] = [];
    for (const f of RACINE_NUE) {
      const racine = lire(f) as Record<string, unknown>;
      for (const cle of ['source', '_source', 'maison']) {
        if (racine[cle] !== undefined) fautifs.push(`${f} : \`${cle}\` posée à la racine`);
      }
    }
    expect(fautifs, `citation(s) racine — les sous-entrées sortiraient de la garde :\n  ${fautifs.join('\n  ')}`).toEqual([]);
  });

  it('chacun reste de forme `map-of-lists` et cité à 100 % par entrée', () => {
    const fautifs: string[] = [];
    for (const f of RACINE_NUE) {
      const { shape, total, cited, missing } = auditDataset(lire(f));
      if (shape !== 'map-of-lists') fautifs.push(`${f} : forme « ${shape} » (map-of-lists attendue)`);
      if (cited !== total) fautifs.push(`${f} : ${total - cited} entrée(s) sans citation (${missing.slice(0, 5).join(', ')})`);
    }
    expect(fautifs, fautifs.join('\n  ')).toEqual([]);
  });

  it('le nombre de sous-entrées SOUS garde ne s’effondre pas (une racine les avalerait)', () => {
    const total = RACINE_NUE.reduce((n, f) => n + auditDataset(lire(f)).total, 0);
    expect(total).toBeGreaterThanOrEqual(SOUS_ENTREES_MESUREES);
  });
});
