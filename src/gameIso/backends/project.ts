/**
 * Pont MONDE→ÉCRAN des backends ÉCRAN-AFFINES : projette un point GRILLE+MÈTRES du pivot via la
 * projection partagée (`tileCenter` + `metricToLift`). SOURCE UNIQUE de la conversion (sols, murs…) —
 * la rotation caméra et l'élévation-écran vivent entièrement ici, jamais dans un builder.
 */
import { tileCenter, type Dims } from '../iso';
import { metricToLift } from '../../state/relief';
import type { GP } from '../builders/types';

export type Pt2 = [number, number];

export function projGP(gp: GP, dims: Dims): Pt2 {
  const { cx, cy } = tileCenter(gp.x, gp.y, dims, metricToLift(gp.h));
  return [cx, cy];
}
