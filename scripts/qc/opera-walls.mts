/**
 * QC — MURS-SEULS du Théâtre Staatsoper en VUE DU DESSUS SCHÉMATIQUE (grille carrée, PAS iso), dans le
 * style EXACT de `art-ref/opera/plan_walls_doors.png` : fond BLANC, murs en traits NOIRS épais, portes
 * en VERT, escaliers en ORANGE. Aucun sol ni mobilier — uniquement la STRUCTURE pour comparer
 * trait-pour-trait au schéma autoritaire.  npx tsx scripts/qc/opera-walls.mts → public/qc/opera-walls.png
 *
 * Convention de rendu (alignée sur `WallSeg`, cf. state/scene.ts) :
 *   • side 'N' (x,y)  → arête entre (x,y) et (x,y-1)  = segment horizontal au sommet de la case (x,y).
 *   • side 'E' (x,y)  → arête entre (x,y) et (x+1,y)  = segment vertical à droite de la case (x,y).
 *   • side '\\' (x,y) → diagonale coin NO→SE de la case (purement visuelle, éventail/courbe).
 *   • side '/' (x,y)  → diagonale coin NE→SO de la case.
 *   • door:true       → l'arête est dessinée en VERT (porte franchissable) au lieu de noir.
 * Les escaliers (`scene.stairs`, from.z===0) sont hachurés en ORANGE sur leur case.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { buildOperaFloorplan } from '../../src/scenes/opera/floorplan';

const scene = buildOperaFloorplan();
const W = scene.dimensions.w, H = scene.dimensions.h;
const Z = 0;
const CELL = 22;             // pixels par case
const PAD = 24;
const SW = W * CELL + PAD * 2;
const SH = H * CELL + PAD * 2;
const X = (gx: number) => PAD + gx * CELL;
const Y = (gy: number) => PAD + gy * CELL;

const BLACK = '#111';
const GREEN = '#1fb8a6';
const ORANGE = '#f0a93a';
const THICK = 5;             // épaisseur des murs (traits épais comme le schéma)
const DOORW = 6;

const parts: string[] = [];

// ── Murs sur arêtes ──────────────────────────────────────────────────────────
for (const w of scene.walls ?? []) {
  if ((w.z ?? 0) !== Z) continue;
  const door = !!w.door;
  const col = door ? GREEN : BLACK;
  const sw = door ? DOORW : THICK;
  const cap = door ? 'butt' : 'square';
  if (w.side === 'N') {
    // sommet de la case (x,y) : de (x,y) à (x+1,y)
    parts.push(`<line x1="${X(w.x)}" y1="${Y(w.y)}" x2="${X(w.x + 1)}" y2="${Y(w.y)}" stroke="${col}" stroke-width="${sw}" stroke-linecap="${cap}"/>`);
  } else if (w.side === 'E') {
    // côté droit de la case (x,y) : de (x+1,y) à (x+1,y+1)
    parts.push(`<line x1="${X(w.x + 1)}" y1="${Y(w.y)}" x2="${X(w.x + 1)}" y2="${Y(w.y + 1)}" stroke="${col}" stroke-width="${sw}" stroke-linecap="${cap}"/>`);
  } else if (w.side === '\\') {
    // diagonale NO→SE de la case
    parts.push(`<line x1="${X(w.x)}" y1="${Y(w.y)}" x2="${X(w.x + 1)}" y2="${Y(w.y + 1)}" stroke="${col}" stroke-width="${sw}" stroke-linecap="${cap}"/>`);
  } else if (w.side === '/') {
    // diagonale NE→SO de la case
    parts.push(`<line x1="${X(w.x + 1)}" y1="${Y(w.y)}" x2="${X(w.x)}" y2="${Y(w.y + 1)}" stroke="${col}" stroke-width="${sw}" stroke-linecap="${cap}"/>`);
  }
}

// ── Escaliers (orange, hachuré) ───────────────────────────────────────────────
for (const s of scene.stairs ?? []) {
  if (s.from.z !== Z) continue;
  const x0 = X(s.from.x), y0 = Y(s.from.y);
  parts.push(`<rect x="${x0 + 2}" y="${y0 + 2}" width="${CELL - 4}" height="${CELL - 4}" fill="none" stroke="${ORANGE}" stroke-width="2"/>`);
  for (let i = 1; i < 4; i++) {
    const yy = y0 + (CELL * i) / 4;
    parts.push(`<line x1="${x0 + 2}" y1="${yy}" x2="${x0 + CELL - 2}" y2="${yy}" stroke="${ORANGE}" stroke-width="1.6"/>`);
  }
}

// ── Légende ───────────────────────────────────────────────────────────────────
const ly = SH - 14;
parts.push(`<line x1="${PAD}" y1="${ly}" x2="${PAD + 28}" y2="${ly}" stroke="${GREEN}" stroke-width="${DOORW}"/><text x="${PAD + 34}" y="${ly + 4}" font-family="sans-serif" font-size="13" fill="#333">Porte</text>`);
parts.push(`<line x1="${PAD + 110}" y1="${ly}" x2="${PAD + 138}" y2="${ly}" stroke="${ORANGE}" stroke-width="${DOORW}"/><text x="${PAD + 144}" y="${ly + 4}" font-family="sans-serif" font-size="13" fill="#333">Escalier</text>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SW} ${SH}" width="${SW}" height="${SH}"><rect width="${SW}" height="${SH}" fill="#fff"/>${parts.join('')}</svg>`;
const png = new Resvg(svg, { fitTo: { mode: 'width', value: SW } }).render().asPng();
mkdirSync('public/qc', { recursive: true });
writeFileSync('public/qc/opera-walls.png', png);
console.log(`OK: public/qc/opera-walls.png — murs-seuls (${W}x${H}), ${(scene.walls ?? []).filter((w) => (w.z ?? 0) === Z).length} segments z=0`);
