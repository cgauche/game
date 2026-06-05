/** Rendu partagé d'un bâtiment (jeu + éditeur). Une seule définition des 3
 *  calques et de la profondeur de tri ; le cutaway passe simplement hideRoof. */
import { BuildingFeature } from '../state/scene';
import { Dims, depth } from './iso';
import { buildingLayers } from './catalog/buildings';

/** Profondeur de tri d'un bâtiment = coin avant de l'empreinte. */
export function buildingDepth(b: BuildingFeature, dims: Dims): number {
  return depth(b.foot.x + b.foot.w - 1, b.foot.y + b.foot.h - 1, dims);
}

/** Objet trié { d, el } pour la z-list des deux canvases. */
export function buildingObj(b: BuildingFeature, dims: Dims, hideRoof = false, night = false): { d: number; el: JSX.Element } {
  const L = buildingLayers(b.type, b.foot, b.params ?? {}, { dims, facing: b.facing, night });
  return {
    d: buildingDepth(b, dims),
    el: (
      <g key={`b-${b.id}`}>
        <g dangerouslySetInnerHTML={{ __html: L.interior }} />
        <g dangerouslySetInnerHTML={{ __html: L.walls }} />
        <g style={{ transition: 'opacity 0.25s' }} opacity={hideRoof ? 0 : 1} dangerouslySetInnerHTML={{ __html: L.roof }} />
      </g>
    ),
  };
}
