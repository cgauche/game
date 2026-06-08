/**
 * Rend UN SEUL élément (tête / coiffure / tenue / taille) sur les 4 directions, EN ISOLATION
 * → permet à un agent de tester un correctif sans toucher aux fichiers partagés ni aux autres
 * éléments. Un SVG de remplacement peut être fourni via --svgFile (lu tel quel) pour valider
 * une correction avant de la fusionner.
 *
 * Exemples :
 *   npx tsx scripts/_qc-render-one.mts --kind hair --sex M --idx 3 --out public/qc/one.png
 *   npx tsx scripts/_qc-render-one.mts --kind hair --sex M --idx 3 --cheveuxFile fix.svg --out public/qc/one.png
 *   npx tsx scripts/_qc-render-one.mts --kind head --species Humain --sex F --visageFile v.svg --out public/qc/one.png
 *   npx tsx scripts/_qc-render-one.mts --kind tenue --career Soldat --species Humain --out public/qc/one.png
 *   npx tsx scripts/_qc-render-one.mts --kind size --species Ogre --weapon Épée --out public/qc/one.png
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { GENERATED_HEADS } from '../src/gameIso/rig/parts/generated/heads';
import { HAIRSTYLES } from '../src/gameIso/rig/parts/generated/hairstyles';
import { racePalette } from '../src/gameIso/rig/races';
import { buildTokenMap, applyTokenMap } from '../src/gameIso/rig/palette';
import { baseSpeciesOf } from '../src/gameIso/rig/skeletons';
import type { Appearance } from '../src/gameIso/rig/appearance';
import type { View } from '../src/gameIso/rig/facing';
import type { Weapon } from '../src/engine/types';

const A = Object.fromEntries(process.argv.slice(2).reduce<[string, string][]>((acc, v, i, arr) => {
  if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] == null ? 'true' : arr[i + 1]]);
  return acc;
}, []));
const read = (p?: string) => (p ? readFileSync(p, 'utf8').trim() : undefined);

const DIRS: { view: View; mirror: boolean; label: string }[] = [
  { view: 'front', mirror: false, label: 'face' },
  { view: 'profile', mirror: false, label: 'profil D' },
  { view: 'back', mirror: false, label: 'dos' },
  { view: 'profile', mirror: true, label: 'profil G' },
];

const kind = A.kind ?? 'hair';
const species = A.species ?? 'Humain';
const sex = (A.sex ?? 'M') as 'M' | 'F';
const career = A.career ?? (kind === 'tenue' ? 'Soldat' : 'Mendiant');
const wpn: Weapon[] = A.weapon ? [{ name: A.weapon, type: A.weapon === 'Arc' || A.weapon === 'Arbalète' ? 'ranged' : 'melee', damage: '+0', qualities: [] }] : [];

// Overrides isolés : si fournis, on rend une tête composée À LA MAIN (tokens résolus) sans
// passer par cosmeticPart → ne dépend QUE de cet élément, sans impacter le fichier partagé.
const visageOv = read(A.visageFile);
const cheveuxOv = read(A.cheveuxFile);
const headKey = `${baseSpeciesOf(species)}:${sex}`;

function rigSvg(view: View, mirror: boolean): string {
  let inner: string;
  if ((kind === 'head' || kind === 'hair') && (visageOv || cheveuxOv)) {
    // Composition tête isolée (override), tokens résolus avec la palette espèce.
    const tmap = buildTokenMap(racePalette(baseSpeciesOf(species), sex), {});
    const gen = GENERATED_HEADS[headKey] as { visage?: string; cheveux?: string };
    const visage = applyTokenMap(visageOv ?? gen.visage ?? '', tmap);
    let cheveuxSrc = cheveuxOv;
    if (!cheveuxSrc) {
      const idx = Number(A.idx ?? 0);
      cheveuxSrc = idx > 0 ? HAIRSTYLES[sex][idx - 1]?.svg : gen.cheveux;
    }
    const cheveux = applyTokenMap(cheveuxSrc ?? '', tmap);
    inner = `<g transform="translate(60,46) scale(2)"><g>${cheveux}</g><g>${visage}</g></g>`;
  } else {
    const app: Appearance = { species, sex, build: Number(A.build ?? 0.5), seed: Number(A.seed ?? 4), parts: A.idx ? { cheveux: Number(A.idx) } : undefined };
    inner = renderToStaticMarkup(React.createElement(RigSprite, { appearance: app, equip: { weapons: wpn, armour: [] }, career, view }));
  }
  return mirror ? `<g transform="translate(120,0) scale(-1,1)">${inner}</g>` : inner;
}

const CW = 124, CH = 168;
const cells = DIRS.map((d, i) =>
  `<g transform="translate(${i * CW},0)"><rect width="${CW - 4}" height="${CH - 14}" fill="#262d3b"/>` +
  `<line x1="0" y1="150" x2="${CW - 4}" y2="150" stroke="#e06a4a" stroke-width="0.6"/>` +
  `<line x1="${(CW - 4) / 2}" y1="0" x2="${(CW - 4) / 2}" y2="${CH - 14}" stroke="#4f8fe0" stroke-width="0.4" opacity="0.4"/>` +
  `${rigSvg(d.view, d.mirror)}<text x="${(CW - 4) / 2}" y="${CH - 3}" text-anchor="middle" font-size="9" fill="#cdd" font-family="sans-serif">${d.label}</text></g>`,
);
const W = DIRS.length * CW, H = CH;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#11141c"/>${cells.join('')}</svg>`;
const out = A.out ?? 'public/qc/one.png';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
console.log(`OK → ${out} (${kind}${A.idx ? ' idx ' + A.idx : ''}${A.career ? ' ' + A.career : ''} ${species}:${sex})`);
