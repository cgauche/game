// Mécanique de mesure « citation par ENTRÉE » (#309, suite #278/#281). #278 a posé la garde de
// FORME (`sourceRefInline.mjs` — aucune réinvention de `sourceRefSchema`) ; #309 mesure la
// COUVERTURE réelle : chaque dataset de `src/data/*.json` porte-t-il `source: {book,page}` (ou
// `_source` libre, seule survivance documentée `common.ts:38-45`) sur CHACUNE de ses entrées
// RÉELLES ? Le piège signalé au ticket : un comptage brut (tout id trouvé, y compris les ids
// imbriqués — `specs`/`ranges`/`levels`…) gonfle le dénominateur. Ici on ne compte QUE les entrées
// de PREMIER niveau (item d'un tableau racine, ou item d'un tableau de catégorie type
// `criticals.json.tete`/`mass-battle.json.powerEstimate`) — jamais les sous-objets d'une entrée.
// Module ESM pur, exécutable par `node` nu — consommé par `scripts/data/audit-citations.mjs`
// (rapport) ET par `src/data/citation-coverage-guard.test.ts` (verrou cliquet).

/** Une entrée cite sa source si `source.book` (forme `sourceRefSchema`, `common.ts:23`), `_source`
 *  non vide (forme `freeSourceNoteSchema`, `common.ts:46` — seule survivance documentée pour
 *  `aa-criticals.json`), `maison` non vide top-level (un arbitrage MAISON documenté, rationale +
 *  réfs dans le texte même, ex. `proue-idole-de-stromfels` #221, EST la source de l'entrée), ou
 *  `alsoIn` porte au moins un emplacement bien formé (forme `secondarySourceRefSchema`, `common.ts:47`
 *  — #563 : l'ancre `source` reste la forme retenue, mais un `alsoIn` seul ne doit JAMAIS compter
 *  « non cité » si un futur schéma le rend co-porteur ; réfuté par `!Array.isArray(rec.source)` qui
 *  ne voit QUE l'ancre — trou permissif inverse : une entrée sans ancre valide mais avec des
 *  emplacements `alsoIn` complets serait comptée non citée à tort). Morsure : #563 Lot 1 item 1.
 *  @param {unknown} item @returns {boolean} */
export function isCitedItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const rec = /** @type {Record<string, unknown>} */ (item);
  if (rec.source && typeof rec.source === 'object' && !Array.isArray(rec.source) && typeof (/** @type {Record<string, unknown>} */ (rec.source)).book === 'string') return true;
  if (typeof rec._source === 'string' && rec._source.length > 0) return true;
  if (typeof rec.maison === 'string' && rec.maison.length > 0) return true;
  if (Array.isArray(rec.alsoIn) && rec.alsoIn.some((ref) => isPlainObject(ref) && typeof (/** @type {Record<string, unknown>} */ (ref)).book === 'string' && typeof (/** @type {Record<string, unknown>} */ (ref)).page === 'number')) return true;
  return false;
}

