/**
 * QC — MOBILIER VOLUMIQUE : ce que les recettes de `props.json` produisent réellement comme
 * géométrie monde (`buildPropVolumes`), vue aux quatre rotations de caméra plus une vue de dessus.
 * La sixième colonne montre la VIGNETTE de palette (`propSvg`) — l'art de l'éditeur, jamais le corps
 * monde : les deux sont côte à côte pour juger l'écart d'un coup d'œil.
 *   npx tsx scripts/qc/render-props-volumiques.mts → public/props-volumiques.html
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildPropVolumes } from '../../src/gameIso/builders/propVolumes';
import { polyNormal } from '../../src/gameIso/backends/webgl/worldTris';
import { propSvg } from '../../src/gameIso/catalog/decor';
import { findPropById, findPropMaterialById, props } from '../../src/data';
import { DEFS } from '../../src/gameIso/sprites';
import type { Face } from '../../src/gameIso/builders/types';

/** DÉRIVÉE du catalogue : une recette de plus entre en planche par sa seule déclaration en donnée —
 *  une liste manuscrite laisserait les suivantes hors QC en silence. */
const IDS = props.filter((p) => p.volume).map((p) => p.id);
const METRES_PAR_CASE = 2; // `Scene.metresPerTile` de La Diligence
const PX_PAR_METRE = 44;
const CELL_W = 230, CELL_H = 250;

interface Pt3 { x: number; y: number; h: number }

/** Sommet MONDE (cases en x/y, mètres en h) → mètres, tourné du cran de caméra `rot` (90° par cran). */
function enMetres(p: { x: number; y: number; h: number }, rot: number): Pt3 {
  const a = (rot * Math.PI) / 2;
  const x = p.x * METRES_PAR_CASE, y = p.y * METRES_PAR_CASE;
  return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a), h: p.h };
}

/** Projection d'un point métrique : isométrique vraie, ou vue de dessus (`top`). */
function projeter(p: Pt3, top: boolean): { sx: number; sy: number } {
  if (top) return { sx: p.x * PX_PAR_METRE, sy: p.y * PX_PAR_METRE };
  return {
    sx: (p.x - p.y) * Math.cos(Math.PI / 6) * PX_PAR_METRE,
    sy: ((p.x + p.y) * Math.sin(Math.PI / 6) - p.h) * PX_PAR_METRE,
  };
}

/** Normale UNITAIRE d'un polygone métrique, dans les axes de la planche (x est, y sud, h haut). Le
 *  DEHORS n'a qu'une définition, celle du rendu (`polyNormal`, repère three `(X, Y, Z) = (x, h, y)`) :
 *  la planche l'appelle au lieu d'en tenir une seconde. */
function normale(poly: readonly Pt3[]): Pt3 {
  const n = polyNormal(poly.map((p) => ({ x: p.x, y: p.h, z: p.y })));
  return n ? { x: n.x, y: n.z, h: n.y } : { x: 0, y: 0, h: 0 };
}

/** Direction de l'ŒIL : le NOYAU de `projeter` — un déplacement de (1,1,1) ne bouge aucun des deux axes
 *  d'écran de l'isométrique, et l'œil est à la verticale en vue de dessus. Sert à la FRONTALITÉ comme à
 *  la PROFONDEUR : le peintre trie sur la même mesure qu'il cull. */
const VERS_OEIL = {
  iso: { x: Math.sqrt(1 / 3), y: Math.sqrt(1 / 3), h: Math.sqrt(1 / 3) },
  top: { x: 0, y: 0, h: 1 },
};
const versOeil = (p: Pt3, v: Pt3): number => p.x * v.x + p.y * v.y + p.h * v.h;

/** Couleur du matériau, assombrie selon l'orientation de la face (lumière fixe, QC seulement). */
function teinte(couleur: string, facteur: number): string {
  const v = parseInt(couleur.slice(1), 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255]
    .map((k) => Math.max(0, Math.min(255, Math.round(k * facteur))).toString(16).padStart(2, '0'));
  return `#${c.join('')}`;
}

const LUMIERE = { x: -0.42, y: -0.56, h: 0.71 };

