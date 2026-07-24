/**
 * Couches STATIQUES du stage iso (sols/murs/décor de terrain/toits) : les éléments des BUILDERS
 * (camera-free, memoïsés au stage) décorés des VÉRITÉS DE VUE (reveal au-dessus d'un acteur, estompe
 * d'occlusion, cutaway de toit) et projetés par les BACKENDS affines en objets du tri global.
 * Fonctions PURES — IsoStage les memoïse (contrat de perf : le walkAnim re-rend à 60 Hz).
 */
import { Scene, heightAt } from '../../state/scene';
import { metricToLift } from '../../state/relief';
import { isOutOfAction } from '../../engine/conditions';
import type { LightField } from '../../state/vision';
import type { BattleState } from '../../state/store';
import { TW, TH, EDGE_H, Dims, tileCenter, depth, makeOccludes } from '../../geometry/iso';
import { floorSvg, floorAccentsSvg, floorDepth } from '../backends/affineFloors';
import { wallSvg, wallAccentsSvg, wallDepth } from '../backends/affineWalls';
import { roofSvg, roofDepth } from '../backends/affineRoofs';
import { zoneLabelSvg } from '../backends/affineZoneLabels';
import { AMBIANCE } from '../catalog/ambiance';
import type { DetailOpts } from '../backends/affineDetail';
import type { FloorEl, WallEl, RoofEl } from '../builders/types';
import { buildZoneLabels } from '../builders/zoneLabels';
import type { StageObj } from './objs';

/** Opacité d'un tablier de SURPLOMB rendu AU-DESSUS de la zone active (FANTÔME) : on voit la silhouette
 *  du pont/de la loge sans qu'il masque le sol où l'on se tient. TUNABLE (ajusté à l'œil). */
const OVERHANG_GHOST_OPACITY = 0.35;

/** Pas de QUANTIFICATION de la luminosité par tuile (≈15 paliers) : on arrondit `light` à ce cran pour que
 *  les tuiles voisines partagent la MÊME chaîne `brightness()` → coalescence sous un seul `<g filter>`
 *  (CulledScene), pas un filtre GPU par case. */
const LIGHT_STEP = 0.06;

export interface LayerCtx {
  mode: string;
  battle: BattleState | null;
  partyPos: { x: number; y: number; z?: number };
}

/** Un MUR/DÉCOR/TOIT devant un acteur À SUIVRE (même colonne écran, camera-near, proche) s'ESTOMPE pour
 *  ne pas le cacher — côté murs/toit, du cutaway. Primitive PURE et testée `makeOccludes` (rotation/
 *  projection-aware, cf. iso.ts). ACTEURS PRIS EN COMPTE = ce que le JOUEUR doit voir : en combat TOUS
 *  les combattants (tactique) ; en exploration le SEUL groupe — surtout PAS les PNJ d'ambiance (sinon
 *  un PNJ occupant/derrière un bâtiment ferait disparaître son toit → les bâtiments PEUPLÉS perdaient
 *  leur toit). */
export function makeOccludesActor(_scene: Scene | null, dims: Dims, ctx: LayerCtx): (x: number, y: number) => boolean {
  const actorTiles: { x: number; y: number }[] = [];
  if (ctx.mode === 'battle' && ctx.battle) {
    for (const c of ctx.battle.combatants) if (c.pos && !isOutOfAction(c)) actorTiles.push(c.pos);
  } else {
    actorTiles.push(ctx.partyPos);
  }
  return makeOccludes(dims, actorTiles);
}

/** Sols du pivot décorés + projetés. Fantôme translucide (OVERHANG_GHOST_OPACITY) sauf surplomb PLEIN
 *  (opaque, tagué `vis` → au-dessus du voile — vérités de SCÈNE du builder) ; « reveal » au-dessus d'un
 *  acteur (vérité de VUE, screen-space) : une tuile de sol d'une COUCHE supérieure (passerelle) se rend
 *  semi-transparente au-dessus d'un combattant qui se tient EN DESSOUS — le TRI garde l'index de couche
 *  `z` (depth) ; la position ÉCRAN et « qui est plus haut » passent par la HAUTEUR MÉTRIQUE (`heightAt`).
 *  ACCENTS (LOD 2) : thunk PARESSEUX — l'expansion seedée n'a lieu qu'au rendu, APRÈS le culling écran
 *  (jamais dans le memo pleine-carte), puis reste en cache dans la closure.
 *  ÉCLAIRAGE par tuile (`light`, optionnel : absent en éditeur/QC) : posé comme fragment `brightness(L)`
 *  (`dim`, GPU-composité par CulledScene) — miroir du `tint(base, light)` du POV, ZÉRO élément SVG en plus.
 *  Quantifié (LIGHT_STEP) pour coalescer ; plein jour (`L ≥ 0.995`) = AUCUN `dim` (no-op byte, zéro filtre). */
