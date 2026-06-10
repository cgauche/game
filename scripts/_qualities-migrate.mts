/** One-shot : éclate le Record `QUALITIES` en un fichier par qualité sous
 *  `engine/qualities/defs/<slug>.ts` (`export const quality: QualityDef`). La clé FR (avec accents/
 *  espaces) reste dans la def ; le fichier porte un slug ASCII. Les fonctions (critTrigger) sont
 *  reprises via `.toString()`. Usage : npx tsx scripts/_qualities-migrate.mts */
import { mkdirSync, writeFileSync } from 'node:fs';
import { QUALITIES } from '../src/engine/qualities/registry';

const slug = (key: string) =>
  key.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function serialize(obj: Record<string, unknown>): string {
  const parts = Object.entries(obj).map(
    ([k, v]) => `${JSON.stringify(k)}: ${typeof v === 'function' ? v.toString() : JSON.stringify(v)}`,
  );
  return `{ ${parts.join(', ')} }`;
}

const dir = 'src/engine/qualities/defs';
mkdirSync(dir, { recursive: true });
for (const key of Object.keys(QUALITIES)) {
  const body = `import type { QualityDef } from '../types';\n\nexport const quality: QualityDef = ${serialize(QUALITIES[key] as any)};\n`;
  writeFileSync(`${dir}/${slug(key)}.ts`, body);
}
console.log('qualities migrate:', Object.keys(QUALITIES).length, 'fichiers →', dir);
