/**
 * Rendu CULLÉ de la scène triée + sandwich de BROUILLARD.
 * CULLING au viewport (espace ÉCRAN, PAS l'AABB de tuiles — qui en iso couvre quasi toute la scène) :
 * on projette la tuile de chaque objet lourd tagué (sol/décor/murs) et on ne rend que ceux dont le
 * centre tombe dans le rectangle écran (+ marge pour les corps/murs HAUTS). Le navigateur ne rastérise
 * alors que l'écran à chaque frame → fini le re-raster de toute la carte.
 */
import { useMemo } from 'react';
import { Dims, tileCenter } from '../iso';
import { fogVeilObjs, type FogParams } from '../FogLayer';
import { mergeByDepth, type StageObj } from './objs';
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
  // BROUILLARD ENTRELACÉ par la PROFONDEUR : chaque case cachée porte son voile à SA profondeur
  // (`fogVeilObjs`), fusionné dans le flux trié — plus de « sandwich » vis/!vis qui inversait le tri
  // (un mur visible DERRIÈRE se peignait par-dessus une rampe cachée DEVANT). Ainsi un décor caché
  // devant masque bien un visible derrière, et vice-versa. Mémoïsé sur les bornes ENTIÈRES du cadre +
  // la vision → ne reconstruit qu'au changement de cadre-tuile, pas à chaque pixel de pan.
  const veilObjs = useMemo(
    () => fogVeilObjs(fog, dims),
    [fog.visible, fog.explored, fog.bounds.minX, fog.bounds.maxX, fog.bounds.minY, fog.bounds.maxY, fog.floorZAt, dims],
  );
  // `.filter().map()` (pas map→null) → React ne réconcilie que les ~centaines d'objets à l'écran.
  const shown = mergeByDepth(objs, veilObjs).filter(onScreen);
  return <g>{shown.map(draw)}</g>;
}
