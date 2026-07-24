/**
 * Rendu CULLÉ de la scène triée + sandwich de BROUILLARD.
 * CULLING au viewport (espace ÉCRAN, PAS l'AABB de tuiles — qui en iso couvre quasi toute la scène) :
 * on projette la tuile de chaque objet lourd tagué (sol/décor/murs) et on ne rend que ceux dont le
 * centre tombe dans le rectangle écran (+ marge pour les corps/murs HAUTS). Le navigateur ne rastérise
 * alors que l'écran à chaque frame → fini le re-raster de toute la carte.
 *
 * VÉRITÉS DE VUE écran-espace (#797) : reveal de sol au-dessus d'un acteur, estompe d'occlusion de
 * mur, cutaway « derrière » de toit, et éclairage (`brightness`) par tuile — décidées ICI, sur les
 * SEULS objets déjà culled à l'écran (`shown`), jamais au build plein-carte (`layers.tsx` ne bake plus
 * que les vérités de SCÈNE invariantes : ghost/solidOverhang/roofOccupied/h). C'est le gain décisif
 * contre la rame au déplacement : `floorObjs`/`wallObjs`/`roofObjs` ne dépendent plus de la position
 * du groupe ni de l'éclairage.
 */
import { cloneElement } from 'react';
import { Dims, tileCenter, depth, makeOccludes, TW, TH, EDGE_H } from '../../geometry/iso';
import { metricToLift } from '../../state/relief';
import { AMBIANCE } from '../catalog/ambiance';
import type { LightField } from '../../state/vision';
import { fogFilterFor, type FogParams } from '../FogLayer';
import { lowerFloorDimCss } from '../catalog/ambiance';
import type { StageObj } from './objs';
import { VW, VH } from './useStageCamera';

const LOWER_FLOOR_CSS = lowerFloorDimCss();
/** Reveal d'un sol au-dessus d'un acteur EN DESSOUS (mêmes valeurs qu'avant #797, cf. layers.tsx). */
const OVERHANG_REVEAL_OPACITY = 0.22;
/** Estompe d'occlusion d'un mur/toit devant un acteur à suivre. */
const WALL_OCCLUDE_OPACITY = 0.4;
/** Toit cutaway en vue PLAN (top) : estompe plutôt qu'invisible (iso : 0). */
const ROOF_CUT_PLAN_OPACITY = 0.5;
/** Pas de QUANTIFICATION de la luminosité par tuile (≈15 paliers) : les tuiles voisines partagent la
 *  MÊME chaîne `brightness()` → coalescence sous un seul `<g filter>`, pas un filtre GPU par case. */
const LIGHT_STEP = 0.06;

/** Opacité EFFECTIVE (vérité de VUE écran-espace) d'un objet À L'ÉCRAN : sol (reveal au-dessus d'un
 *  acteur EN DESSOUS), mur/toit (estompe/cutaway devant un acteur à suivre). Fonction PURE et testée
 *  séparément (`CulledScene.test.tsx`) — la même logique alimente le rendu (`coreOf`) ci-dessous. */
export function viewOpacityOf(
  o: StageObj,
  dims: Dims,
  revealActors: { x: number; y: number; z: number; h: number }[],
  occludesActor: (x: number, y: number) => boolean,
  topView: boolean,
): number {
  const HALF_H = (dims.edge && dims.view !== 'top' ? EDGE_H : TH) / 2, TOKEN_H = 92, TOKEN_HW = TW * 0.45;
  if (o.h !== undefined) {
    // SOL : op bakée (ghost/solidOverhang) sauf reveal — critère : la tuile se dessine APRÈS l'acteur
    // (depth) ET le recouvre à l'écran (tileCenter) — robuste aux 4 rotations.
    if (o.ghost || o.z === undefined || o.z <= 0 || !revealActors.length) return o.op ?? 1;
    const T = tileCenter(o.x!, o.y!, dims, metricToLift(o.h));
    for (const a of revealActors) {
      if (a.h >= o.h || o.d <= depth(a.x, a.y, dims, a.z) + 0.5) continue; // acteur au moins aussi haut, ou sol dessiné AVANT lui
      const A = tileCenter(a.x, a.y, dims, metricToLift(a.h));
      if (Math.abs(T.cx - A.cx) <= TW / 2 + TOKEN_HW && T.cy - HALF_H < A.cy && T.cy + HALF_H > A.cy - TOKEN_H) return OVERHANG_REVEAL_OPACITY; // recouvrement écran
    }
    return o.op ?? 1;
  }
  if (o.roofCell) {
    // TOIT : cutaway = occupé (bakée) OU derrière un acteur (écran-espace).
    const cell = o.roofCell, span = o.roofSpan!;
    let behind = false;
    for (let dy = 0; dy < span.h && !behind; dy++)
      for (let dx = 0; dx < span.w && !behind; dx++)
        if (occludesActor(cell.x + dx, cell.y + dy)) behind = true;
    return o.roofOccupied || behind ? (topView ? ROOF_CUT_PLAN_OPACITY : 0) : 1;
  }
  if (o.x !== undefined) return occludesActor(o.x, o.y!) ? WALL_OCCLUDE_OPACITY : 1; // MUR
  return o.op ?? 1;
}

/** Fragment de filtre CSS d'ÉCLAIRAGE (`brightness(L)`) d'une tuile de sol : `base × light` clampé au
 *  plancher partagé, arrondi au cran (coalescence). Plein jour (`L ≥ 0.995`) = AUCUN filtre (no-op). */
