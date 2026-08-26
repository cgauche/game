/**
 * Générateur GÉNÉRIQUE de registres « dépose un fichier → intégré ». Scanne un dossier `defs/`
 * et écrit un index EXPLICITE (`_registry.generated.ts`) — pas d'`import.meta.glob` (Vite-only,
 * cassé sous tsx) : l'index généré marche partout (app Vite, Vitest, scripts tsx), est
 * inspectable et sans coût runtime. Réutilisable pour créatures / tenues / modèles / etc.
 *
 *   node scripts/gen-registry.mjs
 *
 * Câblé dans `npm run gen` (+ `npm run build`). Ajouter une entrée = déposer un fichier
 * dans le `defs/` correspondant, puis relancer (auto en dev via le plugin Vite).
 */
import { readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `importDir` : chemin (relatif au fichier `out`) d'où importer chaque entrée. Défaut `./defs`
 * (les entrées vivent dans un sous-dossier `defs/`). Mettre `.` quand les fichiers sont à plat
 * dans le même dossier que l'index (cas des scénarios).
 * `idUnion` (option PAR registre) : émet AUSSI une union de littéraux `export type <typeName> =`
 * extraite des champs `<field>: '…'` des defs — typage RÉEL des ids côté consommateurs TS.
 * `fields` (option PAR registre) : quand un module de def exporte PLUSIEURS noms (pas 1 seul via
 * `exportName`), liste ces noms → chaque entrée du tableau généré devient `{ champ1, champ2, … }`
 * (ex. `src/data/schemas/defs/` : `file` + `schema`).
 * `constFields` (option PAR registre, avec `fields`) : champs de VALEUR LITTÉRALE ajoutés à chaque
 * entrée générée — ce que le def ne déclare pas parce que c'est une propriété du REGISTRE (la
 * racine `root` d'un dataset : le def dit son fichier, le registre dit d'où il vient).
 * @type {{ dir:string, out:string, exportName?:string, arrayName:string, type:string, typeFrom:string, importDir?:string, idUnion?:{ typeName:string, field:string }, fields?:string[], constFields?:Record<string,string> }[]}
 */
