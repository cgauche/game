/**
 * Rend UN candidat d'arme : lit un JSON {front:"<svg-fragment>"} et écrit un PNG sibling
 * (même nom, .png) dans le repère de l'os `arme` (lame vers -y), frame identique à l'audit.
 * Usage : npx tsx scripts/_qc-render-weapon-cand.mts art-ref/.../cand1.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';

const inPath = process.argv[2];
if (!inPath) { console.error('usage: _qc-render-weapon-cand.mts <cand.json>'); process.exit(1); }
const j = JSON.parse(readFileSync(inPath, 'utf8'));
const frag: string = j.front ?? j.svg ?? '';
const out = inPath.replace(/\.json$/, '.png');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -56 40 72"><defs>${DEFS}</defs><rect x="-20" y="-56" width="40" height="72" fill="#222831"/>${frag}</svg>`;
writeFileSync(out, new Resvg(svg, { background: '#222831', fitTo: { mode: 'width', value: 180 } }).render().asPng());
console.log(`OK → ${out}`);
