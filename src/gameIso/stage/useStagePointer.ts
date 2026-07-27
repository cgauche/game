/**
 * Pointeur du stage iso :
 *  - `tileFromEvent` : écran → tuile — en exploration le PAS INTER-ÉTAGES du groupe d'abord (parité
 *    souris↔clavier), puis `activeZ`, puis fallback CROSS-COUCHE (`screenToTileAtZ` + `resolveCursorZ`) ;
 *  - `pickTile` : picking SPRITE-aware en combat (`data-cid` + `elementFromPoint` — hit-test natif) ;
 *  - glisser-caméra (seuil PAN_THRESHOLD, l'action de clic est DIFFÉRÉE au relâchement) ;
 *  - `performClick` : sélection / cible / déplacement (combat et exploration) ;
 *  - `moveAlong` : marche pas-à-pas du groupe (sauts par-dessus les gouffres compris) ;
 *  - clic droit : attaque la plus PERTINENTE sur l'ennemi survolé (scoreur partagé avec l'IA) ;
 *  - suivi du SURVOL borné aux changements de tuile (curseur main sur l'interactif).
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useGame } from '../../state/store';
import { Scene as GameScene, heightAt, isWalkable, toggleDoorIn } from '../../state/scene';
import { metricToLift } from '../../state/relief';
import { memoByRef } from '../../state/sceneMemo';
import { chebyshev, walkNeighbors, type Pt } from '../../state/path';
import { exploreMovePlan, type ExploreMovePlan, type PathOpts } from '../../state/exploreNav';
import { planJump } from '../../state/jumpMove';
import { runFlow } from '../../state/combatEffects';
import { maxJumpTiles } from '../../engine/movement';
import { effectiveMovement } from '../../engine/encumbrance';
import { Combatant } from '../../engine/types';
import { bus, EVT } from '../../state/bus';
import { combatantAtTile } from '../../state/combatGeometry';
import { resolveCursorZ } from '../../state/combatCursor';
import { controlsActive } from '../../state/netOwnership';
import { combatantClickActs } from '../../state/combatOrParty';
import { hoverClickCommits } from '../../ui/pointerCaps';
import { bestAttack } from '../../state/attackRelevance';
import { Dims, screenToTileAtZ } from '../../geometry/iso';
import { STEP_MS } from '../../geometry/walk';
import { VW, VH } from './useStageCamera';
import type { RoomPortal } from '../../state/roomPortals';

const PAN_THRESHOLD = 6; // px de glissement avant de passer en panoramique (sinon = clic)

/** LIFTS D'AFFICHAGE distincts d'une scène, du plus HAUT au plus bas — l'ensemble des hauteurs auxquelles
 *  une case peut être DESSINÉE (`metricToLift` de chaque hauteur de relief authorée, plus le sol). Un
 *  pixel doit être inversé à CHACUN d'eux pour retrouver la case qu'on voit : le relief n'est pas une
 *  couche, c'est une hauteur continue. Mémoïsé par identité de scène (`memoByRef`, patron canonique). */
const sceneLifts = memoByRef((scene: GameScene): readonly number[] =>
  [...new Set([0, ...scene.layers.flatMap((layer) => [...(layer.height ?? [])]).map(metricToLift)])]
    .sort((a, b) => b - a));

export interface StagePointer {
  /** Tuile survolée (tooltip + réticule de visée ; suivie dans tous les modes de ciblage). */
  hover: Pt | null;
  hoveredPortal: RoomPortal | null;
  portalHandlers: {
    onPortalHover: (portal: RoomPortal | null) => void;
    onPortalClick: (portal: RoomPortal) => void;
  };
  handlers: {
    onPointerDown: (ev: React.PointerEvent) => void;
    onPointerMove: (ev: React.PointerEvent) => void;
    onPointerUp: (ev: React.PointerEvent) => void;
    onPointerCancel: (ev: React.PointerEvent) => void;
    onPointerLeave: () => void;
    onContextMenu: (ev: React.MouseEvent) => void;
  };
}