export const REGISTRIES = [
  {
    dir: 'src/gameIso/rig/creatures/defs',
    out: 'src/gameIso/rig/creatures/_registry.generated.ts',
    exportName: 'creature',
    arrayName: 'CREATURES',
    type: 'CreatureDef',
    typeFrom: './types',
  },
  {
    // Scénarios de test : fichiers À PLAT dans le dossier (pas de sous-dossier defs/).
    dir: 'src/scenes/test-scenarios',
    out: 'src/scenes/test-scenarios/_registry.generated.ts',
    exportName: 'scenario',
    arrayName: 'SCENARIOS',
    type: 'TestScenario',
    typeFrom: './_shared',
    importDir: '.',
  },
  {
    // Parts monstrueuses (têtes/bras/jambes) : 1 part = 1 fichier defs/.
    dir: 'src/gameIso/rig/parts/monster/defs',
    out: 'src/gameIso/rig/parts/monster/_registry.generated.ts',
    exportName: 'part',
    arrayName: 'MONSTER_PARTS',
    type: 'MonsterPartDef',
    typeFrom: './types',
  },
  {
    // Têtes QUADRUPÈDES (art 3 vues + canaux de forme portés par la tête) : 1 tête = 1 fichier defs/.
    // L'union `QuadHeadId` est GÉNÉRÉE depuis les defs : le socle n'énumère aucune clé à la main.
    dir: 'src/gameIso/rig/quadruped/heads/defs',
    out: 'src/gameIso/rig/quadruped/heads/_registry.generated.ts',
    exportName: 'quadHead',
    arrayName: 'QUAD_HEAD_DEFS',
    type: 'QuadHeadDef',
    typeFrom: './types',
    idUnion: { typeName: 'QuadHeadId', field: 'key' },
  },
  {
    // Queues QUADRUPÈDES (art profil + dos) : 1 queue = 1 fichier defs/. L'union `QuadTailId` est
    // GÉNÉRÉE depuis les defs : le socle n'énumère aucune clé à la main.
    dir: 'src/gameIso/rig/quadruped/tails/defs',
    out: 'src/gameIso/rig/quadruped/tails/_registry.generated.ts',
    exportName: 'quadTail',
    arrayName: 'QUAD_TAIL_DEFS',
    type: 'QuadTailDef',
    typeFrom: './types',
    idUnion: { typeName: 'QuadTailId', field: 'key' },
  },
  {
    // Crinières QUADRUPÈDES (encolure de profil + fraise de poitrail + touffe de croupe) :
    // 1 crinière = 1 fichier defs/. L'union `QuadManeId` GÉNÉRÉE remplace l'union littérale du socle.
    dir: 'src/gameIso/rig/quadruped/manes/defs',
    out: 'src/gameIso/rig/quadruped/manes/_registry.generated.ts',
    exportName: 'quadMane',
    arrayName: 'QUAD_MANE_DEFS',
    type: 'QuadManeDef',
    typeFrom: './types',
    idUnion: { typeName: 'QuadManeId', field: 'key' },
  },
  {
    // Sets d'ÉQUIPEMENT quadrupèdes (sellerie/bât/barde — art cuit par vue depuis
    // `atelier/harnais/<id>@<espèce>-<vue>.dessin.mts`) : 1 set = 1 fichier defs/. Même patron que
    // les têtes/queues/crinières ; l'union `QuadHarnaisId` est GÉNÉRÉE des ids déclarés (#1128).
    dir: 'src/gameIso/rig/quadruped/harnais/defs',
    out: 'src/gameIso/rig/quadruped/harnais/_registry.generated.ts',
    exportName: 'quadHarnais',
    arrayName: 'QUAD_HARNAIS_DEFS',
    type: 'QuadHarnaisDef',
    typeFrom: './types',
    idUnion: { typeName: 'QuadHarnaisId', field: 'id' },
  },
  {
    // Appendices (cornes/queue, art multi-vues) : 1 appendice = 1 fichier defs/. Source UNIQUE de
    // l'art de corne/queue, référencé par id (monster.cornes / appendageFeature / traitVisuals).
    dir: 'src/gameIso/rig/parts/appendages/defs',
    out: 'src/gameIso/rig/parts/appendages/_registry.generated.ts',
    exportName: 'appendage',
    arrayName: 'APPENDAGE_DEFS',
    type: 'AppendageDef',
    typeFrom: './types',
    idUnion: { typeName: 'AppendageId', field: 'id' },
  },
  {
    // Prothèses/amputations (art dans defs) : 1 prothèse = 1 fichier.
    dir: 'src/gameIso/rig/parts/prosthesis/defs',
    out: 'src/gameIso/rig/parts/prosthesis/_registry.generated.ts',
    exportName: 'prosthesis',
    arrayName: 'PROSTHESIS_DEFS',
    type: 'ProsthesisDef',
    typeFrom: './types',
    idUnion: { typeName: 'ProsthesisId', field: 'id' },
  },
  {
    // Corps de base (chair nue, pour composer les tenues de monstres) : 1 corps = 1 fichier defs/.
    dir: 'src/gameIso/rig/parts/bodies/defs',
    out: 'src/gameIso/rig/parts/bodies/_registry.generated.ts',
    exportName: 'body',
    arrayName: 'BODY_DEFS',
    type: 'BodyDef',
    typeFrom: './types',
    idUnion: { typeName: 'BodyId', field: 'id' },
  },
  {
    // Yeux peints (art d'orbite, remplacé en place) : 1 œil = 1 fichier defs/. Blessures/mutations/éditeur.
    dir: 'src/gameIso/rig/parts/eyes/defs',
    out: 'src/gameIso/rig/parts/eyes/_registry.generated.ts',
    exportName: 'eye',
    arrayName: 'EYE_DEFS',
    type: 'EyeDef',
    typeFrom: './types',
    idUnion: { typeName: 'EyeId', field: 'id' },
  },
  {
    // Capes (art dorsal 3 vues) : 1 cape = 1 fichier defs/. Emplacement Cape (equip.cape), dorsalOverlays.
    dir: 'src/gameIso/rig/parts/capes/defs',
    out: 'src/gameIso/rig/parts/capes/_registry.generated.ts',
    exportName: 'cape',
    arrayName: 'CAPE_DEFS',
    type: 'CapeDef',
    typeFrom: './types',
    idUnion: { typeName: 'CapeId', field: 'id' },
  },
  {
    // Ailes (art dorsal 3 vues, emplumées/cuir) : 1 paire = 1 fichier defs/. Servi par le trait Vol,
    // l'élément 'ailes' et monster.ailes ; référencé par id.
    dir: 'src/gameIso/rig/parts/wings/defs',
    out: 'src/gameIso/rig/parts/wings/_registry.generated.ts',
    exportName: 'wing',
    arrayName: 'WING_DEFS',
    type: 'WingDef',
    typeFrom: './types',
    idUnion: { typeName: 'WingId', field: 'id' },
  },
  {
    // Tenues (archétypes de classe + Nu) : 1 tenue = 1 fichier defs/.
    dir: 'src/gameIso/rig/parts/tenues/defs',
    out: 'src/gameIso/rig/parts/tenues/_registry.generated.ts',
    exportName: 'tenue',
    arrayName: 'TENUE_DEFS',
    type: 'TenueDef',
    typeFrom: './types',
  },
  {
    // Têtes (visage + coiffure défaut par Race:Sexe, art tokenisé) : 1 tête = 1 fichier defs/.
    dir: 'src/gameIso/rig/parts/heads/defs',
    out: 'src/gameIso/rig/parts/heads/_registry.generated.ts',
    exportName: 'head',
    arrayName: 'HEAD_DEFS',
    type: 'HeadDef',
    typeFrom: './types',
  },
  {
    // Coiffures (pool partagé par sexe, 3 vues) : 1 coiffure = 1 fichier defs/.
    dir: 'src/gameIso/rig/parts/hairstyles/defs',
    out: 'src/gameIso/rig/parts/hairstyles/_registry.generated.ts',
    exportName: 'hairstyle',
    arrayName: 'HAIRSTYLE_DEFS',
    type: 'HairstyleDef',
    typeFrom: './types',
  },
  {
    // Formes de nuée (silhouette d'1 constituant + palette) : 1 forme = 1 fichier defs/.
    dir: 'src/gameIso/rig/swarm/defs',
    out: 'src/gameIso/rig/swarm/_registry.generated.ts',
    exportName: 'swarmForm',
    arrayName: 'SWARM_FORM_DEFS',
    type: 'SwarmFormDef',
    typeFrom: './formDef',
  },
  {
    // Éléments d'apparence (catalogue unifié — traits de corps réutilisables) : 1 élément = 1 fichier defs/.
    dir: 'src/gameIso/rig/parts/elements/defs',
    out: 'src/gameIso/rig/parts/elements/_registry.generated.ts',
    exportName: 'element',
    arrayName: 'ELEMENT_DEFS',
    type: 'AppearanceElement',
    typeFrom: './types',
  },
  {
    // Armes (forme + art unifiés) : 1 arme = 1 fichier defs/.
    dir: 'src/gameIso/rig/parts/weapons/defs',
    out: 'src/gameIso/rig/parts/weapons/_registry.generated.ts',
    exportName: 'weapon',
    arrayName: 'WEAPON_DEFS',
    type: 'WeaponDef',
    typeFrom: './types',
  },
  {
    // Boucliers (silhouette main faible) : 1 bouclier = 1 fichier defs/ — MÊME pattern que les armes.
    dir: 'src/gameIso/rig/parts/shields/defs',
    out: 'src/gameIso/rig/parts/shields/_registry.generated.ts',
    exportName: 'shield',
    arrayName: 'SHIELD_DEFS',
    type: 'ShieldDef',
    typeFrom: './types',
  },
  {
    // Armures (matériau × emplacement, art tokenisé) : 1 matériau = 1 fichier defs/ — MÊME pattern que les tenues.
    dir: 'src/gameIso/rig/parts/armour/defs',
    out: 'src/gameIso/rig/parts/armour/_registry.generated.ts',
    exportName: 'armour',
    arrayName: 'ARMOUR_DEFS',
    type: 'ArmourDef',
    typeFrom: './types',
  },
  {
    // Arts d'engin de siège (silhouette statique 3 vues, plan 'engin') : 1 engin = 1 fichier defs/ —
    // MÊME pattern que les armes/parts (routé par id d'espèce, JAMAIS de name-matcher ni de table à la main).
    dir: 'src/gameIso/rig/engin/defs',
    out: 'src/gameIso/rig/engin/_registry.generated.ts',
    exportName: 'enginArt',
    arrayName: 'ENGIN_ARTS',
    type: 'EnginArtDef',
    typeFrom: './artkit',
  },
  {
    // Arts de COQUE de navire (profil broadside) : 1 coque = 1 fichier defs/ — MÊME pattern que les
    // engins (routé par ID de véhicule dans composeShip ; un id sans def tombe sur le REPLI VISIBLE #223.
    // La galerie oriented-objects montre la couverture déclarée).
    dir: 'src/gameIso/rig/ship/defs',
    out: 'src/gameIso/rig/ship/_registry.generated.ts',
    exportName: 'hullArt',
    arrayName: 'SHIP_ARTS',
    type: 'ShipArtDef',
    typeFrom: './artkit',
  },
  {
    // Arts de VÉHICULE TERRESTRE : 1 véhicule = 1 fichier defs/ — MÊME pattern que les engins/coques
    // (routé par ID de véhicule dans composeLand ; un id sans def tombe sur le REPLI VISIBLE #223).
    dir: 'src/gameIso/rig/land/defs',
    out: 'src/gameIso/rig/land/_registry.generated.ts',
    exportName: 'landArt',
    arrayName: 'LAND_ARTS',
    type: 'LandArtDef',
    typeFrom: './artkit',
  },
  {
    // Gabarits (carrures réutilisables) : 1 carrure = 1 fichier defs/. Dissout PROPS.
    dir: 'src/gameIso/rig/gabarits/defs',
    out: 'src/gameIso/rig/gabarits/_registry.generated.ts',
    exportName: 'gabarit',
    arrayName: 'GABARIT_DEFS',
    type: 'GabaritDef',
    typeFrom: './types',
  },
  {
    // Gabarits corporels AUTO-ENREGISTRÉS : 1 plan = 1 fichier defs/ (ré-exporte son BodyPlan).
    // bodyPlan.ts dérive la table PLANS de cette liste → aucun registre central à éditer.
    dir: 'src/gameIso/rig/plans/defs',
    out: 'src/gameIso/rig/plans/_registry.generated.ts',
    exportName: 'plan',
    arrayName: 'PLAN_LIST',
    type: 'BodyPlan',
    typeFrom: '../bodyPlan',
  },
  {
    // Décors / placeables (catalogue) : 1 décor = 1 fichier defs/.
    dir: 'src/gameIso/catalog/decor/defs',
    out: 'src/gameIso/catalog/decor/_registry.generated.ts',
    exportName: 'prop',
    arrayName: 'PROP_DEFS',
    type: 'PropViz',
    typeFrom: '../types',
  },
  {
    // Bâtiments (catalogue) : 1 bâtiment = 1 fichier defs/ (méta + render unifiés).
    dir: 'src/gameIso/catalog/buildings/defs',
    out: 'src/gameIso/catalog/buildings/_registry.generated.ts',
    exportName: 'building',
    arrayName: 'BUILDING_DEFS',
    type: 'BuildingDef',
    typeFrom: '../types',
  },
  {
    // Terrains / sols : 1 terrain = 1 fichier defs/ (méta PURE + viz gradient/swatch unifiés).
    dir: 'src/state/terrain/defs',
    out: 'src/state/terrain/_registry.generated.ts',
    exportName: 'terrain',
    arrayName: 'TERRAIN_DEFS',
    type: 'TerrainDef',
    typeFrom: './types',
  },
  {
    // Icônes UI SVG maison (24×24, currentColor — remplacent les emojis) : 1 famille = 1 fichier defs/.
    // + union `IconIdGenerated` des ids déclarés → `IconId` (types.ts) est un VRAI type fermé.
    dir: 'src/ui/icons/defs',
    out: 'src/ui/icons/_registry.generated.ts',
    exportName: 'icons',
    arrayName: 'ICON_FAMILIES',
    type: 'IconFamily',
    typeFrom: './types',
    idUnion: { typeName: 'IconIdGenerated', field: 'id' },
  },
  {
    // Bandes d'ambiance (`SceneBackdrop`) : 1 illustration stylisée = 1 fichier defs/.
    dir: 'src/ui/backdrops/defs',
    out: 'src/ui/backdrops/_registry.generated.ts',
    exportName: 'backdrop',
    arrayName: 'BACKDROP_DEFS',
    type: 'BackdropDef',
    typeFrom: './types',
  },
  {
    // Sons (assets CC0 Kenney dans public/audio) : 1 son (avec variantes) = 1 fichier defs/.
    dir: 'src/audio/defs',
    out: 'src/audio/_registry.generated.ts',
    exportName: 'sound',
    arrayName: 'SOUND_DEFS',
    type: 'SoundDef',
    typeFrom: './types',
  },
  {
    // Schémas zod du contrat de donnée (Lot 1) : 1 dataset `src/data/*.json` = 1 fichier defs/,
    // exportant `file` (nom du .json) + `schema` (zod). `fields` (2 exports par module, pas 1
    // seul) → entrées `{ file, schema }` plutôt qu'un tableau plat d'un seul type.
    dir: 'src/data/schemas/defs',
    out: 'src/data/schemas/_registry.generated.ts',
    arrayName: 'SCHEMA_DEFS',
    type: 'SchemaDef',
    typeFrom: './types',
    fields: ['file', 'schema', 'famille'],
    optionalFields: ['meta'],
    constFields: { root: "'src/data'" },
  },
  {
    // Schémas zod des documents de la 2ᵉ racine (`src/scenes`) : 1 projet de campagne = 1 fichier
    // defs-scenes/, exportant `file` (chemin RELATIF à la racine, pas un basename), `schema` et
    // `famille`. Les modules de FORME du même dossier (scene/worldmap/narratif/projet) n'exportent
    // pas `file` : le collecteur les saute (cf. `genOne`, registres à champ `file`).
    dir: 'src/data/schemas/defs-scenes',
    out: 'src/data/schemas/_registry-scenes.generated.ts',
    importDir: './defs-scenes',
    arrayName: 'SCHEMA_DEFS_SCENES',
    type: 'SchemaDef',
    typeFrom: './types',
    fields: ['file', 'schema', 'famille'],
    optionalFields: ['meta'],
    constFields: { root: "'src/scenes'" },
  },
];

