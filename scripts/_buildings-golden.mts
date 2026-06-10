/** Golden master bâtiments : dump (a) BUILDINGS_META et (b) le rendu 3-calques de chaque
 *  bâtiment pour des entrées fixes → JSON, pour prouver l'iso-comportement avant/après la
 *  migration vers le registre defs/. Usage : npx tsx scripts/_buildings-golden.mts <out.json> */
import { writeFileSync } from 'node:fs';
import { BUILDINGS, BUILDINGS_META, buildingLayers } from '../src/gameIso/catalog/buildings';

const dims = { w: 24, h: 18, rot: 0 } as any;
const ctx = { dims, facing: 'S' as const, night: true };
const params = { floors: 2, roofMaterial: 'tuile' as const, timberColor: '#4a3220', wallColor: '#d8c9a8' };

const render = Object.fromEntries(
  Object.keys(BUILDINGS).sort().map((id) => {
    const f = BUILDINGS_META[id]?.defaultFoot ?? { w: 3, h: 3 };
    const foot = { x: 5, y: 5, w: f.w, h: f.h };
    return [id, buildingLayers(id, foot, params, ctx)];
  }),
);
const out = process.argv[2];
writeFileSync(out, JSON.stringify({ meta: BUILDINGS_META, render }, null, 0));
console.log('buildings golden:', Object.keys(BUILDINGS).length, 'bâtiments →', out);
