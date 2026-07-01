import { Scene, tileAt, heightAt, isWalkable } from '../state/scene';
import { gradeBetween, metricToLift, type Grade } from '../state/relief';
import { terrainPriority } from '../state/terrain';
import { terrainGradient } from './catalog/terrain';
import { Dims, diamondCorners, tileCenter, tileEdge } from './iso';

// ── TUNABLES de SURPLOMB (tablier de pont / loge) — ajustés à l'œil par l'orchestrateur ──────────────
/** Épaisseur (mètres) de la DALLE ajourée d'un tablier : la face de bord d'un surplomb donnant sur le
 *  vide descend de cette hauteur seulement (pas une falaise de pleine hauteur) → on voit dessous. */
export const DECK_THICKNESS_M = 0.3;
/** Largeur ÉCRAN (px) d'un PILIER de support sous un tablier (montant vertical fin). */
export const PILLAR_W = 5;

export type EdgeDir = 'N' | 'E' | 'S' | 'O';
const NEIGHBOURS: Record<EdgeDir, [number, number]> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  O: [-1, 0],
};

export interface EdgeBlend {
  dir: EdgeDir;
  terrain: string;
}

/** Voisins de plus haute précédence qui « débordent » sur la tuile (x,y) du niveau `z`. */
export function edgeBlends(scene: Scene, x: number, y: number, z = 0): EdgeBlend[] {
  const self = terrainPriority(tileAt(scene, x, y, z));
  const out: EdgeBlend[] = [];
  for (const dir of ['N', 'E', 'S', 'O'] as EdgeDir[]) {
    const [dx, dy] = NEIGHBOURS[dir];
    const nt = tileAt(scene, x + dx, y + dy, z);
    if (terrainPriority(nt) > self) out.push({ dir, terrain: nt });
  }
  return out;
}

/** Une PAROI de relief sur une arête où la case est PLUS HAUTE que sa voisine : 4 sommets (haut-gauche,
 *  haut-droit, bas-droit, bas-gauche). `grade` = nature du lien (`ramp` douce ≤ STEP_MAX_M / `cliff`
 *  verticale au-delà) ; `lit` = face tournée vers la caméra (éclairée) ; `tone` = terre (talus de
 *  terrain, z0) ou pierre (flanc d'une couche surélevée, z>0). */
export interface ReliefFace {
  dir: EdgeDir;
  /** `ramp` pente lisse / `cliff` paroi pleine / `deck` DALLE FINE d'un surplomb (bord de tablier sur le vide). */
  grade: Extract<Grade, 'ramp' | 'cliff'> | 'deck';
  points: [number, number][];
  lit: boolean;
  tone: 'earth' | 'stone';
}

/** SURPLOMB : la case (x,y,z) d'une couche z>0 a-t-elle une surface MARCHABLE sur une couche INFÉRIEURE ?
 *  (un tablier de pont / une loge AU-DESSUS d'une route praticable). Si oui, le bord donnant sur le vide
 *  ne descend PAS jusqu'au sol (dalle fine + piliers), la couche du dessous reste visible/passable. */
export function isOverhang(scene: Scene, x: number, y: number, z: number): boolean {
  if (z <= 0) return false;
  for (let zz = z - 1; zz >= 0; zz--) if (isWalkable(scene, x, y, zz)) return true;
  return false;
}

/** Lift iso de la surface INFÉRIEURE sous un surplomb (1ʳᵉ couche marchable en dessous), ou null. */
function overhangLowerLift(scene: Scene, x: number, y: number, z: number): number | null {
  for (let zz = z - 1; zz >= 0; zz--) if (isWalkable(scene, x, y, zz)) return metricToLift(heightAt(scene, x, y, zz));
  return null;
}

