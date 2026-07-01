import { tileCenter, tileEdge, depth, isSquareView, diamondPath, CELL, LEVEL_H, type Dims } from './iso';
import { type Scene, type WallSeg } from '../state/scene';
import { structureById } from '../data';

/** Hauteur écran (px) d'une cloison dressée sur une arête — FIXE (la hauteur du relief est portée par le
 *  sol, plus par les murs ; un mur est une cloison d'arête, pas une plateforme). */
export const WALL_H = 54;

type P = { cx: number; cy: number };

/** Les 2 extrémités-écran (au sol) de l'arête d'un mur. Arêtes CARDINALES N/E via la primitive PARTAGÉE
 *  `tileEdge` (même géométrie que les parois de relief → rotation cohérente). Diagonales `\`/`/` : tracées
 *  de coin à coin opposé de la case (coins de grille via tileCenter, rotation gérée). */
function edgeEnds(w: WallSeg, dims: Dims): [P, P] {
  const z = w.z ?? 0;
  if (w.side === 'N' || w.side === 'E') return tileEdge(w.x, w.y, w.side, dims, z);
  const gc = (gx: number, gy: number) => tileCenter(gx - 0.5, gy - 0.5, dims, z);
  return w.side === '\\' ? [gc(w.x, w.y), gc(w.x + 1, w.y + 1)] : [gc(w.x + 1, w.y), gc(w.x, w.y + 1)]; // '/' = NE→SO
}

/** Profondeur de tri d'un mur : du côté de la tuile la plus PROCHE de la caméra (occlusion correcte).
 *  MAX de profondeur sur les DEUX cases bordant l'arête → le mur reste devant son sol proche aux 4
 *  rotations (la case « proche » change avec la caméra). Tri par l'INDEX DE COUCHE `z` (découplé du lift). */
function wallDepth(w: WallSeg, dims: Dims): number {
  const z = w.z ?? 0;
  const cells: [number, number][] =
    w.side === 'E' ? [[w.x, w.y], [w.x + 1, w.y]]
    : w.side === 'N' ? [[w.x, w.y], [w.x, w.y - 1]]
    : [[w.x, w.y]]; // diagonales \ / : la case elle-même
  return Math.max(...cells.map(([cx, cy]) => depth(cx, cy, dims, z))) + 0.45;
}

/** Poteau vertical (montant) à une extrémité d'arête : posé aux deux bouts de chaque mur → les poteaux
 *  des murs adjacents COÏNCIDENT (coins pleins + jambages de porte gratuits). Légère moulure en haut. */
function post(p: P, h: number): string {
  return `<rect x="${p.cx - 1.9}" y="${p.cy - h}" width="3.8" height="${h}" fill="#352b1f"/>` +
    `<rect x="${p.cx - 1.9}" y="${p.cy - h}" width="3.8" height="2.4" fill="#5b4a35"/>` + // chapiteau
    `<rect x="${p.cx - 1.9}" y="${p.cy - 3}" width="3.8" height="3" fill="#241c12"/>`; // socle
}

/** Quad « tranche » de la face entre deux hauteurs (h0 bas, h1 haut), suivant l'arête a→b. */
const slab = (a: P, b: P, h0: number, h1: number) => `${a.cx},${a.cy - h0} ${b.cx},${b.cy - h0} ${b.cx},${b.cy - h1} ${a.cx},${a.cy - h1}`;

const lerpP = (A: P, B: P, t: number): P => ({ cx: A.cx + (B.cx - A.cx) * t, cy: A.cy + (B.cy - A.cy) * t });

// ── PORTE / CORPS DE GARDE : un VRAI passage de fort — une OUVERTURE BÉANTE sur toute la largeur de la
//    porte (PAS d'arche maçonnée ni de recoin factice). Tant qu'elle TIENT, une HERSE barre le passage ;
//    abattue, libre. Les segments contigus de la porte se rendent en bandes JOINTIVES (pas de montant
//    intermédiaire) → herse + linteau + battlement CONTINUS sur toute la largeur.
/** Herse (grille) sur l'ouverture a→b, du sol au linteau (≈H) : barreaux verticaux + 2 traverses de fer. */
function portcullis(a: P, b: P, H: number): string {
  const top = H * 0.9; // la herse pend du linteau
  let g = '';
  for (let i = 0; i <= 5; i++) { const p = lerpP(a, b, i / 5); g += `<line x1="${p.cx}" y1="${p.cy}" x2="${p.cx}" y2="${p.cy - top}" stroke="var(--struct-band)" stroke-width="1.7"/>`; }
  g += `<polygon points="${slab(a, b, top * 0.4, top * 0.4 + 2)}" fill="#4a4d54"/>` +
    `<polygon points="${slab(a, b, top * 0.78, top * 0.78 + 2)}" fill="#4a4d54"/>`; // 2 traverses de fer
  return g;
}