export function floorLayerObjs(floorEls: FloorEl[], scene: Scene, d: Dims, ctx: LayerCtx, lod: number, detailOpts: DetailOpts, light?: LightField): StageObj[] {
  // Acteurs à révéler : en combat tous les combattants debout ; en exploration le groupe + figurants.
  const actors: { x: number; y: number; z: number }[] = [];
  if (ctx.mode === 'battle' && ctx.battle) {
    for (const c of ctx.battle.combatants) if (c.pos && !isOutOfAction(c)) actors.push({ x: c.pos.x, y: c.pos.y, z: c.pos.z ?? 0 });
  } else {
    actors.push({ x: ctx.partyPos.x, y: ctx.partyPos.y, z: ctx.partyPos.z ?? 0 });
    for (const ent of scene.entities) if (ent.kind === 'personnage' && !ent.combat?.hiddenUntilCombat) actors.push({ x: ent.pos.x, y: ent.pos.y, z: ent.z ?? 0 });
  }
  const HALF_H = (d.edge && d.view !== 'top' ? EDGE_H : TH) / 2, TOKEN_H = 92, TOKEN_HW = TW * 0.45;
  // Critère : le sol se dessine APRÈS l'acteur (depth) ET le recouvre à l'écran (tileCenter) — robuste
  // aux 4 rotations. VÉRITÉ DE VUE (screen-space) → décoration au dessin, hors builder.
  const coversActorBelow = (tx: number, ty: number, tz: number): boolean => {
    if (tz <= 0 || !actors.length) return false;
    const hTile = heightAt(scene, tx, ty, tz);
    const fd = depth(tx, ty, d, tz) - 0.5, T = tileCenter(tx, ty, d, metricToLift(hTile));
    for (const a of actors) {
      if (heightAt(scene, a.x, a.y, a.z) >= hTile || fd <= depth(a.x, a.y, d, a.z) + 0.5) continue; // acteur au moins aussi haut, ou sol dessiné AVANT lui
      const A = tileCenter(a.x, a.y, d, metricToLift(heightAt(scene, a.x, a.y, a.z)));
      if (Math.abs(T.cx - A.cx) <= TW / 2 + TOKEN_HW && T.cy - HALF_H < A.cy && T.cy + HALF_H > A.cy - TOKEN_H) return true; // recouvrement écran
    }
    return false;
  };
  // `floorDepth` = depth(x,y,z) − 0.5 → le sol passe juste SOUS les objets de SA case (prop +0, jeton
  // +0.5) tout en s'interclassant avec les voisins par sa vraie position écran (base ≫ z).
  return floorEls.map((el) => {
    const { x, y, z } = el.cell;
    const ghost = !!el.states.ghost;
    const reveal = !ghost && coversActorBelow(x, y, z); // passerelle au-dessus d'un combattant → transparente
    const op = ghost ? (el.states.solidOverhang ? 1 : OVERHANG_GHOST_OPACITY) : reveal ? 0.22 : 1;
    // ÉCLAIRAGE : `base × light` clampé au plancher partagé, arrondi au cran → chaîne stable coalescente.
    const L = light ? Math.max(light.at(x, y, z), AMBIANCE.ambientFloor) : 1;
    const qL = Math.round(L / LIGHT_STEP) * LIGHT_STEP;
    const dim = L >= 0.995 ? undefined : `brightness(${qL.toFixed(2)})`; // plein jour = aucun filtre (no-op)
    let accCache: string | null = null;
    const acc = lod === 2 && !ghost ? () => (accCache ??= floorAccentsSvg(el, d, detailOpts)) : undefined;
    return { d: floorDepth(el, d), x, y, z, ...(el.states.visible ? { vis: true } : {}), op, ...(dim ? { dim } : {}), ...(acc ? { acc } : {}), el: <g key={el.key} style={{ opacity: op, transition: 'opacity 0.2s' }} dangerouslySetInnerHTML={{ __html: floorSvg(el, d, detailOpts) }} /> };
  });
}

