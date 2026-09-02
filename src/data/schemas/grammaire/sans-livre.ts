/**
 * Documents SANS LIVRE (#1466 L1a, étendu #1467 L1b V-Src) — liste NOMINATIVE datée des types de
 * document qui n'ont AUCUN livre : vocabulaire d'application, configuration de rendu, structure du
 * dépôt. À ne pas confondre avec `SOURCE_EN_PROFONDEUR` (même ci-dessous) : ceux-là ONT un livre,
 * cité par sous-entrée, et ce sont deux dettes qui ne se soldent pas ensemble.
 * Partout ailleurs la provenance est
 * REQUISE, sous la forme `source` OU `maison` (refine de fabrique, `document.ts`) : un document de
 * jeu sans folio n'est pas interdit, il doit DIRE pourquoi (le sourçage des datasets de CONTENU qui
 * n'en portent pas reste le lot L1d #1469).
 *
 * Les configurations de RENDU et les manifestes d'outillage de cette liste sont des données de
 * l'application, pas des règles ; `actions.json` est le vocabulaire des actes du moteur (12 de ses
 * 55 entrées citent malgré tout un folio, d'où une source optionnelle et non interdite).
 *
 * Une entrée d'ici n'est PAS un blanc-seing : `axes.json` est resté DEHORS (#1467 L1b V-Src) parce
 * que « pas de livre » et « arbitrage maison » sont deux choses différentes — ses 9 entrées portent
 * désormais `maison`. Mesuré le 2026-08-27 : 49 datasets de `src/data` n'ont aucune provenance de
 * premier niveau, et les 49 sont couverts — 33 ici, 16 dans `SOURCE_EN_PROFONDEUR` (régime DISTINCT,
 * déclaré plus bas) : aucun dataset muet hors régime. Cette liste compte donc 34 clés = ces 33
 * muets + `actions`, seule clé dont le dataset porte MALGRÉ TOUT des provenances (12/55 folios).
 *
 * Clé = `type` du document, égal au nom de base de son dataset. Une entrée ne se retire que par le
 * commit qui SOURCE le document ; aucune entrée ne s'ajoute sans sa raison mesurée.
 */