// Ajout ciblé (#298) : les 2 nouveaux defs manifeste (primitives-manifest, systemes-manifest) vivent
// dans le même dossier `src/data/schemas/defs/` que le registre SCHEMA_DEFS ci-dessus — un fichier
// déposé y est déjà repris par le générateur générique (aucune entrée REGISTRIES supplémentaire).

function genOne(r) {
  const importDir = r.importDir ?? './defs';
  let entries;
  try {
    entries = readdirSync(r.dir);
  } catch {
    return { arrayName: r.arrayName, dir: r.dir, files: 0, changed: false, missing: true };
  }
  const files = entries
    .filter((f) => /\.tsx?$/.test(f) && !f.startsWith('_') && !/\.test\.tsx?$/.test(f) && !f.endsWith('.ascii.ts') && f !== 'index.ts')
    // Registre à champ `file` : un module du dossier qui ne DÉCLARE pas de document (modules de
    // FORME partagés entre defs) n'est pas une entrée — critère STRUCTUREL, jamais une liste de noms.
    .filter((f) => !r.fields?.includes('file') || /^export const file = '/m.test(readFileSync(join(r.dir, f), 'utf8')))
    .sort();
  // `fields` (option PAR registre) : un module de def exporte PLUSIEURS noms (ex. `file`+`schema`,
  // cf. src/data/schemas/defs/) → une entrée `{ champ1, champ2, … }` par fichier, au lieu du
  // tableau plat d'un seul export (`exportName`) des registres « 1 def = 1 valeur ».
  // Alias suffixé (`e0_champ`) UNIQUEMENT pour les registres multi-champs : les registres
  // « 1 def = 1 valeur » gardent `e0` — leur sortie générée reste byte-identique.
  // `optionalFields` : champ qu'un module de def exporte OU NON (`meta`, #1466 — posée par
  // `document()`, absente des defs sans export `meta` ; adoption par def : lot L1b #1467).
  // Détection par CONVENTION D'EXPORT NOMMÉ,
  // comme `file`/`schema`/`famille` : le générateur est TEXTUEL (readdirSync + regex, jamais d'import
  // runtime), donc un export absent doit être vu AVANT d'être importé, sinon le module généré ne compile pas.
  const presents = (f) => (r.optionalFields ?? []).filter((fn) => new RegExp(`^export const ${fn}\\b`, 'm').test(readFileSync(join(r.dir, f), 'utf8')));
  const imports = files.map((f, i) => {
    const names = r.fields
      ? [...r.fields, ...presents(f)].map((fn) => `${fn} as e${i}_${fn}`).join(', ')
      : `${r.exportName} as e${i}`;
    return `import { ${names} } from '${importDir}/${f.replace(/\.tsx?$/, '')}';`;
  });
  const constParts = Object.entries(r.constFields ?? {}).map(([k, v]) => `${k}: ${v}`);
  const arr = r.fields
    ? files.map((f, i) => `{ ${[...r.fields, ...presents(f)].map((fn) => `${fn}: e${i}_${fn}`).concat(constParts).join(', ')} }`)
    : files.map((_, i) => `e${i}`);
  // Union de littéraux des ids déclarés dans les defs (option `idUnion`) — triée, dédupliquée.
  let unionDecl = '';
  if (r.idUnion) {
    const ids = files.flatMap((f) =>
      [...readFileSync(join(r.dir, f), 'utf8').matchAll(new RegExp(`\\b${r.idUnion.field}:\\s*'([^']+)'`, 'g'))].map((m) => m[1]),
    );
    const uniq = [...new Set(ids)].sort();
    // Registre encore VIDE (socle posé avant sa première def) : l'union est `never`, pas la chaîne
    // vide — un `''` accepterait silencieusement l'id vide chez les consommateurs.
    unionDecl =
      `\n/** Union GÉNÉRÉE des \`${r.idUnion.field}\` déclarés dans les defs — le typage réel des consommateurs. */\n` +
      `export type ${r.idUnion.typeName} =\n${uniq.length ? `  | '${uniq.join(`'\n  | '`)}';\n` : '  | never;\n'}`;
  }
  const body =
    `// GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.\n` +
    `// Ajouter une entrée = déposer un fichier dans ${importDir === '.' ? r.dir.split('/').pop() : importDir.replace('./', '')}/ puis \`npm run gen\`.\n` +
    `import type { ${r.type} } from '${r.typeFrom}';\n` +
    imports.join('\n') + '\n\n' +
    `export const ${r.arrayName}: ${r.type}[] = [${arr.join(', ')}];\n` +
    unionDecl;
  // n'écrit que si le contenu change (évite de toucher le mtime → boucles de watch)
  let prev = '';
  try { prev = readFileSync(r.out, 'utf8'); } catch { /* nouveau */ }
  const changed = prev !== body;
  if (changed) writeFileSync(r.out, body);
  return { arrayName: r.arrayName, dir: r.dir, files: files.length, changed, missing: false };
}

/**
 * Registre des IDS de la donnée authorée (`src/data/schemas/_ids.generated.ts`) — le socle contre
 * lequel `ref(type)` refine un id AU PARSE (#1466, clause B de #1473).
 *
 * Périmètre MESURÉ : les 72 datasets de `src/data` dont la racine est une LISTE dont les entrées
 * portent un `id` string (3 500 ids). Les 41 objets de config et les 4 racines-objets à clés non-id
 * (`details`, `localisation`, `names`, `sizes` — clés de configuration ou libellés capitalisés, cf.
 * `docs/structures-donnees.md` §2.3) n'ouvrent aucun espace d'ids : les inscrire ferait résoudre une
 * référence contre une clé de réglage.
 *
 * `SPECS_PAR_DATASET` = les ids de SPÉCIALISATION déclarés par une entrée (`specs[].id`), par
 * dataset puis par entrée : c'est le POOL de VALIDITÉ d'une spec (tout ce que le catalogue déclare),
 * jamais le pool de PROPOSITION d'un choix joueur (`pool: false` reste proposable-ou-non côté
 * `specPoolOf`, `src/data/index.ts`).
 */
/**
 * Pools de spécialisations DÉRIVÉS d'un registre partagé (`specsSource`) — miroir OUTILLAGE du
 * catalogue `SPEC_SOURCES` de `src/data/index.ts`, que ce script `.mjs` ne peut pas importer (TS +
 * dépendances moteur). L'égalité des deux tables, source par source, est TENUE par le test
 * `src/data/schemas/grammaire/pool-specs.test.ts` : une divergence rougit la CI.
 */
const POOLS_DERIVES = {
  weaponGroupsMelee:  (lit) => lit('weaponGroups.json').filter((g) => g.combat === 'melee').map((g) => g.id),
  weaponGroupsRanged: (lit) => lit('weaponGroups.json').filter((g) => g.combat === 'ranged').map((g) => g.id),
  winds:         (lit) => lit('domains.json').filter((d) => d.wind).map((d) => d.id),
  arcaneDomains: (lit) => lit('domains.json').filter((d) => d.arcane).map((d) => d.id),
  cultBlessings: (lit) => lit('gods.json').filter((g) => g.blessings?.length).map((g) => g.id),
  cultMiracles:  (lit) => lit('gods.json').filter((g) => g.miracles?.length).map((g) => g.id),
  cultChaos:     (lit) => lit('gods.json').filter((g) => g.chaosSpells?.length).map((g) => g.id),
  seaShanties:   (lit) => lit('sea-shanties.json').map((s) => s.id),
  groups:        (lit) => lit('groups.json').map((g) => g.id),
  diseases:      (lit) => lit('maladies.json').map((m) => m.id),
  sizes:         (lit) => Object.keys(lit('sizes.json').rangedMod),
  mutations:     (lit) => lit('mutations.json').map((m) => m.id),
  breathTypes:   (lit) => lit('breath-types.json').map((b) => b.id),
  damageTypes:   (lit) => lit('damage-types.json').map((t) => t.id),
  weaponsMelee:  (lit) => lit('trappings.json').filter((t) => t.type === 'melee').map((t) => t.id),
  weaponsRanged: (lit) => lit('trappings.json').filter((t) => t.type === 'ranged').map((t) => t.id),
};

/** Clé de racine-objet qui a la FORME d'un id (`ids internes, labels à l'affichage`). */
const cleIdish = (k) => /^[a-z0-9][a-z0-9-]*$/.test(k);
const genreDe = (v) => (Array.isArray(v) ? 'liste' : v === null ? 'nul' : typeof v);

/**
 * Une racine-OBJET est-elle un RECORD À IDS (ses clés sont des ids : `localisation`, `criticals`,
 * `teintesJeu`) plutôt qu'un document/une configuration unique ? Trois conditions STRUCTURELLES :
 * au moins deux clés, toutes de la forme d'un id, et des valeurs de même genre. Un objet portant
 * `id`+`label` de premier niveau est UN document, pas un record. Écartés par la 2ᵉ condition :
 * `names.json` (clés = LIBELLÉS affichés, `defs/names.ts`), `decorPalette` et les configurations à
 * clés camelCase (noms de CHAMP, pas des ids).
 */
function estRecordAIds(racine) {
  const ks = Object.keys(racine);
  if (ks.length < 2 || !ks.every(cleIdish)) return false;
  if (typeof racine.id === 'string' && typeof racine.label === 'string') return false;
  return new Set(ks.map((k) => genreDe(racine[k]))).size === 1;
}

/**
 * Une valeur d'identité est-elle un LIBELLÉ (capitale initiale ou espace) plutôt qu'un id ? Un
 * `ref()` posé sur un tel dataset validerait un libellé d'affichage, contre la doctrine des ids
 * (CLAUDE.md). Les ids camelCase (`screenShell`, `touxEternuements`) en sont, eux, de vrais ids.
 */
const estUnLibelle = (v) => /^[A-ZÀ-Þ]/.test(v) || /\s/.test(v);

/**
 * DÉFAUTS d'ids — liste NOMINATIVE datée (2026-08-24), DÉCROISSANTE, lot de mort `L1b #1467` : les
 * documents de famille `entite`/`record` dont l'identité de premier niveau n'entre PAS au registre.
 * Chaque entrée porte l'obstacle MESURÉ ; une entrée ne se retire que par le commit qui donne au
 * document des ids de premier niveau. Un dataset ni registré ni inscrit ici fait ROUGIR `npm run gen`.
 */
const DEFAUTS_IDS = {
  'aa-criticals.json': 'record de localisations, mais la clé de méta `_source` siège au même niveau que les entrées — le détecteur de record à ids l’écarte',
  'calendarPhases.json': 'liste d’entités dont l’identité est portée par `key`, jamais par `id`',
  'careerLevels.json': 'liste d’entités sans identité de premier niveau (le couple `career`+`level` la porte)',
  'decorPalette.json': 'record de 435 jetons de teinte à clés camelCase (`terreTresSombre`), graphie que le détecteur de record à ids n’admet pas',
  'names.json': 'record dont les clés sont les LIBELLÉS de race (« Haut Elfe »), pas des ids',
  'raceAppearance.json': 'liste d’entités dont les `id` sont les LIBELLÉS de race (« Démon », « Elfe sylvain »), pas des ids',
  'raw.manifest.json': 'liste d’entités dont l’identité est portée par `topic` (clé composite domaine#sujet), jamais par `id`',
};

/** Familles DÉCLARÉES par les defs de schéma (`export const famille`), dataset par dataset. */
function famillesDeclarees() {
  const dir = 'src/data/schemas/defs';
  const parDataset = new Map();
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.startsWith('_') && !f.endsWith('.test.ts'))) {
    const src = readFileSync(join(dir, f), 'utf8');
    const dataset = src.match(/^export const file = '([^']+)';$/m)?.[1];
    const famille = src.match(/^export const famille = '([^']+)';$/m)?.[1];
    if (!dataset || !famille) throw new Error(`gen-registry: defs/${f} : \`file\`/\`famille\` de premier niveau manquant — chaque def déclare sa famille.`);
    parDataset.set(dataset, famille);
  }
  return parDataset;
}

