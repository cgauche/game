/**
 * BACKEND ÉCRAN-AFFINE des toits (iso losange · edge-on · vue du dessus · mode plan de l'éditeur) :
 * dessine un élément `roof` du pivot en SVG, en projetant ses PANS GRILLE+MÈTRES via le pont partagé
 * (`projGP`). La teinte d'un pan = SA part d'orientation (N/E/S/O de la def, une couleur PAR PAN — fini
 * le choix par-cellule) ; les lignes sémantiques du builder sont stylées ici (`line` pour faîte/arêtier/
 * égout, `detail.courses.joint` pour les rangs de tuiles). MATÉRIAUX v2 : la recette du matériau habille
 * chaque pan — bardeaux décalés (`blockWM`), nuances par bardeau (`paletteVar`, LOD 2), rangs TREMBLÉS
 * (chaume : `edgeWobble` sans blocs) et balayage de brins (`tufts`, LOD 2) — le tout CLIPPÉ au polygone
 * du pan (le motif suit la pente, jamais ne déborde l'égout/l'arêtier). Pas de couche d'accents séparée
 * comme sols/murs : une scène porte une POIGNÉE de toits (le coût vit bien dans le memo du stage).
 * La vue du DESSUS ('top') est la boîte étiquetée historique (plan/planEdge/planText) ; l'ÉDITEUR passe
 * `{ plan: true }` pour son plan étiqueté par-cellule (couverture semi-transparente au travers de
 * laquelle on voit/édite les murs). Toute couleur vient du JSON (`roofMaterials.json`) ou de `shade`.
 */
import { CELL, diamondPath, footprintDepth, isSquareView, tileCenter, type Dims } from '../../geometry/iso';
import { roofMaterial, type RoofMaterialDef } from '../catalog/roofs';
import { ROOF_SLOPE_M, roofCoursesPerStep } from '../builders/roofs';
import {
  detailOf,
  projTag,
  coursesKey,
  patternWM,
  rowBoundaries,
  N_VARIANTS,
  PX_PER_M_V,
  type Courses,
  type DetailOpts,
} from './affineDetail';
import { hash32, seedStream } from '../detail/hash';
import { ACCENT_FRAC, BLOCK_INSET_M, BLOCK_SHADE_K } from '../detail/expand';
import { shade, mix } from '../shade';
import type { DetailRecipe } from '../detail/types';
import { projGP, type Pt2 } from './project';
import type { GP, RoofEl } from '../builders/types';

// Épaisseurs ÉCRAN (px) des lignes — des formes, jamais des identités de couleur.
const SEAM_W = 0.6; // liseré au ton du pan : soude les coutures anti-aliasées entre pans
const EGOUT_W = 0.8; // bord bas de la nappe
const CREST_W = 1.1; // faîte / arêtier (crêtes nettes)
const RIDGE_W = 2.2; // couronnement de faîte : base ÉPAISSE (ton `line`) — la crête a du volume
const RIDGE_CAP_W = 0.9; // liseré CLAIR (`ridgeCap`) posé sur le dessus → lit un couronnement, pas un trait

/** Ton d'une face de toit depuis la def (zéro littéral) : les faces de VOLUME d'avant-toit résolvent leur
 *  ton DÉDIÉ (`soffite` = dessous débordant ombré ; `fascia` = planche de rive sombre) ; un pan ordinaire
 *  suit son orientation N/E/S/O. */
function panFill(sh: RoofMaterialDef, part: string): string {
  if (part === 'soffite') return sh.soffite ?? sh.S ?? sh.N!;
  if (part === 'fascia') return sh.fascia ?? sh.line ?? sh.S ?? sh.N!;
  return sh[part as 'N' | 'E' | 'S' | 'O'] ?? sh.N!;
}
// Formes du détail de couverture (mètres). Le retrait et la fraction des nuances de bardeau réutilisent
// le dosage PARTAGÉ de l'appareillage mural (`BLOCK_INSET_M` / `ACCENT_FRAC`, importés de detail/expand).
const TICK_INSET_M = 0.03; // le joint vertical d'un bardeau laisse respirer les lignes de rang
const WOBBLE_STEP_M = 0.5; // échantillonnage du tremblé de rang (chaume)

