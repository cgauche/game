/**
 * BUILDER de MURS — produit les éléments `wall` du pivot (cf. ./types) : pour chaque `WallSeg` de la
 * scène, les FACES MONDE (GP : grille + MÈTRES) de son assemblage — courtine/panneau de face, plinthe/
 * bandes/arase, parapet + merlons, montants d'extrémité, embrasure/linteau de porte, barreaux +
 * traverses de herse, tas de gravats d'une structure ABATTUE — et les VÉRITÉS DE SCÈNE (visible/down/
 * open). TOUT vient des CHAMPS de l'apparence partagée (`wallApp`, def JSON iso+POV) : parapet/porte/
 * bois routés par la PRÉSENCE des champs, jamais par un id/type en dur. PUR et projection-agnostique :
 * remplace l'assemblage iso (ex-walls.ts) ET l'assemblage POV (ex-pov/geometry) — les DEUX backends
 * dessinent ces mêmes faces, chacun à sa résolution.
 */
import { heightAt, doorIsOpen, structureIsDown, type Scene, type WallSeg, type WallSide } from '../../state/scene';
import { wallApp, type StructureAppearanceDef, type WallPart } from '../catalog/structures';
import { WALL_H_M, isoPxToM } from '../iso';
import { METRES_PER_LEVEL } from '../../state/relief';
import type { Face, WallEl } from './types';
import type { FloorView } from './floors';

// ── Constantes de FORME (fractions de WALL_H / de l'arête, épaisseurs px-iso converties en mètres) ──
/** Ouverture d'une porte bois sans config de def. */
const DOOR_FRAC = 0.52;
/** Panneau bois encastré : tronçon [T0,T1] de l'arête × [LO,HI] de la hauteur ; moulure au sommet. */
const PANEL_T0 = 0.2, PANEL_T1 = 0.8, PANEL_LO = 0.2, PANEL_HI = 0.78;
const SKIRT_FRAC = 0.11; // plinthe
const CAP_FRAC = 0.86; // couronnement (bande haute)
const CAP_LIP_PX = 4; // lèvre du couronnement au-dessus du sommet
const FRAME_PX = 1.3; // épaisseur de la moulure (trait historique)
const CHAMBRANLE_PX = 4; // linteau de porte bois
const TRAVERSE_PX = 2; // traverse de fer d'une herse
/** Demi-largeur d'un BARREAU de herse (fraction d'arête) — l'affine retrace la ligne médiane (1.7 px). */
const BAR_HALF_T = 0.02;
/** Seuil d'éboulis d'un corps de garde ABATTU (fraction de WALL_H). */
const GATE_SILL_FRAC = 0.12;
/** Forme de BRÈCHE — UNE paramétrisation bois+pierre (fusion des deux jeux quasi identiques de
 *  l'ex-walls.ts, bois 0.3/0.36/0.64/0.5 ≈ pierre, écart ≤ ~1 px) : hauteur du tas + dentelure +
 *  moignons de poteau. */
const BREACH_H = 0.32, BREACH_M1 = 0.34, BREACH_M2 = 0.62, BREACH_POST_A = 0.7, BREACH_POST_B = 0.55;

type GXY = { x: number; y: number };

/** Extrémités A,B (coins de GRILLE, ±0.5) de l'arête d'un segment — l'aiguillage UNIQUE N/E/`\`/`/`
 *  (fusionne les ex-implémentations : walls.edgeEnds iso, pov segEnds/edgeFaceWorld/wallCornersWorld).
 *  Cardinales = les MÊMES coins que `tileEdge` (iso.ts) → un backend affine qui projette ces points
 *  retombe sur la géométrie d'arête historique ; le POV les multiplie par `mpt`. */
export function wallEnds(w: Pick<WallSeg, 'x' | 'y' | 'side'>): [GXY, GXY] {
  const { x, y } = w;
  switch (w.side) {
    case 'N': return [{ x: x - 0.5, y: y - 0.5 }, { x: x + 0.5, y: y - 0.5 }];
    case 'E': return [{ x: x + 0.5, y: y - 0.5 }, { x: x + 0.5, y: y + 0.5 }];
    case '\\': return [{ x: x - 0.5, y: y - 0.5 }, { x: x + 0.5, y: y + 0.5 }];
    default: return [{ x: x + 0.5, y: y - 0.5 }, { x: x - 0.5, y: y + 0.5 }]; // '/'
  }
}

