/**
 * BACKEND ÉCRAN-AFFINE des sols (iso losange · edge-on · vue du dessus) : dessine un élément `floor`
 * du pivot en SVG, en projetant sa géométrie GRILLE+MÈTRES via la projection partagée (`tileCenter`/
 * `diamondCorners`/`metricToLift`). La ROTATION caméra vit ENTIÈREMENT ici (le builder n'en sait rien) ;
 * l'ÉCLAIRAGE d'une paroi (face avant/arrière) est une vérité d'ÉCRAN → déduit ici de l'arête projetée.
 * Les couleurs viennent des matériaux JSON (`reliefMaterial`/`terrainGradient`) et de `shade.ts`.
 */
import { Dims, depth, diamondCorners, tileCenter } from '../iso';
import { metricToLift } from '../../state/relief';
import { terrainGradient } from '../catalog/terrain';
import { reliefMaterial } from '../catalog/relief';
import { shade, ao, warm, spec } from '../shade';
import type { CellSide, Face, FloorEl, GP } from '../builders/types';

/** Pied de rampe = nez de pente × ce facteur (ombrage doux du haut vers le bas). */
const SLOPE_BOT = 0.67;
/** Largeur ÉCRAN (px) d'un PILIER de support sous un tablier (montant vertical fin). */
const PILLAR_W = 5;

/** Profondeur de tri d'un sol : sa case (base ≫ z, cf. iso.ts) + offset de couche −0.5 → juste SOUS
 *  les objets de SA case (prop +0, jeton +0.5) tout en s'interclassant avec les voisins par sa vraie
 *  position écran (un sol haut surplombe localement le bas sans recouvrir la cour devant). */
export function floorDepth(el: FloorEl, dims: Dims): number {
  return depth(el.cell.x, el.cell.y, dims, el.cell.z) - 0.5;
}

type Pt2 = [number, number];
const polyPts = (pts: Pt2[]) => pts.map((p) => `${p[0]},${p[1]}`).join(' ');
const lerpP = (a: Pt2, b: Pt2, t: number): Pt2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Projette un point GRILLE+MÈTRES à l'écran — le SEUL pont monde→écran du backend. */
function proj(gp: GP, dims: Dims): Pt2 {
  const { cx, cy } = tileCenter(gp.x, gp.y, dims, metricToLift(gp.h));
  return [cx, cy];
}

/** Un MONTANT vertical fin (PILLAR_W) du haut (dessous de dalle) au bas (surface inférieure). */
function pillarSvg(f: Face, dims: Dims): string {
  const [top, bot] = f.poly.map((p) => proj(p, dims));
  const w = PILLAR_W / 2;
  const pts = `${top[0] - w},${top[1]} ${top[0] + w},${top[1]} ${bot[0] + w},${bot[1]} ${bot[0] - w},${bot[1]}`;
  return (
    `<polygon class="overhang-pillar" points="${pts}" fill="${reliefMaterial(f.material.id).face}" stroke="${ao(0.38)}" stroke-width="0.6"/>` +
    `<line x1="${top[0] - w}" y1="${top[1]}" x2="${bot[0] - w}" y2="${bot[1]}" stroke="${spec(0.12)}" stroke-width="0.8"/>`
  );
}

/** Paroi de relief (falaise/rampe/tablier) : quad projeté [haut-gauche, haut-droit, bas-droit,
 *  bas-gauche]. Face ÉCLAIRÉE si son arête HAUTE est devant (plus bas à l'écran) que le centre de la
 *  case — suit la rotation caméra. */
