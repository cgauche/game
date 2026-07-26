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
import { heightAt, doorIsOpen, structureIsDown, crenellatedAt, isCrenellated, isWalkable, structureAt, edgeOf, type FacadeFeature, type Scene, type WallSeg, type WallSide } from '../../state/scene';
import { sceneZoneTiles } from '../../state/zones';
import { memoByRef } from '../../state/sceneMemo';
import { wallApp, structureAppearance, type StructureAppearanceDef, type WallPart } from '../catalog/structures';
import { facadeStructureAppearance, facadeWallFeatureAppearance } from '../catalog/facades';
import { WALL_H_M, isoPxToM } from '../iso';
import { METRES_PER_LEVEL, gradeBetween } from '../../state/relief';
import type { Face, GP, WallEl } from './types';
import type { FloorView } from './floors';
import { gableEnds, massFootprintCells, resolveMass, roofHeightAt, type RoofShapeSpec } from './roofs';

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
// VANTAIL d'une porte FERMÉE : panneau bois entre les jambages [LEAF_T0,LEAF_T1], 3 joints de planches
// verticaux (demi-largeur PLANK_HALF_T) et une poignée [HANDLE_T0,HANDLE_T1] à mi-hauteur.
const LEAF_T0 = 0.16, LEAF_T1 = 0.84, PLANK_HALF_T = 0.012;
const PLANK_TS = [0.34, 0.5, 0.66]; // positions des joints de planches (fraction d'arête)
const HANDLE_T0 = 0.74, HANDLE_T1 = 0.8, HANDLE_LO = 0.42, HANDLE_HI = 0.56; // poignée
// FENÊTRE (croisée) = vraie OUVERTURE dans la face : carreau AJOURÉ [WIN_T0,WIN_T1]×[WIN_LO,WIN_HI]
// (fraction d'arête × de WALL_H), encadré par les morceaux de `face`, meneau + traverse (demi-tailles).
const WIN_T0 = 0.3, WIN_T1 = 0.7, WIN_LO = 0.42, WIN_HI = 0.8;
const MULLION_HALF_T = 0.02, MULLION_HALF_PX = 2;
const TRAVERSE_PX = 2; // traverse de fer d'une herse
/** Demi-largeur d'un BARREAU de herse (fraction d'arête) — l'affine retrace la ligne médiane (1.7 px). */
const BAR_HALF_T = 0.02;
/** Seuil d'éboulis d'un corps de garde ABATTU (fraction de WALL_H). */
const GATE_SILL_FRAC = 0.12;
/** Forme de BRÈCHE — UNE paramétrisation bois+pierre (fusion des deux jeux quasi identiques de
 *  l'ex-walls.ts, bois 0.3/0.36/0.64/0.5 ≈ pierre, écart ≤ ~1 px) : hauteur du tas + dentelure +
 *  moignons de poteau. */
