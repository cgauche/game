/**
 * ANCRAGE de l'atelier Codex en mode RECORD (#1467 L1b V-P4). Un dataset-objet de famille `record`
 * (`editableObjectDataset(cat).mode === 'record'`) est édité une entrée à la fois : `CodexEdit`
 * résout l'entrée par `data[initialKey]`, et `initialKey` est l'`id` de l'item du navigateur — la
 * CLÉ du record. Un item dont l'id ne retrouve pas sa clé ouvre un formulaire VIDE en silence, et
 * l'enregistrement écrirait une clé étrangère au sceau du dataset.
 *
 * Ce test rejoue la MÊME résolution que `CodexEdit` (build du registre → `id` → `datasetObject`),
 * sans DOM : il échoue nominativement, item par item, avant qu'un auteur ne perde une saisie.
 */
import { describe, it, expect } from 'vitest';
import { CODEX } from './registry';
import { editableObjectDataset } from './CodexEdit';
import { datasetObject } from '../../data/overrides';

/** Les catégories Codex projetées en mode `record` (mesurées, pas déclarées ici). */
const RECORDS = CODEX.filter((c) => editableObjectDataset(c.key)?.mode === 'record');

describe('atelier Codex — mode record : l’item s’ancre sur l’ID, qui EST la clé du record', () => {
  it('au moins une catégorie est projetée en record (sinon ce contrat ne garde rien)', () => {
    expect(RECORDS.map((c) => c.key)).toEqual(['names']);
  });

  for (const cat of RECORDS)
    it(`${cat.key} : chaque item ouvre une entrée TROUVÉE et NON VIDE (0 formulaire vide)`, () => {
      const data = datasetObject(editableObjectDataset(cat.key)!.ds) as Record<string, unknown>;
      const vides = cat.items
        .filter((it) => {
          const entree = data[it.id];
          return !entree || typeof entree !== 'object' || Object.keys(entree as object).length === 0;
        })
        .map((it) => `${cat.key}[${JSON.stringify(it.id)}] (« ${it.label} ») n’est pas une clé de ${editableObjectDataset(cat.key)!.ds}`);
      expect(vides, vides.join('\n')).toEqual([]);
      expect(cat.items.length).toBe(Object.keys(data).length);
    });
});