/**
 * Contrat FERMÉ entre la famille déclarée et le registre d'ids, dans les DEUX sens : `entite`/`record`
 * ⇒ ids au registre OU défaut nominatif ; `config`/`table` ⇒ aucun id, aucun défaut.
 */
function verifieExhaustiviteDesIds(datasetsAIds) {
  const familles = famillesDeclarees();
  const fautes = [];
  for (const [dataset, famille] of [...familles].sort()) {
    const aDesIds = datasetsAIds.has(dataset);
    const defaut = dataset in DEFAUTS_IDS;
    if (famille === 'entite' || famille === 'record') {
      if (!aDesIds && !defaut) fautes.push(`${dataset} (famille ${famille}) : aucun id au registre et aucune entrée de DEFAUTS_IDS.`);
      if (aDesIds && defaut) fautes.push(`${dataset} : porte des ids au registre ET une entrée de DEFAUTS_IDS — retirer l'entrée.`);
    } else {
      if (aDesIds) fautes.push(`${dataset} (famille ${famille}) : un document de réglage/table ne porte aucun id de premier niveau, or le registre en indexe.`);
      if (defaut) fautes.push(`${dataset} (famille ${famille}) : entrée de DEFAUTS_IDS sur un document qui n'attend aucun id.`);
    }
  }
  for (const dataset of Object.keys(DEFAUTS_IDS)) if (!familles.has(dataset)) fautes.push(`${dataset} : entrée de DEFAUTS_IDS sans def de schéma.`);
  if (fautes.length) throw new Error(`gen-registry: exhaustivité du registre d'ids — ${fautes.length} faute(s) :\n  ${fautes.join('\n  ')}`);
}

