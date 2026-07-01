/** Rendu d'un TOIT de bâtiment composé (jeu + éditeur). Un bâtiment réel = des murs d'arête (`WallSeg`,
 *  rendus par `wallObjs`) sur un sol de terrain (rendu par `floorObjs`) ; ce module ne rend que la pièce
 *  de TOIT couvrant l'empreinte. INTÉRIEUR TOUT-EN-SCÈNE (cutaway) : le toit se LÈVE (opacité 0 en iso,
 *  estompé en plan) quand un allié entre dans l'empreinte (`roofHidden(roof.foot, allies)`) — plus aucune
 *  scène-intérieur séparée. La nappe de toit est rendue par `roofFromCells` (`catalog/buildings`). */
import type { Roof } from '../state/scene';
import { Dims, footprintDepth, tileCenter, CELL, isSquareView } from './iso';
import { roofFromCells, styleRoofMaterial } from './catalog/buildings';
import { roofMaterial } from './catalog/roofs';

/** Profondeur de tri d'un toit : MAX sur les 4 coins de l'empreinte à son INDEX DE COUCHE `z` (coin proche
 *  caméra, correct aux 4 rotations) — découplé du lift d'écran. */
export function roofDepth(roof: Roof, dims: Dims): number {
  return footprintDepth(roof.foot.x, roof.foot.y, roof.foot.w, roof.foot.h, dims, roof.z ?? 0);
}

/** Objet trié { d, el } pour la z-list des deux canvases. `cutaway` lève le toit (calculé par l'appelant
 *  via `roofHidden(roof.foot, allies)`) : opacité 0 en iso (on voit l'intérieur tout-en-scène), estompé en
 *  plan. `night` éclaire les fenêtres de la skin. */
export function roofObj(roof: Roof, dims: Dims, cutaway = false, night = false): { d: number; el: JSX.Element } {
  // Vue du dessus : l'extrusion iso n'a pas de sens → plan de toit (boîte englobante de l'empreinte + nom),
  // pour LIRE le bâtiment d'un coup d'œil. Boîte des cases de l'empreinte (les crans 90° gardent un rectangle).
  if (isSquareView(dims.view)) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let dy = 0; dy < roof.foot.h; dy++)
      for (let dx = 0; dx < roof.foot.w; dx++) {
        const { cx, cy } = tileCenter(roof.foot.x + dx, roof.foot.y + dy, dims);
        minX = Math.min(minX, cx - CELL / 2); maxX = Math.max(maxX, cx + CELL / 2);
        minY = Math.min(minY, cy - CELL / 2); maxY = Math.max(maxY, cy + CELL / 2);
      }
    // Nom au centre du toit, police mise à l'échelle pour tenir dans la largeur de l'empreinte (≈0.58·fontSize
    // par caractère), bornée [7, 16].
    const name = roof.label || roof.style || '?';
    const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
    const nameFont = Math.max(7, Math.min(16, (maxX - minX - 12) / Math.max(1, name.length * 0.58)));
    const plan = roofMaterial('plan');
    return {
      d: roofDepth(roof, dims),
      el: (
        <g key={`roof-${roof.id}`} style={{ transition: 'opacity 0.25s' }} opacity={cutaway ? 0.5 : 1}>
          <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} rx={3} fill={plan.planBody!} stroke={plan.planEdge!} strokeWidth={4} />
          <rect x={minX + 5} y={minY + 5} width={maxX - minX - 10} height={maxY - minY - 10} rx={2} fill="none" stroke={plan.planInner!} strokeWidth={1.5} opacity={0.6} />
          <text x={midX} y={midY} textAnchor="middle" dominantBaseline="central" fontSize={nameFont} fontWeight="bold" fill={plan.planText!} stroke={plan.planEdge!} strokeWidth={0.5} pointerEvents="none">
            {name}
          </text>
        </g>
      ),
    };
  }
  // Iso : TOIT AUTO-CONSTRUIT depuis l'ENSEMBLE DE CELLULES de l'empreinte (forme quelconque). Les murs
  // sont des WallSeg, le sol du terrain — on ne dessine QUE la nappe de toit, calée sur `WALL_H`.
  void night;
  const cells = new Set<string>();
  for (let dy = 0; dy < roof.foot.h; dy++)
    for (let dx = 0; dx < roof.foot.w; dx++) cells.add(`${roof.foot.x + dx},${roof.foot.y + dy}`);
  const material = roof.params?.roofMaterial ?? styleRoofMaterial(roof.style);
  return {
    d: roofDepth(roof, dims),
    el: (
      <g key={`roof-${roof.id}`} style={{ transition: 'opacity 0.25s' }} opacity={cutaway ? 0 : 1} dangerouslySetInnerHTML={{ __html: roofFromCells(cells, dims, material) }} />
    ),
  };
}
