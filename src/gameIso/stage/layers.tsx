/**
 * Couche STATIQUE des MURS AU TRAIT : les éléments du builder (`builders/walls`, camera-free) projetés
 * en trait symbolique par le peintre `authoring/wallsSvg`, puis triés par `stage/objs`.
 *
 * UNE SEULE COUCHE POUR LES DEUX VUES DU DESSUS (#1176 P3-5b) : le PLAN DE STATION
 * (`gameIso/TopoScene`) et la vue du dessus de JEU (`gameIso/IsoStage`, verdict `mursAuTrait` de
 * `stage/viewPolicy`) la montent toutes deux — elles ne diffèrent que par le brouillard, un argument.
 * Vu à la verticale, la coiffe d'un mur volumique tombe sous le pixel (mesure au JSDoc de
 * `stage/planSnapshot.ts`), là où le trait est invariant d'échelle — la MATIÈRE vient du monde cuit,
 * la STRUCTURE du trait.
 *
 * C'est tout ce qui reste de l'assemblage de couches SVG : la voie de JEU affine est morte
 * (#1176 P3-4, commit C5a), et avec elle les sols et les toits projetés (`floorLayerObjs`/
 * `roofLayerObjs`), qui n'avaient plus de consommateur.
 * Fonctions PURES.
 */
import { projectOccluder, type Dims } from '../../geometry/iso';
import { memoByRefDeps } from '../../state/sceneMemo';
import { panelOf } from './occluders';
import { wallSvg, wallAccentsSvg, wallDepth } from '../authoring/wallsSvg';
import type { DetailOpts } from '../authoring/detailSvg';
import { buildWalls } from '../builders/walls';
import type { WallEl } from '../builders/types';
import { sortByDepth, type StageObj } from './objs';
import type { Scene } from '../../state/scene';

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

/** LOD 0 (aplats, aucun motif) — une structure au trait veut la silhouette symbolique, pas le détail. */
const TRAIT_LOD: DetailOpts = { zoom: 0.4 };

/**
 * La STRUCTURE d'un étage, au trait, prête à monter dans un SVG : les murs de l'étage `z` (isolement
 * d'un étage, `viewZ` du builder — sans lui les murs de tous les niveaux se superposent), projetés et
 * PRÉ-TRIÉS. `visible` = le brouillard de guerre du jeu ; absent (plan de station, éditeur) ⇒ tout est
 * vu. Un mur que le brouillard cache n'est PAS émis : le trait porterait la structure d'un intérieur
 * jamais exploré, exactement ce que le voile cache. PURE.
 *
 * POURQUOI TOUT OU RIEN (`vis !== false`), et non le champ continu de visibilité (#1176, C6) : le champ
 * s'applique à la MATIÈRE — les couleurs de sommet du monde cuit, où un dégradé a un sens. Un TRAIT
 * symbolique est BINAIRE : un mur à demi estompé se lit « est-ce un mur ? », exactement l'ambiguïté
 * qu'un plan doit interdire. Ce n'est donc pas une incohérence avec C6, c'est sa frontière.
 */
export function wallTraitObjs(scene: Scene, dims: Dims, z: number, visible?: ReadonlySet<string>): StageObj[] {
  const objs = wallLayerObjs(buildWalls(scene, visible, { activeZ: z, viewZ: z }), dims, 0, TRAIT_LOD);
  return sortByDepth(objs.filter((o) => o.vis !== false));
}
