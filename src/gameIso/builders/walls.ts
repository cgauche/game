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
import { heightAt, doorIsOpen, structureIsDown, rampartAt, isRampart, rampAccessAcross, structureAt, edgeOf, tileAt, type Scene, type WallSeg, type WallSide } from '../../state/scene';
import { terrainSolidHeightM } from '../../state/terrain';
import { wallApp, structureAppearance, type StructureAppearanceDef, type WallPart } from '../catalog/structures';
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

/** COURONNE crénelée (parapet dressé + ferrure + arase + merlons) posée à partir de la hauteur `baseH`,
 *  le long de l'arête A→B. SOURCE UNIQUE : (a) le sommet d'une fortification `wallFaces` (baseH = haut de
 *  la face pleine) ET (b) la crête de PÉRIMÈTRE d'une zone rempart (baseH = surface de la zone). Merlons =
 *  1 tronçon / `merlonStep` (fraction 0..1 de CETTE arête → motif périodique par case). */
export function crownFaces(app: StructureAppearanceDef, A: GXY, B: GXY, baseH: number): Face[] {
  const par = app.parapet;
  if (!par) return [];
  const at = (t: number): GXY => ({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t });
  const mat = (part: WallPart) => ({ domain: 'structure' as const, id: app.id, part });
  const span = (part: WallPart, t0: number, t1: number, hLo: number, hHi: number): Face => {
    const P0 = at(t0), P1 = at(t1);
    return { poly: [{ ...P0, h: hHi }, { ...P1, h: hHi }, { ...P1, h: hLo }, { ...P0, h: hLo }], material: mat(part) };
  };
  const slab = (part: WallPart, hLo: number, hHi: number): Face => span(part, 0, 1, hLo, hHi);
  const P = par.heightLevelFrac * METRES_PER_LEVEL; // hauteur dressée du parapet (LEVEL_H·frac px ⇔ m)
  const bandLo = baseH + P * par.parapetBandFrac;
  const crest: Face[] = [
    slab('parapet', baseH, baseH + P),
    slab('bande', bandLo, bandLo + isoPxToM(par.bandThickPx)),
    slab('arase', baseH + P - isoPxToM(par.arasePx), baseH + P),
  ];
  for (let i = 0; i < par.merlonCount; i += par.merlonStep)
    crest.push(span('merlon', i / par.merlonCount, (i + 1) / par.merlonCount, baseH + P, baseH + P + isoPxToM(par.merlonHeightPx)));
  return crest;
}

/** Faces d'un segment, dans l'ORDRE DE PEINTURE (montant A, fond → détail, montant B). Hauteurs en
 *  MÈTRES depuis `b` (surface porteuse). `wallHeightM` = hauteur de la face PLEINE (défaut `WALL_H_M` ≈
 *  2,25 m ; une PORTE/courtine de rempart passe le DROP de la zone, ex. 4 m, pour monter jusqu'au chemin
 *  de ronde). Les hauteurs px des defs passent par `isoPxToM` (une seule vérité px⇔m). Un montant
 *  (poteau/jambage) = 2 points [haut, bas] — le backend lui donne sa largeur. */
