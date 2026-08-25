/** Type d'une entrée des registres de schémas GÉNÉRÉS — UN document authoré, d'une des DEUX racines :
 *  `SCHEMA_DEFS` (`src/data`, catalogues de jeu) et `SCHEMA_DEFS_SCENES` (`src/scenes`, projets de
 *  campagne), émis par `scripts/gen-registry.mjs` et réunis par `DEFS_DE_DOCUMENT` (`validate.ts`). */
import type { z } from 'zod';
import type { FamilleDocument } from './grammaire/document';

/** Racine d'un document authoré — les DEUX sont peuplées (#1466) : `src/data` (catalogues de jeu,
 *  registre `SCHEMA_DEFS`) et `src/scenes` (projets de campagne, registre `SCHEMA_DEFS_SCENES`). */
export type RacineDocument = 'src/data' | 'src/scenes';

export interface SchemaDef {
  /** Désignation du document sous sa racine (`<root>/<file>`), telle qu'exportée par son module de
   *  def. La graphie SUIT LA RACINE : BASENAME pour `root: 'src/data'` (catalogues à plat,
   *  `characteristics.json`), CHEMIN RELATIF à la racine pour `root: 'src/scenes'` (documents en
   *  sous-dossiers, `arene/arene-projet.json`). C'est la clé de `validateDataset`/`schemaForFile`. */
  file: string;
  /** Racine du dataset — émise par `scripts/gen-registry.mjs`, jamais déclarée par le def. */
  root: RacineDocument;
  /** Schéma zod STRICT du dataset (racine = le tableau/objet exact du JSON). */
  schema: z.ZodTypeAny;
  /**
   * Famille du document, MESURÉE sur la structure réelle du dataset et déclarée par son def : elle
   * dit si le document porte des ids de premier niveau (`entite`/`record`) ou n'en porte aucun par
   * construction (`table`/`config`). `scripts/gen-registry.mjs` en fait un contrat FERMÉ contre
   * `IDS_PAR_DATASET`. En L1b (#1467) la déclaration migre dans l'appel `document(type, famille, …)`.
   */
  famille: FamilleDocument;
}
