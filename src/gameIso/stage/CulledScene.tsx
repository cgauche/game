/**
 * Rendu CULLÉ de la scène triée + sandwich de BROUILLARD.
 * CULLING au viewport (espace ÉCRAN, PAS l'AABB de tuiles — qui en iso couvre quasi toute la scène) :
 * on projette la tuile de chaque objet lourd tagué (sol/décor/murs) et on ne rend que ceux dont le
 * centre tombe dans le rectangle écran (+ marge pour les corps/murs HAUTS). Le navigateur ne rastérise
 * alors que l'écran à chaque frame → fini le re-raster de toute la carte.
 */
import { Dims, tileCenter, type Rot } from '../iso';
import { FogLayer } from '../FogLayer';
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
  fog: {
    w: number;
    h: number;
    rot: Rot;
    view: 'iso' | 'top';
    edge: boolean;
    visible: Set<string>;
    explored: Set<string>;
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
    floorZAt: (x: number, y: number) => number;
  };
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
  // assombrissement seuls (filtre `lower-floor-dim`) → l'étage inférieur recule, reste OPAQUE.
  // ACCENTS matériaux v2 : le thunk `acc` ne s'étend qu'ICI (éléments à l'écran uniquement),
  // rendu juste PAR-DESSUS son élément (même profondeur, même opacité), puis servi du cache.
  const draw = (o: StageObj) => {
    const core = o.acc ? (
      <g key={o.el.key}>
        {o.el}
        <g style={{ opacity: o.op ?? 1, transition: 'opacity 0.2s' }} dangerouslySetInnerHTML={{ __html: o.acc() }} />
      </g>
    ) : (
      o.el
    );
    return o.z !== undefined && o.z < activeZ ? (
      <g key={o.el.key} filter="url(#lower-floor-dim)">{core}</g>
    ) : (
      core
    );
  };
  // BROUILLARD ENCADRÉ par le tri : le voile se glisse ENTRE le décor caché (sol, terrain, entités
  // mémorisées/inconnues → `!vis`, DESSOUS, donc grisé/masqué) et le décor VISIBLE (murs/toits/tokens
  // → `vis`, AU-DESSUS). Ainsi un bâtiment qu'on voit garde son VOLUME HAUT même là où il déborde dans
  // les cases derrière (en ombre) : l'ombre ne mange plus son toit. `.filter().map()` (pas map→null) →
  // React ne réconcilie que les ~centaines d'objets à l'écran, pas les milliers de la scène.
  const shown = objs.filter(onScreen);
  return (
    <>
      <g>{shown.filter((o) => !o.vis).map(draw)}</g>
      <FogLayer w={fog.w} h={fog.h} z={activeZ} rot={fog.rot} view={fog.view} edge={fog.edge} visible={fog.visible} explored={fog.explored} bounds={fog.bounds} floorZAt={fog.floorZAt} />
      <g>{shown.filter((o) => o.vis).map(draw)}</g>
    </>
  );
}