export function tileBrightness(o: StageObj, light?: LightField): string | undefined {
  if (!light || o.h === undefined || o.x === undefined) return undefined;
  const L = Math.max(light.at(o.x, o.y!, o.z ?? 0), AMBIANCE.ambientFloor);
  const qL = Math.round(L / LIGHT_STEP) * LIGHT_STEP;
  return L >= 0.995 ? undefined : `brightness(${qL.toFixed(2)})`;
}

export function CulledScene({
  objs,
  dims,
  cam,
  zoom,
  activeZ,
  fog,
  light,
  revealActors,
  occludeTiles,
  topView,
}: {
  objs: StageObj[];
  dims: Dims;
  cam: { x: number; y: number };
  zoom: number;
  activeZ: number;
  fog: FogParams;
  /** Champ d'éclairage par tuile (optionnel : absent en éditeur/QC). */
  light?: LightField;
  /** Acteurs à RÉVÉLER (sol) — position + hauteur MÉTRIQUE, résolues au niveau du stage (liste courte,
   *  jamais un scan de carte) : cf. `revealActorsOf` (layers.tsx). */
  revealActors: { x: number; y: number; z: number; h: number }[];
  /** Cases occupées par un acteur « à suivre » (mur/toit) : cf. `actorTilesOf` (layers.tsx). */
  occludeTiles: { x: number; y: number }[];
  /** Vue du dessus (plan) : un toit cutaway s'estompe plutôt que de disparaître. */
  topView: boolean;
}) {
  const hw = VW / (2 * zoom), hh = VH / (2 * zoom), M = 220;
  const cl = VW / 2 - cam.x - hw, cr = VW / 2 - cam.x + hw;
  const ct = VH / 2 - cam.y - hh, cb = VH / 2 - cam.y + hh;
  const onScreen = (o: StageObj) => {
    if (o.x === undefined) return true; // non tagué (tokens/FX/toits) : toujours rendu
    const c = tileCenter(o.x, o.y!, dims);
    return c.cx >= cl - M && c.cx <= cr + M && c.cy >= ct - M && c.cy <= cb + M;
  };
  const shown = objs.filter(onScreen);

  // ── Vérités de VUE écran-espace, sur les objets À L'ÉCRAN uniquement (viewOpacityOf/tileBrightness
  //    ci-dessus) ────────────────────────────────────────────────────────────────────────────────
  const occludesActor = makeOccludes(dims, occludeTiles);

  // Atténuer SANS opacité (sinon on verrait À TRAVERS les murs du dessous) : désaturation +
  // assombrissement seuls (filtres) → l'élément recule mais reste OPAQUE. Deux voiles composés :
  //  - `lower-floor-dim` : étage SOUS la zone active (z < activeZ).
  //  - BROUILLARD par objet (`fog-remembered`/`fog-unknown`) : case hors-vue, à SA profondeur → un mur
  //    HAUT est assombri sur toute sa silhouette (plus de triangle du losange plat), et un décor caché
  //    DEVANT reste devant (fini le sandwich vis/!vis qui écrasait le tri : mur visible sur rampe cachée).
  // ACCENTS matériaux v2 : le thunk `acc` ne s'étend qu'ICI (éléments à l'écran uniquement).
  const coreOf = (o: StageObj) => {
    const op = viewOpacityOf(o, dims, revealActors, occludesActor, topView);
    const baked = o.roofCell ? 1 : o.op ?? 1; // opacité déjà bakée dans `o.el` (sol ghost/solidOverhang ; mur/toit toujours 1)
    const el = op === baked ? o.el : o.roofCell ? cloneElement(o.el, { opacity: op }) : cloneElement(o.el, { style: { ...(o.el.props.style || {}), opacity: op } });
    return o.acc ? (
      <g key={o.el.key}>
        {el}
        <g style={{ opacity: op, transition: 'opacity 0.2s' }} dangerouslySetInnerHTML={{ __html: o.acc() }} />
      </g>
    ) : el;
  };

  // COALESCENCE des VOILES : un filtre CSS crée une couche GPU par élément — regrouper les objets
  // FILTRÉS consécutifs (fog/étage inférieur/éclairage) sous UN SEUL <g filter> évite des centaines de
  // couches. MAIS on ne regroupe QUE le décor filtré : un objet NON filtré (jeton animé) reste un ENFANT
  // DIRECT, avec sa clé STABLE → React ne le RÉMONTE pas quand il change de profondeur (sinon son cycle
  // de marche se réinitialise à chaque frame et le perso « glisse » sans animer les jambes). Tri par
  // profondeur préservé : runs filtrés et jetons directs sont émis dans l'ordre trié.
  const out: JSX.Element[] = [];
  let runItems: JSX.Element[] | null = null;
  let runFilt = '';
  let runKey = 0;
  const flush = () => { if (runItems) { out.push(<g key={`veil:${runKey++}`} style={{ filter: runFilt }}>{runItems}</g>); runItems = null; } };
  for (const o of shown) {
    const fogF = fogFilterFor(o, fog.explored);
    const lower = o.z !== undefined && o.z < activeZ;
    const dim = tileBrightness(o, light);
    const filt = [lower ? LOWER_FLOOR_CSS : null, fogF, dim].filter(Boolean).join(' ');
    if (filt) {
      if (runItems && runFilt !== filt) flush();
      if (!runItems) { runItems = []; runFilt = filt; }
      runItems.push(coreOf(o));
    } else {
      flush();
      out.push(coreOf(o)); // jeton/décor NON filtré : enfant direct, clé stable (o.el.key)
    }
  }
  flush();
  return <g>{out}</g>;
}