// Contrat DATA (`roofMaterials.json`, cf. RoofMaterialDef) : un matériau de couverture définit ses pentes
// N/E/S/O + `line` (rendu iso) et ses champs `plan*` (vue du dessus). Optionnels au TYPE, requis selon le
// MODE de rendu → les `!` de ce fichier sont garantis par ce contrat, pas par le compilateur.
/** Profondeur de tri d'un toit : MAX sur les 4 coins de l'empreinte à son INDEX DE COUCHE `z` (coin
 *  proche caméra, correct aux 4 rotations) — l'ex-`roofDepth` de RoofSprite. */
export function roofDepth(el: RoofEl, dims: Dims): number {
  return footprintDepth(el.cell.x, el.cell.y, el.span.w, el.span.h, dims, el.cell.z);
}

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lineSvg = (a: Pt2, b: Pt2, color: string, w: number) =>
  `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;

// ── Détail de couverture (matériaux v2) ──────────────────────────────────────────────────────────────
/** (x,y) DANS le polygone d'un pan (xy grille, ray-cast pair-impair) — assigne un rang à SON pan. */
function inPanXY(x: number, y: number, poly: GP[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y)) inside = !inside;
  }
  return inside;
}

/** Gradient du PLAN d'un pan (montée h par unité de grille en +x/+y), depuis 3 sommets non colinéaires
 *  — le backend re-dérive la pente de la géométrie du pivot, sans champ stocké. */
function panGrad(poly: GP[]): { gx: number; gy: number } | null {
  const [p0, p1] = poly;
  for (let j = 2; j < poly.length; j++) {
    const p2 = poly[j];
    const det = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
    if (!det) continue;
    return {
      gx: ((p1.h - p0.h) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.h - p0.h)) / det,
      gy: ((p1.x - p0.x) * (p2.h - p0.h) - (p1.h - p0.h) * (p2.x - p0.x)) / det,
    };
  }
  return null;
}

const n1 = (v: number) => String(Math.round(v * 10) / 10);

interface Pan {
  poly: GP[];
  pts: Pt2[];
  fill: string;
  near: number;
}

/** DÉTAIL des pans (LOD ≥ 1) : par pan — CLIPPÉ à son polygone — bardeaux (joints verticaux décalés
 *  par rang, bornes seedées PARTAGÉES avec l'appareillage mural via `rowBoundaries`), nuances de
 *  bardeau (LOD 2), rangs tremblés (chaume) et brins de paille (LOD 2). Les positions sont ancrées à
 *  la coordonnée MONDE le long de la courbe de niveau → un rang scindé entre segments garde ses
 *  bardeaux alignés, et le seed vient de l'identité MONDE de l'élément (`seedScope` 'instance'). */
function roofDetailSvg(el: RoofEl, pans: Pan[], det: DetailRecipe, dims: Dims, lod: 1 | 2, mpt: number): string {
  const c = det.courses as Courses;
  const rangs = el.lines.filter((l) => l.kind === 'rang');
  if (!rangs.length) return '';
  const step = ROOF_SLOPE_M / roofCoursesPerStep(det)!;
  const h0 = Math.min(...rangs.map((r) => r.a.h));
  const seed = hash32('roof', el.cell.x, el.cell.y, el.cell.z);
  const variant = seed % N_VARIANTS;
  const key = coursesKey(c);
  const W = patternWM(c);
  let svg = '';

  pans.forEach((pan, pi) => {
    const g = panGrad(pan.poly);
    if (!g) return;
    const gm = Math.hypot(g.gx, g.gy);
    if (gm < 1e-9) return; // pan plat : aucun rang
    const down: Pt2 = [-g.gx / gm, -g.gy / gm]; // direction DESCENDANTE (grille)
    const lvl: Pt2 = [-g.gy / gm, g.gx / gm]; // direction le long des courbes de niveau
    const sOf = (p: GP) => (p.x * lvl[0] + p.y * lvl[1]) * mpt; // coordonnée MONDE (m) le long du rang
    let ticks = '';
    let wobble = '';
    let light = '';
    let dark = '';
    let straw = '';
    for (const ln of rangs) {
      const mx = (ln.a.x + ln.b.x) / 2;
      const my = (ln.a.y + ln.b.y) / 2;
      if (!inPanXY(mx, my, pan.poly)) continue;
      const sa = sOf(ln.a);
      const sb = sOf(ln.b);
      if (Math.abs(sb - sa) < 0.05) continue;
      const s0 = Math.min(sa, sb);
      const s1 = Math.max(sa, sb);
      const k = Math.round((ln.a.h - h0) / step);
      /** Point du pan à la coordonnée de rang `s` (m), décalé de `dv` mètres VERS LE BAS de la pente. */
      const at = (s: number, dv: number): string => {
        const t = (s - sa) / (sb - sa);
        const p = projGP(
          { x: ln.a.x + (ln.b.x - ln.a.x) * t + (down[0] * dv) / gm, y: ln.a.y + (ln.b.y - ln.a.y) * t + (down[1] * dv) / gm, h: ln.a.h - dv },
          dims,
        );
        return `${n1(p[0])},${n1(p[1])}`;
      };
      if (c.blockWM) {
        // BARDEAUX : bornes du motif périodique par parité de rang, ancrées MONDE le long du rang.
        const bounds = rowBoundaries(c, key, variant, (((k % 2) + 2) % 2) as 0 | 1);
        const edges: number[] = [s0];
        for (let n = Math.floor(s0 / W); n * W <= s1; n++)
          for (const bd of bounds) {
            const pos = n * W + bd;
            if (pos > s0 + 0.05 && pos < s1 - 0.05) edges.push(pos);
          }
        edges.sort((p, q) => p - q);
        edges.push(s1);
        for (let i = 1; i + 1 < edges.length; i++) ticks += `M${at(edges[i], TICK_INSET_M)}L${at(edges[i], step - TICK_INSET_M)}`;
        if (lod >= 2 && c.paletteVar) {
          for (let i = 0; i + 1 < edges.length; i++) {
            const u0 = edges[i] + BLOCK_INSET_M;
            const u1 = edges[i + 1] - BLOCK_INSET_M;
            if (u1 - u0 < 0.08) continue;
            const rv = seedStream(hash32(seed, 'brd', k, Math.round(edges[i] * 20)))();
            if (rv >= ACCENT_FRAC && rv <= 1 - ACCENT_FRAC) continue;
            const sub = `M${at(u0, BLOCK_INSET_M)}L${at(u1, BLOCK_INSET_M)}L${at(u1, step - BLOCK_INSET_M)}L${at(u0, step - BLOCK_INSET_M)}Z`;
            if (rv < ACCENT_FRAC) light += sub;
            else dark += sub;
          }
        }
      } else if (c.edgeWobble) {
        // CHAUME : le rang droit devient une ligne ORGANIQUE — offsets seedés à la coordonnée MONDE
        // arrondie (un rang scindé entre deux segments tremble pareil des deux côtés).
        const off = (s: number) => (seedStream(hash32(seed, 'wob', k, Math.round(s * 8)))() * 2 - 1) * c.edgeWobble!;
        wobble += `M${at(s0, off(s0))}`;
        for (let s = Math.ceil(s0 / WOBBLE_STEP_M) * WOBBLE_STEP_M; s < s1; s += WOBBLE_STEP_M) wobble += `L${at(s, off(s))}`;
        wobble += `L${at(s1, off(s1))}`;
      }
      if (lod >= 2 && det.tufts) {
        // BALAYAGE de brins (paille) : petits traits le long de la pente, semés depuis chaque rang.
        const t = det.tufts;
        const rs = seedStream(hash32(seed, 'straw', k, Math.round(s0 * 10)));
        const n = Math.round(t.perM2 * (s1 - s0) * step);
        for (let i = 0; i < n; i++) {
          const s = s0 + rs() * (s1 - s0);
          const len = t.hM[0] + rs() * (t.hM[1] - t.hM[0]);
          straw += `M${at(s, -0.15 * len)}L${at(s + (rs() * 2 - 1) * 0.15, 0.85 * len)}`;
        }
      }
    }
    let inner = '';
    if (ticks) inner += `<path d="${ticks}" fill="none" stroke="${c.joint}" stroke-width="${n1(c.jointW * PX_PER_M_V)}"/>`;
    if (wobble)
      inner += `<path d="${wobble}" fill="none" stroke="${c.joint}" stroke-width="${n1(c.jointW * PX_PER_M_V)}" stroke-linejoin="round" opacity="0.85"/>`;
    if (light) inner += `<path d="${light}" fill="${shade(pan.fill, 1 + (c.paletteVar ?? 0) * BLOCK_SHADE_K)}"/>`;
    if (dark) inner += `<path d="${dark}" fill="${shade(pan.fill, 1 - (c.paletteVar ?? 0) * BLOCK_SHADE_K)}"/>`;
    if (straw) {
      // Teinte des brins ANCRÉE au fill du pan (mix vers la couleur de la recette) : la paille reste
      // de la paille sur le pan éclairé comme sur le pan dans l'ombre, sans rayures qui claquent.
      const t = det.tufts!;
      const col = mix(pan.fill, t.colors[hash32(seed, 'strawcol', pi) % t.colors.length], 0.55);
      inner += `<path d="${straw}" fill="none" stroke="${col}" stroke-width="0.7" stroke-linecap="round" opacity="0.55"/>`;
    }
    if (!inner) return;
    // CLIP au polygone du pan : les bardeaux du dernier rang meurent à l'égout, jamais au-delà —
    // id étiqueté par projection + identité de l'élément (planches QC multi-panneaux).
    const cid = `rfc-${projTag(dims)}-${el.key.replace(/[^a-zA-Z0-9_-]/g, '-')}-${pi}`;
    svg += `<clipPath id="${cid}"><path d="M${pan.pts.map((q) => `${q[0]},${q[1]}`).join(' L')} Z"/></clipPath><g clip-path="url(#${cid})">${inner}</g>`;
  });
  return svg;
}

/** Nappe iso/edge-on : pans projetés, triés ARRIÈRE→AVANT à l'écran — en iso le pan opposé à la caméra
 *  est presque de chant et REPLIE d'un cheveu par-dessus le faîte (montée 17 px > pas de profondeur
 *  16 px) ; le pan proche, peint après, recouvre ce repli. Rangs de tuiles (leur couleur/épaisseur vient
 *  de la recette du matériau), détail de couverture (LOD ≥ 1), puis crêtes par-dessus. */
function pansSvg(el: RoofEl, dims: Dims, opts?: DetailOpts): string {
  const sh = roofMaterial(el.material);
  const { lod, mpt } = detailOf(opts);
  const c = sh.detail?.courses;
  const pans: Pan[] = el.faces
    .map((f) => {
      const pts = f.poly.map((p) => projGP(p, dims));
      return { poly: f.poly, pts, fill: panFill(sh, f.material.part!), near: Math.max(...pts.map((p) => p[1])) };
    })
    .sort((a, b) => a.near - b.near);
  let svg = '';
  for (const p of pans)
    svg += `<path d="M${p.pts.map((q) => `${q[0]},${q[1]}`).join(' L')} Z" fill="${p.fill}" stroke="${p.fill}" stroke-width="${SEAM_W}" stroke-linejoin="round"/>`;
  // Rangs DROITS (lignes de niveau du builder) — le chaume les remplace par son tremblé dès le LOD 1.
  const wobbly = lod >= 1 && !!c && !c.blockWM && !!c.edgeWobble;
  if (c && !wobbly)
    for (const ln of el.lines) {
      if (ln.kind !== 'rang') continue;
      svg += lineSvg(projGP(ln.a, dims), projGP(ln.b, dims), c.joint, c.jointW * PX_PER_M_V);
    }
  if (lod >= 1 && sh.detail?.courses) svg += roofDetailSvg(el, pans, sh.detail, dims, lod as 1 | 2, mpt);
  for (const ln of el.lines) {
    if (ln.kind === 'rang') continue;
    const a = projGP(ln.a, dims);
    const b = projGP(ln.b, dims);
    if (ln.kind === 'faite' && sh.ridgeCap) {
      // COURONNEMENT : trait de base épais (ton `line`) + liseré clair par-dessus → crête volumique.
      svg += lineSvg(a, b, sh.line!, RIDGE_W);
      svg += lineSvg(a, b, sh.ridgeCap, RIDGE_CAP_W);
    } else {
      svg += lineSvg(a, b, sh.line!, ln.kind === 'egout' ? EGOUT_W : CREST_W);
    }
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
 *  étiquetée ; sinon nappe en pans continus (+ détail de couverture selon `zoom`/LOD). L'opacité de
 *  CUTAWAY est une décoration du stage. */
export function roofSvg(el: RoofEl, dims: Dims, opts?: DetailOpts & { plan?: boolean }): string {
  if (opts?.plan) return planCellsSvg(el, dims);
  if (isSquareView(dims.view)) return planBoxSvg(el, dims);
  return pansSvg(el, dims, opts);
}