/** Parois de relief de la case (x,y,z) : une face par arête où la case domine sa voisine 4-adjacente AU
 *  MÊME z. Le franchissement vertical s'AUTO-DÉRIVE du delta de hauteur MÉTRIQUE (`heightAt`/`gradeBetween`,
 *  SOURCE UNIQUE) : `flat` → rien, `ramp` → pente lisse, `cliff` → paroi verticale. Remplace l'ancienne
 *  machinerie escalier/rempart : un dénivelé entre deux cases EST le relief, plus besoin d'objet dédié.
 *  Géométrie via la primitive PARTAGÉE `tileEdge` (lift MÉTRIQUE) → rotation cohérente avec murs/sol ;
 *  éclairage déduit de la position ÉCRAN de l'arête → suit la rotation. */
export function reliefFaces(scene: Scene, x: number, y: number, dims: Dims, z = 0): ReliefFace[] {
  const self = heightAt(scene, x, y, z);
  const hiLift = metricToLift(self);
  const ctr = tileCenter(x, y, dims, hiLift); // centre case (sol haut) pour le test avant/arrière
  const overhang = isOverhang(scene, x, y, z); // surplomb (route praticable dessous) → bords ajourés
  const deckLoLift = metricToLift(self - DECK_THICKNESS_M); // dessous de la dalle fine
  const out: ReliefFace[] = [];
  for (const dir of ['N', 'E', 'S', 'O'] as EdgeDir[]) {
    const [dx, dy] = NEIGHBOURS[dir];
    const nb = heightAt(scene, x + dx, y + dy, z);
    if (self <= nb) continue; // la case HAUTE porte la paroi (plateau surélevé ET rebord de fosse)
    const grade = gradeBetween(self, nb);
    if (grade === 'flat') continue; // de niveau → aucune paroi
    // SURPLOMB donnant sur le VIDE (bord de tablier) : DALLE FINE (DECK_THICKNESS_M) au lieu d'une falaise
    // de pleine hauteur → la route du dessous reste visible. Une falaise de TERRAIN PLEIN (rien dessous)
    // garde sa face pleine. Les PILIERS (groundTile) portent la charge jusqu'à la surface inférieure.
    const deck = overhang && tileAt(scene, x + dx, y + dy, z) === 'vide';
    const loLift = deck ? deckLoLift : metricToLift(nb);
    // Paroi du lift HAUT (arête de la case) au lift BAS : mêmes x écran, décalés en hauteur. `slopeFace`
    // (rampe), `renderCliff` (falaise) et `renderDeck` (dalle fine) partagent cette géométrie d'arête.
    const [hiA, hiB] = tileEdge(x, y, dir, dims, hiLift);
    const [loA, loB] = tileEdge(x, y, dir, dims, loLift);
    const lit = (hiA.cy + hiB.cy) / 2 >= ctr.cy; // l'arête est DEVANT (plus bas à l'écran) → face avant
    out.push({ dir, grade: deck ? 'deck' : grade, lit, tone: z > 0 ? 'stone' : 'earth', points: [[hiA.cx, hiA.cy], [hiB.cx, hiB.cy], [loB.cx, loB.cy], [loA.cx, loA.cy]] });
  }
  return out;
}

