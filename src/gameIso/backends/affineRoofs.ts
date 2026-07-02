/**
 * BACKEND ÉCRAN-AFFINE des toits (iso losange · edge-on · vue du dessus · mode plan de l'éditeur) :
 * dessine un élément `roof` du pivot en SVG, en projetant ses PANS GRILLE+MÈTRES via le pont partagé
 * (`projGP`). La teinte d'un pan = SA part d'orientation (N/E/S/O de la def, une couleur PAR PAN — fini
 * le choix par-cellule) ; les lignes sémantiques du builder sont stylées ici (`line` pour faîte/arêtier/
 * égout, `course` pour les rangs de tuiles). La vue du DESSUS ('top') est la boîte étiquetée historique
 * (plan/planEdge/planText) ; l'ÉDITEUR passe `{ plan: true }` pour son plan étiqueté par-cellule
 * (couverture semi-transparente au travers de laquelle on voit/édite les murs). Toute couleur vient du
 * JSON (`roofMaterials.json`).
 */
import { CELL, diamondPath, footprintDepth, isSquareView, tileCenter, type Dims } from '../iso';
import { roofMaterial } from '../catalog/roofs';
import { projGP, type Pt2 } from './project';
import type { RoofEl } from '../builders/types';

// Épaisseurs ÉCRAN (px) des lignes — des formes, jamais des identités de couleur.
const SEAM_W = 0.6; // liseré au ton du pan : soude les coutures anti-aliasées entre pans
const RANG_W = 0.7; // rang de tuiles
const EGOUT_W = 0.8; // bord bas de la nappe
const CREST_W = 1.1; // faîte / arêtier (crêtes nettes)

/** Profondeur de tri d'un toit : MAX sur les 4 coins de l'empreinte à son INDEX DE COUCHE `z` (coin
 *  proche caméra, correct aux 4 rotations) — l'ex-`roofDepth` de RoofSprite. */
export function roofDepth(el: RoofEl, dims: Dims): number {
  return footprintDepth(el.cell.x, el.cell.y, el.span.w, el.span.h, dims, el.cell.z);
}

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lineSvg = (a: Pt2, b: Pt2, color: string, w: number) =>
  `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;

/** Nappe iso/edge-on : pans projetés, triés ARRIÈRE→AVANT à l'écran — en iso le pan opposé à la caméra
 *  est presque de chant et REPLIE d'un cheveu par-dessus le faîte (montée 17 px > pas de profondeur
 *  16 px) ; le pan proche, peint après, recouvre ce repli. Rangs de tuiles puis crêtes par-dessus. */
function pansSvg(el: RoofEl, dims: Dims): string {
  const sh = roofMaterial(el.material);
  const pans = el.faces
    .map((f) => {
      const pts = f.poly.map((p) => projGP(p, dims));
      return { part: f.material.part as 'N' | 'E' | 'S' | 'O', pts, near: Math.max(...pts.map((p) => p[1])) };
    })
    .sort((a, b) => a.near - b.near);
  let svg = '';
  for (const p of pans) {
    const fill = sh[p.part] ?? sh.N!;
    svg += `<path d="M${p.pts.map((q) => `${q[0]},${q[1]}`).join(' L')} Z" fill="${fill}" stroke="${fill}" stroke-width="${SEAM_W}" stroke-linejoin="round"/>`;
  }
  for (const ln of el.lines) {
    if (ln.kind !== 'rang') continue;
    svg += lineSvg(projGP(ln.a, dims), projGP(ln.b, dims), sh.course ?? sh.line!, RANG_W);
  }
  for (const ln of el.lines) {
    if (ln.kind === 'rang') continue;
    svg += lineSvg(projGP(ln.a, dims), projGP(ln.b, dims), sh.line!, ln.kind === 'egout' ? EGOUT_W : CREST_W);
  }
  return svg;
}

/** Vue du DESSUS : l'extrusion iso n'a pas de sens → PLAN de toit (boîte englobante de l'empreinte +
 *  nom) pour LIRE le bâtiment d'un coup d'œil — la représentation historique, couleurs de la def 'plan'. */
function planBoxSvg(el: RoofEl, dims: Dims): string {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let dy = 0; dy < el.span.h; dy++)
    for (let dx = 0; dx < el.span.w; dx++) {
      const { cx, cy } = tileCenter(el.cell.x + dx, el.cell.y + dy, dims);
      minX = Math.min(minX, cx - CELL / 2); maxX = Math.max(maxX, cx + CELL / 2);
      minY = Math.min(minY, cy - CELL / 2); maxY = Math.max(maxY, cy + CELL / 2);
    }
  // Nom au centre, police mise à l'échelle pour tenir dans la largeur (≈ 0.58·fontSize/caractère), bornée [7,16].
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
  const nameFont = Math.max(7, Math.min(16, (maxX - minX - 12) / Math.max(1, el.label.length * 0.58)));
  const plan = roofMaterial('plan');
  return (
    `<rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" rx="3" fill="${plan.planBody!}" stroke="${plan.planEdge!}" stroke-width="4"/>` +
    `<rect x="${minX + 5}" y="${minY + 5}" width="${maxX - minX - 10}" height="${maxY - minY - 10}" rx="2" fill="none" stroke="${plan.planInner!}" stroke-width="1.5" opacity="0.6"/>` +
    `<text x="${midX}" y="${midY}" text-anchor="middle" dominant-baseline="central" font-size="${nameFont}" font-weight="bold" fill="${plan.planText!}" stroke="${plan.planEdge!}" stroke-width="0.5" pointer-events="none">${escapeXml(el.label)}</text>`
  );
}

/** Mode PLAN de l'ÉDITEUR : couverture étiquetée PAR-CELLULE, semi-transparente (on voit/édite les murs
 *  au travers), teintée par le matériau de couverture — l'ex-rendu local d'EditorCanvas, couleurs JSON. */
function planCellsSvg(el: RoofEl, dims: Dims): string {
  const sh = roofMaterial(el.material);
  const plan = roofMaterial('plan');
  let svg = '';
  for (let dy = 0; dy < el.span.h; dy++)
    for (let dx = 0; dx < el.span.w; dx++)
      svg += `<path d="${diamondPath(el.cell.x + dx, el.cell.y + dy, dims)}" fill="${sh.O ?? plan.planBody!}" opacity="0.7" stroke="${plan.planEdge!}" stroke-width="0.5"/>`;
  const { cx, cy } = tileCenter(el.cell.x + (el.span.w - 1) / 2, el.cell.y + (el.span.h - 1) / 2, dims);
  svg +=
    `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="bold" fill="${plan.planText!}" stroke="${plan.planEdge!}" stroke-width="0.5">${escapeXml(el.label)}</text>`;
  return svg;
}

/** SVG d'un élément de toit : `{ plan: true }` = plan étiqueté de l'éditeur ; vue du dessus = boîte
 *  étiquetée ; sinon nappe en pans continus. L'opacité de CUTAWAY est une décoration du stage. */
export function roofSvg(el: RoofEl, dims: Dims, opts?: { plan?: boolean }): string {
  if (opts?.plan) return planCellsSvg(el, dims);
  if (isSquareView(dims.view)) return planBoxSvg(el, dims);
  return pansSvg(el, dims);
}