const BREACH_H = 0.32, BREACH_M1 = 0.34, BREACH_M2 = 0.62, BREACH_POST_A = 0.7, BREACH_POST_B = 0.55;
/** Tolérance de comparaison de hauteurs (m) — sauts de toiture réputés coplanaires en-deçà (`roofSeamEls`). */
const EPS = 1e-9;

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
function wallFaces(seg: WallSeg, app: StructureAppearanceDef, b: number, down: boolean, wallHeightM = WALL_H_M, open = false): Face[] {
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
    // OUVERTE → embrasure béante (le passage se voit) ; FERMÉE → VANTAIL (panneau + planches + poignée)
    // pour que la porte se LISE comme une porte, pas comme un trou.
    const leaf: Face[] = open
      ? [slab('embrasure', b, b + op)]
      : [
          span('vantail', LEAF_T0, LEAF_T1, b, b + op),
          ...PLANK_TS.map((t) => span('vantail-planche', t - PLANK_HALF_T, t + PLANK_HALF_T, b, b + op)),
          span('poignee', HANDLE_T0, HANDLE_T1, b + op * HANDLE_LO, b + op * HANDLE_HI),
        ];
    return [
      upright('poteau', 0, b, H1),
      ...leaf,
      slab('face', b + op, H1),
      slab('chambranle', b + op, b + op + isoPxToM(CHAMBRANLE_PX)),
      slab('couronnement', b + wallHeightM * CAP_FRAC, H1),
      upright('jambage', 0, b, b + op),
      upright('jambage', 1, b, b + op),
      upright('poteau', 1, b, H1),
    ];
  }
  if (seg.window) {
    // FENÊTRE : vraie OUVERTURE — le mur est un CADRE de `face` (trumeau bas + linteau haut + 2 jambages)
    // autour du vide vitré, et la vitre est TRANSPARENTE → on VOIT l'intérieur derrière (le mur reste
    // opaque à la MÉCANIQUE — vision/passage inchangés). Croisée : cadre → vitre → meneau + traverse.
    const winLo = b + wallHeightM * WIN_LO, winHi = b + wallHeightM * WIN_HI;
    const midT = (WIN_T0 + WIN_T1) / 2, midV = (winLo + winHi) / 2;
    const mpx = isoPxToM(MULLION_HALF_PX);
    return [
      upright('poteau', 0, b, H1),
      slab('face', b, winLo), // trumeau sous la fenêtre
      slab('face', winHi, H1), // linteau au-dessus
      span('face', 0, WIN_T0, winLo, winHi), // jambage gauche
      span('face', WIN_T1, 1, winLo, winHi), // jambage droit
      // (plus de `croisee-cadre` PLEIN derrière la vitre : il bouchait l'ouverture — les jambages/trumeau/
      //  linteau encadrent déjà le carreau ; la croisée = meneau + traverse par-dessus le vide vitré.)
      span('vitre', WIN_T0, WIN_T1, winLo, winHi),
      span('meneau', midT - MULLION_HALF_T, midT + MULLION_HALF_T, winLo, winHi), // meneau vertical
      span('meneau', WIN_T0, WIN_T1, midV - mpx, midV + mpx), // traverse horizontale
      slab('plinthe', b, b + wallHeightM * SKIRT_FRAC),
      slab('couronnement', b + wallHeightM * CAP_FRAC, H1),
      slab('couronnement', H1, H1 + isoPxToM(CAP_LIP_PX)),
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

const edgeKey = (edge: Pick<WallSeg, 'x' | 'y' | 'side' | 'z'>): string =>
  `${edge.x},${edge.y},${edge.side},${edge.z ?? 0}`;

const xyKey = (x: number, y: number) => `${x},${y}`;

/** ENVELOPPE extérieure d'un bâtiment (#818) : une arête `WallSeg` en est une seulement si la case
 *  D'EN FACE (l'autre côté de l'arête, `NB`) est le DEHORS — jamais « une autre pièce ». Le dehors =
 *  case n'appartenant à AUCUNE zone INTÉRIEURE (`SceneEffectZone.presentation:'interior'`, même notion
 *  que `zoneTiles` de `stage/architectureVisibility.ts`) ET hors de l'emprise BÂTIE d'une masse (le
 *  VOLUME du corps, PAS sa couverture de toit — #825bis : un avant-toit déborde le mur PAR
 *  CONSTRUCTION, la case qu'il surplombe reste DEHORS ; confondre « sous un toit » et « à l'intérieur »
 *  neutralisait 31 arêtes d'étage sur 58 côté La Diligence, mur en alternance visible/invisible). Une
 *  masse à plusieurs niveaux bâtit TOUS les étages qu'elle porte (`z − levels + 1 … z`), pas seulement
 *  son plancher sommet. Un donjon 100 % intérieur n'a AUCUN dehors → AUCUNE arête n'est enveloppe, le
 *  brouillard y reste inchangé — piège vérifié par un test dédié (walls.test.ts). Mémoïsé PAR SCÈNE
 *  (`memoByRef`, patron canonique unique) : une scène immuable ne recalcule jamais deux fois. */
const envelopeEdgesOf = memoByRef((scene: Scene): ReadonlySet<string> => {
  const interiorByZ = new Map<number, Set<string>>();
  for (const zone of scene.effectZones ?? []) {
    if (zone.presentation !== 'interior') continue;
    const z = zone.z ?? 0;
    const set = interiorByZ.get(z) ?? (interiorByZ.set(z, new Set()).get(z)!);
    for (const tile of sceneZoneTiles(zone)) set.add(xyKey(tile.x, tile.y));
  }
  const builtByZ = new Map<number, Set<string>>();
  const build = (z: number, x: number, y: number) => {
    const set = builtByZ.get(z) ?? (builtByZ.set(z, new Set()).get(z)!);
    set.add(xyKey(x, y));
  };
  for (const body of scene.architecture ?? [])
    for (const mass of body.masses) {
      const cells = massFootprintCells(mass.footprint);
      for (const key of cells) {
        const [x, y] = key.split(',').map(Number);
        for (let z = mass.z - mass.levels + 1; z <= mass.z; z++) build(z, x, y);
      }
    }
  const isDehors = (x: number, y: number, z: number) =>
    !interiorByZ.get(z)?.has(xyKey(x, y)) && !builtByZ.get(z)?.has(xyKey(x, y));

  const out = new Set<string>();
  for (const w of scene.walls ?? []) {
    const z = w.z ?? 0;
    const [nx, ny] = NB[w.side];
    if (isDehors(w.x, w.y, z) !== isDehors(w.x + nx, w.y + ny, z)) out.add(edgeKey(w));
  }
  return out;
});

interface FacadeEdge {
  bodyId: string;
  sectionId: string;
  appearance: string;
  roomZoneIds?: string[];
  features: FacadeFeature[];
}

function facadeEdges(scene: Scene): ReadonlyMap<string, FacadeEdge> {
  const indexed = new Map<string, FacadeEdge>();
  for (const body of scene.architecture ?? []) {
    for (const section of body.facades) {
      for (const edge of section.edges) {
        const key = edgeKey({ ...edge, z: edge.z ?? section.z });
        if (!indexed.has(key)) {
          indexed.set(key, {
            bodyId: body.id,
            sectionId: section.id,
            appearance: section.appearance,
            ...(section.roomZoneIds ? { roomZoneIds: [...section.roomZoneIds] } : {}),
            features: (section.features ?? []).filter((feature) =>
              edgeKey({ ...feature.edge, z: feature.edge.z ?? section.z }) === key),
          });
        }
      }
    }
  }
  return indexed;
}

function facadeFeatureFaces(
  seg: WallSeg,
  facade: FacadeEdge,
  baseH: number,
  down: boolean,
): Face[] {
  if (down) return [];
  const [a, b] = wallEnds(seg);
  const at = (t: number): GXY => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  const out: Face[] = [];
  for (const feature of facade.features) {
    if (feature.kind === 'chimney') continue;
    if (feature.kind === 'window-band' && seg.window) continue;
    const appearance = feature.appearance ??
      facadeWallFeatureAppearance(facade.appearance, feature.kind);
    if (!appearance) continue;
    const id = `${facade.bodyId}:${facade.sectionId}:${feature.id}`;
    const center = feature.offset ?? 0.5;
    const width = feature.width ?? 0.6;
    const t0 = center - width / 2;
    const t1 = center + width / 2;
    const tagged = (part: WallPart, poly: Face['poly']): Face => ({
      poly,
      material: { domain: 'structure', id: appearance, part },
      architectureFeatureId: id,
      architectureFeatureKind: feature.kind,
    });
    const span = (part: WallPart, from: number, to: number, lo: number, hi: number): Face => {
      const p0 = at(from), p1 = at(to);
      return tagged(part, [
        { ...p0, h: hi },
        { ...p1, h: hi },
        { ...p1, h: lo },
        { ...p0, h: lo },
      ]);
    };
    if (feature.kind === 'window-band') {
      const lo = baseH + WALL_H_M * 0.42;
      const hi = baseH + WALL_H_M * 0.8;
      const mullion = width * 0.025;
      out.push(
        span('vitre', t0, t1, lo, hi),
        span('meneau', center - mullion, center + mullion, lo, hi),
        span('meneau', t0, t1, (lo + hi) / 2 - isoPxToM(1.5), (lo + hi) / 2 + isoPxToM(1.5)),
      );
    } else if (feature.kind === 'stone-entry') {
      const inner0 = center - width * 0.28;
      const inner1 = center + width * 0.28;
      out.push(
        span('face', t0, inner0, baseH, baseH + WALL_H_M * 0.76),
        span('face', inner1, t1, baseH, baseH + WALL_H_M * 0.76),
        span('linteau', t0, t1, baseH + WALL_H_M * 0.68, baseH + WALL_H_M * 0.82),
      );
    } else if (feature.kind === 'gable') {
      const p0 = at(t0), p1 = at(t1), apex = at(center);
      out.push(tagged('face', [
        { ...p0, h: baseH + WALL_H_M },
        { ...p1, h: baseH + WALL_H_M },
        { ...apex, h: baseH + WALL_H_M * 1.55 },
      ]));
    } else if (feature.kind === 'sign') {
      out.push(span('panneau', t0, t1, baseH + WALL_H_M * 0.58, baseH + WALL_H_M * 0.76));
    }
  }
  return out;
}

function tagExistingFacadeFaces(faces: Face[], seg: WallSeg, facade: FacadeEdge, down: boolean): Face[] {
  if (down || !seg.window) return faces;
  const feature = facade.features.find((candidate) => candidate.kind === 'window-band');
  if (!feature) return faces;
  const id = `${facade.bodyId}:${facade.sectionId}:${feature.id}`;
  const appearance = feature.appearance ??
    facadeWallFeatureAppearance(facade.appearance, feature.kind);
  return faces.map((face) =>
    face.material.part === 'vitre' || face.material.part === 'meneau'
      ? {
          ...face,
          ...(appearance ? { material: { ...face.material, id: appearance } } : {}),
          architectureFeatureId: id,
          architectureFeatureKind: feature.kind,
        }
      : face);
}

// ── CRÉNELURE (décoration de RENDU) — dérivation du PÉRIMÈTRE (générale, toute forme, opt-in donnée) ──
type Card = 'N' | 'E' | 'S' | 'O';
const CARD: Card[] = ['N', 'E', 'S', 'O'];
const CARD_NB: Record<Card, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], O: [-1, 0] };

