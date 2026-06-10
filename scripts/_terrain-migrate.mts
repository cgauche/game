/** One-shot : éclate les 2 Records terrain (TERRAINS méta + TERRAIN_VIZ viz) en un fichier par
 *  terrain sous `state/terrain/defs/<id>.ts` (`export const terrain: TerrainDef`). Données pures
 *  (pas de fonction) → sérialisées en littéral. Usage : npx tsx scripts/_terrain-migrate.mts */
import { mkdirSync, writeFileSync } from 'node:fs';
import { TERRAINS } from '../src/state/terrain';
import { TERRAIN_VIZ } from '../src/gameIso/catalog/terrain';

const dir = 'src/state/terrain/defs';
mkdirSync(dir, { recursive: true });
for (const id of Object.keys(TERRAINS)) {
  const m = TERRAINS[id];
  const v = TERRAIN_VIZ[id];
  const obj = { id: m.id, label: m.label, walkable: m.walkable, priority: m.priority, gradient: v.gradient, swatch: v.swatch };
  const body = `import type { TerrainDef } from '../types';\n\nexport const terrain: TerrainDef = ${JSON.stringify(obj)};\n`;
  writeFileSync(`${dir}/${id}.ts`, body);
}
console.log('terrain migrate:', Object.keys(TERRAINS).length, 'fichiers →', dir);
