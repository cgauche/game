import { type Scene, isWalkable } from './scene';
import { pathTo, walkNeighbors, type Pt } from './path';
import { screenStepDot, type ScreenDir } from './combatCursor';
import { type Dims } from '../geometry/iso';
import { DIR8_ORDER, DIR8_DELTA, type Dir8 } from './dir8';

const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Case adjacente (8-voisins) libre et ATTEIGNABLE la plus proche d'une cible, pour le move-to-interact
 *  (P5). À l'ÉTAGE de la cible (un PNJ de loge s'aborde depuis une case voisine, même z). */
export function adjacentWalkable(sc: Scene, target: Pt, from: Pt): Pt | null {
  const tz = target.z ?? 0;
  let best: Pt | null = null;
  let bestLen = Infinity;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const c: Pt = tz ? { x: target.x + dx, y: target.y + dy, z: tz } : { x: target.x + dx, y: target.y + dy };
      if (!isWalkable(sc, c.x, c.y, tz)) continue;
      const p = pathTo(sc, from, c, { blocked: new Set() });
      if (p && p.length < bestLen) {
        best = c;
        bestLen = p.length;
      }
    }
  }
  return best;
}

/** Case d'ARRIVÉE qu'un clic/survol sur `tile` enverrait au groupe en EXPLORATION — SOURCE UNIQUE
 *  partagée par l'aperçu de chemin (IsoStage `explorePath`) et le clic (`performClick`), pour qu'ils
 *  ne divergent jamais (la divergence = le bug « le chemin ne s'affiche pas au survol d'un objet »).
 *
 *  `null` = aucune marche : interaction sur place (on est déjà à côté), badaud déjà adjacent, ou aucune
 *  case adjacente atteignable. Pour un déplacement simple on renvoie la case telle quelle — le filtrage
 *  « marchable » reste à `pathTo` (aperçu) / `moveAlong` (clic), comme aujourd'hui. */
export function exploreMoveDest(sc: Scene, partyPos: Pt, tile: Pt): Pt | null {
  const tz = tile.z ?? 0;
  const ent = sc.entities.find((e) => e.pos.x === tile.x && e.pos.y === tile.y && (e.z ?? 0) === tz);
  // On ne marche jamais SUR un personnage ou un objet interactif : on s'approche d'une case adjacente
  // (sinon le groupe entrerait dans le corps du PNJ, et la case d'un objet interactif est bloquée).
  if (ent && (!!ent.dialogueId || !!ent.interact || !!ent.merchant || ent.kind === 'personnage')) {
    if (cheb(partyPos, ent.pos) <= 1) return null; // déjà à portée → interaction/échange/badaud sur place
    return adjacentWalkable(sc, ent.pos, partyPos);
  }
  // Déplacement simple : on renvoie la case cliquée telle quelle. Le franchissement vertical s'auto-dérive
  // du relief le long du chemin (`pathTo` via `surfaceLink` — rampe/falaise), plus aucun escalier explicite.
  return tile;
}

/** Seuil d'alignement écran (`screenStepDot`) sous lequel un voisin n'est PLUS considéré comme
 *  « dans le sens poussé » (#792). En iso, la case voisine IDÉALE d'un cardinal (pas diagonal de
 *  grille) colle à ~0.89–1.0 ; les repêchages hors-axe (pas simple-axe de grille, quasi-perpendiculaires
 *  en vertical du fait du ratio 2:1 TW/TH) tombent à ~0.45 — c'est ce rabattement trompeur qui
 *  provoquait le zigzag/oscillation silencieux au clavier. 0.6 sépare les deux paliers mesurés
 *  (clusters 0.4472 et 0.8944 en losange iso par défaut, `exploreNav.test.ts`) sans jamais mordre sur
 *  la 8-connectivité en champ libre (le voisin idéal de chaque cardinal reste toujours ≥ 0.89).
 */
const ALIGN_MIN = 0.6;

/** Case d'ARRIVÉE d'un PAS clavier en exploration : la surface voisine CONNECTÉE (`walkNeighbors` —
 *  même connectivité que le BFS : `flat`/`ramp`, arête non murée, z auto-dérivé) dont le `tileCenter`
 *  colle le mieux à la direction ÉCRAN poussée (`screenStepDot`, projection partagée avec le curseur de
 *  combat). Gère rampes/tabliers sans aucune ambiguïté de z. Bloqué (`null`) si aucune surface voisine
 *  n'est SUFFISAMMENT alignée (seuil `ALIGN_MIN`) sur la direction poussée — on ne rabat plus vers un
 *  voisin fortement latéral (source du zigzag/oscillation #792). PUR. */
export function exploreStepDest(scene: Scene, from: Pt, dir: ScreenDir, dims: Dims): Pt | null {
  let best: Pt | null = null;
  let bestDot = 0; // strictement positif : sinon aucune surface voisine ne part dans ce sens écran
  for (const n of walkNeighbors(scene, from)) {
    const dot = screenStepDot(scene, from, n, dir, dims);
    if (dot > bestDot) {
      bestDot = dot;
      best = n;
    }
  }
  return bestDot >= ALIGN_MIN ? best : null;
}

/** Case d'ARRIVÉE d'un pas en vue SUBJECTIVE (POV) dans une direction MONDE `worldDir` (Dir8, ≠ écran :
 *  le POV raisonne en cap réel, indépendant de la caméra). La surface voisine CONNECTÉE (`walkNeighbors` —
 *  même connectivité que le BFS : rampes/tabliers/arête non murée, z auto-dérivé) dont le delta grille a le
 *  MÊME signe (x ET y) que le delta unitaire de `worldDir` (`DIR8_DELTA`). `null` si aucune (bord/mur/vide).
 *  PUR — réutilise `walkNeighbors` (zéro géométrie ré-implémentée). */
export function povStepDest(scene: Scene, from: Pt, worldDir: Dir8): Pt | null {
  const d = DIR8_DELTA[worldDir];
  for (const n of walkNeighbors(scene, from)) {
    if (Math.sign(n.x - from.x) === Math.sign(d.gx) && Math.sign(n.y - from.y) === Math.sign(d.gy)) return n;
  }
  return null;
}

/** Orientation du MENEUR à l'ENTRÉE d'une scène (spawn / transition) : regarde vers le CONTENU —
 *  le centroïde de la carte ((w−1)/2, (h−1)/2) quantifié en Dir8 par SECTEURS de 45° (atan2, PAS le
 *  signe du delta : depuis le bord sud d'une carte large on regarde N, pas NE/NO au moindre décalage).
 *  Sans cela, le défaut 'S' fait contempler le VIDE hors-carte en vue subjective (POV) au bord sud.
 *  Entrée déjà au centre → 'S' (aucune direction « vers le contenu » ne domine). PUR.
 *  Une orientation AUTHORÉE (`facing` du heroStart) prime sur ce calcul — arbitré au seam (store). */
export function spawnFacing(pos: { x: number; y: number }, dims: { w: number; h: number }): Dir8 {
  const dx = (dims.w - 1) / 2 - pos.x;
  const dy = (dims.h - 1) / 2 - pos.y;
  if (dx === 0 && dy === 0) return 'S';
  // Cap horaire depuis le nord (grille : N = −y) : 0 = N, π/2 = E, ±π = S, −π/2 = O → cran de 45°
  // le plus proche (l'ex-aequo de frontière de secteur arrondit au cran horaire suivant).
  const step = Math.round(Math.atan2(dx, -dy) / (Math.PI / 4));
  return DIR8_ORDER[((step % 8) + 8) % 8];
}
