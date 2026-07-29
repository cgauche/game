/**
 * Rendu CULLÉ de la scène triée + sandwich de BROUILLARD.
 * CULLING au viewport (espace ÉCRAN, PAS l'AABB de tuiles — qui en iso couvre quasi toute la scène) :
 * on projette la tuile de chaque objet lourd tagué (sol/décor/murs) et on ne rend que ceux dont le
 * centre tombe dans le rectangle écran (+ marge pour les corps/murs HAUTS). Le navigateur ne rastérise
 * alors que l'écran à chaque frame → fini le re-raster de toute la carte.
 *
 * VÉRITÉS DE VUE écran-espace (#797) : pièce mise au point (`roomFocus`) et éclairage (`brightness`)
 * par tuile — décidées ICI, sur les SEULS objets déjà culled à l'écran (`shown`), jamais au build
 * plein-carte. C'est le gain décisif contre la rame au déplacement : `floorObjs`/`wallObjs`/`roofObjs`
 * ne dépendent plus de la position du groupe ni de l'éclairage.
 *
 * Ce qui COIFFE le groupe (toit, dalle et murs d'un niveau supérieur) n'est pas traité ici : il est
 * RETIRÉ en amont, par masse entière, par la loi de dégagement (`stage/architectureVisibility.ts`).
 */
import { cloneElement, useRef } from 'react';
import { Dims, tileCenter, depth, TW, type ActorCapsule } from '../../geometry/iso';
import { metricToLift } from '../../state/relief';
import { AMBIANCE } from '../catalog/ambiance';
import type { LightField } from '../../state/vision';
import { fogFilterFor, type FogParams } from '../FogLayer';
import { lowerFloorDimCss } from '../catalog/ambiance';
import type { StageObj } from './objs';
import { VW, VH } from './useStageCamera';
import type { RoomFocus } from './roomFocus';

const LOWER_FLOOR_CSS = lowerFloorDimCss();
/** Demi-largeur ÉCRAN du jeton — rayon de la capsule de l'acteur (`actorCapsuleOf`, visée caméra et
 *  géométrie d'occlusion). Calée sur le CORPS DESSINÉ : elle couvre la carrure la PLUS LARGE qu'un
 *  héros de Taille Moyenne ou moindre puisse présenter (gabarit `courtaud` du Nain, `build` au
 *  maximum), à l'échelle de token d'un combattant (`combatantObjs`). Sous-couvrir manquerait les
 *  occulteurs posés sur les épaules — le défaut d'origine. Le contrat (couvrir le corps MESURÉ sans
 *  le doubler) est tenu par `CulledScene.test.tsx`, qui remesure le rig au lieu de figer un nombre. */
const TOKEN_HALF_WIDTH = TW * 0.37;
/** Pas de QUANTIFICATION de la luminosité par tuile (≈15 paliers) : les tuiles voisines partagent la
 *  MÊME chaîne `brightness()` → coalescence sous un seul `<g filter>`, pas un filtre GPU par case. */
const LIGHT_STEP = 0.06;

/** Entrée du cache d'IDENTITÉ d'élément : l'élément rendu pour `o`, valable tant que la donnée et les
 *  deux seules vérités de vue qui le déterminent (`op` effectif, matérialisation du détail) tiennent. */
type CachedEl = { o: StageObj; op: number; mat: boolean; el: JSX.Element };
/** Entrée du cache d'un RUN de voile : le `<g filter>` rendu, valable tant que son filtre et la SUITE
 *  de ses enfants (comparés par RÉFÉRENCE) tiennent. */
type CachedVeil = { filt: string; items: JSX.Element[]; el: JSX.Element };

