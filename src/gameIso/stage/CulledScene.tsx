/**
 * Rendu CULLÉ de la scène triée + sandwich de BROUILLARD.
 * CULLING au viewport (espace ÉCRAN, PAS l'AABB de tuiles — qui en iso couvre quasi toute la scène) :
 * on projette la tuile de chaque objet lourd tagué (sol/décor/murs) et on ne rend que ceux dont le
 * centre tombe dans le rectangle écran (+ marge pour les corps/murs HAUTS). Le navigateur ne rastérise
 * alors que l'écran à chaque frame → fini le re-raster de toute la carte.
 */
import { Dims, tileCenter } from '../iso';
import { fogFilterFor, type FogParams } from '../FogLayer';
import { lowerFloorDimCss } from '../catalog/ambiance';
import type { StageObj } from './objs';
import { VW, VH } from './useStageCamera';

const LOWER_FLOOR_CSS = lowerFloorDimCss();

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
  const coreOf = (o: StageObj) =>
    o.acc ? (
      <g key={o.el.key}>
        {o.el}
        <g style={{ opacity: o.op ?? 1, transition: 'opacity 0.2s' }} dangerouslySetInnerHTML={{ __html: o.acc() }} />
      </g>
    ) : (
      o.el
    );
  // `.filter().map()` (pas map→null) → React ne réconcilie que les ~centaines d'objets à l'écran.
  const shown = objs.filter(onScreen);
  // COALESCENCE : un filtre SVG re-rastérise PAR élément → un filtre/objet caché = des centaines de
  // passes = ça rame. Le fog étant spatialement groupé (périphérie), les objets CONSÉCUTIFS du flux trié
  // partagent le même voile → on les regroupe sous UN SEUL <g filter> par RUN (le tri par profondeur est
  // préservé : les runs sont contigus). Passe de ~centaines de filtres à une poignée.
  const runs: { fogF: string | undefined; lower: boolean; items: JSX.Element[] }[] = [];
  let run: (typeof runs)[number] | null = null;
  for (const o of shown) {
    const fogF = fogFilterFor(o, fog.explored);
    const lower = o.z !== undefined && o.z < activeZ;
    if (!run || run.fogF !== fogF || run.lower !== lower) { run = { fogF, lower, items: [] }; runs.push(run); }
    run.items.push(coreOf(o));
  }
  return (
    <g>
      {runs.map((r, i) => {
        // fog + lower-floor = UN SEUL CSS `filter` (GPU) par run → plus aucun filtre SVG re-rastérisé.
        const filt = [r.lower ? LOWER_FLOOR_CSS : null, r.fogF].filter(Boolean).join(' ');
        return filt ? <g key={i} style={{ filter: filt }}>{r.items}</g> : <g key={i}>{r.items}</g>;
      })}
    </g>
  );
}