function wallFaces(seg: WallSeg, app: StructureAppearanceDef, b: number, down: boolean, wallHeightM = WALL_H_M): Face[] {
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
    const hr = wallHeightM * BREACH_H;
    const heap: Face = {
      poly: [{ ...A, h: b }, { ...at(BREACH_M1), h: b + hr }, { ...at(BREACH_M2), h: b + hr * 0.7 }, { ...B, h: b }],
      material: mat('gravats-tas'),
    };
    return [slab('gravats', b, b + hr * 0.5), heap, upright('poteau', 0, b, b + hr * BREACH_POST_A), upright('poteau', 1, b, b + hr * BREACH_POST_B)];
  };

  const H1 = b + wallHeightM; // sommet de la face pleine

  if (app.parapet) {
    // FORTIFICATION de pierre : courtine ferrée + couronne crénelée (parapet + ferrure + arase + merlons).
    const par = app.parapet;
    const P = par.heightLevelFrac * METRES_PER_LEVEL; // hauteur dressée du parapet (poteaux montant à H1+P)
    const crest = crownFaces(app, A, B, H1);

    if (app.door) {
      // CORPS DE GARDE : passage béant barré d'une herse (intacte) ou seuil d'éboulis (abattue) + linteau.
      const passage: Face[] = [];
      if (down) passage.push(slab('seuil', b, b + wallHeightM * GATE_SILL_FRAC));
      else if (app.door.herse) {
        const h = app.door.herse;
        const top = b + wallHeightM * h.topFrac;
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
      ...par.bands.map((t) => slab('bande', b + wallHeightM * t, b + wallHeightM * t + isoPxToM(par.bandThickPx))),
      ...crest,
      upright('poteau', 1, b, H1 + P),
    ];
  }

  // MUR ORDINAIRE (bois) : panneau encadré + moulures + plinthe, ou porte ajourée (routée par le SEG).
  if (down) return breach();
  if (seg.door) {
    const op = wallHeightM * (app.door?.openingFrac ?? DOOR_FRAC);
    return [
      upright('poteau', 0, b, H1),
      slab('embrasure', b, b + op),
      slab('face', b + op, H1),
      slab('chambranle', b + op, b + op + isoPxToM(CHAMBRANLE_PX)),
      slab('couronnement', b + wallHeightM * CAP_FRAC, H1),
      upright('jambage', 0, b, b + op),
      upright('jambage', 1, b, b + op),
      upright('poteau', 1, b, H1),
    ];
  }
  const frameH = b + wallHeightM * PANEL_HI;
  return [
    upright('poteau', 0, b, H1),
    slab('face', b, H1),
    span('panneau', PANEL_T0, PANEL_T1, b + wallHeightM * PANEL_LO, frameH),
    span('moulure', PANEL_T0, PANEL_T1, frameH - isoPxToM(FRAME_PX / 2), frameH + isoPxToM(FRAME_PX / 2)),
    slab('plinthe', b, b + wallHeightM * SKIRT_FRAC),
    slab('couronnement', b + wallHeightM * CAP_FRAC, H1),
    slab('couronnement', H1, H1 + isoPxToM(CAP_LIP_PX)),
    upright('poteau', 1, b, H1),
  ];
}

/** Case VOISINE de l'autre côté de l'arête (diagonales : la case elle-même, comme l'historique). */
const NB: Record<WallSide, [number, number]> = { N: [0, -1], E: [1, 0], '\\': [0, 0], '/': [0, 0] };

// ── ZONE REMPART (surélevée solide) — dérivation du PÉRIMÈTRE (générale, toute forme, opt-in donnée) ──
type Card = 'N' | 'E' | 'S' | 'O';
const CARD: Card[] = ['N', 'E', 'S', 'O'];
const CARD_NB: Record<Card, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], O: [-1, 0] };

/** Hauteur d'AFFICHAGE d'une case (surface + bloc plein éventuel) — miroir de `floors.displayHeightAt`. */
function dispH(scene: Scene, x: number, y: number, z: number): number {
  return heightAt(scene, x, y, z) + terrainSolidHeightM(tileAt(scene, x, y, z));
}

/** L'arête CANONIQUE (ex,ey,side N/E) sépare-t-elle une zone rempart d'une non-zone à un étage `l.z` ? →
 *  arête de PÉRIMÈTRE : sa maçonnerie/crête est fournie par le RENDU DE ZONE (falaise `floorFaces` + crête
 *  synthétique), donc le `WallSeg` gameplay coïncidant ne dessine PAS son visuel (il resterait enseveli /
 *  doublonnerait). PUR — scanne toutes les couches (le mur est en z0, la zone en z1). */
export function isRampartPerimeterEdge(scene: Scene, ex: number, ey: number, side: 'N' | 'E'): boolean {
  const [nx, ny] = side === 'N' ? [ex, ey - 1] : [ex + 1, ey];
  return scene.layers.some((l) => isRampart(scene, ex, ey, l.z) !== isRampart(scene, nx, ny, l.z));
}

/** Structure d'arête (porte/courtine/brèche) SOUS une zone rempart de niveau `zoneZ` (le mur monte de son
 *  étage jusqu'au chemin de ronde). Scanne z de `zoneZ-1` à 0. */
function structureUnder(scene: Scene, ex: number, ey: number, side: 'N' | 'E', zoneZ: number): WallSeg | undefined {
  for (let zz = zoneZ - 1; zz >= 0; zz--) {
    const s = structureAt(scene, ex, ey, side, zz);
    if (s) return s;
  }
  return undefined;
}

/** Éléments `wall` SYNTHÉTIQUES d'une zone rempart : pour chaque arête de PÉRIMÈTRE d'une tuile de zone
 *  (voisin même-z hors zone, avec une VRAIE falaise — pas un accès franchissable type rampe), soit
 *  l'OUVERTURE pleine hauteur d'une structure sous-jacente (porte/courtine/brèche via `wallFaces` mis à
 *  l'échelle du DROP de la zone), soit la seule CRÊTE crénelée (`crownFaces`, la face de maçonnerie
 *  venant de la falaise `floorFaces`). Créneaux CEINTURANT la zone, jamais à l'intérieur (les arêtes
 *  internes sont ignorées). Générique : toute forme/taille, aucune constante de scène. */
