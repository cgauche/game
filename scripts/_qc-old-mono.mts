/** TEMP — rend quelques sprites MONOLITHIQUES récupérés de git (avant suppression 9bc1b1d)
 *  pour comparer le style d'origine au rig actuel. JSON dumpé dans le temp Windows. */
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';

const old = JSON.parse(readFileSync('C:/Users/gauch/AppData/Local/Temp/old-sprites.json', 'utf8')) as Record<string, string>;
for (const name of ['Ogre', 'Troll', 'Minotaure', 'Nain', 'Skaven', 'Loup']) {
  const art = old[name];
  if (!art) { console.log('ABSENT:', name); continue; }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150"><defs>${DEFS}</defs><rect width="120" height="150" fill="#171b26"/>${art}</svg>`;
  writeFileSync(`public/qc/old-${name}.png`, new Resvg(svg, { background: '#171b26', fitTo: { mode: 'width', value: 360 } }).render().asPng());
  console.log('rendu:', name);
}
