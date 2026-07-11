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
 * @type {{ dir:string, out:string, exportName?:string, arrayName:string, type:string, typeFrom:string, importDir?:string, idUnion?:{ typeName:string, field:string }, fields?:string[] }[]}
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
    // Arts de COQUE de navire (vague A1, profil broadside) : 1 coque = 1 fichier defs/ —
    // MÊME pattern que les engins (routé par ID de véhicule, repli procédural par gréement
    // dans composeShip ; la galerie oriented-objects montre la couverture déclarée).
    dir: 'src/gameIso/rig/ship/defs',
    out: 'src/gameIso/rig/ship/_registry.generated.ts',
    exportName: 'hullArt',
    arrayName: 'SHIP_ARTS',
    type: 'ShipArtDef',
    typeFrom: './artkit',
  },
  {
    // Arts de VÉHICULE TERRESTRE (vague A4, silhouette de repli extraite en def) : 1 véhicule = 1
    // fichier defs/ — MÊME pattern que les engins/coques (routé par ID de véhicule dans composeLand ;
    // `attelage-generique` sert de FALLBACK tant qu'un id n'a pas son propre art dédié).
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
    // bodyPlan.ts dérive la table PLANS de cette liste → plus de registre central à éditer.
    dir: 'src/gameIso/rig/plans/defs',
    out: 'src/gameIso/rig/plans/_registry.generated.ts',
    exportName: 'plan',
    arrayName: 'PLAN_LIST',
    type: 'BodyPlan',
    typeFrom: '../bodyPlan',
  },
  {
    // Archétypes marchands (#2) : 1 archétype = 1 fichier defs/.
    dir: 'src/state/merchants/defs',
    out: 'src/state/merchants/_registry.generated.ts',
    exportName: 'merchantArchetype',
    arrayName: 'MERCHANT_ARCHETYPES',
    type: 'MerchantArchetypeDef',
    typeFrom: './types',
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
    fields: ['file', 'schema'],
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
    console.log(`gen-registry: ${r.arrayName} ← dossier absent (${r.dir}) — ignoré`);
    return 0;
  }
  const files = entries
    .filter((f) => f.endsWith('.ts') && !f.startsWith('_') && !f.endsWith('.test.ts') && !f.endsWith('.ascii.ts') && f !== 'index.ts')
    .sort();
  // `fields` (option PAR registre) : un module de def exporte PLUSIEURS noms (ex. `file`+`schema`,
  // cf. src/data/schemas/defs/) → une entrée `{ champ1, champ2, … }` par fichier, au lieu du
  // tableau plat d'un seul export (`exportName`) des registres « 1 def = 1 valeur ».
  // Alias suffixé (`e0_champ`) UNIQUEMENT pour les registres multi-champs : les registres
  // « 1 def = 1 valeur » gardent `e0` — leur sortie générée reste byte-identique.
  const imports = files.map((f, i) => {
    const names = r.fields
      ? r.fields.map((fn) => `${fn} as e${i}_${fn}`).join(', ')
      : `${r.exportName} as e${i}`;
    return `import { ${names} } from '${importDir}/${f.replace(/\.ts$/, '')}';`;
  });
  const arr = r.fields
    ? files.map((_, i) => `{ ${r.fields.map((fn) => `${fn}: e${i}_${fn}`).join(', ')} }`)
    : files.map((_, i) => `e${i}`);
  // Union de littéraux des ids déclarés dans les defs (option `idUnion`) — triée, dédupliquée.
  let unionDecl = '';
  if (r.idUnion) {
    const ids = files.flatMap((f) =>
      [...readFileSync(join(r.dir, f), 'utf8').matchAll(new RegExp(`\\b${r.idUnion.field}:\\s*'([^']+)'`, 'g'))].map((m) => m[1]),
    );
    const uniq = [...new Set(ids)].sort();
    unionDecl =
      `\n/** Union GÉNÉRÉE des \`${r.idUnion.field}\` déclarés dans les defs — le typage réel des consommateurs. */\n` +
      `export type ${r.idUnion.typeName} =\n  | '${uniq.join(`'\n  | '`)}';\n`;
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
  if (prev !== body) writeFileSync(r.out, body);
  console.log(`gen-registry: ${r.arrayName} ← ${files.length} fichiers (${r.dir})${prev !== body ? '' : ' [inchangé]'}`);
  return files.length;
}

export function genAll() {
  for (const r of REGISTRIES) genOne(r);
}

// Exécution directe (node scripts/gen-registry.mjs)
if (import.meta.url === `file://${join(process.cwd(), 'scripts/gen-registry.mjs').replace(/\\/g, '/')}` || process.argv[1]?.endsWith('gen-registry.mjs')) {
  genAll();
}