export function useStagePointer({
  svgRef,
  scene,
  dims,
  zoom,
  camRef,
  hoverTracking,
  partyLeader,
  activeZ = 0,
}: {
  svgRef: RefObject<SVGSVGElement>;
  scene: GameScene | null;
  dims: Dims;
  zoom: number;
  /** Caméra du RENDU COURANT (réf mise à jour par IsoStage après le calcul du focal — les handlers
   *  lisent la valeur au moment de l'événement, comme la closure historique). */
  camRef: RefObject<{ x: number; y: number }>;
  hoverTracking: boolean;
  partyLeader: Combatant | undefined;
  activeZ?: number;
}): StagePointer {
  const panCamBy = useGame((s) => s.panCamBy);
  const [hover, setHover] = useState<Pt | null>(null);
  const [hoveredPortal, setHoveredPortal] = useState<RoomPortal | null>(null);
  const movingRef = useRef(false);
  // Glisser-caméra : on diffère l'action de clic au relâchement ; un glissement > seuil = panoramique.
  const dragRef = useRef<{ sx: number; sy: number; lastX: number; lastY: number; panned: boolean; button: number; tile: Pt | null } | null>(null);

  // Recette (DEV) : pilotage PROGRAMMATIQUE du survol — __wfrp.hover('id') passe par ce hook,
  // le tooltip/réticule se rendent sans souris réelle (pas de chasse aux pixels).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __wfrpSetHover?: (t: Pt | null) => void };
    w.__wfrpSetHover = (t) => setHover(t);
    return () => { delete w.__wfrpSetHover; };
  }, []);

  /** Case d'un AUTRE étage visée par le pointeur, BORNÉE au voisinage marchable du groupe
   *  (`walkNeighbors` — exactement la connectivité qu'emprunte le pas clavier `exploreStepDest`) : le
   *  franchissement vertical (marches, rampe, tablier) se CLIQUE donc comme il se pousse au clavier, et
   *  la parité souris↔clavier annoncée en tête de fichier tient. Hors de ce voisinage l'étage ACTIF
   *  garde la priorité : une case d'un étage qu'AUCUN pas ne rejoint reste une silhouette translucide
   *  posée au-dessus du sol qu'on foule, et ne lui vole jamais le clic.
   *  Le LIFT de chaque candidat est sa HAUTEUR MÉTRIQUE rendue (`metricToLift(heightAt)`), PAS son index
   *  de couche — même correction qu'au curseur clavier (`screenStepDot`, `combatCursor.ts`) : sans elle
   *  un tablier rejoint par une rampe serait cherché à une hauteur fantôme, à côté du pixel dessiné. */
  const stepFromScreen = (gx: number, gy: number): Pt | null => {
    if (!scene) return null;
    for (const n of walkNeighbors(scene, useGame.getState().partyPos)) {
      const nz = n.z ?? 0;
      if (nz === activeZ) continue; // même étage : la résolution de l'étage actif ci-dessous suffit
      const { x, y } = screenToTileAtZ(gx, gy, dims, metricToLift(heightAt(scene, n.x, n.y, nz)));
      if (x === n.x && y === n.y) return n;
    }
    return null;
  };

  /** Case MARCHABLE de la couche `z` réellement DESSINÉE sous le pixel. Chaque case est projetée à son
   *  LIFT MÉTRIQUE (`metricToLift(heightAt)`), JAMAIS au seul index de couche : une marche d'escalier est
   *  dessinée soulevée, et l'inverser à plat rendait la case voisine 1 à 3 pas plus loin — les 8 marches
   *  de `la-diligence` étaient toutes injouables à la souris, donc l'étage inatteignable. On inverse donc
   *  à chacun des lifts DISTINCTS de la scène et on retient la case dont le lift EST celui auquel on l'a
   *  trouvée ; le plus HAUT gagne — c'est lui qu'on voit, et une case cachée DERRIÈRE une marche n'a pas
   *  à être cliquable. Même vérité de projection que le curseur clavier (`screenStepDot`, `combatCursor.ts`).
   *  Scène sans relief ⇒ un seul lift (0) ⇒ strictement l'inversion plan-sol historique. */
  const walkableAtScreen = (gx: number, gy: number, z: number): Pt | null => {
    if (!scene) return null;
    for (const lift of sceneLifts(scene)) {
      const { x, y } = screenToTileAtZ(gx, gy, dims, lift);
      if (x < 0 || y < 0 || x >= dims.w || y >= dims.h) continue;
      if (metricToLift(heightAt(scene, x, y, z)) !== lift) continue; // cette case n'est pas dessinée à ce lift
      if (!isWalkable(scene, x, y, z)) continue;
      return z ? { x, y, z } : { x, y };
    }
    return null;
  };

  // Écran → tuile : annule le zoom (scale autour du centre viewport) puis la translation caméra.
  const tileFromEvent = (ev: React.PointerEvent): Pt | null => {
    const svg = svgRef.current;
    if (!svg || !scene) return null;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const cam = camRef.current!;
    const gx = (loc.x - VW / 2) / zoom + VW / 2 - cam.x;
    const gy = (loc.y - VH / 2) / zoom + VH / 2 - cam.y;
    if (useGame.getState().mode === 'exploration') {
      const step = stepFromScreen(gx, gy);
      if (step) return step;
      const here = walkableAtScreen(gx, gy, activeZ);
      if (here) return here;
    }
    // Fallback CROSS-COUCHE aligné sur le curseur clavier : chaque couche est inversée à son lift,
    // puis `resolveCursorZ` tranche la surface réelle la plus haute de la case candidate.
    for (const z of scene.layers.map((l) => l.z).sort((a, b) => b - a)) {
      const { x, y } = screenToTileAtZ(gx, gy, dims, z);
      if (x < 0 || y < 0 || x >= dims.w || y >= dims.h) continue;
      if (resolveCursorZ(scene, x, y) !== z) continue; // la surface réelle la plus haute ici n'est pas cette couche
      return z ? { x, y, z } : { x, y };
    }
    return null;
  };

  // Picking SPRITE-aware (combat) : si un TOKEN est réellement dessiné sous le curseur (hit-test natif
  // du navigateur via `data-cid`), on cible SA tuile — pas la tuile « derrière » le sprite (ancré
  // au-dessus de sa case en iso, d'où l'ancienne « chasse aux pieds »). Empilement géré nativement :
  // le token de DEVANT (le plus haut dans le tri de profondeur) gagne. Hors d'un token (sol visible)
  // → la tuile du sol (tileFromEvent) pour le déplacement. Hors combat → sol direct.
  const pickTile = (ev: React.PointerEvent): Pt | null => {
    const st = useGame.getState();
    if (st.mode === 'battle' && st.battle) {
      const cid = (document.elementFromPoint(ev.clientX, ev.clientY) as Element | null)?.closest('[data-cid]')?.getAttribute('data-cid');
      const c = cid ? st.battle.combatants.find((x) => x.id === cid) : undefined;
      if (c?.pos) return c.pos.z ? { x: c.pos.x, y: c.pos.y, z: c.pos.z } : { x: c.pos.x, y: c.pos.y };
    }
    return tileFromEvent(ev);
  };

  // Écran → coordonnées SVG (repère viewBox), via la CTM — base du panoramique (delta de glissement).
  const clientToSvg = (ev: React.PointerEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: loc.x, y: loc.y };
  };

  const pathOpts = (): PathOpts => {
    const heroes = useGame.getState().party.filter((h) => !h.dead && h.wounds.current > 0);
    const partyM = heroes.length ? Math.min(...heroes.map((h) => effectiveMovement(h))) : 0;
    return { blocked: new Set(), jump: maxJumpTiles(partyM) };
  };

  const moveAlong = (sceneId: string, plan: ExploreMovePlan) => {
    if (movingRef.current || plan.path.length < 2) return;
    const path = plan.path;
    movingRef.current = true;
    let i = 1;
    const step = () => {
      const st = useGame.getState();
      const currentScene = st.scene;
      if (st.mode !== 'exploration' || st.dialogue || !currentScene || currentScene.id !== sceneId || i >= path.length) {
        movingRef.current = false;
        return;
      }
      const prev = st.partyPos;
      const expectedPrev = path[i - 1];
      if (prev.x !== expectedPrev.x || prev.y !== expectedPrev.y || (prev.z ?? 0) !== (expectedPrev.z ?? 0)) {
        movingRef.current = false;
        return;
      }
      const cur = path[i];
      const dist = Math.max(Math.abs(cur.x - prev.x), Math.abs(cur.y - prev.y));
      if (dist > 1) {
        // SAUT par-dessus un gouffre. Élan = pas contigus en ligne droite menant au décollage.
        const jdx = Math.sign(cur.x - prev.x), jdy = Math.sign(cur.y - prev.y);
        let runUp = 0;
        for (let k = i - 1; k > 0; k--) {
          const a = path[k], b = path[k - 1];
          if (Math.sign(a.x - b.x) === jdx && Math.sign(a.y - b.y) === jdy && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1) runUp++;
          else break;
        }
        const heroes = st.party.filter((hero) => !hero.dead && hero.wounds.current > 0);
        const partyM = heroes.length ? Math.min(...heroes.map((hero) => effectiveMovement(hero))) : 0;
        const jumpPlan = planJump(currentScene, prev, cur, partyM, runUp);
        if (partyLeader) bus.emit(EVT.ANIM_MOVE, { id: partyLeader.id, path: [prev, cur] });
        st.moveParty(cur);
        if (jumpPlan.kind === 'test') {
          runFlow(useGame.getState, useGame.setState, jumpPlan.flow);
          movingRef.current = false; // on s'arrête au saut : le joueur reclique pour continuer
          return;
        }
        i++;
        setTimeout(step, STEP_MS);
        return;
      }
      const stillConnected = walkNeighbors(currentScene, prev).some((neighbor) =>
        neighbor.x === cur.x
        && neighbor.y === cur.y
        && (neighbor.z ?? 0) === (cur.z ?? 0));
      if (!stillConnected) {
        movingRef.current = false;
        return;
      }
      if (partyLeader) bus.emit(EVT.ANIM_MOVE, { id: partyLeader.id, path: [prev, cur] });
      st.moveParty(cur);
      i++;
      setTimeout(step, STEP_MS);
    };
    step();
  };

  const activatePortal = (portal: RoomPortal) => {
    const st = useGame.getState();
    if (st.dialogue || !st.scene) return;
    if (st.mode === 'battle') {
      if (portal.kind === 'passage') return;
      useGame.setState({
        scene: toggleDoorIn(st.scene, portal.edge.x, portal.edge.y, portal.edge.side, portal.z),
      });
      bus.emit(EVT.SCENE_DIRTY);
      setHoveredPortal(null);
      return;
    }
    if (st.mode !== 'exploration') return;
    const currentScene = st.scene;
    if (portal.kind === 'door-closed') {
      const openedScene = toggleDoorIn(currentScene, portal.edge.x, portal.edge.y, portal.edge.side, portal.z);
      useGame.setState({ scene: openedScene });
      bus.emit(EVT.SCENE_DIRTY);
      setHoveredPortal(null);
      return;
    }
    const plan = exploreMovePlan(currentScene, st.partyPos, portal.to, pathOpts());
    if (!plan) return;
    setHover(null);
    setHoveredPortal(null);
    st.setPendingInteract(null);
    moveAlong(currentScene.id, plan);
  };

  const onPortalClick = (portal: RoomPortal) => {
    if (!hoverClickCommits() && hoveredPortal?.id !== portal.id) {
      setHoveredPortal(portal);
      return;
    }
    activatePortal(portal);
  };

  // Action de clic (DIFFÉRÉE au relâchement, sautée si on a fait un panoramique) — sélection / cible / déplacement.
  const performClick = (t: Pt | null) => {
    const st = useGame.getState();
    const sc = st.scene;
    if (!sc || st.dialogue || !t) return;
    const { x, y } = t;
    const tz = t.z ?? 0;
    if (st.mode === 'battle') {
      if (!controlsActive(st)) return; // coop : tour du héros d'un AUTRE joueur — clics inertes
      const occ = st.battle ? combatantAtTile(st.battle.combatants, x, y, tz) : undefined; // clic sur N'IMPORTE quelle tuile de l'empreinte, au bon étage
      // Décision PARTAGÉE avec le clic d'un portrait de frise (`combatantClickActs`) : un ennemi
      // s'attaque en mode neutre, tout combattant se cible en mode sort / choix de cibles ; sinon
      // (allié/soi non actionnable) on inspecte. Desktop (survol) : la visée a déjà tout montré → un
      // clic COMMET ; tactile : deux-taps (tap 1 = aperçu) — cf. pointerCaps.
      if (occ && combatantClickActs(useGame.getState, occ)) st.battleClickEntity(occ.id, { confirm: hoverClickCommits() });
      else if (occ) { if (st.inspectEnabled) st.setInspectId(occ.id); } // allié/soi non-actionnable → inspecter
      else st.battleClickTile(tz ? { x, y, z: tz } : { x, y }, { confirm: hoverClickCommits() }); // z-aware : escalier / case de rempart
      return;
    }
    const ent = sc.entities.find((e) => e.pos.x === x && e.pos.y === y && (e.z ?? 0) === tz);
    // Case d'arrivée partagée avec l'aperçu de survol (explorePath) — JAMAIS recalculée à part (cf.
    // exploreMoveDest) : escalier (autre bout), case adjacente d'un objet/PNJ interactif, ou déplacement simple.
    const plan = exploreMovePlan(sc, st.partyPos, t, pathOpts());
    if (ent && (ent.dialogueId || !!ent.interact || !!ent.merchant)) {
      if (chebyshev(st.partyPos, ent.pos) <= 1) {
        setHover(null);
        st.setPendingInteract(null);
        st.interactEntity(ent.id); // adjacent → fouille / dialogue immédiat
      } else if (plan) {
        // Déplacement-puis-fouille (P5) : marche vers la case adjacente libre, puis fouille à l'arrivée.
        setHover(null);
        st.setPendingInteract(ent.id);
        moveAlong(sc.id, plan);
      }
      return;
    }
    if (ent && ent.kind === 'personnage') {
      // FIGURANT (PNJ sans dialogue/boutique/fouille) : on ne lui marche pas DESSUS — on s'approche
      // d'une case adjacente, ou on le dit s'il est déjà à côté.
      setHover(null);
      st.setPendingInteract(null);
      if (chebyshev(st.partyPos, ent.pos) <= 1) st.log(`${ent.label ?? 'Ce badaud'} n’a rien à vous dire.`);
      else if (plan) moveAlong(sc.id, plan);
      return;
    }
    // Clic ailleurs : annule un déplacement-puis-fouille en attente. `dest` couvre l'ESCALIER (geste
    // explicite pour changer d'étage) et le déplacement simple ; moveAlong filtre les cases non marchables.
    st.setPendingInteract(null);
    if (plan) {
      setHover(null);
      moveAlong(sc.id, plan);
    }
  };

  // Caméra libre : on ARME un glisser au pointer-down (sans agir), on panoramique au mouvement
  // au-delà du seuil, et le clic ne se déclenche au relâchement QUE si on n'a pas glissé.
  const onPointerDown = (ev: React.PointerEvent) => {
    if (useGame.getState().dialogue) return;
    const p = clientToSvg(ev);
    dragRef.current = { sx: ev.clientX, sy: ev.clientY, lastX: p?.x ?? 0, lastY: p?.y ?? 0, panned: false, button: ev.button, tile: pickTile(ev) };
    svgRef.current?.setPointerCapture?.(ev.pointerId);
  };

  const onPointerMove = (ev: React.PointerEvent) => {
    const d = dragRef.current;
    if (d) {
      if (!d.panned && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) > PAN_THRESHOLD) d.panned = true;
      if (d.panned) {
        const p = clientToSvg(ev);
        if (p) {
          panCamBy((p.x - d.lastX) / zoom, (p.y - d.lastY) / zoom); // delta écran (viewBox) → unités caméra
          d.lastX = p.x;
          d.lastY = p.y;
        }
        (ev.currentTarget as SVGElement).style.cursor = 'grabbing';
        return; // pendant un panoramique : pas d'affordance ni de hover de visée
      }
    }
    const t = pickTile(ev);
    // Affordance : curseur main au survol d'un décor interactif / dialogue (DOM direct, sans re-render).
    const sc = useGame.getState().scene;
    const overInteractive =
      !!sc && !!t && useGame.getState().mode === 'exploration' &&
      sc.entities.some((e) => e.pos.x === t.x && e.pos.y === t.y && (e.z ?? 0) === (t.z ?? 0) && (e.dialogueId || !!e.interact || !!e.merchant));
    (ev.currentTarget as SVGElement).style.cursor = overInteractive ? 'pointer' : '';
    // Survol suivi en COMBAT (visée) ET en EXPLORATION (halo renforcé du décor interactif + aperçu de
    // déplacement) — borné aux changements de tuile, donc peu de re-rendus.
    if (!hoverTracking && useGame.getState().mode !== 'exploration') {
      if (hover) setHover(null);
      return;
    }
    if (!t) {
      if (hover) setHover(null);
      return;
    }
    if (!hover || hover.x !== t.x || hover.y !== t.y || (hover.z ?? 0) !== (t.z ?? 0)) {
      if (useGame.getState().combatCursor) useGame.getState().clearCursor(); // la souris (nouvelle tuile) reprend la main sur le curseur clavier/manette
      setHover(t);
      const st = useGame.getState();
      if (st.hoverCombatantId) st.setHoverCombatant(null); // la souris reprend la main sur le ciblage clavier (Tab) / frise
    }
  };

  const onPointerUp = (ev: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    svgRef.current?.releasePointerCapture?.(ev.pointerId);
    (ev.currentTarget as SVGElement).style.cursor = '';
    if (d && !d.panned && d.button === 0) performClick(d.tile); // tap (sans glisser) au bouton principal = clic
  };

  const onPointerLeave = () => {
    if (hover) setHover(null);
    if (hoveredPortal) setHoveredPortal(null);
  };

  // Clic droit en combat = attaque la plus PERTINENTE sur l'ennemi survolé (scoreur partagé avec l'IA :
  // poids éditable × dégâts/multi-cible), sans muter `selectedAttack`. Raccourci sur `availableAttacks`.
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const st = useGame.getState();
    const b = st.battle;
    if (st.mode !== 'battle' || !b || b.over || !controlsActive(st) || !hover) return;
    const active = b.combatants.find((c) => c.id === b.order[b.turn]);
    if (!active || active.kind !== 'hero') return;
    const occ = combatantAtTile(b.combatants, hover.x, hover.y, hover.z ?? 0);
    if (!occ || occ.kind !== 'enemy') return;
    const best = bestAttack(useGame.getState, active, b, occ);
    if (best) st.battleClickEntity(occ.id, { forceAttackId: best.id, confirm: true });
  };

  return {
    hover,
    hoveredPortal,
    portalHandlers: {
      onPortalHover: setHoveredPortal,
      onPortalClick,
    },
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onPointerLeave, onContextMenu },
  };
}
