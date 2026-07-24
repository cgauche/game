/**
 * Couches STATIQUES du stage iso (sols/murs/décor de terrain/toits) : les éléments des BUILDERS
 * (camera-free, memoïsés au stage) projetés par les BACKENDS affines en objets du tri global, avec
 * les VÉRITÉS DE SCÈNE (ghost/solidOverhang/roofOccupied — invariantes à la position des acteurs)
 * bakées ici. Les VÉRITÉS DE VUE écran-espace qui varient PAR PAS (reveal au-dessus d'un acteur,
 * estompe d'occlusion, cutaway de toit « derrière », éclairage par tuile) sont décidées PLUS TARD,
 * au RENDU (`CulledScene`, sur les seuls objets À L'ÉCRAN) — cf. #797 : les geler ici forçait un
 * rebuild plein-carte à chaque pas. Fonctions PURES — IsoStage les memoïse (contrat de perf : le
 * walkAnim re-rend à 60 Hz).
 */
import { Scene, heightAt } from '../../state/scene';
import { isOutOfAction } from '../../engine/conditions';
import type { BattleState } from '../../state/store';
import { Dims } from '../../geometry/iso';
import { floorSvg, floorAccentsSvg, floorDepth } from '../backends/affineFloors';
import { wallSvg, wallAccentsSvg, wallDepth } from '../backends/affineWalls';
import { roofSvg, roofDepth } from '../backends/affineRoofs';
import { zoneLabelSvg } from '../backends/affineZoneLabels';
import type { DetailOpts } from '../backends/affineDetail';
import type { FloorEl, WallEl, RoofEl } from '../builders/types';
import { buildZoneLabels } from '../builders/zoneLabels';
import type { StageObj } from './objs';

/** Extension de `StageObj` (objs.ts hors périmètre #797) : vérités de SCÈNE bakées ici, consommées
 *  par `CulledScene` pour décider les vérités de VUE au rendu, sans re-scanner la scène. */
declare module './objs' {
  interface StageObj {
    /** Hauteur MÉTRIQUE de la tuile de sol — invariante (géométrie), sert au calcul de « reveal ». */
    h?: number;
    /** Surplomb fantôme (silhouette au-dessus de la zone active) : le « reveal » écran-espace ne
     *  s'applique JAMAIS à un ghost (déjà translucide ou plein). */
    ghost?: boolean;
    roomZoneIds?: readonly string[];
  }
}

/** Opacité d'un tablier de SURPLOMB rendu AU-DESSUS de la zone active (FANTÔME) : on voit la silhouette
 *  du pont/de la loge sans qu'il masque le sol où l'on se tient. TUNABLE (ajusté à l'œil). */
const OVERHANG_GHOST_OPACITY = 0.35;

export interface LayerCtx {
  mode: string;
  battle: BattleState | null;
  partyPos: { x: number; y: number; z?: number };
}

/** Acteurs à REVELER (floors) : en combat tous les combattants debout ; en exploration le groupe +
 *  figurants. Hauteur MÉTRIQUE résolue ICI (pas au rendu) — la liste est courte (jamais un scan de
 *  carte) et se recalcule à chaque pas, mais son coût est négligeable comparé au balayage plein-carte
 *  qu'elle évite en aval (CulledScene ne la consulte QUE pour les tuiles à l'écran). */
export function revealActorsOf(scene: Scene, ctx: LayerCtx): { x: number; y: number; z: number; h: number }[] {
  const actors: { x: number; y: number; z: number; h: number }[] = [];
  const push = (x: number, y: number, z: number) => actors.push({ x, y, z, h: heightAt(scene, x, y, z) });
  if (ctx.mode === 'battle' && ctx.battle) {
    for (const c of ctx.battle.combatants) if (c.pos && !isOutOfAction(c)) push(c.pos.x, c.pos.y, c.pos.z ?? 0);
  } else {
    push(ctx.partyPos.x, ctx.partyPos.y, ctx.partyPos.z ?? 0);
    for (const ent of scene.entities) if (ent.kind === 'personnage' && !ent.combat?.hiddenUntilCombat) push(ent.pos.x, ent.pos.y, ent.z ?? 0);
  }
  return actors;
}

/** Cases occupées par un acteur « à suivre » (murs/toits : occlusion/cutaway) — en combat TOUS les
 *  combattants (tactique) ; en exploration le SEUL groupe (surtout PAS les PNJ d'ambiance, sinon un
 *  PNJ occupant/derrière un bâtiment ferait disparaître son toit pour tout le monde). */
export function actorTilesOf(ctx: LayerCtx): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  if (ctx.mode === 'battle' && ctx.battle) {
    for (const c of ctx.battle.combatants) if (c.pos && !isOutOfAction(c)) tiles.push(c.pos);
  } else {
    tiles.push(ctx.partyPos);
  }
  return tiles;
}

/** Sols du pivot projetés. Fantôme translucide (OVERHANG_GHOST_OPACITY) sauf surplomb PLEIN (opaque,
 *  tagué `vis` → au-dessus du voile — vérités de SCÈNE du builder) : décision INVARIANTE à la position
 *  des acteurs, bakée ici. Le « reveal » (une tuile de sol d'une COUCHE supérieure devient translucide
 *  au-dessus d'un combattant qui se tient EN DESSOUS) est une vérité de VUE écran-espace : décidée par
 *  `CulledScene`, à partir de `h` (hauteur MÉTRIQUE, bakée ici) et `ghost` (idem) — zéro recalcul de
 *  géométrie hors écran. ACCENTS (LOD 2) : thunk PARESSEUX — l'expansion seedée n'a lieu qu'au rendu,
 *  APRÈS le culling écran (jamais dans le memo pleine-carte), puis reste en cache dans la closure. */
