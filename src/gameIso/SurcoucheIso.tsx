/**
 * SURCOUCHE DE PLATEAU — les overlays d'interaction et le picking du regard isométrique, posés SUR le
 * canevas volumique que l'hôte possède (`stage/MondeDeCampagne`). Cette feuille ne dérive AUCUNE vérité
 * monde : elle reçoit celles de l'hôte (scène, projection, brouillard, teinte, jetons, caméra, survol)
 * et n'en tire que de la géométrie d'overlay (grille, traits de mur, accès de pièce, réticules).
 */
import { useMemo } from 'react';
import { useGame } from '../state/store';
import { Combatant } from '../engine/types';
import { footprintN, sizeFootprint } from '../state/footprint';
import { mountOf } from '../state/mount';
import { modalBlocksMapHover } from '../state/modalArbiter';
import { mapTargetingActive } from '../state/targetingHolder';
import { Dims, tileCenter } from '../geometry/iso';
import { useCombatFx } from './fx/useCombatFx';
import { type WalkPos } from './fx/walkPose';
import { FxLayer } from './fx/FxLayer';
import { TokenChromeOverlay } from './stage/TokenChromeOverlay';
import { type TokenChromeMark } from './builders/tokenChrome';
import { viewPolicy } from './stage/viewPolicy';
import { wallTraitObjs } from './stage/layers';
import { gridLines } from '../geometry/grid';
import { type TintAt } from './backends/webgl/sceneMeshes';
import { occupiedInteriorZoneIds } from './stage/roomFocus';
import { DoorOverlays } from './stage/DoorOverlays';
import { ClimbOverlays } from './stage/ClimbOverlays';
import { FallOverlays } from './stage/FallOverlays';
import { SiegeHitAreas } from './stage/SiegeHitAreas';
import { EnemyMoveTelegraph, EnemyAimTelegraph, EnemyAoeTelegraph } from './stage/Telegraphs';
import { ZdeTemplate } from './stage/ZdeTemplate';
import { CursorOverlay, HoverMovePreview, ExplorePathPreview, TapPreview } from './stage/MoveOverlays';
import { AimOverlay } from './stage/AimOverlay';
import { CrewTooltip } from './stage/CrewTooltip';
import { DebugMapLabels, DebugLegend } from './stage/DebugOverlay';
import { Flies } from './stage/Ambiance';
import { cameraTargeting, VW, VH } from './stage/useStageCamera';
import { useStagePointer } from './stage/useStagePointer';
import { useHoverTargeting } from './stage/useHoverTargeting';
import type { Scene } from '../state/scene';
import type { BattleState } from '../state/store';
import type { Pt } from '../state/path';
import { portalsForParty } from '../state/roomPortals';

/** OPACITÉ de la grille TACTIQUE (encre `--iso-grid`, partagée avec l'éditeur), plus basse que celle de
 *  l'auteur (`ui/editor/EditorCanvas`, 0,22) : en jeu la grille est un FOND qui donne l'échelle des
 *  cases, jamais l'outil qui sert à poser un mur — elle ne concurrence ni les traits de structure ni
 *  les pions posés dessus. */
const GRILLE_OPACITE = 0.11;

/** Ce que l'hôte SERT à cette surcouche : des vérités déjà dérivées, jamais des entrées à redériver. */
export type VueDePlateau = {
  scene: Scene;
  /** Projection VIVE (cran + lacet réel) — la même que celle du canevas, sans quoi les overlays
   *  décrocheraient du monde pendant une rotation. */
  dims: Dims;
  turning: boolean;
  activeZ: number;
  visible: ReadonlySet<string>;
  tintAt: TintAt;
  liftAt: (x: number, y: number, z?: number) => number;
  politique: ReturnType<typeof viewPolicy>;
  chromes: readonly TokenChromeMark[];
  walkPosAt: (now: number) => WalkPos;
  activeC: Combatant | undefined;
  /** Le combat EN COURS, ou `null` hors combat (déjà tranché par l'hôte). */
  battle: BattleState | null;
  myTurn: boolean;
  partyPos: Pt;
  mode: string;
  targeting: ReturnType<typeof cameraTargeting>;
  anyWalking: boolean;
  camTransform: string;
  camGRef: React.RefObject<SVGGElement>;
  /** Ref-callback du SVG : elle pose l'élément vivant chez l'hôte (picking ET molette). */
  poserSvg: (el: SVGSVGElement | null) => void;
  pointeur: ReturnType<typeof useStagePointer>;
  visée: ReturnType<typeof useHoverTargeting>;
};

