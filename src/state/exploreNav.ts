import { type Scene, isWalkable } from './scene';
import { pathTo, type Pt } from './path';

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
  // ESCALIER : viser une marche envoie à l'AUTRE bout (seul franchissement vertical).
  const stair = (sc.stairs ?? []).find(
    (s) => (s.from.x === tile.x && s.from.y === tile.y && s.from.z === tz) || (s.to.x === tile.x && s.to.y === tile.y && s.to.z === tz),
  );
  if (stair) return stair.from.x === tile.x && stair.from.y === tile.y && stair.from.z === tz ? stair.to : stair.from;
  return tile; // déplacement simple
}