/** Mur en VUE DU DESSUS : un trait ÉPAIS posé SUR l'arête (pas d'extrusion verticale — sinon le mur
 *  « flotte » comme un panneau au-dessus de la case). Une PORTE = ouverture au milieu (deux jambages). */
function topWall(w: WallSeg, a: P, b: P, dims: Dims): { d: number; svg: string } {
  const seg = (p: P, q: P, width: number, col: string) =>
    `<line x1="${p.cx}" y1="${p.cy}" x2="${q.cx}" y2="${q.cy}" stroke="${col}" stroke-width="${width}" stroke-linecap="round"/>`;
  let svg: string;
  if (w.door) {
    // deux jambages, ouverture franchissable au centre
    svg = seg(a, lerpP(a, b, 0.3), 7, '#5b4a35') + seg(lerpP(a, b, 0.7), b, 7, '#5b4a35');
  } else {
    svg = seg(a, b, 8, '#2c2419') + seg(a, b, 5, '#6e5940'); // liseré sombre + dessus bois
  }
  return { d: wallDepth(w, dims) + 0.6, svg: `<g>${svg}</g>` }; // au-dessus des sols
}

/** Fortification de siège (AA p.120-121) dressée sur une arête : rempart de PIERRE crénelé et ferré
 *  (intacte → distincte d'un mur de maison en bois) ou tas de GRAVATS bas laissant la BRÈCHE ouverte
 *  au-dessus (abattue → on voit/passe au travers). Couleurs en tokens :root. `down` = `structureIsDown`. */
