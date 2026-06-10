/** Rendu partagé d'un bâtiment (jeu + éditeur). Une seule définition des 3
 *  calques et de la profondeur de tri ; le cutaway passe simplement hideRoof. */
import { BuildingFeature } from '../state/scene';
import { Dims, depth, diamondPath } from './iso';
import { buildingLayers } from './catalog/buildings';

/** Profondeur de tri d'un bâtiment = coin avant de l'empreinte. */
export function buildingDepth(b: BuildingFeature, dims: Dims): number {
  return depth(b.foot.x + b.foot.w - 1, b.foot.y + b.foot.h - 1, dims);
}

/** Objet trié { d, el } pour la z-list des deux canvases. */
export function buildingObj(b: BuildingFeature, dims: Dims, hideRoof = false, night = false): { d: number; el: JSX.Element } {
  // Vue du dessus : l'extrusion iso n'a pas de sens → empreinte à plat (toit + porte). Fidélité fine déférée.
  if (dims.view === 'top') {
    const tiles: { x: number; y: number }[] = [];
    for (let dy = 0; dy < b.foot.h; dy++)
      for (let dx = 0; dx < b.foot.w; dx++) tiles.push({ x: b.foot.x + dx, y: b.foot.y + dy });
    return {
      d: buildingDepth(b, dims),
      el: (
        <g key={`b-${b.id}`} style={{ transition: 'opacity 0.25s' }} opacity={hideRoof ? 0.3 : 0.9}>
          {tiles.map((t) => (
            <path key={`bf-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, dims)} fill="#5b4f42" stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
          ))}
          {b.door && <path d={diamondPath(b.door.x, b.door.y, dims)} fill="#caa46a" stroke="#3a2c1c" strokeWidth={1} />}
        </g>
      ),
    };
  }
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
