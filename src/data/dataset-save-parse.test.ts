import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATASET_KEYS, datasetEditable, datasetFile, datasetSerializeRoot, resetData } from './overrides';
import { validateDataset } from './schemas/validate';
import { serializeDataset } from './serialize';

/**
 * Garde STRUCTURELLE « la SAUVEGARDE de l'éditeur passe » (#1467 L1b V-FLIP-TABLE, soldée #1530).
 *
 * `CodexEdit.save` écrit `datasetSerializeRoot(clé)` dans `datasetFile(clé)` après l'avoir validé
 * par `validateDataset`. Le test JOUE le couple pour CHAQUE clé de `DATASET_KEYS` qui a une route
 * d'ÉDITION déclarée — aucune liste de noms, le scan suit le registre.
 *
 * Le stock de refus est VIDE et le reste : une clé neuve mal câblée (fichier non dérivable, racine
 * sérialisée nue par-dessus l'enveloppe de son document) est ROUGE, nominativement.
 */

/** Un dataset qu'AUCUN def ne route vers l'édition ne se sauvegarde pas : il est hors du contrat
 *  de save PAR DÉCLARATION (`exposition.edit` = `none`), jamais par une liste en dur. */
function scannees(): typeof DATASET_KEYS {
  return DATASET_KEYS.filter((k) => datasetEditable(k));
}

function refus(): string[] {
  const out: string[] = [];
  for (const k of scannees()) {
    const err = validateDataset(datasetFile(k), datasetSerializeRoot(k));
    if (err) out.push(`${k} → ${datasetFile(k)}`);
  }
  return out.sort();
}

describe('sauvegarde éditeur — chaque clé de dataset résout un fichier REGISTRÉ dont la racine PARSE (#1530)', () => {
  it('aucun refus : tout dataset éditable sérialise une racine que son schéma accepte', () => {
    expect(refus(), 'clé(s) dont la sauvegarde écrirait une racine invalide — câbler le root niché / déclarer le def').toEqual([]);
  });

  it('le scan voit une population réelle (le contrat n’est pas vide par erreur de registre)', () => {
    expect(DATASET_KEYS.length).toBeGreaterThan(80);
    expect(scannees().length).toBeGreaterThan(80);
  });

  it('le FICHIER est DÉRIVÉ du def porteur, jamais deviné depuis la clé JS', () => {
    // Les 6 clés camelCase dont le document porteur porte un nom kebab-case divergent : le défaut
    // `<clé>.json` visait un fichier inexistant, silencieusement.
    expect(datasetFile('celestialHouses')).toBe('astrology.json');
    expect(datasetFile('psychologies')).toBe('psychology.json');
    expect(datasetFile('seaShanties')).toBe('sea-shanties.json');
    expect(datasetFile('crewRoles')).toBe('crew-roles.json');
    expect(datasetFile('navalTraits')).toBe('naval-traits.json');
    expect(datasetFile('steamBreakdowns')).toBe('steam-breakdown.json');
    // Deux clés nichées du MÊME document y résolvent le même fichier.
    expect(datasetFile('crewMoraleFactors')).toBe('crew-morale.json');
    expect(datasetFile('crewMoraleBands')).toBe('crew-morale.json');
  });

  it('un dataset SANS route d’édition déclarée n’a pas de fichier de sauvegarde — refus nominatif', () => {
    expect(datasetEditable('breathTypes')).toBe(false);
    expect(datasetEditable('voyageStakes')).toBe(false);
    expect(() => datasetFile('breathTypes')).toThrow(/breathTypes/);
  });

  it('la racine sérialisée d’un tableau NICHÉ est le DOCUMENT entier (l’enveloppe survit au save)', () => {
    for (const k of ['weather', 'crewTestTypes', 'landCargo', 'seaCargo', 'riverPerils', 'crewMoraleFactors', 'crewMoraleBands'] as const) {
      const root = datasetSerializeRoot(k) as Record<string, unknown>;
      expect(Array.isArray(root), `${k} : racine sérialisée NUE — l’enveloppe du document serait écrasée`).toBe(false);
      expect(typeof root.id, `${k} : racine sans \`id\` d’enveloppe`).toBe('string');
    }
  });

  it('un save SANS édition est un NO-OP À L’OCTET : le couple (fichier dérivé, racine sérialisée) reproduit le disque', () => {
    // Ce que `CodexEdit.save` écrirait si l’on ouvrait puis enregistrait sans rien changer :
    // `serializeDataset(datasetSerializeRoot(clé))` dans `datasetFile(clé)`. Un octet d’écart = un
    // save qui produit un diff de reformatage, ou une racine brancherait sur le MAUVAIS document.
    // Complémentaire de `serialize.test.ts` (round-trip disque→disque) : ici la racine est celle que
    // la MÉMOIRE porte après chargement, et le fichier est celui que la DÉRIVATION désigne.
    // Graphe de modules PARTAGÉ (`isolate: false`) : un test antérieur du worker peut avoir muté un
    // dataset en mémoire. La sonde se remet donc au SEED avant de mesurer — l'invariant porte sur le
    // pipeline (fichier dérivé × racine sérialisée = disque), pas sur l'ordre des tests. `resetData`
    // est lui-même gardé par `overrides.test.ts` (restauration byte-parfaite).
    resetData();
    const DIR = fileURLToPath(new URL('.', import.meta.url));
    const divergents: string[] = [];
    for (const k of scannees()) {
      const fichier = datasetFile(k);
      const disque = readFileSync(join(DIR, fichier), 'utf8');
      if (serializeDataset(datasetSerializeRoot(k)) !== disque) divergents.push(`${k} → ${fichier}`);
    }
    expect(
      divergents.sort(),
      'clé(s) dont un save à vide réécrirait le fichier différemment du disque :\n' + divergents.join('\n'),
    ).toEqual([]);
  });

  it('fail-closed : une racine délibérément fausse est REFUSÉE (l’instrument mord)', () => {
    expect(validateDataset(datasetFile('montures'), { pas: 'un document' })).not.toBeNull();
  });
});