export function SurcoucheIso({
  scene, dims, turning, activeZ, visible, tintAt, liftAt, politique, chromes, walkPosAt,
  activeC, battle, myTurn, partyPos, mode, targeting, anyWalking, camTransform, camGRef,
  poserSvg, pointeur, visée,
}: VueDePlateau) {
  // Vérités d'OVERLAY (jamais du monde) : ce que cette vue seule affiche.
  const mapInert = useGame(modalBlocksMapHover); // modale bloquante (arbitre) : la carte ne répond plus
  const mapTargeting = useGame(mapTargetingActive); // un ciblage carte tient la scène (registre des pendings de ciblage)
  const combatCursor = useGame((s) => s.combatCursor);
  const debugLabels = useGame((s) => s.debugLabels); // overlay d'annotation de carte (__wfrp.labels)
  // Télégraphes ENNEMIS (« qui l'adversaire vise / où il va / où l'aire tombe ») — le ciblage du
  // JOUEUR a son propre réticule (hoverAim + jets pendants), même rendu partagé (TargetReticle).
  const actorMove = useGame((s) => s.actorMove);
  const actorAoe = useGame((s) => s.actorAoe);
  const pendingAttack = useGame((s) => s.pendingAttack);
  const pendingCast = useGame((s) => s.pendingCast);
  const pendingSiegeAim = useGame((s) => s.pendingSiegeAim); // pilonnage indirect : placeur de CASE
  const pendingTrample = useGame((s) => s.pendingTrample);
  const pendingHeal = useGame((s) => s.pendingHeal);
  const pendingDefense = useGame((s) => s.pendingDefense);
  const { floats, projs, auras, aoes } = useCombatFx();
  const { hover, hoveredPortal, portalHandlers, handlers } = pointeur;
  const { hoverAim, hoveredId, hoverMove, explorePath, effHover } = visée;
  const walkPosOf = walkPosAt(performance.now());

  // STRUCTURE AU TRAIT (#1176, P3-5b) : la MÊME couche que le plan de station (`stage/layers`), montrée
  // ici quand le regard retire les murs du monde volumique. Le brouillard lui est passé : un mur non vu
  // n'est pas tracé.
  const mursTrait = useMemo(
    () => (politique.mursAuTrait ? wallTraitObjs(scene, dims, activeZ, visible) : []),
    [scene, politique, dims, activeZ, visible],
  );
  // GRILLE TACTIQUE (#1176, P3-5b) : la même fonction pure que l'éditeur (`geometry/grid`), à l'encre du
  // JEU — un FOND de plateau, pas un outil d'auteur. `w+h+2` segments, jamais un par case.
  const grille = useMemo(
    () => (politique.grilleTactique ? gridLines(dims, activeZ) : []),
    [politique, dims, activeZ],
  );

  // ── Accès de PIÈCE (portes/passages des overlays) ──────────────────────────────────────────────
  // `portalsForParty` lit les accès de la scène (mémoïsés) et, hors zone intérieure, ne garde que les
  // sorties de la COMPOSANTE marchable du groupe (`walkComponentAt`, étiquetage bâti une fois par
  // scène — #1416). Ses seules vraies entrées sont la SCÈNE (réf neuve dès qu'une porte s'ouvre —
  // `wallEdges`/`doorIsOpen` lisent `scene.flags`) et la case de CONTRÔLE arrondie ; le glissement
  // visuel d'une marche n'en fait pas partie, donc une image d'animation ne recalcule aucun accès (#817).
  const doorCtrlKey = battle
    ? (myTurn && activeC?.kind === 'hero' && activeC.pos ? `${activeC.id}@${activeC.pos.x},${activeC.pos.y},${activeC.pos.z ?? 0}` : '')
    : `party@${partyPos.x},${partyPos.y},${partyPos.z ?? 0}`;
  const doorCtrls = useMemo<Pt[]>(
    () => (battle ? (myTurn && activeC?.kind === 'hero' && activeC.pos ? [activeC.pos] : []) : [partyPos]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doorCtrlKey],
  );
  const portals = useMemo(
    () => (doorCtrls.length ? portalsForParty(scene, doorCtrls[0], occupiedInteriorZoneIds(scene, doorCtrls)) : []),
    [scene, doorCtrls],
  );

  /** Ancre écran d'un combattant pour réticule/ligne de visée : centre de l'EMPREINTE, suit le glissé. */
  const reticleAnchor = (c: Combatant) => {
    const off = (sizeFootprint(c.size) - 1) / 2;
    const wp = walkPosOf(c.id, c.pos!.x, c.pos!.y);
    return tileCenter(wp.x + off, wp.y + off, dims);
  };
  const liftOf = (p: Pt) => (p.z ? liftAt(p.x, p.y, p.z) : 0);
  // Empreinte du MOBILE actif (sa MONTURE si cavalier) → aperçus/curseur à la BONNE taille.
  const activeMoveN = activeC && battle ? footprintN(mountOf(battle, activeC) ?? activeC) : 1;
  const camTransition = 'opacity 0.13s ease-out';
  const camOpacity = turning ? 0.6 : 1;

  return (
    /* Le fond du SVG est transparent : le canevas peint dessous. */
    <svg ref={poserSvg} className="iso-stage" style={{ background: 'transparent' }} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice" {...handlers}>
      <g ref={camGRef} style={{ transform: camTransform, transition: camTransition, opacity: camOpacity }}>
        {/* COMPOSITION DE LA VUE DU DESSUS (#1176, P3-5b/P3-5c) : le canevas volumique dessous ne peint
            que les SOLS de l'étage actif et le DÉCOR ; ce qui suit est la surcouche de PLATEAU, du plus
            bas au plus haut — la grille (fond), puis la structure au trait, puis les affordances
            (portes, escaliers, télégraphes), puis les PIONS et leur chrome. L'ordre est celui de
            l'émission du groupe : l'état d'une porte se lit SUR son mur, un pion SUR le sol qu'il
            foule, jamais l'inverse. */}
        {grille.length > 0 && (
          <g pointerEvents="none" data-grille-jeu={grille.length}>
            {grille.map((l, i) => (
              <line key={`gj-${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--iso-grid)" strokeOpacity={GRILLE_OPACITE} strokeWidth={1} shapeRendering="crispEdges" />
            ))}
          </g>
        )}
        {mursTrait.length > 0 && <g pointerEvents="none" data-murs-trait={mursTrait.length}>{mursTrait.map((o) => o.el)}</g>}
        <DoorOverlays
          portals={portals}
          dims={dims}
          activeZ={activeZ}
          visible={visible}
          hoveredPortalId={hoveredPortal?.id ?? null}
          lift={liftOf}
          onPortalHover={portalHandlers.onPortalHover}
          onPortalClick={portalHandlers.onPortalClick}
        />
        <ClimbOverlays scene={scene} dims={dims} activeZ={activeZ} visible={visible} ctrls={doorCtrls} />
        <FallOverlays scene={scene} dims={dims} activeZ={activeZ} visible={visible} ctrls={doorCtrls} />
        {battle && <SiegeHitAreas scene={scene} battle={battle} dims={dims} activeZ={activeZ} visible={visible} />}
        <EnemyMoveTelegraph actorMove={actorMove} dims={dims} footN={activeMoveN} lift={liftOf} />
        <EnemyAimTelegraph targeting={targeting} anchor={reticleAnchor} />
        <Flies scene={scene} dims={dims} />
        <FxLayer dims={dims} floats={floats} projs={projs} auras={auras} aoes={aoes} />
        {battle && hover && <ZdeTemplate battle={battle} hover={hover} pendingCast={pendingCast} pendingSiegeAim={pendingSiegeAim} activeC={activeC} dims={dims} />}
        {mode === 'battle' && <EnemyAoeTelegraph actorAoe={actorAoe} dims={dims} />}
        {/* JETONS (P3-0f, P3-5c) : ils se peignent APRÈS les affordances de SOL (portes, télégraphes,
            gabarits) — l'état d'un combattant se lit par-dessus ce qui est peint sur le sol, jamais
            dessous — et, sous `pionsEnDisques`, c'est ICI que vit le pion lui-même. */}
        <TokenChromeOverlay chromes={chromes} dims={dims} liftAt={liftAt} pions={politique.pionsEnDisques} tintAt={tintAt} walkPosAt={walkPosAt} />
        {/* Curseur LIBRE : il se tait dès qu'un ciblage carte tient la scène (verdict du registre
            `mapTargetingActive`) — le réticule/le gabarit du mode prennent alors le relais. */}
        {battle && combatCursor
          && !mapInert && !mapTargeting
          && !hoverAim?.reticle && <CursorOverlay tile={combatCursor.tile} footN={activeMoveN} dims={dims} liftAt={liftAt} />}
        {battle && hoverMove && effHover && <HoverMovePreview move={hoverMove} at={effHover} footN={activeMoveN} dims={dims} lift={liftOf} />}
        {mode === 'exploration' && explorePath && (hover || hoveredPortal) && <ExplorePathPreview path={explorePath} dims={dims} lift={liftOf} walking={anyWalking} />}
        {battle && <TapPreview battle={battle} activeC={activeC} dims={dims} liftAt={liftAt} myTurn={myTurn} />}
        {battle && (
          <AimOverlay battle={battle} hoverAim={hoverAim} anchor={reticleAnchor} dims={dims}
            pendingAttack={pendingAttack} pendingDefense={pendingDefense} pendingTrample={pendingTrample} pendingHeal={pendingHeal} pendingCast={pendingCast} />
        )}
        {battle && <CrewTooltip battle={battle} hoveredId={hoveredId} myTurn={myTurn} anchor={reticleAnchor} />}
        {debugLabels && <DebugMapLabels scene={scene} dims={dims} liftAt={liftAt} />}
      </g>
      {debugLabels && <DebugLegend />}
    </svg>
  );
}