const lerpP = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** FALAISE (`cliff`) : paroi VERTICALE texturée — face (claire si avant, sombre si arrière) + ombre au
 *  pied + arête vive. PIERRE (flanc d'une couche surélevée) = gris clair éclairé ; TERRE (talus/fosse) =
 *  bruns. Sans ce ton, le flanc d'une plateforme virait au noir et masquait l'étage du dessous. */
function renderCliff(s: ReliefFace): string {
  const [tl, tr, br, bl] = s.points; // haut-gauche, haut-droit, bas-droit, bas-gauche
  const poly = (pts: [number, number][]) => pts.map((p) => `${p[0]},${p[1]}`).join(' ');
  const fill = s.tone === 'stone' ? (s.lit ? '#6b6f76' : '#494d54') : (s.lit ? '#5a4a33' : '#33291c');
  const foot = s.tone === 'stone' ? (s.lit ? '#4a4e54' : '#34373c') : (s.lit ? '#3e3322' : '#241c12');
  const fl = lerpP(tl, bl, 0.6), fr = lerpP(tr, br, 0.6); // bord haut de l'ombre de pied
  return (
    `<polygon class="elev-cliff" points="${poly([tl, tr, br, bl])}" fill="${fill}" stroke="rgba(0,0,0,0.3)" stroke-width="0.6"/>` +
    `<polygon points="${poly([fl, fr, br, bl])}" fill="${foot}" opacity="0.85"/>` +
    (s.lit ? `<line x1="${tl[0]}" y1="${tl[1]}" x2="${tr[0]}" y2="${tr[1]}" stroke="rgba(255,240,210,0.22)" stroke-width="1.1"/>` : '')
  );
}

/** RAMPE (`ramp`, dénivelé ≤ STEP_MAX_M) : plan incliné LISSE — même quad d'arête que la falaise, mais
 *  ombrage doux dégradé du haut (nez éclairé) vers le bas (pied dans l'ombre), SANS marches discrètes →
 *  se lit comme une pente franchissable à pied (≠ mur). Le dénivelé étant petit, la bande reste fine :
 *  un seuil biseauté continu. PIERRE (flanc de couche) plus clair que TERRE (talus). */
function slopeFace(s: ReliefFace): string {
  const [tl, tr, br, bl] = s.points;
  const poly = (pts: [number, number][]) => pts.map((p) => `${p[0]},${p[1]}`).join(' ');
  const top = s.tone === 'stone' ? '#878c95' : '#75603f'; // nez de pente éclairé
  const bot = s.tone === 'stone' ? '#5b5f67' : '#4d3f2a'; // pied de pente dans l'ombre
  const ml = lerpP(tl, bl, 0.5), mr = lerpP(tr, br, 0.5); // mi-pente (couture des deux bandes)
  return (
    `<polygon points="${poly([tl, tr, mr, ml])}" fill="${top}" stroke="rgba(0,0,0,0.16)" stroke-width="0.4"/>` +
    `<polygon points="${poly([ml, mr, br, bl])}" fill="${bot}" stroke="rgba(0,0,0,0.16)" stroke-width="0.4"/>` +
    `<line x1="${tl[0]}" y1="${tl[1]}" x2="${tr[0]}" y2="${tr[1]}" stroke="rgba(255,240,210,0.28)" stroke-width="1.1"/>`
  );
}

/** DALLE FINE (`deck`) : bord d'un TABLIER de surplomb donnant sur le vide — face stone mince (épaisseur
 *  DECK_THICKNESS_M) avec un liseré clair sur l'arête vive. ≠ falaise (pleine hauteur) → on voit dessous. */
function renderDeck(s: ReliefFace): string {
  const [tl, tr, br, bl] = s.points;
  const poly = (pts: [number, number][]) => pts.map((p) => `${p[0]},${p[1]}`).join(' ');
  const fill = s.lit ? '#6b6f76' : '#494d54';
  return (
    `<polygon class="overhang-deck" points="${poly([tl, tr, br, bl])}" fill="${fill}" stroke="rgba(0,0,0,0.32)" stroke-width="0.6"/>` +
    `<line x1="${tl[0]}" y1="${tl[1]}" x2="${tr[0]}" y2="${tr[1]}" stroke="rgba(255,240,210,0.22)" stroke-width="1"/>`
  );
}

/** Un MONTANT vertical fin (PILLAR_W) du `top` (dessous de dalle) au `bot` (surface inférieure). */
function pillarSvg(top: { cx: number; cy: number }, bot: { cx: number; cy: number }): string {
  const w = PILLAR_W / 2;
  const pts = `${top.cx - w},${top.cy} ${top.cx + w},${top.cy} ${bot.cx + w},${bot.cy} ${bot.cx - w},${bot.cy}`;
  return (
    `<polygon class="overhang-pillar" points="${pts}" fill="#565a61" stroke="rgba(0,0,0,0.38)" stroke-width="0.6"/>` +
    `<line x1="${top.cx - w}" y1="${top.cy}" x2="${bot.cx - w}" y2="${bot.cy}" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>`
  );
}

/** PILIERS de support d'une tuile de SURPLOMB : pour chaque arête donnant sur le VIDE, deux montants
 *  verticaux fins aux extrémités de l'arête (coins de l'emprise), du DESSOUS de la dalle jusqu'à la
 *  surface inférieure (route). '' si la tuile n'est pas un bord de surplomb. Coins partagés dédupliqués. */
function overhangPillars(scene: Scene, x: number, y: number, dims: Dims, z: number): string {
  const lowerLift = overhangLowerLift(scene, x, y, z);
  if (lowerLift == null) return ''; // pas un surplomb
  const topLift = metricToLift(heightAt(scene, x, y, z) - DECK_THICKNESS_M); // dessous de la dalle
  let svg = '';
  const seen = new Set<string>();
  for (const dir of ['N', 'E', 'S', 'O'] as EdgeDir[]) {
    const [dx, dy] = NEIGHBOURS[dir];
    if (tileAt(scene, x + dx, y + dy, z) !== 'vide') continue; // arête INTÉRIEURE du tablier → pas de pilier
    const [hiA, hiB] = tileEdge(x, y, dir, dims, topLift);
    const [loA, loB] = tileEdge(x, y, dir, dims, lowerLift);
    for (const [hi, lo] of [[hiA, loA], [hiB, loB]] as [{ cx: number; cy: number }, { cx: number; cy: number }][]) {
      const k = `${Math.round(hi.cx)},${Math.round(hi.cy)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      svg += pillarSvg(hi, lo);
    }
  }
  return svg;
}

/** SVG d'une tuile de sol du niveau `z` (défaut sol) : parois de relief (falaise/rampe auto-dérivées du
 *  dénivelé) + losange de base (soulevé à son LIFT MÉTRIQUE `metricToLift(heightAt)`) + wedges de
 *  transition de terrain. Le TRI de profondeur (côté IsoStage) garde l'INDEX DE COUCHE `z`, découplé de
 *  ce lift métrique d'ÉCRAN. */
export function groundTile(scene: Scene, x: number, y: number, dims: Dims, z = 0): string {
  if (tileAt(scene, x, y, z) === 'vide') return ''; // tuile non construite d'un étage → transparente
  const lift = metricToLift(heightAt(scene, x, y, z));
  // PILIERS d'abord (le plus en arrière : ils tombent sous la dalle), puis les parois, puis le losange.
  const pillars = overhangPillars(scene, x, y, dims, z);
  // Parois (elles descendent SOUS le sol), puis le losange par-dessus son arête haute. Une arête de
  // surplomb sur le vide se rend en DALLE FINE (`deck`), pas en falaise pleine.
  const faces = reliefFaces(scene, x, y, dims, z).map((f) => (f.grade === 'cliff' ? renderCliff(f) : f.grade === 'deck' ? renderDeck(f) : slopeFace(f))).join('');
  const { cx, cy, top, right, bot, left } = diamondCorners(x, y, dims, lift);
  const base = `<path d="M${top[0]},${top[1]} L${right[0]},${right[1]} L${bot[0]},${bot[1]} L${left[0]},${left[1]} Z" fill="url(#${terrainGradient(
    tileAt(scene, x, y, z),
  )})" stroke="rgba(0,0,0,0.16)"/>`;
  const blends = edgeBlends(scene, x, y, z);
  if (!blends.length) return pillars + faces + base; // tuile sans voisin de plus haute précédence : pas de wedge
  // arête partagée par direction (paire de sommets), repliée vers le centre à 40 %
  const EDGE: Record<EdgeDir, [number, number][]> = {
    N: [top, right],
    E: [right, bot],
    S: [bot, left],
    O: [left, top],
  };
  const wedges = blends
    .map(({ dir, terrain }) => {
      const [a, b] = EDGE[dir];
      const ia = [a[0] + (cx - a[0]) * 0.4, a[1] + (cy - a[1]) * 0.4];
      const ib = [b[0] + (cx - b[0]) * 0.4, b[1] + (cy - b[1]) * 0.4];
      const d = `M${a[0]},${a[1]} L${b[0]},${b[1]} L${ib[0]},${ib[1]} L${ia[0]},${ia[1]} Z`;
      return `<path d="${d}" fill="url(#${terrainGradient(terrain)})" opacity="0.7"/>`;
    })
    .join('');
  return pillars + faces + base + wedges;
}
