/**
 * Documents SANS LIVRE (#1466 L1a) — liste NOMINATIVE datée (2026-08-24) des types de document pour
 * lesquels `document()` n'exige PAS de `source`. Partout ailleurs la source est REQUISE : un
 * document de jeu sans folio est une dette, pas un régime (le sourçage des datasets de CONTENU qui
 * n'en portent pas est le lot L1d #1469).
 *
 * Mesure : `docs/structures-donnees.md` §2.3 — « Documents de racine ne portant AUCUNE clé `source`
 * à quelque profondeur que ce soit : 36 ». Les 11 configurations de RENDU et les manifestes
 * d'outillage de cette liste sont des données de l'application, pas des règles ; `actions.json` est
 * le vocabulaire des actes du moteur (12 de ses 55 entrées citent malgré tout un folio, d'où une
 * source optionnelle et non interdite).
 *
 * Clé = `type` du document, égal au nom de base de son dataset. Une entrée ne se retire que par le
 * commit qui SOURCE le document ; aucune entrée ne s'ajoute sans sa raison mesurée.
 */
export const SANS_LIVRE: Readonly<Record<string, string>> = {
  ambiance: 'configuration de rendu — ambiances lumineuses/sonores de scène, aucun folio ne les imprime',
  decorPalette: 'configuration de rendu — palette de teintes du décor, valeurs d’art',
  lightLevels: 'configuration de rendu — paliers d’éclairage du monde volumique',
  lightTones: 'configuration de rendu — teintes de lumière du monde volumique',
  props: 'configuration de rendu — catalogue des placeables de décor (art, pas règle)',
  raceAppearance: 'configuration de rendu — apparences par race pour le rig, art maison',
  reliefMaterials: 'configuration de rendu — matériaux de relief (recettes de détail de surface)',
  renduMonte: 'configuration de rendu — réglages d’assiette de la monture à l’écran',
  roofMaterials: 'configuration de rendu — matériaux de toiture (recettes de détail de surface)',
  structureAppearance: 'configuration de rendu — apparences de structures bâties',
  teintesJeu: 'configuration de rendu — palette de teintes de l’interface de jeu',
  'donnees.manifest': 'manifeste d’outillage — rubriques de la carte des données, décrit le dépôt',
  'primitives.manifest': 'manifeste d’outillage — primitives partagées, décrit le dépôt',
  'raw.manifest': 'manifeste d’outillage — dette/blocage par topic RAW, décrit le dépôt',
  'systemes.manifest': 'manifeste d’outillage — systèmes du jeu, décrit le dépôt',
  actions: 'vocabulaire des actes du moteur — une action porte un folio quand une règle la nomme (12/55), jamais par construction',
};

/** `source` est-elle exigée par la fabrique pour ce type de document ? */
export function exigeSource(type: string): boolean {
  return !(type in SANS_LIVRE);
}
