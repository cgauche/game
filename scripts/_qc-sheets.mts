/**
 * Planches QC multi-axes pour audit visuel (workflow) : tailles × directions × catégories.
 * Détecte : pieds hors sol, hors-centre, trous, blobs, cheveux qui ne touchent pas la tête /
 * invisibles de dos, armes détachées, incohérences directionnelles.
 * Sort : public/qc/sheets/<cat>.png. Lancer : npx tsx scripts/_qc-sheets.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { GENERATED_HEADS } from '../src/gameIso/rig/parts/generated/heads';
import { HAIRSTYLES } from '../src/gameIso/rig/parts/generated/hairstyles';
import type { Appearance } from '../src/gameIso/rig/appearance';
import type { View } from '../src/gameIso/rig/facing';
import type { Weapon } from '../src/engine/types';

type Dir = { view: View; mirror: boolean; label: string };
const DIRS: Dir[] = [
  { view: 'front', mirror: false, label: 'face' },
  { view: 'profile', mirror: false, label: 'profil D' },
  { view: 'back', mirror: false, label: 'dos' },
  { view: 'profile', mirror: true, label: 'profil G' },
];

const wpn = (name: string, type: 'melee' | 'ranged' = 'melee'): Weapon => ({ name, type, damage: { plusBF: false, flat: 0 }, qualities: [] });

/** Rend un rig (vue/miroir/taille/équip) → fragment SVG, dans la boîte rig 120×150. */
function rig(o: { app: Appearance; view: View; mirror: boolean; career?: string; weapons?: Weapon[] }): string {
  const inner = renderToStaticMarkup(
    React.createElement(RigSprite, { appearance: o.app, equip: { weapons: o.weapons ?? [], armour: [] }, career: o.career, view: o.view }),
  );
  return o.mirror ? `<g transform="translate(120,0) scale(-1,1)">${inner}</g>` : inner;
}

const CW = 118, CH = 168, FEET = 150; // boîte rig : pieds ~y150
/** Une vignette : cadre + ligne de sol (aux pieds) + repère vertical de centre + rig + label. */
function cell(x: number, y: number, label: string, svg: string): string {
  return `<g transform="translate(${x},${y})"><rect width="${CW - 4}" height="${CH - 14}" fill="#262d3b" stroke="#3a4252" stroke-width="0.5"/>` +
    `<line x1="0" y1="${FEET}" x2="${CW - 4}" y2="${FEET}" stroke="#e06a4a" stroke-width="0.6" opacity="0.7"/>` + // sol (rouge) : les pieds doivent y toucher
    `<line x1="${(CW - 4) / 2}" y1="0" x2="${(CW - 4) / 2}" y2="${CH - 14}" stroke="#4f8fe0" stroke-width="0.4" opacity="0.4"/>` + // centre (bleu)
    `${svg}<text x="${(CW - 4) / 2}" y="${CH - 3}" text-anchor="middle" font-size="8" fill="#cdd" font-family="sans-serif">${label}</text></g>`;
}

function sheet(name: string, title: string, rows: { label: string; cells: { label: string; svg: string }[] }[]): void {
  const maxCols = Math.max(...rows.map((r) => r.cells.length));
  const LBLW = 92;
  const W = LBLW + maxCols * CW, H = 28 + rows.length * CH;
  const parts: string[] = [`<text x="12" y="18" font-size="14" fill="#d8a93b" font-family="sans-serif">${title}</text>`];
  rows.forEach((r, ri) => {
    const y = 28 + ri * CH;
    parts.push(`<text x="8" y="${y + CH / 2}" font-size="10" fill="#9fb0c8" font-family="sans-serif">${r.label}</text>`);
    r.cells.forEach((c, ci) => parts.push(cell(LBLW + ci * CW, y, c.label, c.svg)));
  });
  const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#11141c"/>${parts.join('')}</svg>`;
  writeFileSync(`public/qc/sheets/${name}.png`, new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: Math.min(2400, W * 2) } }).render().asPng());
  console.log(`  → public/qc/sheets/${name}.png (${rows.length}×${maxCols})`);
}

