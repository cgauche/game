/**
 * Brouillard de guerre — overlay de rendu (espace MONDE, même transform que les tokens). Couvre les
 * cases NON visibles d'un voile sombre : quasi-opaque sur l'INCONNU (rien ne transparaît, « même le
 * décor »), semi-transparent sur l'EXPLORÉ-hors-vue (décor mémorisé, grisé). Les cases EN VUE ne
 * reçoivent aucun voile. Bords ADOUCIS par flou SVG. Les créatures hors-vue sont coupées en amont
 * (IsoStage) ; ce voile gère le décor/terrain (qu'il recouvre) en un seul overlay.
 *
 * PERF (2 leviers) :
 *  1. CULLING au cadre visible (`bounds` + marge) → chemin borné par la FENÊTRE, pas par la scène.
 *  2. FUSION de blocs N×N PLEINEMENT uniformes (tout inconnu / tout mémorisé) en UN losange (union
 *     exacte, zéro changement visuel) → ~N² fois moins de polygones sur les grandes zones pleines (le
 *     coût = le RASTER de SVG par frame de caméra, ∝ nb de polygones). Les FRONTIÈRES restent par
 *     TUILE (précision conservée). Sans ça, l'Opéra plein noir = ~686 polygones re-rastérisés/frame ≈ 42 ms.
 * Bornes ENTIÈRES → le memo ne reconstruit qu'au changement de cadre-tuile (pas à chaque pixel de pan).
 */
import React, { useMemo } from 'react';
import { Dims, ViewMode, TW, TH, CELL, EDGE_W, EDGE_H, tileCenter, diamondPath } from './iso';

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
const BLOCK = 4; // taille de fusion (un bloc BLOCK×BLOCK uniforme = 1 losange)

/** Losange/carré couvrant un bloc N×N de tuiles ancré en (x0,y0) — union EXACTE des N² tuiles
 *  (rotation/vue gérées par `tileCenter`). N=1 ⇒ une tuile. */
function blockPath(x0: number, y0: number, n: number, dims: Dims, view: ViewMode, edge: boolean): string {
  const { cx, cy } = tileCenter(x0 + (n - 1) / 2, y0 + (n - 1) / 2, dims);
  if (view === 'top') {
    const hx = (n * CELL) / 2;
    return `M${cx - hx},${cy - hx} L${cx + hx},${cy - hx} L${cx + hx},${cy + hx} L${cx - hx},${cy + hx}Z`;
  }
  if (edge) {
    const hx = (n * EDGE_W) / 2, hy = (n * EDGE_H) / 2;
    return `M${cx - hx},${cy - hy} L${cx + hx},${cy - hy} L${cx + hx},${cy + hy} L${cx - hx},${cy + hy}Z`;
  }
  const hx = (n * TW) / 2, hy = (n * TH) / 2;
  return `M${cx},${cy - hy} L${cx + hx},${cy} L${cx},${cy + hy} L${cx - hx},${cy}Z`;
}

export const FogLayer = React.memo(function FogLayer({ w, h, z, rot, view, edge, visible, explored, bounds }: FogLayerProps) {
  const { minX, maxX, minY, maxY } = bounds;
  const { unknown, remembered } = useMemo(() => {
    const dims: Dims = { w, h, rot, view, edge };
    const x0 = Math.max(0, minX - MARGIN), x1 = Math.min(w - 1, maxX + MARGIN);
    const y0 = Math.max(0, minY - MARGIN), y1 = Math.min(h - 1, maxY + MARGIN);
    // 0 = visible (pas de voile), 1 = exploré-mémorisé (semi), 2 = inconnu (opaque).
    const stateAt = (x: number, y: number) => { const k = `${x},${y},${z}`; return visible.has(k) ? 0 : explored.has(k) ? 1 : 2; };
    let unknownP = '';
    let rememberedP = '';
    for (let by = y0; by <= y1; by += BLOCK)
      for (let bx = x0; bx <= x1; bx += BLOCK) {
        const ex = Math.min(bx + BLOCK - 1, x1), ey = Math.min(by + BLOCK - 1, y1);
        const full = ex - bx + 1 === BLOCK && ey - by + 1 === BLOCK;
        let uniform: number | -1 = -1, mixed = false;
        for (let y = by; y <= ey && !mixed; y++)
          for (let x = bx; x <= ex; x++) {
            const s = stateAt(x, y);
            if (uniform === -1) uniform = s; else if (s !== uniform) { mixed = true; break; }
          }
        if (!mixed && uniform === 0) continue; // bloc entièrement visible → aucun voile
        if (full && !mixed && uniform === 2) unknownP += blockPath(bx, by, BLOCK, dims, view, edge);
        else if (full && !mixed && uniform === 1) rememberedP += blockPath(bx, by, BLOCK, dims, view, edge);
        else
          for (let y = by; y <= ey; y++)
            for (let x = bx; x <= ex; x++) {
              const s = stateAt(x, y);
              if (s === 2) unknownP += diamondPath(x, y, dims);
              else if (s === 1) rememberedP += diamondPath(x, y, dims);
            }
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