/** Éléments `wall` SYNTHÉTIQUES de CRÉNELURE (RENDU PUR, comme un toit auto-dessiné) : pour chaque arête de
 *  PÉRIMÈTRE d'une tuile crénelée (voisin même-z NON crénelé), la seule CRÊTE crénelée (`crownFaces` :
 *  parapet + merlons, assise à la surface). Merlons CEINTURANT la zone, jamais à l'intérieur. Générique
 *  (toute forme). N'est PAS un `WallSeg` de scène → ne coupe NI le passage NI la LdV plongeante (les
 *  défenseurs tirent par-dessus). La MAÇONNERIE du mur, elle, vient du bloc plein (`floorFaces`). */
export function crestEls(scene: Scene, visible?: ReadonlySet<string>, view?: FloorView): WallEl[] {
  const viewZ = view?.viewZ ?? null;
  const { w, h } = scene.dimensions;
  const out: WallEl[] = [];
  for (const l of scene.layers) {
    if (viewZ != null && l.z !== viewZ) continue; // isolement debug d'un étage
    const z = l.z;
    if (!l.crenellated) continue;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const appId = crenellatedAt(scene, x, y, z);
        if (!appId) continue;
        const surfaceH = heightAt(scene, x, y, z);
        const cApp = structureAppearance(appId);
        for (const side of CARD) {
          const [dx, dy] = CARD_NB[side];
          const nx = x + dx, ny = y + dy;
          if (isCrenellated(scene, nx, ny, z)) continue; // arête INTERNE → pas de crête
          // ACCÈS (rampe/escalier atteint le chemin de ronde à ~même hauteur) → entrée OUVERTE, pas de
          // merlons en travers du passage.
          if (scene.layers.some((l) => isWalkable(scene, nx, ny, l.z) && gradeBetween(surfaceH, heightAt(scene, nx, ny, l.z)) !== 'cliff')) continue;
          const e = edgeOf(x, y, nx, ny);
          if (!e) continue;
          // STRUCTURE (porte/herse) sous l'arête → elle rend DÉJÀ sa propre crête (corps de garde) : pas de
          // double crénelure au-dessus de la porte.
          if (scene.layers.some((l) => l.z < z && structureAt(scene, e.x, e.y, e.side, l.z))) continue;
          const [A, B] = wallEnds({ x: e.x, y: e.y, side: e.side });
          out.push({
            kind: 'wall', key: `crest:${e.x},${e.y},${e.side},${z}`, cell: { x: e.x, y: e.y, z }, side: e.side,
            door: false, appearance: cApp.id,
            ends: [{ ...A, h: surfaceH }, { ...B, h: surfaceH }],
            faces: crownFaces(cApp, A, B, surfaceH),
            states: { visible: !visible || visible.has(`${x},${y},${z}`), down: false, open: false },
          });
        }
      }
  }
  return out;
}

