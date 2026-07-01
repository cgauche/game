/** Helper PUR des bâtiments composés : cutaway du toit. La structure réelle d'un bâtiment est faite de
 *  murs d'arête (`WallSeg`, destructibles via `structure`) sur un sol de terrain — la walkability et la
 *  vue passent par le terrain + `wallBetween` (plus aucune empreinte de bâtiment). Ne subsiste ici que
 *  le RENDU du toit (`Roof`, `scene.roofs`), qui se lève en cutaway quand un allié entre dans l'empreinte. */
import type { Roof } from './scene';

/** Le toit d'un bâtiment composé doit-il être masqué (cutaway) ? Vrai dès qu'un allié se tient dans
 *  l'empreinte du toit (`Roof.foot`) — l'intérieur est tout-en-scène, plus aucune scène-intérieur séparée. */
export function roofHidden(roof: Roof, allies: { x: number; y: number }[]): boolean {
  const f = roof.foot;
  return allies.some((a) => a.x >= f.x && a.x < f.x + f.w && a.y >= f.y && a.y < f.y + f.h);
}
