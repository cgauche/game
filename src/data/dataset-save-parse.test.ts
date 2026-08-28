import { describe, it, expect } from 'vitest';
import { DATASET_KEYS, datasetFile, datasetSerializeRoot } from './overrides';
import { validateDataset } from './schemas/validate';

/**
 * Garde STRUCTURELLE « la SAUVEGARDE de l'éditeur passe » (#1467 L1b V-FLIP-TABLE).
 *
 * `CodexEdit.save` écrit `datasetSerializeRoot(clé)` dans `datasetFile(clé)` après l'avoir validé
 * par `validateDataset`. Les deux résolveurs ont un DÉFAUT (`<clé>.json` / le tableau nu) : une clé
 * dont le tableau est NICHÉ sous une enveloppe et qui n'a pas d'entrée dans `NESTED_ARRAY_FILE`
 * sérialise donc un tableau NU par-dessus son document — ou vise un fichier qui n'existe pas.
 * Rien, avant ce test, ne mesurait ce couple : le défaut était SILENCIEUX jusqu'au save réel.
 *
 * Le test JOUE le couple pour CHAQUE clé de `DATASET_KEYS` — aucune liste de noms, le scan suit le
 * registre. Le stock RESTANT est gelé NOMINATIVEMENT et DÉCROISSANT : une clé neuve mal câblée est
 * ROUGE, une clé réparée doit sortir de la liste (une entrée périmée est ROUGE elle aussi).
 */

/**
 * Clés dont le couple `datasetFile`/`datasetSerializeRoot` NE PARSE PAS son schéma — stock mesuré le
 * 2026-08-28, DÉCROISSANT. La vague V-FLIP-TABLE a soldé les 7 siennes (`montures`,
 * `incidentsMonture`, `problemesVehicule`, `structureCriticals`, `obsessions`, plus les 2 documents
 * devenus éditables) ; les 15 restantes attendent leur lot (propriété #1530).
 *
 * TOUTES relèvent du MÊME défaut MESURÉ : la clé JS est camelCase et le défaut `<clé>.json` vise un
 * fichier qui n'existe pas (`breathTypes.json` pour `breath-types.json`), ou bien le tableau est
 * NICHÉ (`crewMoraleBands`, `landCargo`, `riverPerils`, `seaCargo`, `weather`…) et la racine
 * sérialisée serait le tableau NU. Le remède est le même pour les 15 : une entrée `NESTED_ARRAY_FILE`
 * (ou, pour un tableau racine à nom divergent, sa seule clé `file`). Aucune n'est corrigée ICI : ce
 * lot ne touche qu'aux documents de sa vague, et un cliquet vaut mieux qu'un correctif à l'aveugle.
 */
const REFUS_GELES: readonly string[] = [
  'breathTypes → breathTypes.json',
  'celestialHouses → celestialHouses.json',
  'crewMoraleBands → crewMoraleBands.json',
  'crewMoraleFactors → crewMoraleFactors.json',
  'crewRoles → crewRoles.json',
  'crewTestTypes → crewTestTypes.json',
  'damageTypes → damageTypes.json',
  'landCargo → landCargo.json',
  'navalTraits → navalTraits.json',
  'psychologies → psychologies.json',
  'riverPerils → riverPerils.json',
  'seaCargo → seaCargo.json',
  'seaShanties → seaShanties.json',
  'steamBreakdowns → steamBreakdowns.json',
  'weather → weather.json',
];

function refus(): string[] {
  const out: string[] = [];
  for (const k of DATASET_KEYS) {
    const err = validateDataset(datasetFile(k), datasetSerializeRoot(k));
    if (err) out.push(`${k} → ${datasetFile(k)}`);
  }
  return out.sort();
}

describe('sauvegarde éditeur — chaque clé de dataset résout un fichier REGISTRÉ dont la racine PARSE (#1467 L1b)', () => {
  it('le stock de refus est EXACTEMENT celui gelé (ni neuf — ni périmé)', () => {
    const mesure = refus();
    const neufs = mesure.filter((r) => !REFUS_GELES.includes(r));
    expect(neufs, 'clé(s) NEUVE(s) dont la sauvegarde écrirait une racine invalide — câbler `NESTED_ARRAY_FILE`').toEqual([]);
    const soldes = REFUS_GELES.filter((r) => !mesure.includes(r));
    expect(soldes, 'stock PÉRIMÉ : ces clés parsent désormais — les retirer de la liste').toEqual([]);
  });

  it('le scan voit une population réelle (le contrat n’est pas vide par erreur de registre)', () => {
    expect(DATASET_KEYS.length).toBeGreaterThan(80);
  });

  it('fail-closed : une racine délibérément fausse est REFUSÉE (l’instrument mord)', () => {
    expect(validateDataset(datasetFile('montures'), { pas: 'un document' })).not.toBeNull();
  });
});