export const SANS_LIVRE: Readonly<Record<string, string>> = {
  ambiance: 'configuration de rendu — ambiances lumineuses/sonores de scène, aucun folio ne les imprime',
  decorPalette: 'configuration de rendu — palette de teintes du décor, valeurs d’art',
  lightLevels: 'configuration de rendu — paliers d’éclairage du monde volumique',
  lightTones: 'configuration de rendu — teintes de lumière du monde volumique',
  props:
    'catalogue des placeables de décor — le DOCUMENT est de l’art (volume, libellé, empreinte, et la solidité physique de l’objet : aucune table ne chiffre qu’un tonneau bloque le passage). Trois de ses CHAMPS sont des règles et ne sont pas couverts par cette exemption : `light` (éclairage, LDB 74 l.43/56/58), `cover` et `opaque` (couvert, LDB 14 l.72/81/86) — les 41 entrées qui en portent un (mesuré le 2026-09-02) exigent `source` OU `maison` À L’ENTRÉE, par `affinerEntree` de `schemas/defs/props.ts`, et les 41 portent leur `maison`',
  raceAppearance: 'configuration de rendu — apparences par race pour le rig, art maison',
  reliefMaterials: 'configuration de rendu — matériaux de relief (recettes de détail de surface)',
  renduMonte: 'configuration de rendu — réglages d’assiette de la monture à l’écran',
  roofMaterials: 'configuration de rendu — matériaux de toiture (recettes de détail de surface)',
  structureAppearance: 'configuration de rendu — apparences de structures bâties',
  teintesJeu: 'configuration de rendu — palette de teintes de l’interface de jeu',
  'donnees.manifest': 'manifeste d’outillage — rubriques de la carte des données, décrit le dépôt',
  'primitives.manifest': 'manifeste d’outillage — primitives partagées, décrit le dépôt',
  'raw.manifest': 'manifeste d’outillage — dette/blocage par id de topic RAW, décrit le dépôt',
  'systemes.manifest': 'manifeste d’outillage — systèmes du jeu, décrit le dépôt',
  actions: 'vocabulaire des actes du moteur — une action porte un folio quand une règle la nomme (12/55), jamais par construction',

  // ── #1467 L1b V-Src (2026-08-27) — jugé le 2026-08-26. Chaque raison est MESURÉE au geste sur la
  // donnée réelle ; aucune n'est close par « … ». Trois classes, distinctes par ce qui MANQUE.

  // (1) VOCABULAIRES DE CATÉGORISATION — id + label, aucune valeur mécanique propre. Le concept est
  //     RAW, mais il est imprimé en PLUSIEURS endroits : un `page` scalaire en désignerait un seul.
  qualityTypes:
    'vocabulaire de catégorisation (id+label : Atout/Défaut) — IMPRIMÉS en trois paires de folios distinctes, un `page` scalaire en désignerait une et mentirait pour les deux autres : LDB 60 l.9 / 60 l.40 (folios 291/292), 62 l.217 / 62 l.309 (297/299), 63 l.68 / 63 l.80 (300/300). Les Qualités elles-mêmes portent chacune son folio (qualities.json, 59/59)',
  qualitySubtypes:
    'vocabulaire de catégorisation (id+label : Arme/Armure/Objet) — même famille que `qualityTypes`, mêmes trois paires de folios ; aucune valeur mécanique propre à sourcer (3/3 entrées sans provenance, mesuré)',
  'damage-types':
    'vocabulaire de catégorisation (id+label) — aucune valeur mécanique propre : le type est un PARAMÈTRE d’un Trait sourcé (traits.json), et l’énumération n’est imprimée nulle part en liste (4/4 sans provenance)',
  'breath-types':
    'vocabulaire de catégorisation (id+label) — même régime que `damage-types` : paramètre d’un Trait sourcé, jamais une liste imprimée (6/6 sans provenance)',
  localisation:
    'table de dé INVERSÉ (résultat de dé → zone de touche) — vocabulaire structurel du moteur ; les zones sont LDB et déjà tenues par `hitLocationSchema`, l’inversion ne l’est nulle part',
  propMaterials:
    'matériaux de RENDU des recettes volumiques de décor (couleur, rugosité, métallicité) — apparence, aucune règle à citer (4/4 sans provenance)',

  // (2) INDEX & CATALOGUES D'APPLICATION — l'objet décrit est le dépôt ou son contenu, pas une règle.
  books: 'index d’app des livres eux-mêmes — un livre ne se cite pas lui-même (29/29 sans provenance)',
  groups:
    'index d’app des groupes cibles (38 {id,label}) — tags de regroupement/rencontre, pas une notion RAW nommée ; les espèces sourcées vivent dans species.json',
  names:
    'listes de PRÉNOMS et noms d’authoring par race — aucune mécanique mesurable, aucune règle à sourcer',
  speciesRace:
    'table de résolution race → défauts d’authoring (`default`/`rules`) — câblage d’application, pas une donnée RAW',
  pregens: 'pré-tirés d’app (compositions maison de fiches jouables) — contenu app-inventé, pas une règle RAW',
  merchants:
    'catalogue d’app (archétypes de marchand : taux de rachat, familles vendues, agglo par défaut) ; les VALEURS de règle vivent sourcées à leur foyer (`engine/disponibilite.ts`, `bargain.ts`), et les valeurs maison porteront leur champ `maison` par entrée',
  merchantFamilies:
    'catalogue d’app — familles de PRÉSENTATION du stock marchand (onglets/colonnes de `ui/MerchantPanel.tsx`), mise en page, aucune valeur mécanique',
  'lieux-services':
    'catalogue d’app — id/label/icône de routage d’écran (hub de lieu) ; port et marché portent leur propre schéma sourcé',
  calendarPhases:
    'découpage horaire d’app (7 phases Aube→Nuit : minute de départ + icône, moteur de lumière/vision) — le Calendrier Impérial RAW vit dans calendarMonths/calendarWeekdays (EDO Annexe 3, folio 149-150, 12/12 et 8/8 sourcés) ; aucune table de phases n’y est imprimée',
  'progression-schemas.derived':
    'artefact GÉNÉRÉ par scripts/data/gen-progression-schemas.py — la provenance est PORTÉE PAR CHAQUE BANDE (book, page = folio imprimé, page PDF, ordonnée), relevée sur la page ; une source racine recopierait à la main ce que le générateur mesure',

  // (3) MIXTES — plusieurs provenances PAR CLÉ, aucune racine unique : leurs clés RAW sont citées à
  //     leur foyer (`defs/*.ts`) et la DONNÉE n'en porte aucune, donc rien n'est exigible ici.
  sizes:
    'plusieurs provenances par clé, aucune racine unique : `rangedMod` = LDB folio 162 (`14 - _GoBack.md` l.118-131) verbatim, `shipboardEnc` = MDG folio 92 (`12` l.25-33) verbatim, `footprintSide` = MAISON (LDB 15 l.12 ne chiffre rien). Les réfs vivent au foyer `defs/sizes.ts:2-6`',
  details:
    'plusieurs provenances par clé, aucune racine unique : `ageBase`/`ageRoll`/`heightBase`/`heightRoll` = LDB folio 39 (`05` l.705-728) verbatim pour les 4 seules colonnes imprimées (humain/nain/elfe/halfling) ; `gnome`/`ogre` y sont posés sans source trouvée ; `texts` est de la prose d’application',
};

