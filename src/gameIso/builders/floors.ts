/**
 * BUILDER de SOLS — produit les éléments `floor` du pivot (cf. ./types) : pour chaque tuile construite
 * des couches à rendre, le losange de sol (matériau = id de TerrainDef), les faces VERTICALES de relief
 * auto-dérivées des deltas de hauteur MÉTRIQUE (falaise/rampe/tablier/piliers), les wedges de raccord
 * de terrain, et les VÉRITÉS DE SCÈNE (visible/surplomb/fantôme/surplomb plein). PUR et
 * projection-agnostique : géométrie en unités de GRILLE + MÈTRES (`GP`), aucune notion de caméra.
 */
import { Scene, tileAt, heightAt, isWalkable } from '../../state/scene';
import { gradeBetween } from '../../state/relief';
import { terrainPriority, terrainSolidHeightM } from '../../state/terrain';
import type { CellSide, Face, FloorEl } from './types';

/** Épaisseur (mètres) de la DALLE ajourée d'un tablier de surplomb : la face de bord donnant sur le
 *  vide descend de cette hauteur seulement (pas une falaise de pleine hauteur) → on voit dessous. */
const DECK_THICKNESS_M = 0.3;

/** Hauteur d'AFFICHAGE (m) d'une surface = hauteur combat (`heightAt`, vérité INTOUCHÉE) + le BLOC PLEIN
 *  éventuel du terrain (`solidHeightM`, ex. mur). SEULE la dérivation des faces de `buildFloors` la lit :
 *  une tuile `mur` (combat-hauteur 0) s'affiche ainsi comme un bloc de sa `solidHeightM` (4 faces + dessus,
 *  via le relief EXISTANT), sans qu'AUCUN code combat ne voie cette hauteur. Le bloc s'AJOUTE à la hauteur
 *  propre de la tuile (opéra : mur posé sur un étage surélevé). */
function displayHeightAt(scene: Scene, x: number, y: number, z: number): number {
  return heightAt(scene, x, y, z) + terrainSolidHeightM(tileAt(scene, x, y, z));
}

export const SIDES: CellSide[] = ['N', 'E', 'S', 'O'];
/** Déplacement de la case VOISINE que borde chaque arête cardinale (source UNIQUE, partagée POV). */
export const NEIGHBOURS: Record<CellSide, [number, number]> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  O: [-1, 0],
};

export interface EdgeBlend {
  dir: CellSide;
  terrain: string;
}

/** Voisins de plus haute précédence qui « débordent » sur la tuile (x,y) du niveau `z`. */
export function edgeBlends(scene: Scene, x: number, y: number, z = 0): EdgeBlend[] {
  const self = terrainPriority(tileAt(scene, x, y, z));
  const out: EdgeBlend[] = [];
  for (const dir of SIDES) {
    const [dx, dy] = NEIGHBOURS[dir];
    const nt = tileAt(scene, x + dx, y + dy, z);
    if (terrainPriority(nt) > self) out.push({ dir, terrain: nt });
  }
  return out;
}

/** SURPLOMB : la case (x,y,z) d'une couche z>0 a-t-elle une surface MARCHABLE sur une couche INFÉRIEURE ?
 *  (un tablier de pont / une loge AU-DESSUS d'une route praticable). Si oui, le bord donnant sur le vide
 *  ne descend PAS jusqu'au sol (dalle fine + piliers), la couche du dessous reste visible/passable. */
export function isOverhang(scene: Scene, x: number, y: number, z: number): boolean {
  if (z <= 0) return false;
  for (let zz = z - 1; zz >= 0; zz--) if (isWalkable(scene, x, y, zz)) return true;
  return false;
}

/** TOIT D'UN BLOC PLEIN : la case (x,y,z>0) coiffe-t-elle un terrain à BLOC PLEIN (mur) d'une couche
 *  inférieure, à hauteur d'AFFICHAGE coïncidente ? (le chemin de ronde posé sur la masse du rempart). Alors
 *  ce n'est PAS un surplomb flottant mais la surface SUPÉRIEURE d'une structure solide → il se voit d'un
 *  étage inférieur exactement comme le bloc (opaque, jamais culé/fantôme), au lieu de disparaître et de
 *  laisser le dessus BRUT du bloc à nu quand on regarde le mur d'en bas (activeZ sous z). GÉNÉRAL. */
