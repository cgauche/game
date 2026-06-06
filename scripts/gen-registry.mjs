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

/** @type {{ dir:string, out:string, exportName:string, arrayName:string, type:string, typeFrom:string }[]} */
export const REGISTRIES = [
  {
    dir: 'src/gameIso/rig/creatures/defs',
    out: 'src/gameIso/rig/creatures/_registry.generated.ts',
    exportName: 'creature',
    arrayName: 'CREATURES',
    type: 'CreatureDef',
    typeFrom: './types',
  },
];

function genOne(r) {
  const files = readdirSync(r.dir)
    .filter((f) => f.endsWith('.ts') && !f.startsWith('_') && !f.endsWith('.test.ts') && f !== 'index.ts')
    .sort();
  const imports = files.map((f, i) => `import { ${r.exportName} as e${i} } from './defs/${f.replace(/\.ts$/, '')}';`);
  const arr = files.map((_, i) => `e${i}`);
  const body =
    `// ⚠️ GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.\n` +
    `// Ajouter une entrée = déposer un fichier dans defs/ puis \`npm run gen\`.\n` +
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
