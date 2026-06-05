/**
 * Rendu d'os résolus (ResolvedBone[]) en SVG string — PUR, sans React, donc utilisable
 * en rendu headless (resvg/QC) ET par RigSprite (via dangerouslySetInnerHTML). Source UNIQUE
 * du markup d'un rig, partagée par TOUS les gabarits corporels (bipède/quadrupède/ailé).
 */
import { toSvg } from './kinematics';
import type { ResolvedBone } from './composeRig';

/** <g data-bone> par os (transform = matrice monde), parts échellées, miroir par part. */
export function bonesToSvg(bones: ResolvedBone[]): string {
  return bones
    .map((b) => {
      const inner = b.parts
        .map((p) => (p.mirror ? `<g transform="scale(-1,1)">${p.svg}</g>` : p.svg))
        .join('');
      return `<g data-bone="${b.id}" transform="${toSvg(b.matrix)}"><g transform="scale(${b.scale[0].toFixed(4)},${b.scale[1].toFixed(4)})">${inner}</g></g>`;
    })
    .join('');
}