/** Apparence d'une fermeture SYNTHÉTIQUE de comble (pignon de bout ou joint latéral, #815/#819) : routée
 *  par la FAÇADE authorée sur cette arête (`facadeWallFeatureAppearance(..., 'gable')`, comme toute autre
 *  feature de façade) si une section en couvre le bord ; repli sur `structureAppearance` par hauteur
 *  (même seuil que `wallApp` — pierre au-delà d'un niveau, bois sinon) quand aucune façade n'y est
 *  authorée. JAMAIS un matériau de pierre en dur indépendamment de la façade : `eaveHeightM > 1` est
 *  vrai pour la quasi-totalité des sections authorées — sans ce routage, TOUT pignon peint en pierre,
 *  y compris sur un corps à colombage. */
function gableAppearance(
  facades: ReadonlyMap<string, FacadeEdge>,
  edge: { x: number; y: number; side: WallSide; z: number },
  eaveHeightM: number,
): string {
  const facade = facades.get(edgeKey(edge));
  const routed = facade && facadeWallFeatureAppearance(facade.appearance, 'gable');
  return routed ?? structureAppearance(eaveHeightM > 1 ? 'mur-en-pierre' : 'plain').id;
}

/** Éléments `wall` SYNTHÉTIQUES de PIGNON (RENDU PUR, comme `crestEls`) : ferme le triangle mur qui
 *  manquait entre l'égout (où les rampants s'arrêtent) et le sommet du mur d'étage (qui ne montait que
 *  jusqu'à sa hauteur d'étage) — sans lui, on VOIT À TRAVERS le comble aux deux extrémités d'un toit à
 *  pignon. Une MASSE = une nappe (#823, plus de pré-groupement en « nappes » depuis des rectangles
 *  authorés) : chaque masse ferme SON PROPRE pignon, à SA largeur, jamais celle d'une masse voisine.
 *  Matériau de MUR du corps (jamais la couverture), apparence routée par façade avec repli sur
 *  `structureAppearance` (`gableAppearance`), `roomZoneIds` propagés (sinon le pignon reste suspendu en
 *  l'air quand la coupe lève le toit, #819). SAUTÉ quand la case juste au-delà du pignon
 *  (`GableEnd.outside`) est DÉJÀ couverte par une AUTRE masse (même `z`) : deux volumes jointifs
 *  continuent le toit sans mur entre eux — un éventuel saut de hauteur à cette jointure est alors la
 *  charge de `roofSeamEls` (#819), pas la sienne. */