export function capsSolid(scene: Scene, x: number, y: number, z: number): boolean {
  if (z <= 0) return false;
  const top = displayHeightAt(scene, x, y, z);
  for (let zz = z - 1; zz >= 0; zz--)
    if (terrainSolidHeightM(tileAt(scene, x, y, zz)) > 0 && displayHeightAt(scene, x, y, zz) >= top - 0.01) return true;
  return false;
}

/** Hauteur d'AFFICHAGE de la surface INFÉRIEURE sous un surplomb (1ʳᵉ couche marchable en dessous), ou null. */
function overhangLowerHeight(scene: Scene, x: number, y: number, z: number): number | null {
  for (let zz = z - 1; zz >= 0; zz--) if (isWalkable(scene, x, y, zz)) return displayHeightAt(scene, x, y, zz);
  return null;
}

/** Étage de SOL effectif sous (x,y) pour le BROUILLARD : à un trou (`vide`) de l'étage actif, on retombe
 *  sur le premier sol en dessous → le voile reflète la visibilité du CONTREBAS (vu par le trou) au lieu
 *  d'un noir « inconnu » qui masquerait l'étage inférieur. Mono-niveau (pas de trou) ⇒ `activeZ`.
 *  PARTAGÉ par le builder (surplomb PLEIN) et par FogLayer (IsoStage) — une seule vérité de voile. */
export function fogFloorZ(scene: Scene, x: number, y: number, activeZ: number): number {
  for (let zz = activeZ; zz >= 0; zz--)
    if (scene.layers.some((l) => l.z === zz) && tileAt(scene, x, y, zz) !== 'vide') return zz;
  return activeZ;
}

/** Coins de GRILLE (±0.5) des extrémités de l'ARÊTE `side` de la case (x,y), dans l'ordre HORAIRE de
 *  `tileEdge` (iso.ts) — même convention → un backend affine qui projette ces points retombe
 *  byte-identique sur la géométrie d'arête existante. */
function edgeCorners(x: number, y: number, side: CellSide): [{ x: number; y: number }, { x: number; y: number }] {
  const c = (gx: number, gy: number) => ({ x: gx - 0.5, y: gy - 0.5 });
  switch (side) {
    case 'N': return [c(x, y), c(x + 1, y)];
    case 'E': return [c(x + 1, y), c(x + 1, y + 1)];
    case 'S': return [c(x + 1, y + 1), c(x, y + 1)];
    default: return [c(x, y + 1), c(x, y)]; // O
  }
}

/** Faces d'une tuile de sol, dans l'ORDRE DE PEINTURE (piliers — les plus en arrière, ils tombent sous
 *  la dalle — puis parois de relief qui descendent SOUS le sol, losange de base, wedges par-dessus).
 *  null si la tuile est `vide` (étage non construit → transparente, on voit le dessous). */