function genIds() {
  const dir = 'src/data';
  const out = 'src/data/schemas/_ids.generated.ts';
  const ids = [];
  const specs = [];
  const cacheJson = new Map();
  const litJson = (nom) => {
    if (!cacheJson.has(nom)) cacheJson.set(nom, JSON.parse(readFileSync(join(dir, nom), 'utf8')));
    return cacheJson.get(nom);
  };
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    let racine;
    try { racine = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    if (!Array.isArray(racine)) {
      if (racine && typeof racine === 'object' && estRecordAIds(racine)) ids.push([f, Object.keys(racine).sort()]);
      continue;
    }
    const entrees = racine.filter((e) => e && typeof e === 'object' && typeof e.id === 'string');
    if (!entrees.length) continue;
    if (entrees.some((e) => estUnLibelle(e.id))) continue;
    ids.push([f, [...new Set(entrees.map((e) => e.id))].sort()]);
    const catalogueDe = (e) => {
      if (e.specsSource) {
        const derive = POOLS_DERIVES[e.specsSource];
        if (!derive) throw new Error(`gen-registry: ${f} « ${e.id} » : specsSource « ${e.specsSource} » inconnue de POOLS_DERIVES.`);
        return derive(litJson);
      }
      return Array.isArray(e.specs) ? e.specs.filter((s) => s && typeof s.id === 'string').map((s) => s.id) : [];
    };
    const parEntree = entrees
      .map((e) => [e.id, [...new Set(catalogueDe(e))].sort()])
      .filter(([, l]) => l.length)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    if (parEntree.length) specs.push([f, parEntree]);
  }
  verifieExhaustiviteDesIds(new Set(ids.map(([f]) => f)));
  const lit = (v) => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const body =
    `// GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.\n` +
    `// Régénérer : \`npm run gen\` (deux exécutions successives rendent le même octet).\n\n` +
    `/**\n` +
    ` * Ids de PREMIER NIVEAU de chaque dataset de \`src/data\` — les \`id\` des entrées d'un dataset-LISTE,\n * les CLÉS d'un dataset-RECORD (\`localisation\`, \`criticals\`, \`teintesJeu\`) — la cible de tout \`ref(type)\`\n` +
    ` * (\`src/data/schemas/grammaire/ref.ts\`), qui refine l'id AU PARSE contre ce registre.\n` +
    ` *\n` +
    ` * Deux RÉGIMES de lecture, tous deux déclarés :\n` +
    ` *  - CI / DEV / test : ce fichier généré, figé au commit — une référence morte casse au parse ;\n` +
    ` *  - ÉDITEUR (\`CodexEdit.save\` → \`validateDataset\`) : le registre se RECALCULE depuis les datasets\n` +
    ` *    EN MÉMOIRE, sinon une entité créée au Compendium rendrait rouge toute donnée qui la\n` +
    ` *    référence avant le prochain \`npm run gen\`. Ce régime est câblé quand la grammaire est\n` +
    ` *    consommée par les defs (#1467).\n` +
    ` */\n` +
    `export const IDS_PAR_DATASET: Readonly<Record<string, readonly string[]>> = {\n` +
    ids.map(([f, l]) => `  ${lit(f)}: [${l.map(lit).join(', ')}],\n`).join('') +
    `};\n\n` +
    `/**\n` +
    ` * Pool de VALIDITÉ des spécialisations déclarées par une entrée (\`specs[].id\`), par dataset puis\n` +
    ` * par id d'entrée — la cible du refine de \`spec\` pour un type à pool FERMÉ (\`specsOpen: false\`).\n` +
    ` */\n` +
    `export const SPECS_PAR_DATASET: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {\n` +
    specs
      .map(([f, entrees]) => `  ${lit(f)}: {\n${entrees.map(([id, l]) => `    ${lit(id)}: [${l.map(lit).join(', ')}],\n`).join('')}  },\n`)
      .join('') +
    `};\n`;
  let prev = '';
  try { prev = readFileSync(out, 'utf8'); } catch { /* nouveau */ }
  const changed = prev !== body;
  if (changed) writeFileSync(out, body);
  return { out, datasets: ids.length, ids: ids.reduce((n, [, l]) => n + l.length, 0), changed };
}

