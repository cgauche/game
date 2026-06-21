/**
 * Brouillard de guerre — overlay de rendu (espace MONDE, même transform que les tokens). Couvre les
 * cases NON visibles d'un voile sombre : quasi-opaque sur l'INCONNU (rien ne transparaît, « même le
 * décor »), semi-transparent sur l'EXPLORÉ-hors-vue (décor mémorisé, grisé). Les cases EN VUE ne
 * reçoivent aucun voile. Bords ADOUCIS par flou SVG. Les créatures hors-vue sont coupées en amont
 * (IsoStage) ; ce voile gère le décor/terrain (qu'il recouvre) en un seul overlay.
 *
 * PERF : on ne dessine QUE les tuiles dans le cadre VISIBLE (`bounds` + marge) — le chemin est borné
 * par la FENÊTRE, pas par la scène (sinon une grande carte murée = chemin de 300k chars re-rastérisé
 * à chaque frame de caméra → ~100 ms/frame). Les bornes sont des ENTIERS : le memo ne reconstruit
 * qu'au changement de cadre-tuile (pas à chaque pixel de pan) ; la marge couvre le glissement sous-tuile.
 */
import React, { useMemo } from 'react';
import { Dims, ViewMode, diamondPath } from './iso';

interface Bounds { minX: number; maxX: number; minY: number; maxY: number }
interface FogLayerProps {
  w: number;
  h: number;
  z: number;
  rot: 0 | 1 | 2 | 3;
  view: ViewMode;
  edge: boolean;
  visible: Set<string>;
  explored: Set<string>;
  bounds: Bounds;
}

const MARGIN = 5; // tuiles autour du cadre : couvre le pan sous-tuile + l'étalement du flou

export const FogLayer = React.memo(function FogLayer({ w, h, z, rot, view, edge, visible, explored, bounds }: FogLayerProps) {
  const { minX, maxX, minY, maxY } = bounds;
  const { unknown, remembered } = useMemo(() => {
    const dims: Dims = { w, h, rot, view, edge };
    const x0 = Math.max(0, minX - MARGIN), x1 = Math.min(w - 1, maxX + MARGIN);
    const y0 = Math.max(0, minY - MARGIN), y1 = Math.min(h - 1, maxY + MARGIN);
    let unknownP = '';
    let rememberedP = '';
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const k = `${x},${y},${z}`;
        if (visible.has(k)) continue;
        const d = diamondPath(x, y, dims);
        if (explored.has(k)) rememberedP += d;
        else unknownP += d;
      }
    return { unknown: unknownP, remembered: rememberedP };
    // Deps sur les ENTIERS du cadre (pas l'objet `bounds`) → pas de rebuild tant que le cadre-tuile est stable.
  }, [w, h, z, rot, view, edge, visible, explored, minX, maxX, minY, maxY]);

  if (!unknown && !remembered) return null;
  return (
    <g className="fog" pointerEvents="none">
      <defs>
        <filter id="fog-feather" x="-12%" y="-12%" width="124%" height="124%">
          <feGaussianBlur stdDeviation={11} />
        </filter>
      </defs>
      <g filter="url(#fog-feather)">
        {remembered && <path d={remembered} fill="#06050d" opacity={0.52} />}
        {unknown && <path d={unknown} fill="#04030a" opacity={0.985} />}
      </g>
    </g>
  );
});
