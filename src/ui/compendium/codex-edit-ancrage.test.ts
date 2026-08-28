/**
 * ANCRAGE de l'atelier Codex sur la voie TABLEAU (#1467 L1b V-FLIP-RECORD).
 *
 * CONTRAT POSITIF : tout item d'une catégorie Codex ÉDITABLE ouvre une entrée TROUVÉE et NON VIDE.
 * `CodexEdit` résout l'entrée par `arr.findIndex((e) => entryKey(e) === label)` (`CodexEdit.tsx`,
 * mémo `src`), où `label` est celui de l'item du navigateur : un item que cette résolution rate
 * ouvre un formulaire VIDE en silence, et l'enregistrement APPEND un doublon au dataset.
 *
 * Le test rejoue CETTE résolution, sans DOM, sur TOUTES les catégories de dataset-liste éditables —
 * le périmètre est MESURÉ (`editableDataset` sur `CODEX`), jamais une liste de noms : une catégorie
 * neuve y entre sans qu'on l'inscrive. Il remplace la garde `mode record` (morte avec son unique
 * habitant, `names` étant devenu une liste de 7 documents) par un contrat qui couvre les ~100
 * catégories de la voie ordinaire, `names` compris.
 */
import { describe, it, expect } from 'vitest';
import { CODEX, entryKey } from './registry';
import { editableDataset, editableObjectDataset } from './CodexEdit';
import { datasetArray } from '../../data/overrides';

/** Catégories projetées sur un dataset-TABLEAU éditable (mesurées, pas déclarées ici). */
const LISTES = CODEX.filter((c) => !editableObjectDataset(c.key) && editableDataset(c.key));

/**
 * ANCRAGES CASSÉS encore en stock — mesurés le 2026-08-28, DÉCROISSANTS, PRÉEXISTANTS à ce lot (aucun
 * n'est de son fait : ce test est le premier à les VOIR). CAUSE UNIQUE mesurée : les documents de ces
 * 3 datasets ne portent AUCUN `label`, donc `entryKey` retombe sur leur `id` (`plus2`,
 * `tres-petite`…), tandis que l'item Codex porte un libellé FABRIQUé au build (« Progression maximale
 * (M+2) ») — l'ancrage par LABEL de `CodexEdit` ne peut pas les rejoindre, et le clic « Éditer » ouvre
 * un formulaire VIDE. PROPRIÉTAIRE : #1472 (ancrage de l'atelier par ID plutôt que par libellé).
 * Un item NEUF mal ancré est ROUGE ; un item réparé doit sortir d'ici (une entrée périmée est ROUGE).
 */
const ANCRAGES_CASSES: readonly string[] = [
  'navalProgression', 'shipHullSizes', 'shipConstructionTraits',
];

/**
 * Catégories dont la CARDINALITÉ item ⇄ document diverge (mesuré 2026-08-28, PRÉEXISTANT) : la
 * catégorie ne projette qu'une PARTIE de son dataset. Chaque entrée porte sa cause ; la liste est
 * fermée par le test lui-même (une entrée périmée échoue).
 */
const CARDINALITE_DIVERGENTE: Readonly<Record<string, string>> = {
  landCargo: '7 items projetés pour 9 documents — la catégorie filtre au build (#1472)',
  seaCargo: '11 items projetés pour 13 documents — même filtre au build (#1472)',
};

describe('atelier Codex — voie TABLEAU : chaque item s’ancre sur une entrée du dataset', () => {
  it('le périmètre est peuplé (sinon ce contrat ne garde rien)', () => {
    expect(LISTES.length).toBeGreaterThan(50);
    expect(LISTES.map((c) => c.key)).toContain('names');
  });

  it('aucun item n’ouvre un formulaire VIDE — la résolution `entryKey` retrouve chaque entrée', () => {
    const vides: string[] = [];
    const casses = new Set<string>();
    for (const cat of LISTES.filter((c) => !ANCRAGES_CASSES.includes(c.key))) {
      const arr = datasetArray(editableDataset(cat.key)!) as unknown as Record<string, unknown>[];
      for (const item of cat.items) {
        const i = arr.findIndex((e) => entryKey(e) === item.label);
        const trouvee = i >= 0 && !!arr[i] && Object.keys(arr[i]).length > 0;
        if (!trouvee) vides.push(`${cat.key}[${JSON.stringify(item.id)}] (« ${item.label} ») n’est ancré sur aucune entrée de ${editableDataset(cat.key)}`);
      }
    }
    expect(vides, vides.join('\n')).toEqual([]);

    // Le stock GELÉ se re-mesure : une catégorie réparée doit en sortir.
    for (const cle of ANCRAGES_CASSES) {
      const cat = LISTES.find((c) => c.key === cle);
      const arr = cat ? (datasetArray(editableDataset(cle)!) as unknown as Record<string, unknown>[]) : [];
      if (cat?.items.some((item) => !arr.some((e) => entryKey(e) === item.label))) casses.add(cle);
    }
    expect([...ANCRAGES_CASSES].filter((k) => !casses.has(k)), 'ancrage(s) gelé(s) dont tous les items résolvent — les retirer du stock').toEqual([]);
  });

  it('cardinalité items == documents, sauf divergence NOMMÉE (et aucune n’est périmée)', () => {
    const ecarts = LISTES.filter((c) => c.items.length !== datasetArray(editableDataset(c.key)!).length).map((c) => c.key);
    const neufs = ecarts.filter((k) => !(k in CARDINALITE_DIVERGENTE));
    expect(neufs, `catégorie(s) dont la population diverge de son dataset sans cause nommée :\n  ${neufs.join('\n  ')}`).toEqual([]);
    const perimees = Object.keys(CARDINALITE_DIVERGENTE).filter((k) => !ecarts.includes(k));
    expect(perimees, 'divergence(s) nommée(s) qui n’existent plus — les retirer').toEqual([]);
  });
});
