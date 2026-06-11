/**
 * QC visuel des mutations physiques (LDB 19) : planches PNG pour contrôle humain.
 *   npx tsx scripts/_qc-mutations.mts
 * → public/qc/mutations-front.png   (les 19 mutations de face, étiquetées)
 * → public/qc/mutations-vues.png    (cas représentatifs en face/profil/dos)
 * → public/qc/mutations-enemies.png (mutants ennemis tirés au seed)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { mutationOverlaysFor, mutationAppearance, randomMutationOverlays } from '../src/gameIso/rig/parts/mutations';
import { LABELS_PHYSIQUES } from '../src/data/mutations';
import type { Mutation } from '../src/engine/corruption';
import type { Appearance } from '../src/gameIso/rig/appearance';
import type { View } from '../src/gameIso/rig/facing';
import type { RigOverlay } from '../src/gameIso/rig/bones';

const APP: Appearance = { species: 'Humain', sex: 'M', build: 0.5, seed: 4 };
const mut = (label: string): Mutation => ({ label, kind: 'physique', roll: 1 });

const CW = 124, CH = 172;
function cell(i: number, perRow: number, label: string, app: Appearance, overlays: RigOverlay[], view: View): string {
  const x = (i % perRow) * CW, y = Math.floor(i / perRow) * CH;
  const inner = renderToStaticMarkup(React.createElement(RigSprite, { appearance: app, equip: { weapons: [], armour: [] }, career: 'Mendiant', view, overlays }));
  return `<g transform="translate(${x},${y})"><rect width="${CW - 4}" height="${CH - 18}" fill="#262d3b"/>` +
    `<line x1="0" y1="150" x2="${CW - 4}" y2="150" stroke="#e06a4a" stroke-width="0.6"/>` +
    `${inner}<text x="${(CW - 4) / 2}" y="${CH - 6}" text-anchor="middle" font-size="8" fill="#cdd" font-family="sans-serif">${label}</text></g>`;
}

function montage(out: string, cells: string[], perRow: number) {
  const rows = Math.ceil(cells.length / perRow);
  const W = perRow * CW, H = rows * CH;
  const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#11141c"/>${cells.join('')}</svg>`;
  writeFileSync(out, new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W * 2 } }).render().asPng());
  console.log(`OK → ${out}`);
}

mkdirSync('public/qc', { recursive: true });

// Planche 1 : chaque mutation physique, de face.
montage('public/qc/mutations-front.png',
  LABELS_PHYSIQUES.map((label, i) => {
    const m = [mut(label)];
    return cell(i, 5, label, mutationAppearance(APP, m), mutationOverlaysFor(m), 'front');
  }), 5);

// Planche 2 : vues — détails de visage (face seulement), cornes (toutes vues), morpho.
const VUES: { label: string; m: Mutation[] }[] = [
  { label: 'Groin poilu', m: [mut('Groin poilu')] },
  { label: 'Cornes asymétriques', m: [mut('Cornes asymétriques')] },
  { label: 'Langue pendante', m: [mut('Langue pendante')] },
  { label: 'Court sur pattes', m: [mut('Court sur pattes')] },
  { label: 'Corpulent', m: [mut('Corpulent')] },
  { label: 'Émacié', m: [mut('Émacié')] },
];
montage('public/qc/mutations-vues.png',
  VUES.flatMap(({ label, m }, r) => (['front', 'profile', 'back'] as View[]).map((v, c) =>
    cell(r * 3 + c, 3, `${label} — ${v}`, mutationAppearance(APP, m), mutationOverlaysFor(m), v))), 3);

// Planche 3 : mutants ennemis (tirage au seed, chemin enemyProfile).
montage('public/qc/mutations-enemies.png',
  [0, 1, 7, 42, 1234, 77].map((seed, i) =>
    cell(i, 6, `Mutant seed ${seed}`, { ...APP, seed }, randomMutationOverlays(seed), 'front')), 6);

// Planche 4 : GROS PLAN buste/tête des mutations de détail (jugement de l'art).
const ZW = 200, ZH = 240;
function zoomCell(i: number, perRow: number, label: string, overlays: RigOverlay[]): string {
  const x = (i % perRow) * ZW, y = Math.floor(i / perRow) * ZH;
  const inner = renderToStaticMarkup(React.createElement(RigSprite, { appearance: APP, equip: { weapons: [], armour: [] }, career: 'Mendiant', view: 'front', overlays }));
  return `<g transform="translate(${x},${y})"><rect width="${ZW - 4}" height="${ZH - 18}" fill="#262d3b"/>` +
    `<svg x="0" y="0" width="${ZW - 4}" height="${ZH - 18}" viewBox="28 14 64 76">${inner}</svg>` +
    `<text x="${(ZW - 4) / 2}" y="${ZH - 5}" text-anchor="middle" font-size="11" fill="#cdd" font-family="sans-serif">${label}</text></g>`;
}
const CLOSEUPS = ['Œil énorme', 'Bouche supplémentaire', 'Visage inversé', 'Langue pendante', 'Groin poilu',
  'Cornes asymétriques', 'Beauté surnaturelle', 'Tentacule épais', 'Peau d’acier', 'Écailles épineuses',
  'Plumes éparses', 'Suintement de pus', 'Peau brillante', 'Doigts distendus', 'Articulation supplémentaire aux jambes'];
{
  const perRow = 5;
  const cells = CLOSEUPS.map((label, i) => zoomCell(i, perRow, label, mutationOverlaysFor([mut(label)])));
  const rows = Math.ceil(cells.length / perRow);
  const W = perRow * ZW, H = rows * ZH;
  const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#11141c"/>${cells.join('')}</svg>`;
  writeFileSync('public/qc/mutations-closeup.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: W } }).render().asPng());
  console.log('OK → public/qc/mutations-closeup.png');
}
