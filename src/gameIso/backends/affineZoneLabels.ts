/**
 * BACKEND ÉCRAN-AFFINE des étiquettes de ZONE DESCRIPTIVE (#782) : le nom d'une pièce, peint SUR le
 * plancher à SA hauteur (`tileCenter`+`metricToLift`), révélé en cutaway par le builder
 * (`buildZoneLabels` — la visibilité est déjà tranchée, ce backend ne fait QUE projeter/styler). Même
 * patron visuel que le texte de plan des toits (`planBoxSvg`, `affineRoofs.ts`) : couleurs de
 * `roofMaterial('plan')`, police mise à l'échelle sur la largeur ÉCRAN (≈0.58·fontSize/caractère,
 * bornée [7,16]).
 */
import { Dims, footprintDepth, tileCenter } from '../../geometry/iso';
import { roofMaterial } from '../catalog/roofs';
import type { ZoneLabelEl } from '../builders/zoneLabels';

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Profondeur de tri : coin caméra-proche de TOUTE l'empreinte (`footprintDepth`, patron `roofDepth`)
 *  − 0.45 → juste AU-DESSUS de CHAQUE case de sol qu'elle couvre (`floorDepth` = depth−0.5, ≤ ce max)
 *  et SOUS murs (+0.45)/props (+0)/jetons (+0.5) : le texte, qui peut déborder de sa case, ne se fait
 *  jamais tronquer par une case voisine de sa PROPRE pièce peinte après. */
export function zoneLabelDepth(el: ZoneLabelEl, dims: Dims): number {
  return footprintDepth(el.x, el.y, el.spanW, el.spanH, dims, el.z) - 0.45;
}

/** Texte centré à la projection du centre de la zone, À SA HAUTEUR (`lift`, calculée par l'appelant via
 *  `liftAt` — même patron que `DebugMapLabels`) — la police se met à l'échelle sur la largeur ÉCRAN de
 *  l'empreinte (deux coins projetés au même lift), même formule que `planBoxSvg`. */
export function zoneLabelSvg(el: ZoneLabelEl, dims: Dims, lift: number): string {
  const { cx, cy } = tileCenter(el.cx, el.cy, dims, lift);
  const half = Math.max(el.spanW, el.spanH) / 2;
  const a = tileCenter(el.cx - half, el.cy, dims, lift);
  const b = tileCenter(el.cx + half, el.cy, dims, lift);
  const widthPx = Math.max(24, Math.abs(b.cx - a.cx));
  const fontSize = Math.max(7, Math.min(16, (widthPx - 12) / Math.max(1, el.label.length * 0.58)));
  const plan = roofMaterial('plan');
  return (
    `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" ` +
    `font-weight="bold" fill="${plan.planText!}" stroke="${plan.planEdge!}" stroke-width="0.5" pointer-events="none">` +
    `${escapeXml(el.label)}</text>`
  );
}
