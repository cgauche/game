/** Helper PUR des bâtiments composés : cutaway du toit. La structure réelle d'un bâtiment est faite de
 *  murs d'arête (`WallSeg`, destructibles via `structure`) sur un sol de terrain — la walkability et la
 *  vue passent par le terrain + `wallBetween` (plus aucune empreinte de bâtiment). Ne subsiste ici que
 *  le RENDU du toit (masses de `ArchitectureBody`, `gameIso/builders/roofs.ts`), qui se lève en cutaway
 *  quand un allié entre dans l'empreinte. */
import type { ArchitectureRect } from './scene';

/** Boîte englobante d'une empreinte de masse (`BuildingMass.footprint`, plusieurs rectangles). */
export function massFootBBox(footprint: readonly ArchitectureRect[]): ArchitectureRect {
  const x = Math.min(...footprint.map((r) => r.x));
  const y = Math.min(...footprint.map((r) => r.y));
  const x1 = Math.max(...footprint.map((r) => r.x + r.w));
  const y1 = Math.max(...footprint.map((r) => r.y + r.h));
  return { x, y, w: x1 - x, h: y1 - y };
}

/** Le toit d'un bâtiment composé doit-il être masqué (cutaway) ? Vrai dès qu'un allié se tient dans
 *  l'empreinte du toit — l'intérieur est tout-en-scène, plus aucune scène-intérieur séparée. */
export function roofHidden(foot: ArchitectureRect, allies: { x: number; y: number }[]): boolean {
  return allies.some((a) => a.x >= foot.x && a.x < foot.x + foot.w && a.y >= foot.y && a.y < foot.y + foot.h);
}
