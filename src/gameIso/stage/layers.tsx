/**
 * Couche STATIQUE des MURS pour le PLAN DE STATION (`gameIso/TopoScene`) : les éléments du builder
 * (`builders/walls`, camera-free) projetés en trait symbolique par le peintre `authoring/wallsSvg`,
 * puis triés par `stage/objs`.
 *
 * C'est tout ce qui reste de l'assemblage de couches SVG : la voie de JEU affine est morte
 * (#1176 P3-4, commit C5a), et avec elle les sols et les toits projetés (`floorLayerObjs`/
 * `roofLayerObjs`), qui n'avaient plus de consommateur. Le plan de station, lui, garde SA structure au
 * trait : la coiffe d'un mur volumique tombe sous le pixel à l'échelle d'un plan (mesure au JSDoc de
 * `stage/planSnapshot.ts`), là où le trait est invariant d'échelle — sa MATIÈRE vient, elle, de
 * l'instantané volumique.
 * Fonction PURE.
 */
import { projectOccluder, type Dims } from '../../geometry/iso';
import { memoByRefDeps } from '../../state/sceneMemo';
import { panelOf } from './occluders';
import { wallSvg, wallAccentsSvg, wallDepth } from '../authoring/wallsSvg';
import type { DetailOpts } from '../authoring/detailSvg';
import type { WallEl } from '../builders/types';
import type { StageObj } from './objs';

/**
 * PROJECTION MÉMOÏSÉE PAR ÉLÉMENT (#808) : identité d'élément inchangée ET mêmes paramètres de
 * projection ⇒ MÊME `StageObj`. Aucune invalidation manuelle — les paramètres sont COMPARÉS, jamais
 * notifiés. UNE seule variante est retenue par élément (la dernière) : une rotation/un zoom change les
 * paramètres pour TOUS les éléments à la fois, donc en garder plusieurs n'éviterait aucun recalcul et
 * ferait enfler la mémoire (le thunk `svg` retient sa chaîne SVG).
 *
 * Sûr parce qu'un `StageObj` n'est JAMAIS muté après construction — le partager entre deux rendus ne
 * peut donc rien faire dériver.
 */
const wallProjected = memoByRefDeps<WallEl, StageObj>();

/** Murs sur arêtes (cloisons fines) : faces du builder projetées par le backend affine, fusionnées dans
 *  le tri. ACCENTS (LOD 2) : thunk paresseux, étendu APRÈS le culling écran puis mis en cache. */
export function wallLayerObjs(wallEls: WallEl[], d: Dims, lod: number, detailOpts: DetailOpts, lazySvg = false): StageObj[] {
  return wallEls.map((el) => wallProjected(el, [d, detailOpts, lod, lazySvg], () => {
    let svgCache: string | null = null;
    const svg = () => (svgCache ??= wallSvg(el, d, detailOpts));
    let accCache: string | null = null;
    const acc = lod === 2 ? () => (accCache ??= wallAccentsSvg(el, d, detailOpts)) : undefined;
    const occluder = projectOccluder(panelOf(el.faces), d);
    return {
      d: wallDepth(el, d),
      x: el.cell.x,
      y: el.cell.y,
      z: el.cell.z,
      kind: 'wall',
      ...(el.side === 'N' || el.side === 'E' ? { side: el.side } : {}),
      ...(el.roomZoneIds ? { roomZoneIds: el.roomZoneIds } : {}),
      bounds: occluder.bounds,
      vis: el.states.visible,
      ...(lazySvg ? { svg } : {}),
      ...(acc ? { acc } : {}),
      el: <g
        key={el.key}
        style={{ opacity: 1, transition: 'opacity 0.25s' }}
        {...(lazySvg ? {} : { dangerouslySetInnerHTML: { __html: svg() } })}
      />,
    };
  }));
}