/** Faces d'un segment, dans l'ORDRE DE PEINTURE (montant A, fond → détail, montant B). Hauteurs en
 *  MÈTRES depuis `b` (surface porteuse) ; les hauteurs px des defs passent par `isoPxToM` (une seule
 *  vérité px⇔m). Un montant (poteau/jambage) = 2 points [haut, bas] — le backend lui donne sa largeur
 *  (même convention que le pilier de sol). */
function wallFaces(seg: WallSeg, app: StructureAppearanceDef, b: number, down: boolean): Face[] {
  const [A, B] = wallEnds(seg);
  const at = (t: number): GXY => ({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t });
  const mat = (part: WallPart) => ({ domain: 'structure' as const, id: app.id, part });
  /** Quad vertical [A@haut, B@haut, B@bas, A@bas] sur le tronçon [t0,t1] de l'arête. */
  const span = (part: WallPart, t0: number, t1: number, hLo: number, hHi: number): Face => {
    const P0 = at(t0), P1 = at(t1);
    return { poly: [{ ...P0, h: hHi }, { ...P1, h: hHi }, { ...P1, h: hLo }, { ...P0, h: hLo }], material: mat(part) };
  };
  const slab = (part: WallPart, hLo: number, hHi: number): Face => span(part, 0, 1, hLo, hHi);
  const upright = (part: WallPart, t: number, hLo: number, hHi: number): Face => {
    const P = at(t);
    return { poly: [{ ...P, h: hHi }, { ...P, h: hLo }], material: mat(part) };
  };
  /** BRÈCHE (structure abattue) : tas de gravats dentelé laissant le passage + moignons de poteau. */
  const breach = (): Face[] => {
    const hr = WALL_H_M * BREACH_H;
    const heap: Face = {
      poly: [{ ...A, h: b }, { ...at(BREACH_M1), h: b + hr }, { ...at(BREACH_M2), h: b + hr * 0.7 }, { ...B, h: b }],
      material: mat('gravats-tas'),
    };
    return [slab('gravats', b, b + hr * 0.5), heap, upright('poteau', 0, b, b + hr * BREACH_POST_A), upright('poteau', 1, b, b + hr * BREACH_POST_B)];
  };

  const H1 = b + WALL_H_M; // sommet de la face pleine

  if (app.parapet) {
    // FORTIFICATION de pierre : courtine ferrée + couronne crénelée (parapet + ferrure + arase + merlons).
    const par = app.parapet;
    const P = par.heightLevelFrac * METRES_PER_LEVEL; // hauteur dressée du parapet (LEVEL_H·frac px ⇔ m)
    const bandLo = H1 + P * par.parapetBandFrac;
    const crest: Face[] = [
      slab('parapet', H1, H1 + P),
      slab('bande', bandLo, bandLo + isoPxToM(par.bandThickPx)),
      slab('arase', H1 + P - isoPxToM(par.arasePx), H1 + P),
    ];
    for (let i = 0; i < par.merlonCount; i += par.merlonStep)
      crest.push(span('merlon', i / par.merlonCount, (i + 1) / par.merlonCount, H1 + P, H1 + P + isoPxToM(par.merlonHeightPx)));

    if (app.door) {
      // CORPS DE GARDE : passage béant barré d'une herse (intacte) ou seuil d'éboulis (abattue) + linteau.
      const passage: Face[] = [];
      if (down) passage.push(slab('seuil', b, b + WALL_H_M * GATE_SILL_FRAC));
      else if (app.door.herse) {
        const h = app.door.herse;
        const top = b + WALL_H_M * h.topFrac;
        for (let k = 0; k <= h.bars; k++) {
          const t = k / h.bars;
          passage.push(span('herse-barreau', Math.max(0, t - BAR_HALF_T), Math.min(1, t + BAR_HALF_T), b, top));
        }
        for (const f of h.traverseFracs) passage.push(slab('herse-traverse', b + (top - b) * f, b + (top - b) * f + isoPxToM(TRAVERSE_PX)));
      }
      return [...passage, slab('linteau', H1 - isoPxToM(app.door.lintelPx), H1), ...crest];
    }
    if (down) return breach();
    return [
      upright('poteau', 0, b, H1 + P),
      slab('face', b, H1),
      ...par.bands.map((t) => slab('bande', b + WALL_H_M * t, b + WALL_H_M * t + isoPxToM(par.bandThickPx))),
      ...crest,
      upright('poteau', 1, b, H1 + P),
    ];
  }

  // MUR ORDINAIRE (bois) : panneau encadré + moulures + plinthe, ou porte ajourée (routée par le SEG).
  if (down) return breach();
  if (seg.door) {
    const op = WALL_H_M * (app.door?.openingFrac ?? DOOR_FRAC);
    return [
      upright('poteau', 0, b, H1),
      slab('embrasure', b, b + op),
      slab('face', b + op, H1),
      slab('chambranle', b + op, b + op + isoPxToM(CHAMBRANLE_PX)),
      slab('couronnement', b + WALL_H_M * CAP_FRAC, H1),
      upright('jambage', 0, b, b + op),
      upright('jambage', 1, b, b + op),
      upright('poteau', 1, b, H1),
    ];
  }
  const frameH = b + WALL_H_M * PANEL_HI;
  return [
    upright('poteau', 0, b, H1),
    slab('face', b, H1),
    span('panneau', PANEL_T0, PANEL_T1, b + WALL_H_M * PANEL_LO, frameH),
    span('moulure', PANEL_T0, PANEL_T1, frameH - isoPxToM(FRAME_PX / 2), frameH + isoPxToM(FRAME_PX / 2)),
    slab('plinthe', b, b + WALL_H_M * SKIRT_FRAC),
    slab('couronnement', b + WALL_H_M * CAP_FRAC, H1),
    slab('couronnement', H1, H1 + isoPxToM(CAP_LIP_PX)),
    upright('poteau', 1, b, H1),
  ];
}

