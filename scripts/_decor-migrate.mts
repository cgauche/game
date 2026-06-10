/** One-shot : éclate `catalog/decor.ts` (Record monolithique) en un fichier par prop sous
 *  `catalog/decor/defs/<id>.ts` (`export const prop: PropViz = {...}`), pour rejoindre le
 *  registre codegen (gen-registry.mjs). Le render est repris verbatim via `.toString()`.
 *  Usage : npx tsx scripts/_decor-migrate.mts */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PROPS } from '../src/gameIso/catalog/decor';

const dir = 'src/gameIso/catalog/decor/defs';
mkdirSync(dir, { recursive: true });

for (const id of Object.keys(PROPS)) {
  const p = PROPS[id];
  const fields = [`id: ${JSON.stringify(p.id)}`, `label: ${JSON.stringify(p.label)}`];
  if (p.searchable) fields.push('searchable: true');
  fields.push(`render: ${p.render.toString()}`);
  const body = `import type { PropViz } from '../../types';\n\nexport const prop: PropViz = { ${fields.join(', ')} };\n`;
  writeFileSync(`${dir}/${id}.ts`, body);
}
console.log('decor migrate:', Object.keys(PROPS).length, 'fichiers →', dir);