export function rampartWallEls(scene: Scene, visible?: ReadonlySet<string>, view?: FloorView): WallEl[] {
  const viewZ = view?.viewZ ?? null;
  const { w, h } = scene.dimensions;
  const out: WallEl[] = [];
  for (const l of scene.layers) {
    if (viewZ != null && l.z !== viewZ) continue; // isolement debug d'un étage
    const z = l.z;
    if (!l.rampart) continue;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const appId = rampartAt(scene, x, y, z);
        if (!appId) continue;
        const surfaceH = heightAt(scene, x, y, z);
        for (const side of CARD) {
          const [dx, dy] = CARD_NB[side];
          const nx = x + dx, ny = y + dy;
          if (isRampart(scene, nx, ny, z)) continue; // arête INTERNE → ni face ni crête
          if (rampAccessAcross(scene, x, y, z, side)) continue; // accès (rampe/escalier atteint la zone) → arête ouverte
          const e = edgeOf(x, y, nx, ny);
          if (!e) continue;
          const struct = structureUnder(scene, e.x, e.y, e.side, z);
          const [A, B] = wallEnds({ x: e.x, y: e.y, side: e.side });
          const vis = !visible || visible.has(`${x},${y},${z}`);
          const key = `rampart:${e.x},${e.y},${e.side},${z}`;
          if (struct?.structure) {
            // OUVERTURE / face pleine du mur gameplay, montée jusqu'au chemin de ronde (base = sol voisin).
            const base = dispH(scene, nx, ny, z);
            const sApp = structureAppearance(struct.structure);
            const down = structureIsDown(scene, struct);
            out.push({
              kind: 'wall', key, cell: { x: e.x, y: e.y, z }, side: e.side, door: false, appearance: sApp.id,
              ends: [{ ...A, h: surfaceH }, { ...B, h: surfaceH }],
              faces: wallFaces({ ...struct, x: e.x, y: e.y, side: e.side }, sApp, base, down, surfaceH - base),
              states: { visible: vis, down, open: false },
            });
          } else {
            // CRÊTE seule (la falaise `floorFaces` porte la face de maçonnerie de périmètre).
            const cApp = structureAppearance(appId);
            out.push({
              kind: 'wall', key, cell: { x: e.x, y: e.y, z }, side: e.side, door: false, appearance: cApp.id,
              ends: [{ ...A, h: surfaceH }, { ...B, h: surfaceH }],
              faces: crownFaces(cApp, A, B, surfaceH),
              states: { visible: vis, down: false, open: false },
            });
          }
        }
      }
  }
  return out;
}

/** Éléments `wall` de la scène. `view` ABSENT ⇒ toutes les couches (éditeur/QC/POV) ; sinon `viewZ`
 *  isole un étage (debug), sinon z ≤ activeZ (le jeu ne dresse pas les cloisons AU-DESSUS de la zone
 *  active). `visible` absent ⇒ tout visible ; sinon un mur est VISIBLE (dessiné AU-DESSUS du voile de
 *  brouillard) si l'une des DEUX cases bordant son arête est en vue. La hauteur de BASE est MÉTRIQUE
 *  (`heightAt`, la vérité POV historique — identique à l'ex-lift iso quand height = 4·z). Les crêtes/
 *  ouvertures de ZONE REMPART sont AJOUTÉES (`rampartWallEls`) et les `WallSeg` de périmètre coïncidants
 *  NE dessinent PAS leur visuel (la zone les remplace ; ils restent gameplay-seuls). */
export function buildWalls(scene: Scene, visible?: ReadonlySet<string>, view?: FloorView): WallEl[] {
  const activeZ = view?.activeZ ?? 0;
  const viewZ = view?.viewZ ?? null;
  const out: WallEl[] = [];
  for (const w of scene.walls ?? []) {
    const z = w.z ?? 0;
    if (view && (viewZ != null ? z !== viewZ : z > activeZ)) continue;
    // Arête de PÉRIMÈTRE d'une zone rempart (N/E canoniques) → visuel fourni par la zone, on saute.
    if ((w.side === 'N' || w.side === 'E') && isRampartPerimeterEdge(scene, w.x, w.y, w.side)) continue;
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
  out.push(...rampartWallEls(scene, visible, view));
  return out;
}