mkdirSync('public/qc/sheets', { recursive: true });

// A — TAILLES × DIRECTIONS (soldat armé) : ancrage sol, centrage, trous, cohérence dir.
const SIZES: { sp: string; label: string }[] = [
  { sp: 'Ogre', label: 'Ogre' }, { sp: 'Humain', label: 'Humain' }, { sp: 'Nain', label: 'Nain' }, { sp: 'Halfling', label: 'Halfling' },
];
sheet('A-tailles-dirs', 'A — Tailles × directions (Soldat + épée tenue) : sol(rouge)/centre(bleu)',
  SIZES.map((s) => ({
    label: s.label,
    cells: DIRS.map((d) => ({ label: d.label, svg: rig({ app: { species: s.sp, sex: 'M', build: 0.5, seed: 4 }, view: d.view, mirror: d.mirror, career: 'Soldat', weapons: [wpn('Épée')] }) })),
  })),
);

// B — TÊTES (visage+cheveux défaut espèce) × directions : visage/yeux/oreilles/cheveux de dos.
sheet('B-tetes-dirs', 'B — Têtes par espèce:sexe × directions (cheveux de dos ?)',
  Object.keys(GENERATED_HEADS).map((key) => {
    const [sp, sx] = key.split(':');
    return { label: key, cells: DIRS.map((d) => ({ label: d.label, svg: rig({ app: { species: sp, sex: sx as 'M' | 'F', build: 0.5, seed: 4 }, view: d.view, mirror: d.mirror, career: 'Mendiant' }) })) };
  }),
);

// C — COIFFURES × directions (Humain) : touche la tête ? visible de dos ?
const hairRows = (sex: 'M' | 'F') => [
  { label: `H:${sex} défaut`, cells: DIRS.map((d) => ({ label: d.label, svg: rig({ app: { species: 'Humain', sex, build: 0.5, seed: 4, parts: { cheveux: 0 } }, view: d.view, mirror: d.mirror, career: 'Mendiant' }) })) },
  ...HAIRSTYLES[sex].map((h, i) => ({
    label: `${sex}#${i + 1} ${h.name.slice(0, 14)}`,
    cells: DIRS.map((d) => ({ label: d.label, svg: rig({ app: { species: 'Humain', sex, build: 0.5, seed: 4, parts: { cheveux: i + 1 } }, view: d.view, mirror: d.mirror, career: 'Mendiant' }) })),
  })),
];
sheet('C-coiffures-M', 'C — Coiffures Humain M × directions', hairRows('M'));
sheet('C-coiffures-F', 'C — Coiffures Humain F × directions', hairRows('F'));

// D — ARMES tenues × directions : arme détachée de la main ? trous ?
const WEAPONS = ['Épée', 'Hache', 'Masse', 'Lance', 'Hallebarde', 'Dague', 'Arc', 'Arbalète'];
sheet('D-armes-dirs', 'D — Armes tenues (Humain Soldat) × directions',
  WEAPONS.map((w) => ({
    label: w,
    cells: DIRS.map((d) => ({ label: d.label, svg: rig({ app: { species: 'Humain', sex: 'M', build: 0.5, seed: 4 }, view: d.view, mirror: d.mirror, career: 'Soldat', weapons: [wpn(w, w === 'Arc' || w === 'Arbalète' ? 'ranged' : 'melee')] }) })),
  })),
);

// E — TENUES de carrière (échantillon) × directions : cohérence, trous, dos.
const CAREERS = ['Soldat', 'Garde', 'Chevalier', 'Noble', 'Sorcier', 'Prêtre', 'Mendiant', 'Marchand', 'Batelier', 'Chasseur'];
sheet('E-tenues-dirs', 'E — Tenues de carrière (Humain) × directions',
  CAREERS.map((c) => ({
    label: c,
    cells: DIRS.map((d) => ({ label: d.label, svg: rig({ app: { species: 'Humain', sex: 'M', build: 0.5, seed: 4 }, view: d.view, mirror: d.mirror, career: c }) })),
  })),
);

console.log('OK — planches QC dans public/qc/sheets/');
