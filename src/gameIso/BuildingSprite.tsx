/** Rendu partagé d'un bâtiment (jeu + éditeur). Une seule définition des 3
 *  calques et de la profondeur de tri ; le cutaway passe simplement hideRoof. */
import { BuildingFeature } from '../state/scene';
import { Dims, depth, tileCenter, CELL } from './iso';
import { buildingLayers } from './catalog/buildings';

/** Profondeur de tri d'un bâtiment = coin avant de l'empreinte. */
export function buildingDepth(b: BuildingFeature, dims: Dims): number {
  return depth(b.foot.x + b.foot.w - 1, b.foot.y + b.foot.h - 1, dims);
}

/** Objet trié { d, el } pour la z-list des deux canvases. */
export function buildingObj(b: BuildingFeature, dims: Dims, hideRoof = false, night = false): { d: number; el: JSX.Element } {
  // Vue du dessus : l'extrusion iso n'a pas de sens → plan de bâtiment (toit + MURS ÉPAIS + porte),
  // pour qu'on LISE un bâtiment et pas de simples tuiles. Boîte englobante des cases de l'empreinte
  // (les crans de rotation 90° gardent un rectangle). Fidélité fine déférée.
  if (dims.view === 'top') {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let dy = 0; dy < b.foot.h; dy++)
      for (let dx = 0; dx < b.foot.w; dx++) {
        const { cx, cy } = tileCenter(b.foot.x + dx, b.foot.y + dy, dims);
        minX = Math.min(minX, cx - CELL / 2); maxX = Math.max(maxX, cx + CELL / 2);
        minY = Math.min(minY, cy - CELL / 2); maxY = Math.max(maxY, cy + CELL / 2);
      }
    const door = b.door ? tileCenter(b.door.x, b.door.y, dims) : null;
    // Lettre du TYPE au centre (comme le « H » du départ héros) → on identifie le bâtiment d'un coup d'œil.
    const letter = (b.type || b.label || '?').charAt(0).toUpperCase();
    const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
    return {
      d: buildingDepth(b, dims),
      el: (
        <g key={`b-${b.id}`} style={{ transition: 'opacity 0.25s' }} opacity={hideRoof ? 0.5 : 1}>
          {/* toit + contour de murs épais (le bâtiment se lit comme une structure, pas des tuiles) */}
          <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} rx={3} fill="#6e4f3a" stroke="#241a12" strokeWidth={4} />
          <rect x={minX + 5} y={minY + 5} width={maxX - minX - 10} height={maxY - minY - 10} rx={2} fill="none" stroke="#8a6a4a" strokeWidth={1.5} opacity={0.6} />
          {door && <rect x={door.cx - CELL / 2} y={door.cy - CELL / 2} width={CELL} height={CELL} fill="#caa46a" stroke="#3a2c1c" strokeWidth={1.5} />}
          <text x={midX} y={midY} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(28, (maxY - minY) * 0.55)} fontWeight="bold" fill="#f2e6cc" stroke="#241a12" strokeWidth={0.6} pointerEvents="none">
            {letter}
          </text>
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
