/**
 * Rendu CULLÉ de la scène triée + sandwich de BROUILLARD.
 * CULLING au viewport (espace ÉCRAN, PAS l'AABB de tuiles — qui en iso couvre quasi toute la scène) :
 * on projette la tuile de chaque objet lourd tagué (sol/décor/murs) et on ne rend que ceux dont le
 * centre tombe dans le rectangle écran (+ marge pour les corps/murs HAUTS). Le navigateur ne rastérise
 * alors que l'écran à chaque frame → fini le re-raster de toute la carte.
 */
import { Dims, tileCenter } from '../iso';
import { fogFilterFor, type FogParams } from '../FogLayer';
import type { StageObj } from './objs';
import { VW, VH } from './useStageCamera';

export function CulledScene({
  objs,
  dims,
  cam,
  zoom,
  activeZ,
  fog,
}: {
  objs: StageObj[];
  dims: Dims;
  cam: { x: number; y: number };
  zoom: number;
  activeZ: number;
  fog: FogParams;
}) {
  const hw = VW / (2 * zoom), hh = VH / (2 * zoom), M = 220;
  const cl = VW / 2 - cam.x - hw, cr = VW / 2 - cam.x + hw;
  const ct = VH / 2 - cam.y - hh, cb = VH / 2 - cam.y + hh;
  const onScreen = (o: StageObj) => {
    if (o.x === undefined) return true; // non tagué (tokens/FX) : toujours rendu
    const c = tileCenter(o.x, o.y!, dims);
    return c.cx >= cl - M && c.cx <= cr + M && c.cy >= ct - M && c.cy <= cb + M;
  };
  // Atténuer SANS opacité (sinon on verrait À TRAVERS les murs du dessous) : désaturation +
  // assombrissement seuls (filtres) → l'élément recule mais reste OPAQUE. Deux voiles composés :
  //  - `lower-floor-dim` : étage SOUS la zone active (z < activeZ).
  //  - BROUILLARD par objet (`fog-remembered`/`fog-unknown`) : case hors-vue, à SA profondeur → un mur
  //    HAUT est assombri sur toute sa silhouette (plus de triangle du losange plat), et un décor caché
  //    DEVANT reste devant (fini le sandwich vis/!vis qui écrasait le tri : mur visible sur rampe cachée).
  // ACCENTS matériaux v2 : le thunk `acc` ne s'étend qu'ICI (éléments à l'écran uniquement).
  const draw = (o: StageObj) => {
    const core = o.acc ? (
      <g key={o.el.key}>
        {o.el}
        <g style={{ opacity: o.op ?? 1, transition: 'opacity 0.2s' }} dangerouslySetInnerHTML={{ __html: o.acc() }} />
      </g>
    ) : (
      o.el
    );
    const fogF = fogFilterFor(o, fog.explored);
    const lower = o.z !== undefined && o.z < activeZ;
    if (!fogF && !lower) return core;
    let node = core;
    if (fogF) node = <g filter={fogF}>{node}</g>;
    if (lower) node = <g filter="url(#lower-floor-dim)">{node}</g>;
    return <g key={o.el.key}>{node}</g>;
  };
  // `.filter().map()` (pas map→null) → React ne réconcilie que les ~centaines d'objets à l'écran.
  const shown = objs.filter(onScreen);
  return <g>{shown.map(draw)}</g>;
}