export function gableEls(scene: Scene, visible?: ReadonlySet<string>, view?: FloorView): WallEl[] {
  const activeZ = view?.activeZ ?? 0;
  const viewZ = view?.viewZ ?? null;
  const out: WallEl[] = [];
  const facades = facadeEdges(scene);

  const roofedAtZ = new Map<number, Set<string>>();
  for (const body of scene.architecture ?? [])
    for (const mass of body.masses) {
      let set = roofedAtZ.get(mass.z);
      if (!set) { set = new Set(); roofedAtZ.set(mass.z, set); }
      for (const key of massFootprintCells(mass.footprint)) set.add(key);
    }

  for (const body of scene.architecture ?? [])
    for (const mass of body.masses) {
      const z = mass.z;
      if (view && (viewZ != null ? z !== viewZ : z > activeZ)) continue;
      const { cells, shape, roomZoneIds } = resolveMass(scene, mass);
      const roofed = roofedAtZ.get(z)!;
      const side: WallSide = shape.ridge === 'x' ? 'E' : 'N';
      gableEnds(cells, shape).forEach((end, i) => {
        if (roofed.has(`${end.outside.x},${end.outside.y}`)) return; // jointure : le toit continue
        const [base0, base1] = [end.poly[0], end.poly[end.poly.length - 1]];
        const vis = !visible
          || visible.has(`${end.anchor.x},${end.anchor.y},${z}`)
          || visible.has(`${end.outside.x},${end.outside.y},${z}`);
        const appearance = gableAppearance(facades, { x: end.anchor.x, y: end.anchor.y, side, z }, shape.eaveHeightM);
        out.push({
          kind: 'wall',
          key: `gable:${body.id}:${mass.id}:${i}`,
          cell: { x: end.anchor.x, y: end.anchor.y, z },
          bodyId: body.id,
          roomZoneIds: [...roomZoneIds],
          side,
          door: false,
          appearance,
          ends: [base0, base1],
          faces: [{ poly: end.poly, material: { domain: 'structure', id: appearance, part: 'face' } }],
          states: { visible: vis, down: false, open: false },
        });
      });
    }
  return out;
}

