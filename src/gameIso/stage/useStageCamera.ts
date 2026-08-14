/**
 * Caméra du stage iso : transition « dim-and-turn » des 8 crans (rotation/edge-on), zoom molette,
 * caméra libre (camPan, remise à zéro au changement d'unité active), calcul du POINT FOCAL
 * (leader/centroïde/actif/paire de visée/peek de frise) et du cadre VISIBLE (culling d'animation).
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useGame, type BattleState } from '../../state/store';
import { Combatant } from '../../engine/types';
import { isOutOfAction } from '../../engine/conditions';
import { Dims, screenToTile } from '../../geometry/iso';
import type { WalkPos } from '../fx/walkPose';

// Viewport virtuel : le SVG remplit tout l'espace dispo (preserveAspectRatio slice) et la caméra
// recadre autour du point focal (groupe / combattant actif).
export const VW = 1100;
export const VH = 720;

/** État caméra réactif : rotation AFFICHÉE (retardée pour masquer le ré-agencement sous le creux
 *  d'opacité de la transition), zoom (molette non-passive) et décalage manuel (camPan). */
export function useStageCamera(svgRef: RefObject<SVGSVGElement>): {
  shownRot: 0 | 1 | 2 | 3;
  shownEdge: boolean;
  turning: boolean;
  zoom: number;
  camPan: { x: number; y: number };
} {
  const zoom = useGame((s) => s.zoom);
  const setZoom = useGame((s) => s.setZoom);
  // Rotation caméra (cran de 90°). `camRot` = cible (store, lu en live par le rig) ; `shownRot` =
  // orientation AFFICHÉE, retardée. `camEdge` : cran impair, vue « de face » (edge-on) axis-alignée 3D.
  const camRot = useGame((s) => s.camRot);
  const camEdge = useGame((s) => s.camEdge);
  const camPan = useGame((s) => s.camPan);
  const resetCamPan = useGame((s) => s.resetCamPan);
  const [shownRot, setShownRot] = useState<0 | 1 | 2 | 3>(camRot);
  const [shownEdge, setShownEdge] = useState(camEdge);
  const [turning, setTurning] = useState(false);
  // Dépend de camRot SEUL (pas de shownRot) : sinon le swap de shownRot à mi-course re-déclenche
  // l'effet et son cleanup annule le timer qui rétablit `turning=false` → la scène resterait sombre.
  // `prevCam` filtre les re-rendus non liés.
  const prevCam = useRef({ rot: camRot, edge: camEdge });
  useEffect(() => {
    if (prevCam.current.rot === camRot && prevCam.current.edge === camEdge) return;
    prevCam.current = { rot: camRot, edge: camEdge };
    setTurning(true);
    const t1 = window.setTimeout(() => { setShownRot(camRot); setShownEdge(camEdge); }, 130); // swap au creux
    const t2 = window.setTimeout(() => setTurning(false), 260); // remontée
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [camRot, camEdge]);

  // Zoom molette (listener non-passif pour pouvoir preventDefault le scroll de page).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(useGame.getState().zoom - e.deltaY * 0.0015); // le store borne
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // Refocus « sur celui qui joue après » : tout décalage manuel de caméra est annulé quand l'unité
  // active change (nouveau tour) — sinon le pion actif pourrait rester hors champ après un panoramique.
  const activeTurnKey = useGame((s) => (s.mode === 'battle' && s.battle ? s.battle.order[s.battle.turn] : 'explore'));
  useEffect(() => {
    resetCamPan();
  }, [activeTurnKey, resetCamPan]);

  return { shownRot, shownEdge, turning, zoom, camPan };
}

/** Attaque/sort ENNEMI télégraphié (actorAim) : la paire à cadrer + le style de ligne (pleine en
 *  mêlée, pointillée tir/sort). Le ciblage du JOUEUR a son propre réticule. */
export function cameraTargeting(
  battle: BattleState | null,
  actorAim: { fromId: string; toId: string; kind: string } | null,
): { from: Combatant; to: Combatant; melee?: boolean } | null {
  if (!battle || !actorAim) return null;
  const a = battle.combatants.find((c) => c.id === actorAim.fromId);
  const b = battle.combatants.find((c) => c.id === actorAim.toId);
  return a?.pos && b?.pos ? { from: a, to: b, melee: actorAim.kind === 'melee' || actorAim.kind === 'charge' } : null;
}

/** POINT FOCAL de la caméra (PUR, appelé à la frame — suit le token qui GLISSE via `walkPosOf`) :
 *  hors combat le leader visuel ; une paire attaquant↔cible (télégraphe OU attaque/incantation en
 *  cours de résolution — sinon on voit mieux ce que fait l'IA que soi-même) se cadre à son MILIEU ;
 *  en combat l'unité active (ou le centroïde à l'ouverture du Round 1 / sans actif) ; le survol d'un
 *  portrait de FRISE (peek) prime temporairement — au relâchement la transition CSS ramène la vue. */
export function stageFocus(args: {
  mode: string;
  battle: BattleState | null;
  partyPos: { x: number; y: number };
  partyLeader: Combatant | undefined;
  walkPosOf: WalkPos;
  planView: boolean;
  hoverCombatantId: string | null;
  targeting: { from: Combatant; to: Combatant } | null;
  pendingAttack: { attackerId: string; targetId: string } | null;
  pendingCast: { casterId: string; targetId?: string; zone?: { center?: { x: number; y: number } | null } } | null;
}): { x: number; y: number } {
  const { mode, battle, partyPos, partyLeader, walkPosOf, planView, hoverCombatantId, targeting, pendingAttack, pendingCast } = args;
  let camPair: { from: { x: number; y: number }; to: { x: number; y: number } } | null =
    targeting ? { from: targeting.from.pos!, to: targeting.to.pos! } : null;
  if (!camPair && mode === 'battle' && battle && pendingAttack) {
    const a = battle.combatants.find((c) => c.id === pendingAttack.attackerId);
    const b = battle.combatants.find((c) => c.id === pendingAttack.targetId);
    if (a?.pos && b?.pos) camPair = { from: a.pos, to: b.pos };
  }
  if (!camPair && mode === 'battle' && battle && pendingCast) {
    const a = battle.combatants.find((c) => c.id === pendingCast.casterId);
    const to = pendingCast.zone?.center ?? battle.combatants.find((c) => c.id === pendingCast.targetId)?.pos;
    if (a?.pos && to) camPair = { from: a.pos, to };
  }
  // Hors combat, la caméra suit la position VISUELLE du leader (qui glisse via ANIM_MOVE), pas la
  // tuile logique partyPos qui avance d'une case toutes les 150 ms.
  let focus: { x: number; y: number } = partyPos;
  if (mode !== 'battle' && partyLeader) focus = walkPosOf(partyLeader.id, partyPos.x, partyPos.y);
  if (camPair) {
    // Cadrer les DEUX : on centre sur le milieu attaquant ↔ cible.
    focus = { x: Math.round((camPair.from.x + camPair.to.x) / 2), y: Math.round((camPair.from.y + camPair.to.y) / 2) };
  } else if (mode === 'battle' && battle) {
    const alive = battle.combatants.filter((c) => c.pos && !isOutOfAction(c));
    const centroid = alive.length
      ? {
          x: Math.round(alive.reduce((s, c) => s + c.pos!.x, 0) / alive.length),
          y: Math.round(alive.reduce((s, c) => s + c.pos!.y, 0) / alive.length),
        }
      : focus;
    const active = battle.combatants.find((c) => c.id === battle.order[battle.turn] && c.pos);
    // Ouverture du combat (pause du Round 1) : on cadre le CENTRE du champ (vue des forces) ;
    // sinon la caméra SUIT le token actif qui glisse (n'arrive plus avant lui).
    if (planView) focus = centroid;
    else if (active?.pos) focus = walkPosOf(active.id, active.pos.x, active.pos.y);
    else focus = centroid;
  }
  // Peek caméra (survol d'un portrait dans la FRISE d'initiative) — local/read-only, actif même hors
  // de son tour (coop) ; le survol d'un TOKEN sur la carte, lui, ne bouge pas la caméra.
  if (mode === 'battle' && battle && hoverCombatantId) {
    const peeked = battle.combatants.find((c) => c.id === hoverCombatantId && c.pos);
    if (peeked?.pos) focus = walkPosOf(peeked.id, peeked.pos.x, peeked.pos.y);
  }
  return focus;
}

/** Cadre VISIBLE en tuiles (AABB des 4 coins de la fenêtre projetés) : culling d'animation
 *  (setVisibleTileBounds) ET du brouillard (FogLayer borné par la fenêtre, pas par la scène). */
export function computeViewBounds(cam: { x: number; y: number }, zoom: number, dims: Dims): { minX: number; maxX: number; minY: number; maxY: number } {
  const toTile = (sx: number, sy: number) => screenToTile((sx - VW / 2) / zoom + VW / 2 - cam.x, (sy - VH / 2) / zoom + VH / 2 - cam.y, dims);
  const cs = [toTile(0, 0), toTile(VW, 0), toTile(0, VH), toTile(VW, VH)];
  const xs = cs.map((c) => c.x), ys = cs.map((c) => c.y);
  return { minX: Math.floor(Math.min(...xs)), maxX: Math.ceil(Math.max(...xs)), minY: Math.floor(Math.min(...ys)), maxY: Math.ceil(Math.max(...ys)) };
}
