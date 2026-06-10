/** Golden master terrains : dump TERRAINS (méta) + TERRAIN_VIZ (gradient/swatch) → JSON, pour
 *  prouver l'iso-comportement avant/après la migration. Usage : npx tsx scripts/_terrain-golden.mts <out.json> */
import { writeFileSync } from 'node:fs';
import { TERRAINS, terrainWalkable, terrainPriority } from '../src/state/terrain';
import { TERRAIN_VIZ, terrainGradient } from '../src/gameIso/catalog/terrain';

const ids = Object.keys(TERRAINS).sort();
const dump = {
  meta: TERRAINS,
  viz: TERRAIN_VIZ,
  walk: Object.fromEntries(ids.map((id) => [id, terrainWalkable(id)])),
  prio: Object.fromEntries(ids.map((id) => [id, terrainPriority(id)])),
  grad: Object.fromEntries(ids.map((id) => [id, terrainGradient(id)])),
};
writeFileSync(process.argv[2], JSON.stringify(dump, null, 0));
console.log('terrain golden:', ids.length, 'terrains →', process.argv[2]);
