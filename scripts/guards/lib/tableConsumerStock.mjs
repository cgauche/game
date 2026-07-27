// STOCK CLIQUETÉ des tables d'effets SANS CONSOMMATEUR (« donnée écrite, non tirée = dette ») —
// consommé par `src/data/tables.test.ts`. Patron whitelist-en-lib du dépôt
// (`paletteLiteralStock.mjs`, `rigPartViewStock.mjs`).
//
// Une entrée de `tables.json` que NI une autre donnée (`src/data/*.json`) NI le code de prod
// (`src/**/*.ts(x)` hors tests) ne porte par son id en toutes lettres est un ornement : elle ne
// sera jamais tirée au runtime et fait mentir les compteurs d'obtenabilité (#734).
//
// Périmètre mesuré : détection TEXTUELLE de l'id complet. Angles morts déclarés : un id construit
// par concaténation dynamique dont aucun fichier ne porte la forme complète serait compté orphelin
// à tort ; un consommateur MORT (code jamais appelé) compte comme un consommateur.
//
// Un id se solde en CÂBLANT sa table (op `rollTable`, clé de rôle de Domaine, appel code) puis en
// retirant sa ligne ici — jamais en retirant la ligne seule.

/** @type {ReadonlySet<string>} */
export const TABLE_ORPHAN_RATCHET = new Set([
  'vdm-siphonnage-de-sort', // le trait `siphonnage-de-sort` (traits.json) annonce le tableau dans sa desc, aucune op ne le tire
  'vdm-symboles-augure', // curée, aucun consommateur data ni code
]);