/**
 * Documents dont la provenance est CITÉE EN PROFONDEUR (#1467 L1b V-Src) — régime DISTINCT de
 * `SANS_LIVRE` : ceux-ci ONT un livre, plusieurs même, mais pas à la RACINE. Chaque sous-entrée
 * porte son `source: {book,page}` ; la racine, elle, ne doit JAMAIS en porter — `auditDataset`
 * (`scripts/guards/lib/citationCoverage.mjs:83`) rend `{total:1, cited:1}` dès qu'une racine cite,
 * ce qui ferait sortir 490 sous-entrées du dénominateur de la garde de couverture. Verrouillé par
 * `src/data/source-racine-aveugle.test.ts`.
 *
 * La fabrique les exempte comme `SANS_LIVRE` (même effet : aucune provenance exigée à l'entrée de
 * racine), mais le MOTIF n'est pas le même et les deux listes ne se soldent pas ensemble — d'où deux
 * constantes. Comptes mesurés le 2026-08-27.
 *
 * `miscast` en est SORTI le 2026-08-28 (#1467 L1b V-FLIP-TABLE) : son fichier ne porte plus une
 * racine nue mais 5 DOCUMENTS, chacun avec SA `source` (LDB 234 ×2, VDM 24, VDM 25, LDB 218) — la
 * provenance y est redevenue exigible à l'entrée, et la fabrique l'exige.
 *
 * `criticals` et `aa-criticals` en sont SORTIS le 2026-09-02 (#1657 B2a) par le MÊME chemin : les
 * deux racines nues sont devenues 8 DOCUMENTS-tables dans un seul fichier, chacun portant SA
 * `source` (LDB 174 ×4 ; AA 83/84/85/86) en plus des 160 rangées qui gardent la leur.
 */
export const SOURCE_EN_PROFONDEUR: Readonly<Record<string, string>> = {
  'sea-weather': 'racine nue, citations par sous-entrée (34/34) — une source racine rendrait le dataset aveugle',
  'sea-events': 'racine nue, citations par sous-entrée (58/58) — une source racine rendrait le dataset aveugle',
  'sea-navigation': 'racine nue, citations par sous-entrée (2/2) — une source racine rendrait le dataset aveugle',
  'sea-perils': 'racine nue, citations par sous-entrée (15/15) — une source racine rendrait le dataset aveugle',
  'sea-cargo': 'racine nue, citations par sous-entrée (13/13) — une source racine rendrait le dataset aveugle',
  'land-cargo': 'racine nue, citations par sous-entrée (35/35) — une source racine rendrait le dataset aveugle',
  'river-perils': 'racine nue, citations par sous-entrée (4/4) — une source racine rendrait le dataset aveugle',
  weather: 'racine nue, citations par sous-entrée (10/10) — une source racine rendrait le dataset aveugle',
  'mass-battle': 'racine nue, citations par sous-entrée (39/39) — une source racine rendrait le dataset aveugle',
  'arcane-phenomena': 'racine nue, citations par sous-entrée (41/41) — une source racine rendrait le dataset aveugle',
  'ship-construction': 'racine nue, citations par sous-entrée (22/22) — une source racine rendrait le dataset aveugle',
  'crew-test-types': 'racine nue, citations par sous-entrée (10/10) — une source racine rendrait le dataset aveugle',
  disponibilite: 'racine nue, citations par sous-entrée (6/6) — une source racine rendrait le dataset aveugle',
  'naval-progression': 'racine nue, citations par sous-entrée (5/5) — une source racine rendrait le dataset aveugle',
};

/** UNION des deux régimes d'exemption — ce que la fabrique ET le cliquet consultent. */
export const SANS_PROVENANCE_EXIGEE: Readonly<Record<string, string>> = { ...SANS_LIVRE, ...SOURCE_EN_PROFONDEUR };

/** Une PROVENANCE (`source` ou `maison`) est-elle exigée par la fabrique pour ce type de document ? */
export function exigeSource(type: string): boolean {
  return !(type in SANS_PROVENANCE_EXIGEE);
}
