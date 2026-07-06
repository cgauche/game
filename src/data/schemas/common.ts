/**
 * Schémas zod PARTAGÉS entre les defs de `src/data/schemas/defs/*.ts` (contrat de donnée, Lot 1 —
 * docs/plans/2026-07-06-perennite-10-ans-design.md). Un besoin récurrent (GameOp, réf de source…)
 * se factorise ICI — jamais recopié dans chaque def.
 */
import { z } from 'zod';

/**
 * Un `GameOp` (`src/engine/ops.ts`) tel qu'il apparaît en DONNÉE : forme LOOSE — seul `op` (le nom
 * de l'opération) est garanti par tous les vocabulaires ; les champs restants varient par `op` et
 * sont déjà validés au vocabulaire par `data-wellformed` (moteur). Ce schéma ne vérifie que la
 * FORME (un objet avec un `op` string), pas la sémantique de l'opération.
 */
export const gameOpSchema = z.looseObject({ op: z.string() });

/**
 * Réf de source récurrente `{ book, page }` — vue sur 2-3 datasets (`characteristics.json`,
 * `species.json`/`SpeciesData.source`, `careers.json`/`CareerData.source` dans `src/data/index.ts`) :
 * même forme partout. `book` = id de `books.json` (id-pur, cf. commit `21aa4881`) ; `page` = folio
 * IMPRIMÉ du livre, JAMAIS l'index de la ré-extraction Marker (piège documenté :
 * `game-source-page-is-printed-folio`).
 */
export const sourceRefSchema = z.strictObject({
  book: z.string(),
  page: z.number(),
});

/**
 * Recette de détail de surface (`DetailRecipe`, `src/gameIso/detail/types.ts`) — portée par le champ
 * optionnel `detail` de 3 datasets d'apparence (`roofMaterials.json`, `reliefMaterials.json`,
 * `structureAppearance.json`). Reflet STRICT de l'interface TS (mêmes sous-objets/champs requis).
 */
export const detailRecipeSchema = z.strictObject({
  courses: z
    .strictObject({
      hM: z.number(),
      joint: z.string(),
      jointW: z.number(),
      stagger: z.number().optional(),
      blockWM: z.tuple([z.number(), z.number()]).optional(),
      edgeWobble: z.number().optional(),
      paletteVar: z.number().optional(),
    })
    .optional(),
  bands: z.array(z.strictObject({ atV: z.number(), hM: z.number(), color: z.string() })).optional(),
  timber: z
    .strictObject({
      postEveryM: z.number(),
      braces: z.enum(['X', 'V']).optional(),
      wM: z.number(),
      color: z.string(),
    })
    .optional(),
  speckle: z
    .strictObject({
      perM2: z.number(),
      rM: z.tuple([z.number(), z.number()]),
      colors: z.array(z.string()),
      vBias: z.number().optional(),
    })
    .optional(),
  tufts: z
    .strictObject({
      perM2: z.number(),
      hM: z.tuple([z.number(), z.number()]),
      colors: z.array(z.string()),
    })
    .optional(),
  tintVar: z.number().optional(),
  seedScope: z.enum(['edge', 'tile', 'instance']),
});

/**
 * Niveau de `Difficulty` (`src/engine/types.ts`) tel qu'il apparaît en DONNÉE — vu sur plusieurs
 * datasets naval-commerce (`sea-navigation.json`, `sea-cargo.json`, `land-cargo.json`,
 * `sea-weather.json`) qui portent tous des champs `difficulty`/`*Difficulty` typés `Difficulty` par
 * leurs consommateurs (`DATA as unknown as { ... difficulty: Difficulty ... }`). Les 10 valeurs du
 * type canon (LDB Tests + extrêmes EDO App.2) — pas seulement le sous-ensemble présent aujourd'hui —
 * car c'est le type que les consommateurs attendent, une future entrée peut légitimement en ajouter.
 */
export const difficultySchema = z.enum([
  'tresFacile',
  'facile',
  'accessible',
  'intermediaire',
  'complexe',
  'difficile',
  'tresDifficile',
  'presqueImpossible',
  'impossible',
]);
