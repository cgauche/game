/**
 * BACKEND ÉCRAN-AFFINE des murs (iso losange · edge-on · vue du dessus) : dessine un élément `wall`
 * du pivot en SVG, en projetant ses faces GRILLE+MÈTRES via le pont partagé (`projGP`). La ROTATION
 * caméra vit ici ; l'OMBRAGE d'orientation (arête N dans l'ombre) et les traits/liserés (dérivés de la
 * couleur de face via `shade.ts`) aussi. Les couleurs de base viennent de la def JSON par `wallPartColor`
 * (source unique avec le POV). La vue du DESSUS ('top') est la représentation SYMBOLIQUE historique
 * (traits épais / glyphe de porte), routée par `isSquareView` — elle se trace sur `el.ends`, pas les faces.
 */
import { CELL, depth, diamondPath, isSquareView, tileCenter, type Dims } from '../iso';
import { metricToLift } from '../../state/relief';
import { structureAppearance, wallPartColor, type StructureAppearanceDef, type WallPart } from '../catalog/structures';
import { shade, SIDE_N, SIDE_LIT, POST_CAP, POST_BASE } from '../shade';
import type { Face, WallEl } from '../builders/types';
import { projGP, type Pt2 } from './project';

// Facteurs d'ombrage et épaisseurs ÉCRAN (px) des ornements — des formes, jamais des identités de couleur.
const OUTLINE = 0.4; // liseré d'arête sombre dérivé de la face
const JAMBCAP = 1.25; // chapiteau de jambage clair (repli sans couleur de def)
const EMBRASURE_OPACITY = 0.42;
const POST_W = 3.8, POST_CAP_H = 2.4, POST_BASE_H = 3; // montant d'extrémité
const JAMB_W = 3.6, JAMB_CAP_H = 1.8; // jambage de porte
const FRAME_W = 1.3, BAR_W = 1.7; // moulure bois / barreau de herse (lignes médianes)

/** Parties BOIS ombrées par ORIENTATION (arête N assombrie) — mêmes que l'ex-houseWallIso. `shade` est
 *  un no-op sur les `var(--x)` pierre : la pierre garde ses tons bruts, comme l'historique. */
const TINTED: ReadonlySet<WallPart> = new Set(['face', 'panneau', 'moulure', 'plinthe', 'couronnement']);

/** Profondeur de tri : MAX sur les deux cases bordant l'arête → le mur reste devant son sol proche aux
 *  4 rotations ; vue du dessus symbolique : +0.6 (au-dessus des overlays de sol), comme l'historique. */
export function wallDepth(el: WallEl, dims: Dims): number {
  const { x, y, z } = el.cell;
  const cells: [number, number][] = el.side === 'E' ? [[x, y], [x + 1, y]] : el.side === 'N' ? [[x, y], [x, y - 1]] : [[x, y]];
  return Math.max(...cells.map(([cx, cy]) => depth(cx, cy, dims, z))) + 0.45 + (isSquareView(dims.view) ? 0.6 : 0);
}

const polyPts = (pts: Pt2[]) => pts.map((p) => `${p[0]},${p[1]}`).join(' ');
const mid = (a: Pt2, b: Pt2): Pt2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const line = (a: Pt2, b: Pt2, color: string, w: number) =>
  `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${w}"/>`;
const strokeAttr = (color: string, w: number) => ` stroke="${color}" stroke-width="${w}"`;

/** Montant plein (poteau) du haut [0] au bas [1] : rect + chapiteau clair + socle sombre. */
function postSvg(top: Pt2, bot: Pt2, app: StructureAppearanceDef): string {
  const x = top[0] - POST_W / 2;
  return `<rect x="${x}" y="${top[1]}" width="${POST_W}" height="${bot[1] - top[1]}" fill="${app.post}"/>` +
    `<rect x="${x}" y="${top[1]}" width="${POST_W}" height="${POST_CAP_H}" fill="${shade(app.post, POST_CAP)}"/>` +
    `<rect x="${x}" y="${bot[1] - POST_BASE_H}" width="${POST_W}" height="${POST_BASE_H}" fill="${shade(app.post, POST_BASE)}"/>`;
}

/** Jambage de porte (montant fin aux couleurs de la def de porte, repli dérivé de la face). */
function jambSvg(top: Pt2, bot: Pt2, app: StructureAppearanceDef): string {
  const x = top[0] - JAMB_W / 2;
  return `<rect x="${x}" y="${top[1]}" width="${JAMB_W}" height="${bot[1] - top[1]}" fill="${wallPartColor(app, 'jambage')}"/>` +
    `<rect x="${x}" y="${top[1]}" width="${JAMB_W}" height="${JAMB_CAP_H}" fill="${app.door?.jambCap ?? shade(app.face, JAMBCAP)}"/>`;
}

