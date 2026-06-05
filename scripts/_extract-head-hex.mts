/**
 * Extraction pour la migration couleur des TÊTES (visage + cheveux) par espèce:sexe.
 * Pour chaque tête de GENERATED_HEADS : hex distincts par slot + rendu de référence PNG.
 * Sort : public/qc/head-hex/<slug>.json + public/qc/head-index.json + public/qc/head/<slug>.png
 * Lancer : npx tsx scripts/_extract-head-hex.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { GENERATED_HEADS } from '../src/gameIso/rig/parts/generated/heads';
import { DEFS } from '../src/gameIso/sprites';

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function hexInfo(svg: string): { hex: string; count: number; ctx: string }[] {
  const map: Record<string, { count: number; ctx: string }> = {};
  const re = /#[0-9a-fA-F]{6}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    const hex = m[0].toLowerCase();
    if (!map[hex]) map[hex] = { count: 0, ctx: svg.slice(Math.max(0, m.index - 14), m.index + 7).replace(/"/g, "'").trim() };
    map[hex].count++;
  }
  return Object.entries(map).map(([hex, v]) => ({ hex, count: v.count, ctx: v.ctx })).sort((a, b) => b.count - a.count);
}

mkdirSync('public/qc/head', { recursive: true });
mkdirSync('public/qc/head-hex', { recursive: true });
const index: { key: string; png: string; json: string }[] = [];

for (const [key, head] of Object.entries(GENERATED_HEADS)) {
  const visage = (head as Record<string, string>).visage ?? '';
  const cheveux = (head as Record<string, string>).cheveux ?? '';
  // Rendu de référence (gros plan tête : cheveux derrière, visage devant).
  const inner = `<g>${cheveux}</g><g>${visage}</g>`;
  const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-15 -18 30 38"><defs>${DEFS}</defs>${inner}</svg>`;
  const png = `qc/head/${slug(key)}.png`;
  writeFileSync(`public/${png}`, new Resvg(full, { background: '#2b3142', fitTo: { mode: 'width', value: 240 } }).render().asPng());

  const data = { key, png: `public/${png}`, visage: hexInfo(visage), cheveux: hexInfo(cheveux) };
  const jsonPath = `public/qc/head-hex/${slug(key)}.json`;
  writeFileSync(jsonPath, JSON.stringify(data, null, 1));
  index.push({ key, png: `public/${png}`, json: jsonPath });
}

writeFileSync('public/qc/head-index.json', JSON.stringify(index));
console.log(`OK — ${index.length} têtes → public/qc/head-hex/*.json + head/*.png ; index : public/qc/head-index.json`);
