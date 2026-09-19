/**
 * Le CŒUR d'un livre se RETIRE par le geste de l'atelier (#1825) : Compendium → Livres → un livre
 * de cœur → Éditer → vider « Cœur de règles » → Enregistrer. `editFields.ts#inferFields` rend le
 * champ `nullable` et `CodexEdit` émet `null` au vide : le schéma de `coeur` ADMET `null`, comme
 * les deux autres champs optionnels de ce def (`dir`, `extractionDir`). Couture générale : #1830.
 *
 * Ce banc juge le CHEMIN RÉEL, sur `books.json` réel et la porte que `CodexEdit` appelle vraiment
 * (`validateDataset`, `src/data/schemas/validate.ts:129`) — jamais un schéma forgé. Il vit ici, et
 * non avec les tests de donnée de `coeur` (`src/data/book-source-integrity.test.ts`) ni avec ceux de
 * `validateDataset` (`src/data/schemas/validate.test.ts`), parce qu'il lui faut les DEUX côtés de la
 * couture : `src/ui` peut lire `src/data`, l'inverse serait une dépendance à contresens.
 */
import { describe, it, expect } from 'vitest';
import { inferFields } from './editFields';
import { metaPourFichier, noeudObjet, schemaForFile, validateDataset } from '../../data/schemas/validate';
import { books } from '../../data/index';

const FILE = 'books.json';
const entrees = books as unknown as Record<string, unknown>[];
/** L'entrée qui PORTE un cœur — trouvée par le champ, jamais par un id de livre recopié. */
const PORTEUR = entrees.findIndex((b) => b.coeur != null);

/** Le dataset réel, l'entrée porteuse recevant `valeur` sur `coeur`. */
const datasetAvec = (valeur: unknown): unknown[] =>
  entrees.map((e, i) => (i === PORTEUR ? { ...e, coeur: valeur } : e));

describe('atelier — le cœur d’un livre se vide par le geste (#1825)', () => {
  it('le registre réel porte au moins un livre de cœur', () => {
    expect(PORTEUR).toBeGreaterThanOrEqual(0);
  });

  it('`inferFields` rend `coeur` NULLABLE sur la donnée réelle — l’atelier émettra donc `null`', () => {
    // MÊME régime que `CodexEdit.tsx:575` — le banc lit le formulaire que l'écran construit.
    const regime = { meta: metaPourFichier(FILE), noeud: noeudObjet(schemaForFile(FILE)) };
    const champ = inferFields(entrees, regime).find((f) => f.key === 'coeur');
    expect(champ).toBeDefined();
    expect(champ?.nullable).toBe(true);
    expect(champ?.label).toBe('Cœur de règles');
  });

  it('VIDER le champ (`null`) est ACCEPTÉ par la porte d’enregistrement', () => {
    expect(validateDataset(FILE, datasetAvec(null))).toBeNull();
  });

  it('le dataset committé, inchangé, passe la même porte', () => {
    expect(validateDataset(FILE, entrees)).toBeNull();
  });

  it('une graphie NON normalisée reste REFUSÉE, et le message nomme la règle', () => {
    const erreur = validateDataset(FILE, datasetAvec('5E '));
    expect(erreur).not.toBeNull();
    expect(erreur).toMatch(/graphie normalisée/);
  });

  it('la chaîne VIDE reste REFUSÉE — vider se dit `null`, pas `""`', () => {
    expect(validateDataset(FILE, datasetAvec(''))).not.toBeNull();
  });
});