function reliefFaceSvg(f: Face, el: FloorEl, dims: Dims): string {
  const [tl, tr, br, bl] = f.poly.map((p) => proj(p, dims));
  const m = reliefMaterial(f.material.id);
  if (f.material.part === 'ramp') {
    // RAMPE (dénivelé ≤ STEP_MAX_M) : plan incliné LISSE — ombrage doux dégradé du haut (nez éclairé)
    // vers le bas (pied dans l'ombre), SANS marches discrètes → une pente franchissable à pied (≠ mur).
    const top = m.slopeTop!;
    const bot = shade(m.slopeTop!, SLOPE_BOT);
    const ml = lerpP(tl, bl, 0.5), mr = lerpP(tr, br, 0.5); // mi-pente (couture des deux bandes)
    return (
      `<polygon points="${polyPts([tl, tr, mr, ml])}" fill="${top}" stroke="${ao(0.16)}" stroke-width="0.4"/>` +
      `<polygon points="${polyPts([ml, mr, br, bl])}" fill="${bot}" stroke="${ao(0.16)}" stroke-width="0.4"/>` +
      `<line x1="${tl[0]}" y1="${tl[1]}" x2="${tr[0]}" y2="${tr[1]}" stroke="${warm(0.28)}" stroke-width="1.1"/>`
    );
  }
  const ctr = tileCenter(el.cell.x, el.cell.y, dims, metricToLift(f.poly[0].h));
  const lit = (tl[1] + tr[1]) / 2 >= ctr.cy; // l'arête haute est DEVANT (plus bas à l'écran) → face avant
  const fill = lit ? m.face : shade(m.face, m.shadeDark!);
  if (f.material.part === 'deck') {
    // DALLE FINE : bord d'un TABLIER de surplomb donnant sur le vide — ≠ falaise (pleine hauteur).
    return (
      `<polygon class="overhang-deck" points="${polyPts([tl, tr, br, bl])}" fill="${fill}" stroke="${ao(0.32)}" stroke-width="0.6"/>` +
      `<line x1="${tl[0]}" y1="${tl[1]}" x2="${tr[0]}" y2="${tr[1]}" stroke="${warm(0.22)}" stroke-width="1"/>`
    );
  }
  // FALAISE : paroi VERTICALE — face (claire si avant, sombre si arrière) + ombre au pied + arête vive.
  const foot = lit ? m.foot! : shade(m.foot!, m.shadeDark!);
  const fl = lerpP(tl, bl, 0.6), fr = lerpP(tr, br, 0.6); // bord haut de l'ombre de pied
  return (
    `<polygon class="elev-cliff" points="${polyPts([tl, tr, br, bl])}" fill="${fill}" stroke="${ao(0.3)}" stroke-width="0.6"/>` +
    `<polygon points="${polyPts([fl, fr, br, bl])}" fill="${foot}" opacity="0.85"/>` +
    (lit ? `<line x1="${tl[0]}" y1="${tl[1]}" x2="${tr[0]}" y2="${tr[1]}" stroke="${warm(0.22)}" stroke-width="1.1"/>` : '')
  );
}

/** Losange de base. Coins recomputés par `diamondCorners` (ordre ÉCRAN top→right→bot→left, invariant
 *  par rotation — le poly GRILLE tournerait son point de départ avec la caméra) : parité flottante
 *  exacte avec la projection historique ; les backends non-affines projettent `poly` directement. */
function groundFaceSvg(f: Face, el: FloorEl, dims: Dims): string {
  const { top, right, bot, left } = diamondCorners(el.cell.x, el.cell.y, dims, metricToLift(f.poly[0].h));
  return `<path d="M${top[0]},${top[1]} L${right[0]},${right[1]} L${bot[0]},${bot[1]} L${left[0]},${left[1]} Z" fill="url(#${terrainGradient(f.material.id)})" stroke="${ao(0.16)}"/>`;
}

const SCREEN_EDGE_IDX: Record<CellSide, number> = { N: 0, E: 1, S: 2, O: 3 };

/** Wedge de raccord de terrain. Le voisin est repéré en GRILLE (`side`), mais `diamondCorners` garde la
 *  tuile orientée-ÉCRAN (la rotation ne bouge que le centre) → on décale de `rot` crans (arêtes en ordre
 *  horaire depuis le haut-droit) pour que l'arête écran portant le wedge SUIVE la rotation caméra. */
function wedgeSvg(f: Face, el: FloorEl, dims: Dims): string {
  const { cx, cy, top, right, bot, left } = diamondCorners(el.cell.x, el.cell.y, dims, metricToLift(f.poly[0].h));
  const SCREEN_EDGES: Pt2[][] = [[top, right], [right, bot], [bot, left], [left, top]];
  const rot = dims.rot ?? 0;
  const [a, b] = SCREEN_EDGES[(SCREEN_EDGE_IDX[f.side!] - rot + 4) % 4];
  const ia = [a[0] + (cx - a[0]) * 0.4, a[1] + (cy - a[1]) * 0.4];
  const ib = [b[0] + (cx - b[0]) * 0.4, b[1] + (cy - b[1]) * 0.4];
  const d = `M${a[0]},${a[1]} L${b[0]},${b[1]} L${ib[0]},${ib[1]} L${ia[0]},${ia[1]} Z`;
  return `<path d="${d}" fill="url(#${terrainGradient(f.material.id)})" opacity="0.7"/>`;
}

/** SVG d'un élément de sol : faces dessinées DANS L'ORDRE du builder (piliers → parois → base → wedges). */
export function floorSvg(el: FloorEl, dims: Dims): string {
  let svg = '';
  for (const f of el.faces) {
    if (f.material.domain === 'relief') svg += f.material.part === 'pillar' ? pillarSvg(f, dims) : reliefFaceSvg(f, el, dims);
    else svg += f.material.part === 'wedge' ? wedgeSvg(f, el, dims) : groundFaceSvg(f, el, dims);
  }
  return svg;
}
