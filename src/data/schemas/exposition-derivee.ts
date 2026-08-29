/**
 * Tables d'exposition du Codex DÉRIVÉES du registre de schémas (#1472). Aucune table à la main :
 * une déclaration `exposition` de plus sur un def (`document(type, famille, champs, meta, exposition)`)
 * est une entrée de plus ici. Les contrats sont tenus par `exposition-contrats.test.ts`.
 *
 * La dérivation est une FONCTION PURE (`deriveExposition`) que le module applique à `SCHEMA_DEFS` :
 * ses refus (fail-fast, nominatifs) se prouvent sur des defs SYNTHÉTIQUES, sans toucher la vraie donnée.
 */
import { SCHEMA_DEFS } from './_registry.generated';
import type { SchemaDef } from './types';

/** Route d'un dataset-OBJET : la clé JS du dataset et la projection de l'éditeur. */
export interface RouteObjet {
  readonly ds: string;
  readonly mode: 'single' | 'record';
}

/** Exemption d'exposition au Codex, telle que déclarée par le def. */
export interface ExemptionCodex {
  readonly kind: 'vocabulaire-app-interne' | 'dette';
  readonly raison: string;
  readonly ticket?: string;
}

/** Tables dérivées d'un jeu de defs — ce que `deriveExposition` rend, et rien d'autre. */
export interface TablesExposition {
  readonly categoryDataset: Record<string, string>;
  readonly datasetFichier: Record<string, string>;
  readonly objectCategory: Record<string, RouteObjet>;
  readonly fichiersDeclares: Set<string>;
  readonly exempts: Record<string, ExemptionCodex>;
}

/**
 * Dérive les tables d'exposition d'un jeu de defs. FAIL-FAST et NOMINATIVE : un def sans
 * `exposition`, une route indépartageable, un dataset-objet à 0 ou 2 clés, ou DEUX defs revendiquant
 * la même clé de catégorie lèvent — la garantie de construction (une clé, un propriétaire) ne se perd
 * pas en écrasement silencieux.
 */
export function deriveExposition(defs: readonly SchemaDef[]): TablesExposition {
  const categoryDataset: Record<string, string> = {};
  const datasetFichier: Record<string, string> = {};
  const objectCategory: Record<string, RouteObjet> = {};
  const fichiersDeclares = new Set<string>();
  const exempts: Record<string, ExemptionCodex> = {};
  const proprietaire = new Map<string, string>();

  /** Une clé de catégorie n'a qu'UN def propriétaire — la 2ᵉ revendication est nommée, pas absorbée. */
  const revendique = (cle: string, fichier: string): void => {
    const deja = proprietaire.get(cle);
    if (deja !== undefined) {
      throw new Error(
        `exposition-derivee : la catégorie Codex « ${cle} » est revendiquée par DEUX documents ` +
          `(\`${deja}\` et \`${fichier}\`) — une clé, une route : trancher au def.`,
      );
    }
    proprietaire.set(cle, fichier);
  };

  /** Un dataset éditable n'a qu'UN document porteur — son fichier disque en découle (#1530). */
  const routeFichier = (ds: string, fichier: string): void => {
    const deja = datasetFichier[ds];
    if (deja !== undefined) {
      throw new Error(
        `exposition-derivee : le dataset '${ds}' est édité par DEUX documents ` +
          `(\`${deja}\` et \`${fichier}\`) — un dataset, un fichier : trancher au def.`,
      );
    }
    datasetFichier[ds] = fichier;
  };

  for (const def of defs) {
    fichiersDeclares.add(def.file);
    const expo = def.exposition;
    if (!expo) {
      throw new Error(
        `exposition-derivee : \`${def.file}\` ne déclare aucune \`exposition\` — tout document dit où il ` +
          `se lit (Codex) et où il s'édite (\`document(type, famille, champs, meta, exposition)\`).`,
      );
    }

    if ('exempt' in expo.codex) exempts[def.file] = expo.codex.exempt;
    const keys = 'keys' in expo.codex ? expo.codex.keys : [];

    if ('dataset' in expo.edit) {
      const ds = expo.edit.dataset;
      // Une seule clé Codex : elle route, quelle que soit sa graphie (`races` → dataset `species`).
      // Plusieurs clés : celle qui ÉGALE le dataset route, les autres sont des vues en lecture.
      const route = keys.length === 1 ? keys[0] : keys.find((k) => k === ds);
      if (!route) {
        throw new Error(
          `exposition-derivee : \`${def.file}\` édite le dataset '${ds}' mais aucune de ses clés Codex ` +
            `[${keys.join(', ')}] ne le départage — une clé unique, ou une clé égale au nom du dataset.`,
        );
      }
      revendique(route, def.file);
      categoryDataset[route] = ds;
      routeFichier(ds, def.file);
      continue;
    }

    if ('object' in expo.edit) {
      if (keys.length !== 1) {
        throw new Error(
          `exposition-derivee : \`${def.file}\` s'édite comme dataset-OBJET mais déclare ${keys.length} clés Codex ` +
            `[${keys.join(', ')}] — un objet de configuration n'a qu'une clé (identité clé ↔ dataset).`,
        );
      }
      revendique(keys[0], def.file);
      objectCategory[keys[0]] = { ds: keys[0], mode: expo.edit.object };
      continue;
    }

    if ('niche' in expo.edit) {
      // Tableaux nichés : chaque catégorie routée porte le nom de son dataset (identité).
      for (const cat of expo.edit.niche.categories) {
        revendique(cat, def.file);
        categoryDataset[cat] = cat;
        routeFichier(cat, def.file);
      }
    }
  }

  return { categoryDataset, datasetFichier, objectCategory, fichiersDeclares, exempts };
}

const derive = deriveExposition(SCHEMA_DEFS);

/** Catégorie Codex → dataset-LISTE éditable (`src/data/overrides.ts` `ARRAYS`). */
export const CATEGORY_DATASET_DERIVE: Readonly<Record<string, string>> = derive.categoryDataset;

/** Dataset-LISTE éditable → FICHIER disque de son document porteur (#1530). Un dataset absent d'ici
 *  n'a AUCUNE route d'édition déclarée (`edit:{none}`) : il ne se sauvegarde pas, donc il n'a pas de
 *  fichier de sauvegarde — c'est un refus, jamais un `<clé>.json` deviné. */
export const DATASET_FICHIER_DERIVE: Readonly<Record<string, string>> = derive.datasetFichier;

/** Catégorie Codex → dataset-OBJET éditable (`src/data/overrides.ts` `OBJECTS`). */
export const OBJECT_CATEGORY_DERIVE: Readonly<Record<string, RouteObjet>> = derive.objectCategory;

/** Les `file` de tous les defs de `src/data` — ancre du contrat filesystem. */
export const FICHIERS_DECLARES: ReadonlySet<string> = derive.fichiersDeclares;

/** Fichier → exemption d'exposition au Codex déclarée par son def. */
export const EXEMPTS: Readonly<Record<string, ExemptionCodex>> = derive.exempts;

/** Union des clés de catégorie Codex déclarées par les defs. */
export const CLES_CODEX_DECLAREES: ReadonlySet<string> = new Set(
  SCHEMA_DEFS.flatMap((d) => (d.exposition && 'keys' in d.exposition.codex ? [...d.exposition.codex.keys] : [])),
);