/** Une entrée « objet simple » (ni tableau, ni null) — filtre des tableaux de catégorie exploitables. */
function isPlainObject(x) {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

/** Libellé d'une entrée pour le rapport (id si présent, sinon min/max, sinon index). */
function entryLabel(item, key, idx) {
  if (isPlainObject(item)) {
    if (typeof item.id === 'string') return key ? `${key}.${item.id}` : item.id;
    if (typeof item.min === 'number') return `${key ? key + '.' : ''}${item.min}-${item.max}`;
  }
  return `${key ? key + '.' : ''}#${idx}`;
}

/**
 * Résultat de mesure d'un dataset (fichier `.json` de `src/data`).
 * @typedef {{ total: number, cited: number, missing: string[], shape: 'array'|'map-of-lists'|'single' }} DatasetCoverage
 */

/**
 * Détecte la FORME d'un dataset et compte ses entrées RÉELLES + leur citation.
 * - `array` : le fichier racine EST le tableau d'entrées (`skills.json`, `talents.json`…).
 * - `map-of-lists` : objet racine dont une ou plusieurs propriétés DIRECTES sont des tableaux
 *   d'objets ET dont AU MOINS UN item de ces tableaux cite déjà sa source individuellement —
 *   signe que ce dataset suit la convention PAR ENTRÉE (`sea-weather.json.table`,
 *   `mass-battle.json.powerEstimate`…) : chaque tableau est une CATÉGORIE de la même famille de
 *   table, les entrées sont les items de CES tableaux, jamais recursées plus profond (`ops`/
 *   `ranges` imbriqués ne comptent pas).
 * - `single` : objet de config unique — cité si sa RACINE porte `source`/`_source` (convention
 *   documentée `common.ts:30-35` : "à la racine quand le dataset est un objet de config unique
 *   plutôt qu'une liste" — couvre alors TOUT le fichier, y compris les tableaux/sous-tables
 *   imbriqués, ex. `montures.json`/`river-criticals.json.tables`). Sans racine citée ET sans
 *   tableau à convention par-entrée, le fichier entier est UNE entrée non citée.
 * @param {unknown} data @returns {DatasetCoverage}
 */
export function auditDataset(data) {
  if (Array.isArray(data)) {
    const total = data.length;
    const missing = [];
    let cited = 0;
    data.forEach((item, i) => {
      if (isCitedItem(item)) cited++;
      else missing.push(entryLabel(item, '', i));
    });
    return { total, cited, missing, shape: 'array' };
  }
  if (isPlainObject(data)) {
    // La RACINE citée prime (convention documentée `common.ts:30-35`) : elle couvre tout le
    // fichier, y compris les tableaux/sous-tables imbriqués (`montures.json`, `river-criticals.json.
    // tables`…) — même quand une valeur scalaire annexe (`crew-morale.json.base`) est la seule
    // réellement visée par cette réf précise, le fichier est considéré couvert.
    if (isCitedItem(data)) return { total: 1, cited: 1, missing: [], shape: 'single' };
    const categoryProps = Object.entries(data).filter(
      ([, v]) => Array.isArray(v) && v.length > 0 && v.every(isPlainObject),
    );
    if (categoryProps.length > 0) {
      const missing = [];
      let total = 0;
      let cited = 0;
      for (const [key, arr] of categoryProps) {
        arr.forEach((item, i) => {
          total++;
          if (isCitedItem(item)) cited++;
          else missing.push(entryLabel(item, key, i));
        });
      }
      return { total, cited, missing, shape: 'map-of-lists' };
    }
    return { total: 1, cited: 0, missing: ['(racine)'], shape: 'single' };
  }
  return { total: 0, cited: 0, missing: [], shape: 'single' };
}

/**
 * Liste d'EXEMPTION nominative — vocabulaires app-internes légitimement sans livre (aucune
 * mécanique CHIFFRÉE tirée du RAW, ou note de provenance libre déjà documentée comme survivance
 * unique). Chaque entrée porte SA raison ; jamais un motif générique. Établie depuis la mesure
 * réelle (#309, phase 1) — toute extension future nomme le fichier + justifie.
 * @type {Record<string, string>}
 */
export const EXEMPT_DATASETS = {
  'aa-criticals.json': "note libre `_source` au niveau du fichier (seule survivance documentée, common.ts:56-65) — l'extraction Marker d'Aux Armes EXISTE (motif RÉVISÉ #563 : la table de Blessures Critiques cite un intervalle APPROXIMATIF `p.≈118-124`, jamais migrée en `source: sourceRefSchema` PAR ENTRÉE — dette de migration, pas un blocage d'extraction).",
  'books.json': 'catalogue des LIVRES eux-mêmes — pas de "source" au sens où un livre se cite lui-même.',
  'characteristics.json': "vocabulaire des 10 Caractéristiques (clés/labels), pas une table de valeurs RAW à citer par entrée (base SUPPRIMÉE #310, table morte).",
  'decorPalette.json': 'palette de couleurs de RENDU (hex), pas une donnée RAW.',
  'ambiance.json': 'config de rendu (éclairage iso/POV), pas une donnée RAW.',
  'details.json': "presets d'authoring (âge/taille par race) dérivés de tables LDB déjà citées ailleurs (species.json) — vocabulaire de génération, pas une table RAW autonome.",
  'localisation.json': 'table de dé inversé (mapping résultat→zone de touche) — vocabulaire structurel du moteur, pas une table RAW à citer en tant que telle (les zones sont LDB, déjà couvertes par `hitLocationSchema`).',
  'names.json': "liste de PRÉNOMS d'authoring par race — pas une mécanique mesurable, aucune règle à sourcer.",
  'sizes.json': 'un seul champ `rangedMod` (barème de modificateur par Taille) — vocabulaire structurel, pas une entrée narrative sourçable individuellement.',
  'speciesRace.json': "table de résolution race→défauts d'authoring (`_doc`/`default`/`rules`), pas une donnée RAW.",
  'groups.json': "vocabulaire app-interne de GROUPES de créatures (tags de regroupement/rencontre), pas une notion RAW nommée.",
  'props.json': "catalogue de props de décor (rendu iso), pas une donnée RAW.",
  'reliefMaterials.json': 'catalogue de matériaux de relief (rendu iso), pas une donnée RAW.',
  'lightLevels.json': "niveaux de lumière (rendu iso/vision), vocabulaire moteur — pas une table RAW à citer par entrée (la RÈGLE de vision est ailleurs, sourcée).",
  'raceAppearance.json': "presets d'apparence (rendu iso) par race — esthétique, pas une règle RAW.",
  'roofMaterials.json': 'catalogue de matériaux de toiture (rendu iso), pas une donnée RAW.',
  'structureAppearance.json': "presets d'apparence de structure (rendu iso), pas une donnée RAW.",
  'breath-types.json': "vocabulaire de catégorisation (id+label uniquement, ex. « feu »/« poison ») — aucune valeur mécanique propre à sourcer, la RÈGLE (souffle de créature) est ailleurs.",
  'damage-types.json': "vocabulaire de catégorisation (id+label uniquement) — aucune valeur mécanique propre à sourcer.",
  'qualityTypes.json': "vocabulaire de catégorisation des Qualités/Défauts (id+label, Atout/Défaut) — aucune valeur mécanique propre.",
  'qualitySubtypes.json': "vocabulaire de catégorisation des Qualités/Défauts (id+label, Arme/Armure/Objet) — aucune valeur mécanique propre.",
  'pregens.json': "personnages PRÉ-GÉNÉRÉS d'authoring (fiches jouables), contenu app-inventé — pas une règle RAW à sourcer.",
  'calendarPhases.json': "les 7 phases de la journée (Aube→Nuit) sont un DÉCOUPAGE app-interne (minute de départ + icône, moteur de lumière/vision) — introuvable comme table RAW nommée dans le Calendrier Impérial (EDO Annexe 3, folio 149-150 : seuls mois/jours/jours intercalaires y sont RAW, #309 phase 3) ; aucune valeur mécanique à sourcer par entrée.",
  'primitives.manifest.json': "manifeste TOOLING (#298) des primitives partagées du code (nom/fichier/concept/verrou) — vocabulaire app-interne, aucune mécanique RAW à sourcer.",
  'systemes.manifest.json': "manifeste TOOLING (#298) éditorial des systèmes implémentés (nom/modules/état/ticket) — vocabulaire app-interne, aucune mécanique RAW à sourcer.",
  'lieux-services.json': "vocabulaire des SERVICES de lieu (#343 — auberge/temple/forgeron/guilde) : id/label/icône de routage d'écran (hub de lieu), aucune valeur mécanique propre à sourcer (port/marché portent leur propre schéma sourcé).",
  'axes.json': "axes de forces/faiblesses (#409) — mécanique MAISON tracée par ticket (aucune règle RAW ne stat un axe de forces) : `source: 'maison'` par entrée, pas de folio {book,page} à citer.",
  'raw.manifest.json': "manifeste TOOLING (#487) éditorial du champ Implémente de l'Atlas RAW (topic/ticket/bloque, généré par scripts/raw/build-implemente.mjs) — vocabulaire app-interne, aucune mécanique RAW à sourcer.",
  'merchants.json': "archétypes de MARCHAND (#2) — config app-owned (taux de rachat/Marchandage/agglo par défaut/familles vendues), pas une table RAW à folio unique par entrée : les VALEURS RAW citées (½/¼ de revente, majoration, Disponibilité) vivent dans `engine/disponibilite.ts` (LDB 59) et `bargain.ts`, déjà sourcées à leur foyer ; le `boniment` est une réplique d'auteur, sans RAW à sourcer.",
  'merchantFamilies.json': "familles de PRÉSENTATION du stock marchand (onglets/colonnes de `ui/MerchantPanel.tsx`) — vocabulaire de mise en page app-interne, aucune valeur mécanique RAW à sourcer par entrée.",
};