function floorFaces(scene: Scene, x: number, y: number, z: number, overhang: boolean): Face[] | null {
  const terrain = tileAt(scene, x, y, z);
  if (terrain === 'vide') return null;
  const self = displayHeightAt(scene, x, y, z); // AFFICHAGE (bloc plein `solidHeightM` compris) — jamais lu par le combat
  const solidBlock = terrainSolidHeightM(terrain) > 0; // mur (terrain à bloc plein) → flancs en PIERRE, pas en terre
  const faces: Face[] = [];

  // PILIERS de support d'un surplomb : pour chaque arête donnant sur le VIDE, deux montants verticaux
  // aux coins de l'arête, du DESSOUS de la dalle jusqu'à la surface inférieure. Coins partagés dédupliqués.
  // Gaté sur `overhang` (≠ `lowerH != null`) : une ZONE REMPART solide (overhang forcé faux) descend en
  // falaise PLEINE, sans pilotis (`overhangLowerHeight` verrait pourtant le sol marchable dessous).
  const lowerH = overhangLowerHeight(scene, x, y, z);
  if (overhang && lowerH != null) {
    const topH = self - DECK_THICKNESS_M; // dessous de la dalle
    const seen = new Set<string>();
    for (const side of SIDES) {
      const [dx, dy] = NEIGHBOURS[side];
      if (tileAt(scene, x + dx, y + dy, z) !== 'vide') continue; // arête INTÉRIEURE du tablier → pas de pilier
      for (const c of edgeCorners(x, y, side)) {
        const k = `${c.x},${c.y}`;
        if (seen.has(k)) continue;
        seen.add(k);
        faces.push({
          poly: [{ ...c, h: topH }, { ...c, h: lowerH }],
          side,
          material: { domain: 'relief', id: 'pilier', part: 'pillar' },
        });
      }
    }
  }

  // PAROIS de relief : une face par arête où la case DOMINE sa voisine 4-adjacente AU MÊME z. Le
  // franchissement vertical s'AUTO-DÉRIVE du delta métrique (`heightAt`/`gradeBetween`, SOURCE UNIQUE) :
  // `flat` → rien, `ramp` → pente lisse, `cliff` → paroi verticale. Un bord de surplomb donnant sur le
  // VIDE se rend en DALLE FINE (`deck`, épaisseur DECK_THICKNESS_M) au lieu d'une falaise pleine → la
  // route du dessous reste visible ; une falaise de TERRAIN PLEIN garde sa face pleine.
  for (const side of SIDES) {
    const [dx, dy] = NEIGHBOURS[side];
    const nb = displayHeightAt(scene, x + dx, y + dy, z); // voisin en hauteur d'AFFICHAGE (mur voisin = bloc plein)
    if (self <= nb) continue; // la case HAUTE porte la paroi (plateau surélevé ET rebord de fosse)
    const grade = gradeBetween(self, nb);
    if (grade === 'flat') continue; // de niveau → aucune paroi
    const deck = overhang && tileAt(scene, x + dx, y + dy, z) === 'vide';
    const loH = deck ? self - DECK_THICKNESS_M : nb;
    const [A, B] = edgeCorners(x, y, side);
    faces.push({
      // Quad haut-gauche → haut-droit → bas-droit → bas-gauche (l'ordre attendu par les renderers).
      poly: [{ ...A, h: self }, { ...B, h: self }, { ...B, h: loH }, { ...A, h: loH }],
      side,
      // Ton : PIERRE (flanc d'un BLOC PLEIN — mur —, d'une couche surélevée, ou dalle de tablier ; le
      // matériau `pierre` porte sa propre recette d'assises → paroi maçonnée, pas un cube de terre) /
      // terre (talus/fosse de la base).
      material: { domain: 'relief', id: deck || z > 0 || solidBlock ? 'pierre' : 'terre', part: deck ? 'deck' : grade },
    });
  }

  // LOSANGE de base (matériau = id du terrain), à la hauteur métrique de la surface. Coins en ordre
  // horaire depuis le NO (= ordre écran top→right→bot→left au cran 0).
  faces.push({
    poly: [
      { x: x - 0.5, y: y - 0.5, h: self },
      { x: x + 0.5, y: y - 0.5, h: self },
      { x: x + 0.5, y: y + 0.5, h: self },
      { x: x - 0.5, y: y + 0.5, h: self },
    ],
    material: { domain: 'terrain', id: terrain },
  });

  // WEDGES de raccord de terrain : trapèze sur l'arête faisant face à chaque voisin de plus haute
  // précédence, inset de 0.4 vers le centre de la case.
  for (const { dir, terrain: nt } of edgeBlends(scene, x, y, z)) {
    const [A, B] = edgeCorners(x, y, dir);
    const in40 = (p: { x: number; y: number }) => ({ x: p.x + (x - p.x) * 0.4, y: p.y + (y - p.y) * 0.4, h: self });
    faces.push({
      poly: [{ ...A, h: self }, { ...B, h: self }, in40(B), in40(A)],
      side: dir,
      material: { domain: 'terrain', id: nt, part: 'wedge' },
    });
  }
  return faces;
}

/** Vérité de JEU pilotant la sélection des couches (PAS une caméra) : `activeZ` = étage de la zone
 *  active (combattant actif / groupe), `viewZ` = isolement debug d'un seul étage (`viewLevel`).
 *  `allies` = positions du groupe : vérité de CUTAWAY (un ornement de faîte est masqué quand son toit
 *  est levé pour montrer l'intérieur — MÊME `roofHidden` que `buildRoofs`) ; n'active PAS le tri par
 *  couche (seuls `activeZ`/`viewZ` le font), donc le POV peut le fournir sans culler ses props d'étage. */