/** Murs sur arêtes (cloisons fines) : faces du builder projetées par le backend affine, fusionnées dans
 *  le tri global (un mur avant occulte ce qui est derrière ; les portes sont ajourées). ACCENTS (LOD 2) :
 *  thunk paresseux, étendu APRÈS le culling écran puis mis en cache (cf. floorLayerObjs). */
export function wallLayerObjs(wallEls: WallEl[], d: Dims, occludesActor: (x: number, y: number) => boolean, lod: number, detailOpts: DetailOpts): StageObj[] {
  return wallEls.map((el) => {
    const op = occludesActor(el.cell.x, el.cell.y) ? 0.4 : 1;
    let accCache: string | null = null;
    const acc = lod === 2 ? () => (accCache ??= wallAccentsSvg(el, d, detailOpts)) : undefined;
    return {
      d: wallDepth(el, d),
      x: el.cell.x,
      y: el.cell.y,
      z: el.cell.z,
      vis: el.states.visible,
      op,
      ...(acc ? { acc } : {}),
      el: <g key={el.key} style={{ opacity: op, transition: 'opacity 0.25s' }} dangerouslySetInnerHTML={{ __html: wallSvg(el, d, detailOpts) }} />,
    };
  });
}

/** Toits du pivot : cutaway TOUT-EN-SCÈNE — le toit se lève quand un allié est DANS l'empreinte
 *  (`roofOccupied`, vérité de SCÈNE du builder) OU DERRIÈRE le bâtiment (vérité de VUE : une case de
 *  l'empreinte `occludesActor` — sinon le toit cacherait le perso qui passe derrière) — opacité 0 en
 *  iso, estompe en plan. */
export function roofLayerObjs(roofEls: RoofEl[], d: Dims, occludesActor: (x: number, y: number) => boolean, topView: boolean, detailOpts: DetailOpts): StageObj[] {
  return roofEls.map((el) => {
    let behind = false;
    for (let dy = 0; dy < el.span.h && !behind; dy++)
      for (let dx = 0; dx < el.span.w && !behind; dx++)
        if (occludesActor(el.cell.x + dx, el.cell.y + dy)) behind = true;
    const cut = el.states.roofOccupied || behind;
    return {
      d: roofDepth(el, d),
      vis: el.states.visible,
      el: (
        <g
          key={el.key}
          style={{ transition: 'opacity 0.25s' }}
          opacity={cut ? (topView ? 0.5 : 0) : 1}
          dangerouslySetInnerHTML={{ __html: roofSvg(el, d, detailOpts) }}
        />
      ),
    };
  });
}

/** Étiquettes de zone descriptive (#782), OVERLAY D'ANNOTATION toujours actif (pas gaté par un flag
 *  debug) — au patron de `DebugMapLabels` : projette via `liftAt`/`tileCenter`, se pose PAR-DESSUS
 *  l'ambiance et les jetons (appelant : placé APRÈS `AmbianceVeils`, dans un groupe qui partage la
 *  transform caméra du stage). La révélation cutaway reste tranchée par le builder (`buildZoneLabels` —
 *  une zone masquée par un toit non levé n'émet AUCUN élément). */
export function ZoneLabels({ scene, dims, liftAt, allies, activeZ, viewZ }: { scene: Scene; dims: Dims; liftAt: (x: number, y: number, z?: number) => number; allies: { x: number; y: number }[]; activeZ: number; viewZ: number | null }) {
  const els = buildZoneLabels(scene, { allies, activeZ, viewZ });
  return (
    <g pointerEvents="none">
      {els.map((el) => (
        <g key={el.key} dangerouslySetInnerHTML={{ __html: zoneLabelSvg(el, dims, liftAt(el.cx, el.cy, el.z)) }} />
      ))}
    </g>
  );
}