/** Une face du pivot en SVG. Quads = polygones remplis (+ liseré par partie) ; montants (2 points) =
 *  rects de largeur fixe ; moulure/barreau = leur LIGNE MÉDIANE (trait historique 1.3/1.7 px). */
function faceSvg(f: Face, app: StructureAppearanceDef, tintK: number, dims: Dims): string {
  const part = f.material.part as WallPart;
  const p = f.poly.map((gp) => projGP(gp, dims));
  if (part === 'poteau') return postSvg(p[0], p[1], app);
  if (part === 'jambage') return jambSvg(p[0], p[1], app);
  if (part === 'moulure') return line(mid(p[0], p[3]), mid(p[1], p[2]), shade(wallPartColor(app, part), tintK), FRAME_W);
  if (part === 'herse-barreau') return line(mid(p[2], p[3]), mid(p[0], p[1]), wallPartColor(app, part), BAR_W);
  const base = wallPartColor(app, part);
  const fill = TINTED.has(part) ? shade(base, tintK) : base;
  let extra = '';
  if (part === 'face') extra = app.parapet ? strokeAttr(app.band ?? app.face, 0.8) : strokeAttr(shade(app.face, OUTLINE), 0.7);
  else if (part === 'parapet' || part === 'linteau') extra = strokeAttr(app.band ?? app.face, 0.8);
  else if (part === 'chambranle') extra = strokeAttr(shade(app.face, OUTLINE), 0.5);
  else if (part === 'gravats-tas') extra = strokeAttr(app.band ?? shade(app.face, OUTLINE), 0.6);
  else if (part === 'embrasure') extra = ` opacity="${EMBRASURE_OPACITY}"`;
  return `<polygon points="${polyPts(p)}" fill="${fill}"${extra}/>`;
}

/** Vue du DESSUS symbolique : trait épais sur l'arête (courtine ferrée / mur bois / brèche en tirets),
 *  porte bois = deux jambages, corps de garde = case pleine + glyphe de herse. */
function topSvg(el: WallEl, app: StructureAppearanceDef, dims: Dims): string {
  const [a, b] = el.ends.map((gp) => projGP(gp, dims));
  const seg = (p: Pt2, q: Pt2, w: number, col: string, dash?: string) =>
    `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const lerp = (t: number): Pt2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  if (app.parapet) {
    if (el.states.down) return `<g>${seg(a, b, 6, app.rubble ?? app.face, '3 5')}</g>`;
    if (app.door) {
      const lift = metricToLift(el.ends[0].h);
      const { cx, cy } = tileCenter(el.cell.x, el.cell.y, dims, lift);
      const h = CELL / 2;
      let glyph = `<rect x="${cx - h * 0.46}" y="${cy - h}" width="${h * 0.92}" height="${2 * h}" fill="${app.recess ?? app.face}"/>`;
      for (let i = 1; i <= 3; i++) {
        const ly = cy - h + 2 * h * (i / 4);
        glyph += `<line x1="${cx - h * 0.46}" y1="${ly}" x2="${cx + h * 0.46}" y2="${ly}" stroke="${app.cap ?? app.face}" stroke-width="1.6"/>`;
      }
      return `<g><path d="${diamondPath(el.cell.x, el.cell.y, dims, lift)}" fill="${app.face}" stroke="${app.band ?? app.face}" stroke-width="2.5"/>${glyph}</g>`;
    }
    return `<g>${seg(a, b, 11, app.band ?? app.face) + seg(a, b, 7, app.face)}</g>`;
  }
  if (el.states.down) return `<g>${seg(a, b, 5, app.face, '3 5')}</g>`;
  if (el.door) return `<g>${seg(a, lerp(0.3), 7, shade(app.post, POST_CAP)) + seg(lerp(0.7), b, 7, shade(app.post, POST_CAP))}</g>`;
  return `<g>${seg(a, b, 8, shade(app.face, OUTLINE)) + seg(a, b, 5, app.face)}</g>`;
}

/** SVG d'un élément de mur : iso/edge-on = faces dans l'ORDRE DE PEINTURE du builder, ombrées par
 *  l'orientation MONDE de l'arête ; vue du dessus = représentation symbolique. */
export function wallSvg(el: WallEl, dims: Dims): string {
  const app = structureAppearance(el.appearance);
  if (isSquareView(dims.view)) return topSvg(el, app, dims);
  const tintK = el.side === 'N' ? SIDE_N : SIDE_LIT;
  return `<g>${el.faces.map((f) => faceSvg(f, app, tintK, dims)).join('')}</g>`;
}
