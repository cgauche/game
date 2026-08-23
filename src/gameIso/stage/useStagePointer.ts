/**
 * Pointeur du stage iso :
 *  - `tileFromEvent` : écran → tuile — en exploration le PAS INTER-ÉTAGES du groupe d'abord (parité
 *    souris↔clavier), puis `activeZ`, puis fallback CROSS-COUCHE (`screenToTileAtLift` +
 *    `resolveCursorZ`). Les trois chemins inversent la projection du STAGE (`stage/projection.ts`,
 *    `stage/stageCam.ts`) — la même que le peintre, affine ou volumique ;
 *  - `pickTile` : picking SPRITE-aware, hit-test délégué à la voie de rendu (`targetUnderPointer`) ;
 *  - glisser-caméra (seuil PAN_THRESHOLD, l'action de clic est DIFFÉRÉE au relâchement) — bouton
 *    principal : panoramique posé HORS de React (`state/stagePan`, un battement de frame par
 *    mouvement) et commis au store en UN `set` au relâchement ; bouton MILIEU : lacet libre de la vue ;
 *  - TACTILE à DEUX DOIGTS : pincer = zoom (`setZoom`, borné par le store), translation du milieu des
 *    doigts = panoramique. Un seul pointeur garde strictement le comportement ci-dessus ;
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
import { exploreMovePlan, exploreSeatPlan, type ExploreMovePlan, type PathOpts } from '../../state/exploreNav';
import { memeCase, RANG_MENEUR, seatPoseOf, seatSlotsOf } from '../../state/seating';
// `t` est déjà le nom local de la TUILE survolée dans ce module : la traduction s'y importe sous son
// rôle, sans rebaptiser trente sites de pointeur.
import { t as message } from '../../i18n';
import { planJump } from '../../state/jumpMove';
import { runFlow } from '../../state/combatEffects';
import { maxJumpTiles } from '../../engine/movement';
import { effectiveMovement } from '../../engine/encumbrance';
import { Combatant } from '../../engine/types';
import { bus, EVT } from '../../state/bus';
import { combatantAtTile } from '../../state/combatGeometry';
import { resolveCursorZ } from '../../state/combatCursor';
import { controlsActive } from '../../state/netOwnership';
import { SENSIBILITE_DRAG_DEG_PX, getStageYaw, poserYaw } from '../../state/stageYaw';
import { accordsPan, getStagePan, poserPan } from '../../state/stagePan';
import { battreStageFrames } from './stageFrames';
import { combatantClickActs } from '../../state/combatOrParty';
import { hoverClickCommits } from '../../ui/pointerCaps';
import { bestAttack } from '../../state/attackRelevance';
import { type Dims } from '../../geometry/iso';
import { STEP_MS } from '../../geometry/walk';
import { poseFromDims, screenToTileAtLift } from './projection';
import { stagePointAt, viewBoxPointAt } from './stageCam';
import { hasSpritePicker, targetUnderPointer } from './spritePicker';
import { sceneAUnPropVolumique } from '../builders/props';
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
  /** Caméra du RENDU COURANT (réf mise à jour par l'hôte du monde après le calcul du focal — les handlers
   *  lisent la valeur au moment de l'événement, comme la closure historique). */
  camRef: RefObject<{ x: number; y: number }>;
  hoverTracking: boolean;
  partyLeader: Combatant | undefined;
  activeZ?: number;
}): StagePointer {
  const setCamPan = useGame((s) => s.setCamPan);
  const [hover, setHover] = useState<Pt | null>(null);
  const [hoveredPortal, setHoveredPortal] = useState<RoomPortal | null>(null);
  const movingRef = useRef(false);
  // Glisser-caméra : on diffère l'action de clic au relâchement ; un glissement > seuil = panoramique.
  // La BASE du panoramique (`pan0` + le point de viewBox `vbX/vbY` + le zoom + le n° d'accord du
  // décalage vivant) se re-pose dès qu'une de ses hypothèses bouge sous le geste : un recentrage
  // (`resetCamPan`) ou un cran de molette. Sans elle, le delta CUMULÉ serait ré-échelonné par le
  // nouveau zoom, et le relâchement contredirait le recentrage.
  const dragRef = useRef<{ sx: number; sy: number; vbX: number; vbY: number; panned: boolean; button: number; tile: Pt | null; yaw0: number; pan0: { x: number; y: number }; zoom0: number; accord0: number } | null>(null);
  // Pointeurs ACTIFS sur le stage, par `pointerId` — c'est leur NOMBRE qui distingue les deux régimes
  // du tactile : un doigt = le glisser historique (`dragRef`), deux = le PINCER (zoom + panoramique).
  // `pinchRef` porte l'état du geste à deux doigts (écart et milieu du dernier échantillon).
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number; accord0: number } | null>(null);

  // Recette (DEV) : pilotage PROGRAMMATIQUE du survol — __wfrp.hover('id') passe par ce hook,
  // le tooltip/réticule se rendent sans souris réelle (pas de chasse aux pixels).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __wfrpSetHover?: (t: Pt | null) => void };
    w.__wfrpSetHover = (t) => setHover(t);
    return () => { delete w.__wfrpSetHover; };
  }, []);

  // POSE de projection du rendu courant : les trois chemins d'inversion ci-dessous lisent la MÊME
  // géométrie que le peintre, quelle que soit la voie.
  const pose = poseFromDims(dims);

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
      const { x, y } = screenToTileAtLift(pose, { x: gx, y: gy }, metricToLift(heightAt(scene, n.x, n.y, nz)));
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
      const { x, y } = screenToTileAtLift(pose, { x: gx, y: gy }, lift);
      if (x < 0 || y < 0 || x >= dims.w || y >= dims.h) continue;
      if (metricToLift(heightAt(scene, x, y, z)) !== lift) continue; // cette case n'est pas dessinée à ce lift
      if (!isWalkable(scene, x, y, z)) continue;
      return z ? { x, y, z } : { x, y };
    }
    return null;
  };

  /** Case du MEUBLE réellement dessinée sous le pixel, à la couche `z` : la MÊME inversion par LIFT
   *  que `walkableAtScreen`, mais pour une case qu'un décor `prop` OCCUPE — donc justement celle que
   *  la marchabilité écarte (l'empreinte d'un meuble solide n'est pas marchable). Sans elle, le pixel
   *  d'un plateau FIN que le rayon ne touche pas retombait sur la boucle CROSS-COUCHE de
   *  `tileFromEvent`, qui rendait une case d'un AUTRE ÉTAGE : mesuré sur `la-diligence`, le clic de la
   *  table murale (13,10) résolvait (16,13,z1) et envoyait le groupe à l'autre bout de la salle. */
  const propAtScreen = (gx: number, gy: number, z: number): Pt | null => {
    if (!scene) return null;
    for (const lift of sceneLifts(scene)) {
      const { x, y } = screenToTileAtLift(pose, { x: gx, y: gy }, lift);
      if (x < 0 || y < 0 || x >= dims.w || y >= dims.h) continue;
      if (metricToLift(heightAt(scene, x, y, z)) !== lift) continue; // cette case n'est pas dessinée à ce lift
      // PREMIÈRE case dessinée sous le pixel (lift le plus haut) : c'est celle qu'on VOIT, et elle
      // décide seule — porte-t-elle un meuble ou non. Continuer à sonder les lifts plus bas
      // rendrait un meuble d'AILLEURS, la maladie même qu'on soigne.
      return scene.entities.some((e) => e.kind === 'prop' && e.pos.x === x && e.pos.y === y && (e.z ?? 0) === z)
        ? (z ? { x, y, z } : { x, y })
        : null;
    }
    return null;
  };

  /** Point de PROJECTION du stage sous le pixel : le pixel de l'élément remonte la chaîne d'affichage
   *  à l'envers par les DEUX étages de `stageCam` (recouvrement `slice`, puis caméra du groupe), et
   *  retombe dans le repère où `tileCenter`/`worldToScreen` dessinent. Entrée COMMUNE de la résolution
   *  de tuile (`tileFromEvent`) et de celle de meuble (`propAtScreen`). */
  const stagePointOf = (ev: React.PointerEvent): { x: number; y: number } | null => {
    const vb = clientToSvg(ev);
    if (!vb || !scene) return null;
    return stagePointAt(vb, camRef.current!, zoom);
  };

  // Écran → tuile.
  const tileFromEvent = (ev: React.PointerEvent): Pt | null => {
    const p = stagePointOf(ev);
    if (!p || !scene) return null;
    const { x: gx, y: gy } = p;
    if (useGame.getState().mode === 'exploration') {
      const step = stepFromScreen(gx, gy);
      if (step) return step;
      const here = walkableAtScreen(gx, gy, activeZ);
      if (here) return here;
    }
    // Fallback CROSS-COUCHE aligné sur le curseur clavier : chaque couche est inversée à son lift,
    // puis `resolveCursorZ` tranche la surface réelle la plus haute de la case candidate.
    for (const z of scene.layers.map((l) => l.z).sort((a, b) => b - a)) {
      const { x, y } = screenToTileAtLift(pose, { x: gx, y: gy }, z);
      if (x < 0 || y < 0 || x >= dims.w || y >= dims.h) continue;
      if (resolveCursorZ(scene, x, y) !== z) continue; // la surface réelle la plus haute ici n'est pas cette couche
      return z ? { x, y, z } : { x, y };
    }
    return null;
  };

  // Picking SPRITE-aware : si un TOKEN (ou un décor volumique) est réellement dessiné sous le curseur,
  // on cible SA tuile — pas la tuile « derrière » le sprite (ancré au-dessus de sa case en iso, d'où
  // l'ancienne « chasse aux pieds »). Le hit-test lui-même appartient à la VOIE DE RENDU
  // (`targetUnderPointer` : `elementFromPoint` en affine, lancer de rayon en volumique) — l'empilement
  // s'y tranche, de la seule façon que la voie sait trancher. Sans cible dessinée → la tuile du sol
  // (tileFromEvent) pour le déplacement.
  const pickTile = (ev: React.PointerEvent): Pt | null => {
    const st = useGame.getState();
    // On n'interroge la voie de rendu que là où sa réponse peut changer le verdict, et le hit-test
    // tourne À CHAQUE `pointermove` : en COMBAT, pour le jeton sous le pixel (le chemin historique,
    // quads seuls) ; hors combat, seulement si une voie volumique est inscrite ET que la scène porte
    // un meuble à recette — c'est la seule chose que le rayon MONDE puisse nommer, et c'est lui qui
    // coûte (la masse triangulée de la carte). Une scène sans mobilier volumique ne paie donc rien,
    // et le survol garde son affordance là où il y a un meuble à désigner.
    const enCombat = st.mode === 'battle' && !!st.battle;
    const meublesVolumiques = !!st.scene && hasSpritePicker() && sceneAUnPropVolumique(st.scene);
    const visé = enCombat || meublesVolumiques ? targetUnderPointer(ev.clientX, ev.clientY) : null;
    if (visé?.kind === 'combatant' && enCombat && st.battle) {
      const c = st.battle.combatants.find((x) => x.id === visé.id);
      if (c?.pos) return c.pos.z ? { x: c.pos.x, y: c.pos.y, z: c.pos.z } : { x: c.pos.x, y: c.pos.y };
    }
    // LA CASE D'UN MEUBLE LUI APPARTIENT : hors combat, si la case DESSINÉE sous le pixel porte un
    // décor `prop`, c'est LUI qu'on vise — avant le rayon. Deux silences mesurés sur `la-diligence`
    // s'y referment d'un coup : le plateau FIN que le rayon rate (aucune face sous le pixel), et le
    // meuble VOISIN plus proche de la caméra que le rayon nomme à la place (le comptoir devant la
    // table (10,23)) — une occultation ne prend pas à un meuble la case qu'il occupe. Le rayon garde
    // tout le reste : au-dessus d'une case de SOL, c'est lui qui dit quel corps s'y dessine.
    const p = st.mode !== 'battle' ? stagePointOf(ev) : null;
    const meuble = p ? propAtScreen(p.x, p.y, activeZ) : null;
    if (meuble) return meuble;
    // DÉCOR VOLUMIQUE : c'est le MEUBLE qui est dessiné sous le pixel, pas la tuile derrière lui — on
    // cible sa case d'ancrage, d'où l'interaction d'exploration le reprend comme n'importe quel décor.
    if (visé?.kind === 'entity') {
      const ent = useGame.getState().scene?.entities.find((e) => e.id === visé.id);
      if (ent) return ent.z ? { x: ent.pos.x, y: ent.pos.y, z: ent.z } : { x: ent.pos.x, y: ent.pos.y };
    }
    return tileFromEvent(ev);
  };

  // Écran → coordonnées de VIEWBOX — base du panoramique (delta de glissement). Le seul étage de
  // `stageCam` qui s'inverse ici est le recouvrement `slice` : la caméra du groupe reste en place,
  // c'est elle qu'on déplace. Deux entrées, une seule inversion : un point CLIENT nu (milieu de deux
  // doigts) et l'événement de pointeur.
  const clientPtToSvg = (cx: number, cy: number): { x: number; y: number } | null => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return null; // élément sans surface mesurée : aucun pixel à inverser
    return viewBoxPointAt({ sx: cx - r.left, sy: cy - r.top }, { w: r.width, h: r.height });
  };
  const clientToSvg = (ev: React.PointerEvent): { x: number; y: number } | null => clientPtToSvg(ev.clientX, ev.clientY);

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
      const dist = chebyshev(cur, prev);
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
    // MEUBLE À PLACES : le MÊME `pendingInteract` que la fouille, mais la marche va jusqu'à l'ABORD
    // de la place (`exploreSeatPlan` via `exploreMovePlan`), jamais à la case d'ancrage du meuble.
    // Aucun second pending, aucune route `sit`/`seat` : le geste reste `interactEntity`. Cette branche
    // n'INTERCEPTE rien : sans place servable elle repasse la main à la chaîne fouille/marchand/dialogue.
    if (ent && ent.kind === 'prop' && seatSlotsOf(sc, ent.id).length) {
      const meneur = st.party[0]?.id;
      const assisIci = !!meneur && seatPoseOf(sc, { kind: 'party', rang: RANG_MENEUR })?.propId === ent.id;
      const surAbord = seatSlotsOf(sc, ent.id).some((s) => memeCase(s.approach, st.partyPos));
      if (assisIci || surAbord) {
        // Sur place : le store arbitre entre se relever, servir la fouille/le marchand, et s'asseoir.
        setHover(null);
        st.setPendingInteract(null);
        st.interactEntity(ent.id);
        return;
      }
      // Une place SERVABLE au loin : on marche jusqu'à son ABORD (jamais la case d'ancrage), et le
      // MÊME `pendingInteract` que la fouille se consomme à l'arrivée.
      if (plan && exploreSeatPlan(sc, st.partyPos, ent.id, pathOpts())) {
        setHover(null);
        st.setPendingInteract({ id: ent.id, at: plan.dest });
        moveAlong(sc.id, plan);
        return;
      }
      // REPLI — aucune place servable (toutes prises, ou aucun abord atteignable) : les places
      // AJOUTENT une affordance, elles n'en retirent AUCUNE. La chaîne fouille/marchand/dialogue
      // ci-dessous reprend la main (et `exploreMovePlan` a déjà rendu la marche vers une case
      // adjacente). Un meuble qui n'a QUE des places, lui, dit pourquoi il ne sert pas.
      if (!ent.dialogueId && !ent.interact && !ent.merchant) {
        setHover(null);
        st.setPendingInteract(null);
        st.log(message('seating.noReachableSeat'));
        return;
      }
    }
    if (ent && (ent.dialogueId || !!ent.interact || !!ent.merchant)) {
      if (chebyshev(st.partyPos, ent.pos) <= 1) {
        setHover(null);
        st.setPendingInteract(null);
        st.interactEntity(ent.id); // adjacent → fouille / dialogue immédiat
      } else if (plan) {
        // Déplacement-puis-fouille (P5) : marche vers la case adjacente libre, puis fouille à l'arrivée.
        setHover(null);
        st.setPendingInteract({ id: ent.id, at: plan.dest });
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

  /** RE-POSE la base du panoramique sur l'état courant : le décalage vivant devient l'origine, et le
   *  point de viewBox sous le doigt aussi. Ce que le geste a déjà parcouru est acquis, ce qui suit se
   *  mesure à partir d'ici. */
  const rebaser = (d: NonNullable<typeof dragRef.current>, p: { x: number; y: number }): void => {
    d.pan0 = getStagePan();
    d.vbX = p.x;
    d.vbY = p.y;
    d.zoom0 = zoom;
    d.accord0 = accordsPan();
  };

  // Un glisser survit à la souris : l'écran peut être QUITTÉ en plein geste (changement de scène,
  // combat qui s'ouvre) et aucun `pointerup` n'arrive. Le décalage vivant reviendrait alors hanter le
  // montage suivant, sans que le store — seul état commis — n'en sache rien. On le rend au commis.
  useEffect(() => () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    const commis = useGame.getState().camPan;
    poserPan(commis.x, commis.y);
  }, []);
  // Caméra libre : on ARME un glisser au pointer-down (sans agir), on panoramique au mouvement
  // au-delà du seuil, et le clic ne se déclenche au relâchement QUE si on n'a pas glissé.
  const onPointerDown = (ev: React.PointerEvent) => {
    if (useGame.getState().dialogue) return;
    // Bouton MILIEU : le navigateur y arme son défilement automatique (curseur en rose des vents,
    // la page défile au moindre mouvement) — il prendrait le glisser-tourner à chaque geste.
    if (ev.button === 1) ev.preventDefault();
    ptrs.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (ptrs.current.size === 2) {
      // 2ᵉ doigt : le geste devient un PINCER. Le glisser à un doigt est DÉSARMÉ — sinon son
      // relâchement commettrait le clic différé (un ordre de déplacement au bout d'un zoom).
      const [a, b] = [...ptrs.current.values()];
      pinchRef.current = { dist: Math.hypot(b.x - a.x, b.y - a.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, accord0: accordsPan() };
      dragRef.current = null;
      svgRef.current?.setPointerCapture?.(ev.pointerId);
      return;
    }
    const p = clientToSvg(ev);
    dragRef.current = { sx: ev.clientX, sy: ev.clientY, vbX: p?.x ?? 0, vbY: p?.y ?? 0, panned: false, button: ev.button, tile: pickTile(ev), yaw0: getStageYaw(), pan0: getStagePan(), zoom0: zoom, accord0: accordsPan() };
    svgRef.current?.setPointerCapture?.(ev.pointerId);
  };

  const onPointerMove = (ev: React.PointerEvent) => {
    if (ptrs.current.has(ev.pointerId)) ptrs.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    // DEUX DOIGTS : l'écart entre eux pilote le ZOOM, la translation de leur MILIEU pilote le
    // PANORAMIQUE. Le geste est lu en variables LOCALES avant tout appel au store (patron
    // `ui/MapCanvas`) — jamais un `pinchRef.current` déréférencé dans un callback différé, que le
    // `pointerup` a pu remettre à `null` entre-temps.
    const pinch = pinchRef.current;
    if (pinch && ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const st = useGame.getState();
      st.setZoom(st.zoom * (dist / (pinch.dist || dist))); // le store borne
      const from = clientPtToSvg(pinch.cx, pinch.cy);
      const to = clientPtToSvg(cx, cy);
      if (from && to) {
        // Comme le glisser à un doigt : le pan se pose HORS de React (`state/stagePan`) et le store ne
        // converge qu'au relâchement — ici en RELATIF, le milieu des doigts n'a pas de base stable.
        const cur = getStagePan();
        poserPan(cur.x + (to.x - from.x) / zoom, cur.y + (to.y - from.y) / zoom); // delta écran (viewBox) → unités caméra
        battreStageFrames();
      }
      pinch.dist = dist;
      pinch.cx = cx;
      pinch.cy = cy;
      return; // pendant un pincer : ni survol, ni panoramique à un doigt
    }
    const d = dragRef.current;
    if (d) {
      if (!d.panned && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) > PAN_THRESHOLD) d.panned = true;
      if (d.panned) {
        // Bouton MILIEU = TOURNER (le principal déplace le groupe, le droit ouvre l'attaque la plus
        // pertinente) : le lacet se pose ABSOLUMENT depuis l'angle du début de geste, la vue suit donc
        // le doigt sans dériver au fil des images.
        if (d.button === 1) {
          poserYaw(d.yaw0 + (ev.clientX - d.sx) * SENSIBILITE_DRAG_DEG_PX);
          (ev.currentTarget as SVGElement).style.cursor = 'grabbing';
          return;
        }
        const p = clientToSvg(ev);
        if (p) {
          // Une hypothèse de la base a bougé sous le geste (recentrage, cran de molette) : on se re-cale
          // dessus AVANT d'appliquer quoi que ce soit — le recentrage gagne, et le doigt repart de là.
          if (accordsPan() !== d.accord0 || zoom !== d.zoom0) rebaser(d, p);
          // Le décalage se pose ABSOLUMENT depuis celui de la base, comme le lacet ci-dessus, et RIEN
          // n'entre dans le store avant le relâchement : un `set` par événement de souris re-rendait le
          // stage ENTIER. Le battement repose les deux clients de la caméra sur la même valeur.
          poserPan(d.pan0.x + (p.x - d.vbX) / zoom, d.pan0.y + (p.y - d.vbY) / zoom); // delta écran (viewBox) → unités caméra
          battreStageFrames();
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
      sc.entities.some((e) => e.pos.x === t.x && e.pos.y === t.y && (e.z ?? 0) === (t.z ?? 0)
        // Un meuble à places est interactif SANS `SceneEntity.interact` : c'est la place qui appelle.
        && (e.dialogueId || !!e.interact || !!e.merchant || (e.kind === 'prop' && seatSlotsOf(sc, e.id).length > 0)));
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
    ptrs.current.delete(ev.pointerId);
    if (ptrs.current.size < 2 && pinchRef.current) {
      // FIN DU PINCER : même convergence que le glisser ci-dessous — le décalage vivant se commet au
      // store en UN `set`, sauf si un recentrage a déjà eu le dernier mot pendant le geste.
      if (accordsPan() === pinchRef.current.accord0) setCamPan(getStagePan().x, getStagePan().y);
      pinchRef.current = null;
    }
    svgRef.current?.releasePointerCapture?.(ev.pointerId);
    (ev.currentTarget as SVGElement).style.cursor = '';
    if (!d) return;
    // FIN DU GLISSER-CAMÉRA : le décalage vivant se COMMET au store, en UN seul `set` ABSOLU pour tout
    // le geste — c'est là, et là seulement, que l'état React converge sur ce que la vue montre déjà.
    // Un recentrage arrivé APRÈS le dernier mouvement a le dernier mot : il a déjà commis {0,0} et
    // ramené le vivant, il n'y a rien à écrire par-dessus.
    if (d.panned && d.button === 0 && accordsPan() === d.accord0) setCamPan(getStagePan().x, getStagePan().y);
    if (!d.panned && d.button === 0) performClick(d.tile); // tap (sans glisser) au bouton principal = clic
  };

  const onPointerLeave = () => {
    ptrs.current.clear();
    pinchRef.current = null;
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
