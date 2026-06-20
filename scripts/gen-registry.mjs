/**
 * Générateur GÉNÉRIQUE de registres « dépose un fichier → intégré ». Scanne un dossier `defs/`
 * et écrit un index EXPLICITE (`_registry.generated.ts`) — pas d'`import.meta.glob` (Vite-only,
 * cassé sous tsx) : l'index généré marche partout (app Vite, Vitest, scripts tsx), est
 * inspectable et sans coût runtime. Réutilisable pour créatures / tenues / modèles / etc.
 *
 *   node scripts/gen-registry.mjs
 *
 * Câblé dans `npm run gen` (+ build:data / build). Ajouter une entrée = déposer un fichier
 * dans le `defs/` correspondant, puis relancer (auto en dev via le plugin Vite).
 */
import { readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `importDir` : chemin (relatif au fichier `out`) d'où importer chaque entrée. Défaut `./defs`
 * (les entrées vivent dans un sous-dossier `defs/`). Mettre `.` quand les fichiers sont à plat
 * dans le même dossier que l'index (cas des scénarios).
 * @type {{ dir:string, out:string, exportName:string, arrayName:string, type:string, typeFrom:string, importDir?:string }[]}
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
    // Tenues (archétypes de classe + Nu) : 1 tenue = 1 fichier defs/.
    dir: 'src/gameIso/rig/parts/tenues/defs',
    out: 'src/gameIso/rig/parts/tenues/_registry.generated.ts',
    exportName: 'tenue',
    arrayName: 'TENUE_DEFS',
    type: 'TenueDef',
    typeFrom: './types',
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
    // Gabarits (carrures réutilisables) : 1 carrure = 1 fichier defs/. Dissout PROPS.
    dir: 'src/gameIso/rig/gabarits/defs',
    out: 'src/gameIso/rig/gabarits/_registry.generated.ts',
    exportName: 'gabarit',
    arrayName: 'GABARIT_DEFS',
    type: 'GabaritDef',
    typeFrom: './types',
  },
  {
    // Races (peau/tête/traits/posture + défauts d'espèce) : 1 race = 1 fichier defs/.
    // Dissout SPECIES_PALETTES + SPECIES_POSE + l'if-chain baseSpeciesOf + la config biped.
    dir: 'src/gameIso/rig/races/defs',
    out: 'src/gameIso/rig/races/_registry.generated.ts',
    exportName: 'race',
    arrayName: 'RACE_DEFS',
    type: 'RaceDef',
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
    // Sons (assets CC0 Kenney dans public/audio) : 1 son (avec variantes) = 1 fichier defs/.
    dir: 'src/audio/defs',
    out: 'src/audio/_registry.generated.ts',
    exportName: 'sound',
    arrayName: 'SOUND_DEFS',
    type: 'SoundDef',
    typeFrom: './types',
  },
];

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
    .filter((f) => f.endsWith('.ts') && !f.startsWith('_') && !f.endsWith('.test.ts') && f !== 'index.ts')
    .sort();
  const imports = files.map((f, i) => `import { ${r.exportName} as e${i} } from '${importDir}/${f.replace(/\.ts$/, '')}';`);
  const arr = files.map((_, i) => `e${i}`);
  const body =
    `// ⚠️ GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.\n` +
    `// Ajouter une entrée = déposer un fichier dans ${importDir === '.' ? r.dir.split('/').pop() : importDir.replace('./', '')}/ puis \`npm run gen\`.\n` +
    `import type { ${r.type} } from '${r.typeFrom}';\n` +
    imports.join('\n') + '\n\n' +
    `export const ${r.arrayName}: ${r.type}[] = [${arr.join(', ')}];\n`;
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
