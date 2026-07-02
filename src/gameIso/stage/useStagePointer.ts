/**
 * Pointeur du stage iso (extrait EN DERNIER — comportement au pixel près) :
 *  - `tileFromEvent` : écran → tuile, picking CROSS-COUCHE du HAUT vers le bas (`screenToTileAtZ` +
 *    `resolveCursorZ`, parité souris↔clavier) ;
 *  - `pickTile` : picking SPRITE-aware en combat (`data-cid` + `elementFromPoint` — hit-test natif) ;
 *  - glisser-caméra (seuil PAN_THRESHOLD, l'action de clic est DIFFÉRÉE au relâchement) ;
 *  - `performClick` : sélection / cible / déplacement (combat et exploration) ;
 *  - `moveAlong` : marche pas-à-pas du groupe (sauts par-dessus les gouffres compris) ;
 *  - clic droit : attaque la plus PERTINENTE sur l'ennemi survolé (scoreur partagé avec l'IA) ;
 *  - suivi du SURVOL borné aux changements de tuile (curseur main sur l'interactif).
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useGame } from '../../state/store';
import { Scene as GameScene, isWalkable } from '../../state/scene';
import { pathTo, chebyshev, type Pt } from '../../state/path';
import { exploreMoveDest } from '../../state/exploreNav';
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
import { Dims, screenToTileAtZ } from '../iso';
import { VW, VH } from './useStageCamera';

const PAN_THRESHOLD = 6; // px de glissement avant de passer en panoramique (sinon = clic)

export interface StagePointer {
  /** Tuile survolée (tooltip + réticule de visée ; suivie dans tous les modes de ciblage). */
  hover: Pt | null;
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
}): StagePointer {
  const panCamBy = useGame((s) => s.panCamBy);
  const [hover, setHover] = useState<Pt | null>(null);
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
    // Picking CROSS-COUCHE aligné sur le curseur clavier (PARITÉ souris↔clavier) : SANS borne d'étage
    // `≤ activeZ`, on vise la couche RÉELLE LA PLUS HAUTE de la case écran sous le curseur — survoler/
    // cliquer le chemin de ronde z1 depuis la cour z0 cible z1 (défenseurs et pièces). On itère du HAUT
    // vers le bas : chaque couche est inversée À SON lift (`screenToTileAtZ`), et `resolveCursorZ`
    // (SOURCE UNIQUE de « la couche réelle la plus haute d'une case », partagée avec `nextCursorTile`)
    // tranche — la 1ʳᵉ couche dont la case résout à ELLE-MÊME gagne (un surplomb dessiné lifté capte le
    // clic ; sinon on tombe dans le puits jusqu'au sol). Sol plat mono-couche : byte-identique.
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

  const moveAlong = (sc: GameScene, from: Pt, to: Pt) => {
    if (movingRef.current || !isWalkable(sc, to.x, to.y, to.z ?? 0)) return;
    // Portée de saut du GROUPE = le plus faible sauteur (tout le monde doit franchir) ; permet à pathTo
    // de router des sauts par-dessus un gouffre vers la destination cliquée (Saut LDB 15).
    const heroes = useGame.getState().party.filter((h) => !h.dead && h.wounds.current > 0);
    const partyM = heroes.length ? Math.min(...heroes.map((h) => effectiveMovement(h))) : 0;
    const path = pathTo(sc, from, to, { blocked: new Set(), jump: maxJumpTiles(partyM) });
    if (!path || path.length < 2) return;
    movingRef.current = true;
    if (partyLeader) bus.emit(EVT.ANIM_MOVE, { id: partyLeader.id, path });
    let i = 1;
    const step = () => {
      const st = useGame.getState();
      if (st.mode !== 'exploration' || st.dialogue || i >= path.length) {
        movingRef.current = false;
        return;
      }
      const prev = path[i - 1], cur = path[i];
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
        const plan = planJump(sc, prev, cur, partyM, runUp);
        st.moveParty(cur); // franchit (optimiste) ; un échec de Test fera retomber dans le gouffre
        if (plan.kind === 'test') {
          runFlow(useGame.getState, useGame.setState, plan.flow); // modale Athlétisme « Saut » ; échec → fall
          movingRef.current = false; // on s'arrête au saut : le joueur reclique pour continuer
          return;
        }
        i++;
        setTimeout(step, 150);
        return;
      }
      st.moveParty(cur);
      i++;
      setTimeout(step, 150);
    };
    step();
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
    const dest = exploreMoveDest(sc, st.partyPos, t);
    if (ent && (ent.dialogueId || !!ent.interact || !!ent.merchant)) {
      if (chebyshev(st.partyPos, ent.pos) <= 1) {
        st.setPendingInteract(null);
        st.interactEntity(ent.id); // adjacent → fouille / dialogue immédiat
      } else if (dest) {
        // Déplacement-puis-fouille (P5) : marche vers la case adjacente libre, puis fouille à l'arrivée.
        st.setPendingInteract(ent.id);
        moveAlong(sc, st.partyPos, dest);
      }
      return;
    }
    if (ent && ent.kind === 'personnage') {
      // FIGURANT (PNJ sans dialogue/boutique/fouille) : on ne lui marche pas DESSUS — on s'approche
      // d'une case adjacente, ou on le dit s'il est déjà à côté.
      st.setPendingInteract(null);
      if (chebyshev(st.partyPos, ent.pos) <= 1) st.log(`${ent.label ?? 'Ce badaud'} n’a rien à vous dire.`);
      else if (dest) moveAlong(sc, st.partyPos, dest);
      return;
    }
    // Clic ailleurs : annule un déplacement-puis-fouille en attente. `dest` couvre l'ESCALIER (geste
    // explicite pour changer d'étage) et le déplacement simple ; moveAlong filtre les cases non marchables.
    st.setPendingInteract(null);
    if (dest) moveAlong(sc, st.partyPos, dest);
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
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onPointerLeave, onContextMenu },
  };
}