/** Une NAPPE de toit indexée par cellule — pour `roofSeamEls` : son emprise+forme PROPRES (une masse par
 *  nappe, #823) donnent la hauteur exacte à n'importe quel coin de son empreinte. */
interface RoofNappe {
  bodyId: string;
  massId: string;
  z: number;
  shape: RoofShapeSpec;
  cells: ReadonlySet<string>;
  roomZoneIds: readonly string[];
}

function indexRoofNappes(scene: Scene): ReadonlyMap<string, RoofNappe> {
  const index = new Map<string, RoofNappe>();
  for (const body of scene.architecture ?? [])
    for (const mass of body.masses) {
      const { cells, shape, roomZoneIds } = resolveMass(scene, mass);
      const nappe: RoofNappe = { bodyId: body.id, massId: mass.id, z: mass.z, shape, cells, roomZoneIds };
      for (const key of cells) if (!index.has(key)) index.set(key, nappe);
    }
  return index;
}

/** Éléments `wall` de FERMETURE de JOINT LATÉRAL entre deux CASES DE TOITURE voisines de nappes
 *  distinctes (#819) : `gableEnds` ne ferme que les extrémités du FAÎTAGE d'une nappe — le bord qui
 *  court PARALLÈLEMENT au faîtage (jonction de deux ailes côte à côte, jupe plus basse contre une aile,
 *  masses de `z` différents…) n'a AUCUN générateur. RENDU PUR : pour CHAQUE paire de cases 4-adjacentes
 *  couvertes par DEUX nappes distinctes (n'importe quel axe), si la hauteur de couverture diffère à l'un
 *  des deux coins de l'arête partagée, un quad de MUR comble le vide entre la surface haute et la basse
 *  — matériau de MUR (jamais de couverture, même apparence routée que `gableEls`), `roomZoneIds` = union
 *  des deux nappes (sinon suspendu en l'air quand l'une des deux coupes lève son toit). SILENCIEUX quand
 *  un seul côté est couvert (l'égout descend normalement jusqu'à un mur physique, déjà dressé ailleurs)
 *  ou quand les deux nappes sont exactement coplanaires au joint (rien à fermer). */
function roofSeamEls(scene: Scene, visible?: ReadonlySet<string>, view?: FloorView): WallEl[] {
  const activeZ = view?.activeZ ?? 0;
  const viewZ = view?.viewZ ?? null;
  const out: WallEl[] = [];
  const facades = facadeEdges(scene);
  const index = indexRoofNappes(scene);
  const heightAtCorner = (n: RoofNappe, x: number, y: number) => roofHeightAt({ x, y }, n.cells, n.shape);

  const DIRS: { side: WallSide; nx: number; ny: number; c0: GXY; c1: GXY }[] = [];
  for (const [key, a] of index) {
    const [x, y] = key.split(',').map(Number);
    DIRS.length = 0;
    DIRS.push(
      { side: 'E', nx: x + 1, ny: y, c0: { x: x + 1, y }, c1: { x: x + 1, y: y + 1 } },
      { side: 'N', nx: x, ny: y + 1, c0: { x, y: y + 1 }, c1: { x: x + 1, y: y + 1 } },
    );
    for (const { side, nx, ny, c0, c1 } of DIRS) {
      const b = index.get(`${nx},${ny}`);
      if (!b || b === a) continue;
      const hA0 = heightAtCorner(a, c0.x, c0.y), hA1 = heightAtCorner(a, c1.x, c1.y);
      const hB0 = heightAtCorner(b, c0.x, c0.y), hB1 = heightAtCorner(b, c1.x, c1.y);
      if (Math.abs(hA0 - hB0) < EPS && Math.abs(hA1 - hB1) < EPS) continue; // nappes coplanaires au joint
      const z = Math.max(a.z, b.z);
      if (view && (viewZ != null ? z !== viewZ : z > activeZ)) continue;
      const vis = !visible || visible.has(`${x},${y},${z}`) || visible.has(`${nx},${ny},${z}`);
      const edgeCell = side === 'E' ? { x, y } : { x, y: ny };
      const roomZoneIds = [...new Set([...a.roomZoneIds, ...b.roomZoneIds])];
      const appearance = gableAppearance(facades, { ...edgeCell, side, z }, Math.max(a.shape.eaveHeightM, b.shape.eaveHeightM));
      const hi0 = Math.max(hA0, hB0), lo0 = Math.min(hA0, hB0);
      const hi1 = Math.max(hA1, hB1), lo1 = Math.min(hA1, hB1);
      const gp0hi: GP = { x: c0.x - 0.5, y: c0.y - 0.5, h: hi0 };
      const gp1hi: GP = { x: c1.x - 0.5, y: c1.y - 0.5, h: hi1 };
      const gp0lo: GP = { x: c0.x - 0.5, y: c0.y - 0.5, h: lo0 };
      const gp1lo: GP = { x: c1.x - 0.5, y: c1.y - 0.5, h: lo1 };
      out.push({
        kind: 'wall',
        key: `seam:${a.bodyId}:${a.massId}:${b.bodyId}:${b.massId}:${x},${y}:${side}`,
        cell: { x: edgeCell.x, y: edgeCell.y, z },
        bodyId: a.bodyId,
        roomZoneIds,
        side,
        door: false,
        appearance,
        ends: [gp0lo, gp1lo],
        faces: [{ poly: [gp0hi, gp1hi, gp1lo, gp0lo], material: { domain: 'structure', id: appearance, part: 'face' } }],
        states: { visible: vis, down: false, open: false },
      });
    }
  }
  return out;
}