export interface FloorView {
  activeZ?: number;
  viewZ?: number | null;
  allies?: { x: number; y: number }[];
}

/** Éléments `floor` de la scène. Couches émises : l'ACTIVE + celles du DESSOUS (z ≤ activeZ) — d'en
 *  haut on voit le contrebas par le puits ; d'en bas on ne dessine pas les étages pleins au-dessus.
 *  AU-DESSUS de la zone active, SEULS les SURPLOMBS (tablier/loge) sont émis, tagués `ghost` (silhouette
 *  translucide côté stage), borné aux scènes multi-couches. `visible` absent ⇒ tout visible (éditeur/QC). */
export function buildFloors(scene: Scene, visible?: ReadonlySet<string>, view?: FloorView): FloorEl[] {
  const activeZ = view?.activeZ ?? 0;
  const viewZ = view?.viewZ ?? null;
  const { w, h } = scene.dimensions;
  const multiLayer = scene.layers.length > 1;
  const isVis = (xx: number, yy: number, zz: number) => !visible || visible.has(`${xx},${yy},${zz}`);
  const out: FloorEl[] = [];
  for (const lvl of scene.layers) {
    if (viewZ != null && lvl.z !== viewZ) continue; // isole : seule la couche isolée
    const layerGhost = viewZ == null && lvl.z > activeZ; // couche au-dessus de la zone active
    if (layerGhost && !multiLayer) continue;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const overhang = isOverhang(scene, x, y, lvl.z);
        // Le TOIT d'un bloc plein (chemin de ronde sur le mur) n'est pas un surplomb flottant → jamais
        // fantôme : dessiné opaque comme le bloc qu'il coiffe, même vu d'un étage inférieur.
        const caps = capsSolid(scene, x, y, lvl.z);
        const ghost = layerGhost && !caps; // tablier au-dessus de la zone active → fantôme ; pas un toit de bloc
        if (ghost && !overhang) continue; // au-dessus : SEULEMENT les surplombs
        const faces = floorFaces(scene, x, y, lvl.z, overhang);
        if (!faces) continue;
        // RÈGLE GÉNÉRALE du surplomb : il ne s'efface (fantôme translucide) que pour ne pas masquer une
        // SURFACE VISIBLE en dessous. Là où l'étage du dessous n'est PAS visible (occulté/brouillard),
        // rien à protéger → surplomb PLEIN : dessiné opaque comme la structure qu'on perçoit (un rempart
        // en bord de carte) et AU-DESSUS du voile (`visible`), au lieu d'être mangé par l'ombre.
        const solidOverhang = ghost && !isVis(x, y, fogFloorZ(scene, x, y, activeZ));
        // BLOC SOLIDE (mur : terrain à `solidHeightM`) : OPAQUE → jamais « visible » lui-même (le rayon
        // vers lui est bloqué par lui-même, son intérieur n'est pas éclairé). Comme un WallSeg (cf.
        // `buildWalls`), on le dessine AU-DESSUS du voile — structure PERÇUE, opaque — dès qu'une case
        // OUVERTE qu'il borde est en vue ; sinon il serait grisé sous la brume alors qu'on le voit se
        // dresser devant soi. `!ghost` : au-dessus de la zone active, seul `solidOverhang` décide.
        // Le TOIT d'un bloc plein (`caps`) suit la même règle : perçu (opaque, au-dessus du voile) dès
        // qu'une case ouverte QU'IL BORDE — à son étage OU à celui du bloc en dessous (la cour au pied du
        // mur) — est en vue, sinon le chemin de ronde serait grisé alors qu'on voit le rempart d'en bas.
        const perceivable =
          !ghost &&
          (terrainSolidHeightM(tileAt(scene, x, y, lvl.z)) > 0 || caps) &&
          SIDES.some((s) => { const [dx, dy] = NEIGHBOURS[s]; return isVis(x + dx, y + dy, lvl.z) || (caps && isVis(x + dx, y + dy, lvl.z - 1)); });
        out.push({
          kind: 'floor',
          key: `floor:${x},${y},${lvl.z}`,
          cell: { x, y, z: lvl.z },
          faces,
          states: { visible: solidOverhang || perceivable, overhang, ghost, solidOverhang },
        });
      }
  }
  return out;
}