/**
 * `verbose` (param, défaut `false`) : régénère TOUS les registres. En mode silencieux (défaut —
 * appel `buildStart` du plugin Vite, donc CHAQUE run Vitest via `globalSetup`), n'imprime QUE les
 * registres réellement RÉGÉNÉRÉS ou en erreur (dossier absent), + UNE ligne agrégée pour le reste
 * — évite les ~15 lignes « [inchangé] » qui polluent chaque sortie de test et cassent le parseur
 * pass/fail de l'outil `rtk`. En mode verbose (exécution directe `npm run gen`), détail complet
 * inchangé (usage : audit manuel de ce que le générateur a vu).
 */
export function genAll(verbose = false) {
  const results = REGISTRIES.map(genOne);
  let unchangedCount = 0;
  for (const res of results) {
    if (res.missing) {
      console.log(`gen-registry: ${res.arrayName} ← dossier absent (${res.dir}) — ignoré`);
      continue;
    }
    if (res.changed || verbose) {
      console.log(`gen-registry: ${res.arrayName} ← ${res.files} fichiers (${res.dir})${res.changed ? '' : ' [inchangé]'}`);
    } else {
      unchangedCount++;
    }
  }
  const idsRes = genIds();
  if (idsRes.changed || verbose) {
    console.log(`gen-registry: IDS_PAR_DATASET ← ${idsRes.ids} ids / ${idsRes.datasets} datasets (${idsRes.out})${idsRes.changed ? '' : ' [inchangé]'}`);
  } else {
    unchangedCount++;
  }
  if (!verbose && unchangedCount > 0) {
    console.log(`gen-registry: ${unchangedCount} registre${unchangedCount > 1 ? 's' : ''} à jour`);
  }
}

// Exécution directe (node scripts/gen-registry.mjs) : détail complet (audit manuel).
if (import.meta.url === `file://${join(process.cwd(), 'scripts/gen-registry.mjs').replace(/\\/g, '/')}` || process.argv[1]?.endsWith('gen-registry.mjs')) {
  genAll(true);
}