function structureSeg(w: WallSeg, a: P, b: P, dims: Dims, down: boolean): { d: number; svg: string } {
  const d = wallDepth(w, dims);
  const isGate = structureById.get(w.structure ?? '')?.kind === 'porte';
  if (isSquareView(dims.view)) {
    const line = (col: string, width: number, dash?: string) =>
      `<line x1="${a.cx}" y1="${a.cy}" x2="${b.cx}" y2="${b.cy}" stroke="${col}" stroke-width="${width}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
    // BRÈCHE (abattue) : pointillé clairsemé de gravats sur l'arête.
    if (down) return { d: d + 0.6, svg: `<g>${line('var(--struct-rubble)', 6, '3 5')}</g>` };
    // PORTE INTACTE : bloc plein sur SA case (sinon le plancher laisse un trou) + glyphe de passage barré ;
    // la COURTINE, elle, reste un simple TRAIT épais sur l'arête.
    if (isGate) {
      const { cx: px, cy: py } = tileCenter(w.x, w.y, dims);
      const h = CELL / 2;
      const block = `<path d="${diamondPath(w.x, w.y, dims)}" fill="var(--struct-face)" stroke="var(--struct-band)" stroke-width="2.5"/>`;
      // passage N-S sombre traversant la courtine + barreaux de herse (E-O) → corps de garde fermé identifiable.
      let glyph = `<rect x="${px - h * 0.46}" y="${py - h}" width="${h * 0.92}" height="${2 * h}" fill="#241a10"/>`;
      for (let i = 1; i <= 3; i++) { const ly = py - h + 2 * h * (i / 4); glyph += `<line x1="${px - h * 0.46}" y1="${ly}" x2="${px + h * 0.46}" y2="${ly}" stroke="var(--struct-cap)" stroke-width="1.6"/>`; }
      return { d: d + 0.6, svg: `<g>${block}${glyph}</g>` };
    }
    // COURTINE : barre pierre ÉPAISSE ferrée sur l'arête (trait).
    return { d: d + 0.6, svg: `<g>${line('var(--struct-band)', 11) + line('var(--struct-face)', 7)}</g>` };
  }
  const H = WALL_H; // hauteur FIXE (cloison d'arête)
  const P = LEVEL_H * 0.32; // parapet / corps de garde : hauteur dressée au-dessus du plan H
  // PORTE / CORPS DE GARDE (structure `kind:'porte'`) — routé par l'id de structure AVANT la brèche
  // générique. OUVERTURE BÉANTE sur toute la largeur : PAS de face de pierre ni d'arche — un vrai passage.
  // INTACTE : la HERSE barre le passage. ABATTUE (`down`) : plus de herse, seuil d'éboulis → passage libre.
  if (isGate) {
    const lintel = `<polygon points="${slab(a, b, H - 4, H)}" fill="var(--struct-face)" stroke="var(--struct-band)" stroke-width="0.8"/>`; // poutre du gatehouse d'où pend la herse
    const bars = down
      ? `<polygon points="${slab(a, b, 0, H * 0.12)}" fill="var(--struct-rubble)"/>` // BRÈCHE : seuil d'éboulis, passage dégagé
      : portcullis(a, b, H); // HERSE continue barrant le passage
    const N = 5, merlonH = 6;
    let merlons = '';
    for (let i = 0; i < N; i += 2) {
      const p0 = lerpP(a, b, i / N), p1 = lerpP(a, b, (i + 1) / N);
      merlons += `<polygon points="${p0.cx},${p0.cy - (H + P)} ${p1.cx},${p1.cy - (H + P)} ${p1.cx},${p1.cy - (H + P) - merlonH} ${p0.cx},${p0.cy - (H + P) - merlonH}" fill="var(--struct-cap)"/>`;
    }
    const parapet = `<polygon points="${slab(a, b, H, H + P)}" fill="var(--struct-face)" stroke="var(--struct-band)" stroke-width="0.8"/>` + // parapet
      `<polygon points="${slab(a, b, H + P * 0.72, H + P * 0.72 + 2.4)}" fill="var(--struct-band)"/>` + // ferrure du parapet
      `<polygon points="${slab(a, b, H + P - 3, H + P)}" fill="var(--struct-cap)"/>` + // arase (couronnement)
      merlons;
    return { d, svg: `<g>${bars}${lintel}${parapet}</g>` };
  }
  if (down) {
    // BRÈCHE : éboulis bas le long de l'arête (≈0.3 H), ouverture au-dessus laissée transparente. Tas
    // DENTELÉ (≠ « mur court ») + moignons de jambage qui subsistent aux extrémités.
    const hr = H * 0.32;
    const m1 = lerpP(a, b, 0.34), m2 = lerpP(a, b, 0.62);
    const svg = `<g><polygon points="${slab(a, b, 0, hr * 0.5)}" fill="var(--struct-rubble)"/>` +
      `<polygon points="${a.cx},${a.cy} ${m1.cx},${m1.cy - hr} ${m2.cx},${m2.cy - hr * 0.7} ${b.cx},${b.cy}" fill="var(--struct-rubble-hi)" stroke="var(--struct-band)" stroke-width="0.6"/>` +
      post(a, hr * 0.7) + post(b, hr * 0.55) + `</g>`;
    return { d, svg };
  }
  // REMPART INTACT : face pierre pleine + bandes de fer, surmontée d'un PARAPET crénelé dressé au-dessus
  // du plan H → le rempart se lit en relief, pas en bande plate. Montants d'extrémité = coins/jambages.
  const band = (t: number) => `<polygon points="${slab(a, b, H * t, H * t + 2.4)}" fill="var(--struct-band)"/>`;
  const N = 5, merlonH = 6; // créneaux : 1 merlon / 1 trou (i pair) — montés au sommet du parapet (H+P)
  let merlons = '';
  for (let i = 0; i < N; i += 2) {
    const p0 = lerpP(a, b, i / N), p1 = lerpP(a, b, (i + 1) / N);
    merlons += `<polygon points="${p0.cx},${p0.cy - (H + P)} ${p1.cx},${p1.cy - (H + P)} ${p1.cx},${p1.cy - (H + P) - merlonH} ${p0.cx},${p0.cy - (H + P) - merlonH}" fill="var(--struct-cap)"/>`;
  }
  const svg = `<g>${post(a, H + P)}` +
    `<polygon points="${slab(a, b, 0, H)}" fill="var(--struct-face)" stroke="var(--struct-band)" stroke-width="0.8"/>` + // face pierre
    band(0.28) + band(0.56) + band(0.82) + // ferrures de la courtine
    `<polygon points="${slab(a, b, H, H + P)}" fill="var(--struct-face)" stroke="var(--struct-band)" stroke-width="0.8"/>` + // parapet
    `<polygon points="${slab(a, b, H + P * 0.72, H + P * 0.72 + 2.4)}" fill="var(--struct-band)"/>` + // ferrure du parapet
    `<polygon points="${slab(a, b, H + P - 3, H + P)}" fill="var(--struct-cap)"/>` + // arase (couronnement)
    merlons +
    `${post(b, H + P)}</g>`;
  return { d, svg };
}

/** SVG d'un segment de mur TEXTURÉ (panneau encadré + moulures + plinthe + ombrage par côté) + sa
 *  profondeur, pour le tri global de IsoStage. Une PORTE est ajourée (ouverture basse + linteau) ; une
 *  arête portant une STRUCTURE de siège (`w.structure`) se rend en fortification/brèche (`structureSeg`,
 *  `structDown` = état abattu fourni par l'appelant, comme l'overlay porte lit `doorIsOpen`). Hauteur
 *  FIXE `WALL_H` (le relief vit dans le sol, plus dans le mur). */
export function wallSeg(w: WallSeg, dims: Dims, structDown = false): { d: number; svg: string } {
  const [a, b] = edgeEnds(w, dims);
  if (w.structure) return structureSeg(w, a, b, dims, structDown);
  if (isSquareView(dims.view)) return topWall(w, a, b, dims); // grille carrée : trait sur l'arête, pas d'extrusion
  const H = WALL_H;
  // Palette par orientation (lumière en haut-gauche) : faces N (vers le bas-droit) plus sombres que E.
  const N = w.side === 'N';
  const face = N ? '#5d4c36' : '#6e5940';
  const inset = N ? '#4b3d2b' : '#594732'; // fond de panneau (renfoncement)
  const frame = N ? '#6b573e' : '#7c6647'; // liseré clair du cadre
  const cap = N ? '#806b4b' : '#917a58'; // corniche / dessus
  const skirt = N ? '#3c3022' : '#473829'; // plinthe

  if (w.door) {
    const op = H * 0.52; // hauteur de l'ouverture
    // Jambage ENCADRÉ (montant sombre + chapiteau clair) → la porte se lit comme une ouverture cadrée,
    // pas comme un simple trou (crucial en vue de FACE où l'embrasure n'est plus vue en biais).
    const jamb = (p: P) =>
      `<rect x="${p.cx - 1.8}" y="${p.cy - op}" width="3.6" height="${op}" fill="#6e5940"/>` +
      `<rect x="${p.cx - 1.8}" y="${p.cy - op}" width="3.6" height="1.8" fill="#8a7048"/>`; // chapiteau clair
    const svg = `<g>${post(a, H)}` +
      `<polygon points="${slab(a, b, 0, op)}" fill="#15100a" opacity="0.42"/>` + // embrasure ombrée
      `<polygon points="${slab(a, b, op, H)}" fill="${face}" stroke="#2a2118" stroke-width="0.7"/>` + // mur au-dessus de la porte
      `<polygon points="${slab(a, b, op, op + 4)}" fill="#7c6647" stroke="#2a2118" stroke-width="0.5"/>` + // poutre de linteau
      `<polygon points="${slab(a, b, H * 0.86, H)}" fill="${cap}"/>` + // corniche
      jamb(a) + jamb(b) +
      `${post(b, H)}</g>`;
    return { d: wallDepth(w, dims), svg };
  }

  // Panneau encadré : un rectangle inset (renfoncé) au centre de la face.
  const lerp = (A: P, B: P, t: number): P => ({ cx: A.cx + (B.cx - A.cx) * t, cy: A.cy + (B.cy - A.cy) * t });
  const m = 0.2; // marge horizontale du panneau
  const pl = lerp(a, b, m), pr = lerp(a, b, 1 - m);
  const yLo = 0.2, yHi = 0.78; // bornes verticales du panneau
  const panel = `${pl.cx},${pl.cy - H * yLo} ${pr.cx},${pr.cy - H * yLo} ${pr.cx},${pr.cy - H * yHi} ${pl.cx},${pl.cy - H * yHi}`;
  const frameLine = `M${pl.cx},${pl.cy - H * yHi} L${pr.cx},${pr.cy - H * yHi}`; // arête haute du cadre (lumière)

  const svg = `<g>${post(a, H)}` +
    `<polygon points="${slab(a, b, 0, H)}" fill="${face}" stroke="#2c2419" stroke-width="0.7"/>` + // face
    `<polygon points="${panel}" fill="${inset}"/>` + // panneau renfoncé
    `<path d="${frameLine}" stroke="${frame}" stroke-width="1.3" fill="none"/>` + // moulure haute du cadre
    `<polygon points="${slab(a, b, 0, H * 0.11)}" fill="${skirt}"/>` + // plinthe
    `<polygon points="${slab(a, b, H * 0.86, H)}" fill="${cap}"/>` + // corniche
    `<polygon points="${slab(a, b, H, H + 4)}" fill="${cap}"/>` + // épaisseur dessus
    `${post(b, H)}</g>`;
  return { d: wallDepth(w, dims), svg };
}

/** Tous les segments de mur de la scène, prêts à fusionner dans le tri de profondeur. Un mur = une pièce
 *  (plus de face cour séparée : le relief — et donc tout flanc maçonné — vit dans le sol). */
export function wallSegs(scene: Scene, dims: Dims): { d: number; svg: string }[] {
  return (scene.walls ?? []).map((w) => wallSeg(w, dims, false));
}