export function floorLayerObjs(floorEls: FloorEl[], scene: Scene, d: Dims, _ctx: LayerCtx, lod: number, detailOpts: DetailOpts): StageObj[] {
  // `floorDepth` = depth(x,y,z) − 0.5 → le sol passe juste SOUS les objets de SA case (prop +0, jeton
  // +0.5) tout en s'interclassant avec les voisins par sa vraie position écran (base ≫ z).
  return floorEls.map((el) => {
    const { x, y, z } = el.cell;
    const ghost = !!el.states.ghost;
    // Op bakée = décision INVARIANTE (ghost/solidOverhang) uniquement ; le « reveal » (partyPos) se
    // surcharge PLUS TARD, au rendu (CulledScene) — jamais recalculé ici.
    const op = ghost ? (el.states.solidOverhang ? 1 : OVERHANG_GHOST_OPACITY) : 1;
    let accCache: string | null = null;
    const acc = lod === 2 && !ghost ? () => (accCache ??= floorAccentsSvg(el, d, detailOpts)) : undefined;
    return {
      d: floorDepth(el, d), x, y, z, kind: 'floor',
      ...(el.states.visible ? { vis: true } : {}),
      h: heightAt(scene, x, y, z),
      ghost,
      op,
      ...(acc ? { acc } : {}),
      el: <g key={el.key} style={{ opacity: op, transition: 'opacity 0.2s' }} dangerouslySetInnerHTML={{ __html: floorSvg(el, d, detailOpts) }} />,
    };
  });
}

/** Murs sur arêtes (cloisons fines) : faces du builder projetées par le backend affine, fusionnées dans
 *  le tri global (un mur avant occulte ce qui est derrière ; les portes sont ajourées). L'estompe
 *  d'occlusion (acteur à suivre devant le mur) est une vérité de VUE écran-espace : décidée par
 *  `CulledScene` (à partir de `x,y` déjà bakés ici). ACCENTS (LOD 2) : thunk paresseux, étendu APRÈS le
 *  culling écran puis mis en cache (cf. floorLayerObjs). */
export function wallLayerObjs(wallEls: WallEl[], d: Dims, _occludesActor: (x: number, y: number) => boolean, lod: number, detailOpts: DetailOpts): StageObj[] {
  return wallEls.map((el) => {
    let accCache: string | null = null;
    const acc = lod === 2 ? () => (accCache ??= wallAccentsSvg(el, d, detailOpts)) : undefined;
    return {
      d: wallDepth(el, d),
      x: el.cell.x,
      y: el.cell.y,
      z: el.cell.z,
      kind: 'wall',
      ...(el.side === 'N' || el.side === 'E' ? { side: el.side } : {}),
      ...(el.roomZoneIds ? { roomZoneIds: el.roomZoneIds } : {}),
      vis: el.states.visible,
      ...(acc ? { acc } : {}),
      el: <g key={el.key} style={{ opacity: 1, transition: 'opacity 0.25s' }} dangerouslySetInnerHTML={{ __html: wallSvg(el, d, detailOpts) }} />,
    };
  });
}

/** Toits du pivot : cutaway TOUT-EN-SCÈNE — le toit se lève quand un allié est DANS l'empreinte
 *  (`roofOccupied`, vérité de SCÈNE du builder, bakée ici) OU DERRIÈRE le bâtiment (vérité de VUE
 *  écran-espace : une case de l'empreinte occulte un acteur — sinon le toit cacherait le perso qui
 *  passe derrière) — décidée par `CulledScene` à partir de `roofCells` bakées ici. */
export function roofLayerObjs(roofEls: RoofEl[], d: Dims, detailOpts: DetailOpts): StageObj[] {
  return roofEls.map((el) => ({
    d: roofDepth(el, d),
    z: el.cell.z,
    kind: 'roof',
    vis: el.states.visible,
    roofOccupied: !!el.states.roofOccupied,
    roofCell: el.cell,
    roofSpan: el.span,
    roofCells: el.cells.map((cell) => ({ ...cell, z: el.cell.z })),
    ...(el.roomZoneIds ? { roomZoneIds: el.roomZoneIds } : {}),
    el: (
      <g key={el.key} style={{ transition: 'opacity 0.25s' }} opacity={1} dangerouslySetInnerHTML={{ __html: roofSvg(el, d, detailOpts) }} />
    ),
  }));
}

export function ZoneLabels({ enabled, scene, dims, liftAt, allies, activeZ, viewZ }: { enabled: boolean; scene: Scene; dims: Dims; liftAt: (x: number, y: number, z?: number) => number; allies: { x: number; y: number }[]; activeZ: number; viewZ: number | null }) {
  if (!enabled) return null;
  const els = buildZoneLabels(scene, { allies, activeZ, viewZ });
  return (
    <g pointerEvents="none">
      {els.map((el) => (
        <g key={el.key} dangerouslySetInnerHTML={{ __html: zoneLabelSvg(el, dims, liftAt(el.cx, el.cy, el.z)) }} />
      ))}
    </g>
  );
}