/** Deux listes d'éléments sont-elles la MÊME suite, référence à référence ? */
function sameItems(a: readonly JSX.Element[], b: readonly JSX.Element[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

export function actorCapsuleOf(
  actor: { x: number; y: number; h: number },
  dims: Dims,
): ActorCapsule {
  const base = metricToLift(actor.h);
  const top = base + 1;
  const foot = tileCenter(actor.x, actor.y, dims, base);
  const head = tileCenter(actor.x, actor.y, dims, top);
  return {
    segment: [{ x: foot.cx, y: foot.cy }, { x: head.cx, y: head.cy }],
    radius: TOKEN_HALF_WIDTH,
    depth: depth(actor.x, actor.y, dims, base),
    vertical: [base, top],
  };
}

/** Opacité d'un objet À L'ÉCRAN : celle que sa couche a bakée (`layers.tsx` — silhouette de surplomb,
 *  surplomb plein), les toits étant toujours opaques. Aucun voile de vue ne s'y superpose : ce qui
 *  gêne la lecture d'un intérieur est RETIRÉ par la loi de dégagement (`cutawayForSection` /
 *  `cutawayOverhead`, résolue en amont dans `IsoStage`), jamais rendu translucide. */
export function bakedOpacityOf(o: StageObj): number {
  return o.roofCell ? 1 : o.op ?? 1;
}

export function roomOpacityOf(o: StageObj, focus: RoomFocus | null | undefined, dims: Dims): number {
  if (!focus || !o.kind) return 1;
  if (o.kind === 'roof') return 1;
  if (o.kind === 'wall' && o.roomZoneIds?.length) return 1;
  const z = o.z ?? o.roofCell?.z ?? 0;
  if (z !== focus.z) return 0;
  const has = (x: number, y: number) => focus.tiles.has(`${x},${y},${focus.z}`);
  if (o.kind === 'floor')
    return o.x !== undefined && o.y !== undefined && has(o.x, o.y) ? 1 : 0;
  if (o.kind === 'prop')
    return o.x !== undefined && o.y !== undefined && has(o.x, o.y) ? 1 : 0;
  if (o.kind === 'wall') {
    if (o.x === undefined || o.y === undefined || !o.side) return 0;
    const anchor = { x: o.x, y: o.y };
    const other = o.side === 'N'
      ? { x: o.x, y: o.y - 1 }
      : o.side === 'S'
        ? { x: o.x, y: o.y + 1 }
        : o.side === 'E'
          ? { x: o.x + 1, y: o.y }
          : { x: o.x - 1, y: o.y };
    const anchorInside = has(anchor.x, anchor.y);
    const otherInside = has(other.x, other.y);
    if (anchorInside === otherInside) return anchorInside ? 1 : 0;
    const inside = anchorInside ? anchor : other;
    const outside = anchorInside ? other : anchor;
    return depth(outside.x, outside.y, dims, z) > depth(inside.x, inside.y, dims, z) ? 0 : 1;
  }
  return 0;
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
  roomFocus,
}: {
  objs: StageObj[];
  dims: Dims;
  cam: { x: number; y: number };
  zoom: number;
  activeZ: number;
  fog: FogParams;
  /** Champ d'éclairage par tuile (optionnel : absent en éditeur/QC). */
  light?: LightField;
  /** Pièce mise au point (le groupe s'y tient) : hors d'elle, rien de son étage n'est peint. */
  roomFocus?: RoomFocus | null;
}) {
  const hw = VW / (2 * zoom), hh = VH / (2 * zoom), M = 220;
  const cl = VW / 2 - cam.x - hw, cr = VW / 2 - cam.x + hw;
  const ct = VH / 2 - cam.y - hh, cb = VH / 2 - cam.y + hh;
  const onScreen = (o: StageObj) => {
    if (o.bounds) {
      return o.bounds.right >= cl && o.bounds.left <= cr && o.bounds.bottom >= ct && o.bounds.top <= cb;
    }
    if (o.roofCells) {
      return o.roofCells.some((cell) => {
        const c = tileCenter(cell.x, cell.y, dims);
        return c.cx >= cl - M && c.cx <= cr + M && c.cy >= ct - M && c.cy <= cb + M;
      });
    }
    if (o.x === undefined) return true; // non tagué (tokens/FX) : toujours rendu
    const c = tileCenter(o.x, o.y!, dims);
    return c.cx >= cl - M && c.cx <= cr + M && c.cy >= ct - M && c.cy <= cb + M;
  };
  const shown = objs.filter(onScreen);
  // CACHE D'IDENTITÉ D'ÉLÉMENT. Le stage se re-rend à ~60 Hz pendant une marche (`useWalkAnim` force
  // une image par frame) alors que la quasi-totalité de la scène est INCHANGÉE : sans cache, chaque
  // image ré-alloue l'arbre ENTIER (un `cloneElement` par objet à l'écran) et React re-diffe des
  // milliers de nœuds pour n'écrire rien. En rendant la MÊME référence d'élément, `oldProps ===
  // newProps` et React saute le sous-arbre. `op` et `mat` RÉSUMENT à eux seuls toutes les vérités de
  // vue que `coreOf` consomme (occlusion caméra, reveal de sol, cutaway de toit, pièce, brouillard) :
  // deux images qui partagent `(o, op, mat)` produisent le même élément, au pixel près.
  const elCache = useRef(new Map<string, CachedEl>());
  const veilCache = useRef(new Map<string, CachedVeil>());
  const rootCache = useRef<{ items: JSX.Element[]; el: JSX.Element } | null>(null);
  const prevEls = elCache.current, nextEls = new Map<string, CachedEl>();
  const prevVeils = veilCache.current, nextVeils = new Map<string, CachedVeil>();

  // Atténuation par filtres CSS groupés. Deux voiles composés :
  //  - `lower-floor-dim` : étage SOUS la zone active (z < activeZ).
  //  - BROUILLARD par objet (`fog-remembered`/`fog-unknown`) : case hors-vue, à SA profondeur → un mur
  //    HAUT est assombri sur toute sa silhouette (plus de triangle du losange plat), et un décor caché
  //    DEVANT reste devant (fini le sandwich vis/!vis qui écrasait le tri : mur visible sur rampe cachée).
  // ACCENTS matériaux v2 : le thunk `acc` ne s'étend qu'ICI (éléments à l'écran uniquement).
  const coreOf = (o: StageObj) => {
    const op = bakedOpacityOf(o) * roomOpacityOf(o, roomFocus, dims);
    const unknownFog = o.x !== undefined
      && !o.vis
      && !fog.explored.has(`${o.x},${o.y},${o.z ?? 0}`);
    const materializeDetail = !unknownFog && op > 0;
    const key = o.el.key === null ? null : String(o.el.key);
    if (key !== null) {
      const hit = prevEls.get(key);
      if (hit && hit.o === o && hit.op === op && hit.mat === materializeDetail) {
        nextEls.set(key, hit);
        return hit.el;
      }
    }
    const baseEl = o.svg && materializeDetail
      ? cloneElement(o.el, { dangerouslySetInnerHTML: { __html: o.svg() } })
      : o.el;
    const baked = o.roofCell ? 1 : o.op ?? 1; // opacité déjà bakée dans `o.el` (sol ghost/solidOverhang ; mur/toit toujours 1)
    const intrinsic = typeof baseEl.type === 'string';
    const el = op === baked
      ? baseEl
      : !intrinsic
        ? <g key={baseEl.key} style={{ opacity: op, transition: 'opacity 0.2s' }}>{baseEl}</g>
        : o.roofCell
          ? cloneElement(baseEl, { opacity: op })
          : cloneElement(baseEl, { style: { ...(baseEl.props.style || {}), opacity: op } });
    const node = o.acc && materializeDetail ? (
      <g key={o.el.key}>
        {el}
        <g style={{ opacity: op, transition: 'opacity 0.2s' }} dangerouslySetInnerHTML={{ __html: o.acc() }} />
      </g>
    ) : el;
    if (key !== null) nextEls.set(key, { o, op, mat: materializeDetail, el: node });
    return node;
  };

  // COALESCENCE des VOILES : un filtre CSS crée une couche GPU par élément — regrouper les objets
  // FILTRÉS consécutifs (fog/étage inférieur/éclairage) sous UN SEUL <g filter> évite des centaines de
  // couches. MAIS on ne regroupe QUE le décor filtré : un objet NON filtré (jeton animé) reste un ENFANT
  // DIRECT, avec sa clé STABLE → React ne le RÉMONTE pas quand il change de profondeur (sinon son cycle
  // de marche se réinitialise à chaque frame et le perso « glisse » sans animer les jambes). Tri par
  // profondeur préservé : runs filtrés et jetons directs sont émis dans l'ordre trié.
  // Clé du run ANCRÉE sur son PREMIER objet (clé de scène stable, `floor:x,y,z`…) et JAMAIS un
  // compteur : un compteur re-numérote TOUS les runs suivants dès qu'une frontière bouge quelque part
  // (le voile se déplace à chaque pas) → React démonte puis remonte toute la fin de la scène. Ancrée,
  // une frontière qui bouge ne perturbe que SES runs. Mesuré sur La Diligence (#808) : ~3 300
  // opérations de nœud DOM par pas avec le compteur.
  const out: JSX.Element[] = [];
  let runItems: JSX.Element[] | null = null;
  let runFilt = '';
  // Un run dont le filtre ET la suite d'enfants (par RÉFÉRENCE, donc via le cache ci-dessus) sont
  // inchangés rend le MÊME `<g>` : React saute alors les CENTAINES de tuiles qu'il porte d'un coup.
  const flush = () => {
    if (!runItems) return;
    const key = `veil:${runItems[0].key}`;
    const hit = prevVeils.get(key);
    if (hit && hit.filt === runFilt && sameItems(hit.items, runItems)) {
      nextVeils.set(key, hit);
      out.push(hit.el);
    } else {
      const el = <g key={key} style={{ filter: runFilt }}>{runItems}</g>;
      nextVeils.set(key, { filt: runFilt, items: runItems, el });
      out.push(el);
    }
    runItems = null;
  };
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
  elCache.current = nextEls;
  veilCache.current = nextVeils;
  // Image où RIEN n'a bougé à l'écran (le jeton glisse hors du décor, la caméra suit) : la racine
  // elle-même est réutilisée et React s'arrête au premier nœud.
  const cachedRoot = rootCache.current;
  if (cachedRoot && sameItems(cachedRoot.items, out)) return cachedRoot.el;
  const root = <g>{out}</g>;
  rootCache.current = { items: out, el: root };
  return root;
}