/** Une vue d'un décor : ses faces peintes par l'algorithme du peintre, ou `null` si aucune face. */
function vueSvg(faces: readonly Face[], rot: number, top: boolean): { svg: string; peintes: number } {
  const polys = faces.map((f) => {
    const metrique = f.poly.map((p) => enMetres(p, rot));
    const n = normale(metrique);
    const vers = top ? VERS_OEIL.top : VERS_OEIL.iso;
    return {
      metrique,
      n,
      face: f,
      visible: versOeil(n, vers) > 0,
      profondeur: metrique.reduce((acc, p) => acc + versOeil(p, vers) / metrique.length, 0),
    };
  });
  const visibles = polys.filter((p) => p.visible).sort((a, b) => a.profondeur - b.profondeur);
  const corps = visibles.map(({ metrique, n, face }) => {
    const materiau = findPropMaterialById(face.material.id);
    const lambert = Math.max(0, n.x * LUMIERE.x + n.y * LUMIERE.y + n.h * LUMIERE.h);
    const fill = teinte(materiau?.color ?? '#888888', 0.45 + 0.6 * lambert);
    const d = metrique.map((p) => projeter(p, top)).map(({ sx, sy }) => `${sx.toFixed(1)},${sy.toFixed(1)}`).join(' ');
    return `<polygon points="${d}" fill="${fill}" stroke="${teinte(fill, 0.7)}" stroke-width="0.5"/>`;
  }).join('');
  return { svg: corps, peintes: visibles.length };
}

/** Ancrage de PLANCHE : la recette au cap d'identité, origine de grille, sol à 0 m — aucune scène. */
const ancrageDePlanche = { ancre: { x: 0, y: 0 }, facing: 'N' as const, baseHeightM: 0 };

const COLONNES = [
  { titre: 'rot0', rot: 0, top: false },
  { titre: 'rot1', rot: 1, top: false },
  { titre: 'rot2', rot: 2, top: false },
  { titre: 'rot3', rot: 3, top: false },
  { titre: 'top', rot: 0, top: true },
];

const vides: string[] = [];
const lignes = IDS.map((id) => {
  const prop = findPropById(id);
  if (!prop?.volume) throw new Error(`recette absente : ${id}`);
  const faces = buildPropVolumes(prop, ancrageDePlanche);
  const cellules = COLONNES.map(({ titre, rot, top }) => {
    const { svg, peintes } = vueSvg(faces, rot, top);
    if (peintes === 0) vides.push(`${id}/${titre}`);
    return `<td><div class="vue"><svg viewBox="${-CELL_W / 2} ${-CELL_H + 60} ${CELL_W} ${CELL_H}" width="${CELL_W}" height="${CELL_H}">${svg}</svg>` +
      `<span class="meta">${titre} — ${peintes} faces</span></div></td>`;
  }).join('');
  const vignette = `<td><div class="vue vignette"><svg viewBox="0 0 120 150" width="120" height="150"><defs>${DEFS}</defs>${propSvg(id, 'S', 0)}</svg>` +
    `<span class="meta">vignette palette</span></div></td>`;
  return `<tr><th>${id}<br><small>${prop.volume.primitives.length} primitives · ${prop.seatSlots?.length ?? 0} place(s)</small></th>${cellules}${vignette}</tr>`;
}).join('\n');

const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>QC — mobilier volumique</title>
<style>
 body { background:#15171f; color:#e8e0cc; font:14px/1.4 system-ui, sans-serif; padding:16px; }
 table { border-collapse:collapse; }
 th, td { border:1px solid #333a4a; padding:6px; vertical-align:top; }
 th { text-align:left; max-width:180px; }
 .vue { display:flex; flex-direction:column; align-items:center; background:#1e2130; }
 .vue svg { background:#20243a; }
 .meta { font-size:11px; opacity:0.75; padding:2px 0; }
</style>
<h1>Mobilier volumique — géométrie monde des recettes de <code>props.json</code></h1>
<p>Quatre rotations de caméra + vue de dessus, peintes depuis les <code>Face[]</code> réelles de
<code>buildPropVolumes</code> (cap d'identité <code>N</code>, sol à 0 m, case de 2 m). Dernière colonne :
la vignette SVG de palette, qui n'est jamais le corps monde.</p>
<table><thead><tr><th>ref</th>${COLONNES.map((c) => `<th>${c.titre}</th>`).join('')}<th>vignette</th></tr></thead>
<tbody>
${lignes}
</tbody></table>
</html>`;

mkdirSync('public', { recursive: true });
writeFileSync('public/props-volumiques.html', html);
console.log(`OK: public/props-volumiques.html — ${IDS.length} lignes × ${COLONNES.length} vues monde + vignette de palette`);
if (vides.length) {
  console.error(`VUES MONDE VIDES : ${vides.join(', ')}`);
  process.exitCode = 1;
}