/** Éléments `wall` de la scène. `view` ABSENT ⇒ toutes les couches (éditeur/QC/POV) ; sinon `viewZ`
 *  isole un étage (debug), sinon z ≤ activeZ (le jeu ne dresse pas les cloisons AU-DESSUS de la zone
 *  active). `visible` absent ⇒ tout visible ; sinon un mur est VISIBLE (dessiné AU-DESSUS du voile de
 *  brouillard) si l'une des DEUX cases bordant son arête est en vue, OU si l'arête est de l'ENVELOPPE
 *  du bâtiment (`envelopeEdgesOf`, #818 — la façade n'est pas un secret, seul l'intérieur se cache).
 *  La hauteur de BASE est MÉTRIQUE
 *  (`heightAt`, la vérité POV historique — identique à l'ex-lift iso quand height = 4·z). Les CRÊTES
 *  crénelées (décoration de rendu pur, `crestEls`) sont AJOUTÉES en fin — elles ne coupent ni passage ni LdV. */
export function buildWalls(scene: Scene, visible?: ReadonlySet<string>, view?: FloorView): WallEl[] {
  const activeZ = view?.activeZ ?? 0;
  const viewZ = view?.viewZ ?? null;
  const out: WallEl[] = [];
  const authoredEdges = facadeEdges(scene);
  for (const w of scene.walls ?? []) {
    const z = w.z ?? 0;
    if (view && (viewZ != null ? z !== viewZ : z > activeZ)) continue;
    const baseH = heightAt(scene, w.x, w.y, z);
    const facade = authoredEdges.get(edgeKey(w));
    const physicalApp = wallApp(w, baseH);
    const app = facade && !w.structure
      ? facadeStructureAppearance(facade.appearance)
      : physicalApp;
    const down = !!w.structure && structureIsDown(scene, w);
    const open = !!w.door && doorIsOpen(scene, w);
    const [nx, ny] = NB[w.side];
    const vis = !visible || visible.has(`${w.x},${w.y},${z}`) || visible.has(`${w.x + nx},${w.y + ny},${z}`)
      || envelopeEdgesOf(scene).has(edgeKey(w));
    const [A, B] = wallEnds(w);
    const physicalFaces = wallFaces(w, app, baseH, down, WALL_H_M, open);
    out.push({
      kind: 'wall',
      key: `wall:${w.x},${w.y},${w.side},${z}`,
      cell: { x: w.x, y: w.y, z },
      ...(facade ? {
        bodyId: facade.bodyId,
        facadeSectionId: facade.sectionId,
        facadeAppearance: facade.appearance,
        ...(facade.roomZoneIds ? { roomZoneIds: [...facade.roomZoneIds] } : {}),
      } : {}),
      side: w.side,
      door: !!w.door,
      appearance: app.id,
      ends: [{ ...A, h: baseH }, { ...B, h: baseH }],
      faces: [
        ...(facade ? tagExistingFacadeFaces(physicalFaces, w, facade, down) : physicalFaces),
        ...(facade ? facadeFeatureFaces(w, facade, baseH, down) : []),
      ],
      states: { visible: vis, down, open },
    });
  }
  out.push(...crestEls(scene, visible, view));
  out.push(...gableEls(scene, visible, view));
  out.push(...roofSeamEls(scene, visible, view));
  return out;
}
