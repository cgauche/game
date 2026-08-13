/**
 * PROJECTION ÉCRAN des faces d'un élément de builder — emprise de culling de la voie affine, et
 * géométrie d'occlusion de la loi de dégagement (`stage/architectureVisibility.ts`, `cleared` de
 * `IsoStage`), que le monde soit peint en SVG ou en volumique. Partagé, donc hors des couches de
 * projection : aucun peintre ici, seulement la géométrie.
 */
import { projectOccluder, type Dims, type OccluderPanel } from '../../geometry/iso';
import { metricToLift } from '../../state/relief';

export function panelOf(faces: readonly { poly: readonly { x: number; y: number; h: number }[] }[]): OccluderPanel {
  return {
    polygons: faces.map((face) => face.poly.map((point) => ({
      x: point.x,
      y: point.y,
      lift: metricToLift(point.h),
    }))),
  };
}

export function elOccluder(el: { faces: readonly { poly: readonly { x: number; y: number; h: number }[] }[] }, d: Dims) {
  return projectOccluder(panelOf(el.faces), d);
}