/** Case VOISINE de l'autre côté de l'arête (diagonales : la case elle-même, comme l'historique). */
const NB: Record<WallSide, [number, number]> = { N: [0, -1], E: [1, 0], '\\': [0, 0], '/': [0, 0] };

/** Éléments `wall` de la scène. `view` ABSENT ⇒ toutes les couches (éditeur/QC/POV) ; sinon `viewZ`
 *  isole un étage (debug), sinon z ≤ activeZ (le jeu ne dresse pas les cloisons AU-DESSUS de la zone
 *  active). `visible` absent ⇒ tout visible ; sinon un mur est VISIBLE (dessiné AU-DESSUS du voile de
 *  brouillard) si l'une des DEUX cases bordant son arête est en vue. La hauteur de BASE est MÉTRIQUE
 *  (`heightAt`, la vérité POV historique — identique à l'ex-lift iso quand height = 4·z). */
export function buildWalls(scene: Scene, visible?: ReadonlySet<string>, view?: FloorView): WallEl[] {
  const activeZ = view?.activeZ ?? 0;
  const viewZ = view?.viewZ ?? null;
  const out: WallEl[] = [];
  for (const w of scene.walls ?? []) {
    const z = w.z ?? 0;
    if (view && (viewZ != null ? z !== viewZ : z > activeZ)) continue;
    const baseH = heightAt(scene, w.x, w.y, z);
    const app = wallApp(w, baseH);
    const down = !!w.structure && structureIsDown(scene, w);
    const open = !!w.door && doorIsOpen(scene, w);
    const [nx, ny] = NB[w.side];
    const vis = !visible || visible.has(`${w.x},${w.y},${z}`) || visible.has(`${w.x + nx},${w.y + ny},${z}`);
    const [A, B] = wallEnds(w);
    out.push({
      kind: 'wall',
      key: `wall:${w.x},${w.y},${w.side},${z}`,
      cell: { x: w.x, y: w.y, z },
      side: w.side,
      door: !!w.door,
      appearance: app.id,
      ends: [{ ...A, h: baseH }, { ...B, h: baseH }],
      faces: wallFaces(w, app, baseH, down),
      states: { visible: vis, down, open },
    });
  }
  return out;
}
