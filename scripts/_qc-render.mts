/**
 * Rendu QC : rastérise chaque ARME (silhouette seule) et chaque CRÉATURE (front) en
 * PNG individuel + un manifest, pour un audit de reconnaissabilité EN AVEUGLE.
 * Lancer : npx tsx scripts/_qc-render.mts → public/qc/*.png + manifest.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { creatureView } from '../src/gameIso/sprites';
import { weaponPart } from '../src/gameIso/rig/parts/equipment';
import { pickView } from '../src/gameIso/rig/parts/types';
import creatureSprites from '../src/gameIso/creatureSprites.json';
import type { Weapon } from '../src/engine/types';

mkdirSync('public/qc', { recursive: true });
const manifest: { id: string; path: string; kind: string; intended: string }[] = [];
const raster = (svg: string, path: string, w: number) => {
  const r = new Resvg(svg, { background: '#222831', fitTo: { mode: 'width', value: w } });
  writeFileSync(path, r.render().asPng());
};
const wep = (name: string): Weapon => ({ name, type: 'melee', damage: '+4', qualities: [] } as Weapon);

// Une arme représentative par FORME d'art distincte.
const WEAPONS: [string, string][] = [
  ['épée', 'Épée'], ['hache', 'Hache'], ['masse', 'Masse'], ['dague', 'Dague'],
  ['lance', 'Lance'], ['bâton', 'Bâton de combat'], ['arc', 'Arc long'], ['arbalète', 'Arbalète'],
  ['arme à poudre', 'Pistolet'], ['fronde', 'Fronde'], ['fouet', 'Fouet'], ['bombe/explosif', 'Bombe'],
  ['arme de parade (main-gauche)', 'Main Gauche'],
];
let i = 0;
for (const [fam, name] of WEAPONS) {
  const frag = pickView(weaponPart(wep(name)), 'front');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -56 40 72"><defs>${DEFS}</defs><rect x="-20" y="-56" width="40" height="72" fill="#222831"/>${frag}</svg>`;
  const id = `w${String(i).padStart(2, '0')}`;
  raster(svg, `public/qc/${id}.png`, 180);
  manifest.push({ id, path: `public/qc/${id}.png`, kind: 'weapon', intended: fam });
  i++;
}

let j = 0;
for (const label of Object.keys(creatureSprites)) {
  const frag = creatureView(label, 'front');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><defs>${DEFS}</defs><rect width="160" height="160" fill="#222831"/>${frag}</svg>`;
  const id = `c${String(j).padStart(2, '0')}`;
  raster(svg, `public/qc/${id}.png`, 220);
  manifest.push({ id, path: `public/qc/${id}.png`, kind: 'creature', intended: label });
  j++;
}

writeFileSync('public/qc/manifest.json', JSON.stringify(manifest));
console.log(`OK: ${manifest.length} PNG (${WEAPONS.length} armes + ${j} créatures) → public/qc/`);
