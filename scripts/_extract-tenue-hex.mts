/**
 * Extraction pour la migration couleur des tenues de carrière.
 * Pour chaque carrière de GENERATED_CAREER_TENUES_AUTO :
 *   - liste les hex DISTINCTS par part (torse/jambes/bras/tete) + fréquence + contexte,
 *   - rastérise le sprite ACTUEL (front) en PNG → référence visuelle pour la classification.
 * Sort : public/qc/tenue-hex.json (manifest) + public/qc/tenue/<slug>.png
 * Lancer : npx tsx scripts/_extract-tenue-hex.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { GENERATED_CAREER_TENUES_AUTO } from '../src/gameIso/rig/parts/generated/careerTenuesAuto';
import type { Appearance } from '../src/gameIso/rig/appearance';

const PARTS = ['torse', 'jambes', 'bras', 'tete'] as const;
type PartKey = (typeof PARTS)[number];

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Hex distincts d'un fragment SVG, avec fréquence et un mini-contexte (le 1er usage). */
function hexInfo(svg: string): Record<string, { count: number; ctx: string }> {
  const out: Record<string, { count: number; ctx: string }> = {};
  const re = /#[0-9a-fA-F]{6}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    const hex = m[0].toLowerCase();
    if (!out[hex]) {
      // contexte : l'attribut qui porte ce hex (fill/stroke/stop-color) + ~12 car. avant.
      const start = Math.max(0, m.index - 16);
      out[hex] = { count: 0, ctx: svg.slice(start, m.index + 7).replace(/"/g, "'").trim() };
    }
    out[hex].count++;
  }
  return out;
}

mkdirSync('public/qc/tenue', { recursive: true });

const manifest: Record<string, {
  slug: string;
  png: string;
  parts: Record<string, string[]>;            // part → hex présents
  hex: { hex: string; count: number; parts: string[]; ctx: string }[]; // agrégé, trié par fréquence
}> = {};

for (const [career, tenue] of Object.entries(GENERATED_CAREER_TENUES_AUTO)) {
  const perPart: Record<string, string[]> = {};
  const agg: Record<string, { count: number; parts: Set<string>; ctx: string }> = {};
  for (const part of PARTS) {
    const svg = (tenue as Partial<Record<PartKey, string>>)[part];
    if (!svg) continue;
    const info = hexInfo(svg);
    perPart[part] = Object.keys(info);
    for (const [hex, { count, ctx }] of Object.entries(info)) {
      if (!agg[hex]) agg[hex] = { count: 0, parts: new Set(), ctx };
      agg[hex].count += count;
      agg[hex].parts.add(part);
    }
  }
  const hex = Object.entries(agg)
    .map(([h, v]) => ({ hex: h, count: v.count, parts: [...v.parts], ctx: v.ctx }))
    .sort((a, b) => b.count - a.count);

  // Rendu de référence (front) — sprite humain standard portant cette tenue.
  const app: Appearance = { species: 'Humain', sex: 'M', build: 0.5, seed: 4 };
  const inner = renderToStaticMarkup(
    React.createElement(RigSprite, { appearance: app, equip: { weapons: [], armour: [] }, career }),
  );
  const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150"><defs>${DEFS}</defs>${inner}</svg>`;
  const png = `qc/tenue/${slug(career)}.png`;
  const r = new Resvg(full, { background: '#2b3142', fitTo: { mode: 'width', value: 320 } });
  writeFileSync(`public/${png}`, r.render().asPng());

  manifest[career] = { slug: slug(career), png, parts: perPart, hex };
}

writeFileSync('public/qc/tenue-hex.json', JSON.stringify(manifest, null, 1));

// Fichiers PAR carrière (lus tels quels par les agents du workflow) + index compact.
mkdirSync('public/qc/tenue-hex', { recursive: true });
const index: { career: string; png: string; json: string }[] = [];
for (const [career, e] of Object.entries(manifest)) {
  const jsonPath = `public/qc/tenue-hex/${e.slug}.json`;
  writeFileSync(jsonPath, JSON.stringify({ career, png: `public/${e.png}`, hex: e.hex }, null, 1));
  index.push({ career, png: `public/${e.png}`, json: jsonPath });
}
writeFileSync('public/qc/tenue-index.json', JSON.stringify(index));

const totalHex = Object.values(manifest).reduce((n, c) => n + c.hex.length, 0);
console.log(`OK → public/qc/tenue-hex.json + tenue-hex/<slug>.json (${index.length} carrières, ${totalHex} hex distincts cumulés)`);
console.log(`     index → public/qc/tenue-index.json ; PNGs → public/qc/tenue/*.png`);
