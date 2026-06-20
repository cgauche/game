/**
 * Brouillard de guerre — overlay de rendu (espace MONDE, même transform que les tokens). Couvre les
 * cases NON visibles d'un voile sombre : quasi-opaque sur l'INCONNU (rien ne transparaît, « même le
 * décor »), semi-transparent sur l'EXPLORÉ-hors-vue (décor mémorisé, grisé). Les cases EN VUE ne
 * reçoivent aucun voile. Bords ADOUCIS par flou SVG. Les créatures hors-vue sont coupées en amont
 * (IsoStage) ; ce voile gère le décor/terrain (qu'il recouvre) en un seul overlay.
 *
 * Mémoïsé (React.memo + useMemo) sur des props STABLES (Sets `visible`/`explored` à réf stable,
 * primitives de caméra) → ne se reconstruit PAS pendant la marche (qui re-rend IsoStage à 60 Hz).
 */
import React, { useMemo } from 'react';
import { Dims, ViewMode, diamondPath } from './iso';

interface FogLayerProps {
  w: number;
  h: number;
  z: number;
  rot: 0 | 1 | 2 | 3;
  view: ViewMode;
  edge: boolean;
  visible: Set<string>;
  explored: Set<string>;
}

export const FogLayer = React.memo(function FogLayer({ w, h, z, rot, view, edge, visible, explored }: FogLayerProps) {
  const { unknown, remembered } = useMemo(() => {
    const dims: Dims = { w, h, rot, view, edge };
    let unknownP = '';
    let rememberedP = '';
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = `${x},${y},${z}`;
        if (visible.has(k)) continue;
        const d = diamondPath(x, y, dims);
        if (explored.has(k)) rememberedP += d;
        else unknownP += d;
      }
    return { unknown: unknownP, remembered: rememberedP };
  }, [w, h, z, rot, view, edge, visible, explored]);

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
