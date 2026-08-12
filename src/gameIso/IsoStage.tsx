/**
 * Stage isométrique SVG (React) — la COQUILLE FINE du rendu : lit le store, memoïse les BUILDERS
 * (camera-free : sols/murs/toits/props/tokens/surbrillances), projette par les BACKENDS affines en
 * couches STATIQUES pré-triées, insère les éléments DYNAMIQUES par-frame (tokens qui glissent, halos,
 * aperçus) par dichotomie, et orchestre les overlays d'INTERACTION (portes, hit-areas de siège,
 * télégraphes, gabarit ZdE, réticules, tooltips, debug, ambiance — sous-composants `stage/`).
 * Caméra : `useStageCamera` (8 crans, focus, culling) ; pointeur : `useStagePointer` (picking
 * cross-couche + data-cid, pan, clics) ; visée au survol : `useHoverTargeting`.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type MutableRefObject } from 'react';
import './anim.css';
import { useGame, type BattleState } from '../state/store';
import { heightAt, sceneMetresPerTile, type Scene } from '../state/scene';
import { sceneIsDark } from '../state/sceneRules';
import { metricToLift } from '../state/relief';
import { computeStateVisibleAndLight, sceneLightSources } from '../state/visionState';
import { partyLeaderOf } from '../state/combatants';
import { Combatant } from '../engine/types';
import { footprintN, sizeFootprint } from '../state/footprint';
import { mountOf } from '../state/mount';
import { placingZoneOf } from '../state/combatFlow';
import { controlsActive } from '../state/netOwnership';
import { modalBlocksMapHover } from '../state/modalArbiter';
import { mapTargetingActive } from '../state/targetingHolder';
import { Dims, tileCenter, isSquareView, capsuleCenter } from '../geometry/iso';
import { DEFS } from './sprites';
import { isoAmbianceDefs } from './catalog/ambiance';
import { detailPatternDefs, lodOf, LOD_ZOOM } from './backends/affineDetail';
import { getViewZ, subscribeViewZ } from '../state/viewLevel';
import { setVisibleTileBounds } from './viewport';
import { useCombatFx } from './fx/useCombatFx';
import { useWalkAnim, useMoveBlockedBump, subscribeWalkFrames } from './fx/useWalkAnim';
import { walkPoseAt, walkGlideM, type WalkTrack } from './fx/walkPose';
import { FxLayer } from './fx/FxLayer';
import { buildFloors } from './builders/floors';
import { buildWalls } from './builders/walls';
import { buildRoofs, clearedSpace } from './builders/roofs';
import { buildProps } from './builders/props';
import { buildTokens } from './builders/tokens';
import { floorLayerObjs, wallLayerObjs, roofLayerObjs, elOccluder, type LayerCtx } from './stage/layers';
import { combatHighlightObjs, combatHighlightsView, type HighlightOpts } from './stage/highlightLayer';
import { buildHighlights, type HighlightEl } from './builders/highlights';
import { propLayerObjs, figurantLayerObjs, interactHaloObjs, combatantObjs, partyLeaderObj, npcHoverHaloObjs, dynamicHighlightObjs, type TokenCtx, type WalkPos } from './stage/tokens';
import { sortByDepth, mergeByDepth, type StageObj } from './stage/objs';
import { CulledScene, actorCapsuleOf } from './stage/CulledScene';
import { GameStage3D, type StageWalkAnim } from './stage/GameStage3D';
import { getStageBackend, subscribeStageBackend } from '../state/stage3d';
import { getStageYaw, subscribeStageYaw, viewRot, viewYawDeg } from '../state/stageYaw';
import { tintFor } from './backends/webgl/visibilityTint';
import { actorPoseKey, type KeepEl, type ActorPose, type TintAt } from './backends/webgl/sceneMeshes';
import type { PropEl, TokenEl } from './builders/types';
import { stageCamTransform } from './stage/stageCam';
import { occupiedInteriorZoneIds, roomCutawayAllies, roomFocusAt } from './stage/roomFocus';
import { NO_CLEARED_SPACE, exteriorWallViewZ, frontFacadeCutaway, cutawayForSection, cutawayOverhead, lidCutaway, spaceCellKey } from './stage/architectureVisibility';
import { DoorOverlays } from './stage/DoorOverlays';
import { ClimbOverlays } from './stage/ClimbOverlays';
import { FallOverlays } from './stage/FallOverlays';
import { SiegeHitAreas } from './stage/SiegeHitAreas';
import { EnemyMoveTelegraph, EnemyAimTelegraph, EnemyAoeTelegraph } from './stage/Telegraphs';
import { ZdeTemplate } from './stage/ZdeTemplate';
import { CursorOverlay, HoverMovePreview, ExplorePathPreview } from './stage/MoveOverlays';
import { AimOverlay } from './stage/AimOverlay';
import { CrewTooltip } from './stage/CrewTooltip';
import { DebugMapLabels, DebugLegend } from './stage/DebugOverlay';
import { Flies, AmbianceVeils } from './stage/Ambiance';
import { WeatherVeil } from './stage/WeatherVeil';
import { useStageCamera, cameraTargeting, stageFocus, computeViewBounds, VW, VH } from './stage/useStageCamera';
import { useStagePointer } from './stage/useStagePointer';
import { useHoverTargeting } from './stage/useHoverTargeting';
import type { Pt } from '../state/path';
import type { LightSource } from '../state/vision';
import { portalsForParty } from '../state/roomPortals';

/** `ctx`/`occludesActor` positionnels EXIGÉS par `floorLayerObjs`/`wallLayerObjs` (compat `TopoScene`,
 *  hors périmètre #797) mais IGNORÉS depuis que ces couches ne bakent plus les vérités de VUE
 *  écran-espace — références STABLES (module-level), jamais recréées, pour ne rien ajouter aux deps. */
const NEUTRAL_LAYER_CTX: LayerCtx = { mode: 'exploration', battle: null, partyPos: { x: 0, y: 0 } };
const NO_OCCLUDE = () => false;

export function IsoStage() {
  // ── État (store) ────────────────────────────────────────────────────────────────────────────────
  const scene = useGame((s) => s.scene);
  const mode = useGame((s) => s.mode);
  const partyPos = useGame((s) => s.partyPos);
  const flags = useGame((s) => s.flags); // B4 : masquer le halo d'un décor déjà fouillé (__fouille_<id>)
  const party = useGame((s) => s.party);
  const battle = useGame((s) => s.battle);
  const gameTime = useGame((s) => s.gameTime);
  const lightLevel = useGame((s) => s.lightLevel);
  const explored = useGame((s) => s.explored);
  const markExplored = useGame((s) => s.markExplored);
  const dialogue = useGame((s) => s.dialogue);
  // Télégraphes ENNEMIS (« qui l'adversaire vise / où il va / où l'aire tombe ») — le ciblage du
  // JOUEUR a son propre réticule (hoverAim + jets pendants), même rendu partagé (TargetReticle).
  const actorAim = useGame((s) => s.actorAim);
  const actorMove = useGame((s) => s.actorMove);
  const actorAoe = useGame((s) => s.actorAoe);
  // COOP : le tour du héros d'un AUTRE joueur s'affiche comme un tour ennemi — AUCUNE affordance.
  const myTurn = useGame(controlsActive);
  const planView = useGame((s) => s.pendingRoundStart?.round === 1); // ouverture : cadrer tout le champ
  const mapInert = useGame(modalBlocksMapHover); // modale bloquante (arbitre) : la carte ne répond plus
  const mapTargeting = useGame(mapTargetingActive); // un ciblage carte tient la scène (registre des pendings de ciblage)
  const pendingAttack = useGame((s) => s.pendingAttack);
  const pendingCast = useGame((s) => s.pendingCast);
  const pendingSiegeAim = useGame((s) => s.pendingSiegeAim); // pilonnage indirect : placeur de CASE
  const pendingCleave = useGame((s) => s.pendingCleave);
  const pendingDualStrike = useGame((s) => s.pendingDualStrike);
  const preemptAiming = useGame((s) => s.preemptAiming); // Tir rapide armé (pause) : cible par la carte hors tour
  const pendingTrample = useGame((s) => s.pendingTrample);
  const pendingHeal = useGame((s) => s.pendingHeal);
  const pendingDefense = useGame((s) => s.pendingDefense);
  const viewMode = useGame((s) => s.viewMode);
  const debugLabels = useGame((s) => s.debugLabels); // overlay d'annotation de carte (__wfrp.labels)
  // L'orientation MONDE vivante (store `facing`) n'est lue QUE par la voie volumique : son abonnement
  // vit dans `VolumetricWorld` (`setFacing` reforge la référence à chaque pas — en affine, le stage ne
  // doit pas s'en re-rendre).
  // VOIE DE RENDU du monde (#1176, DEV) — hors store : elle décrit le chantier, pas le monde.
  const stageBackend = useSyncExternalStore(subscribeStageBackend, getStageBackend, getStageBackend);
  const webgl = import.meta.env.DEV && stageBackend === 'webgl';
  const combatCursor = useGame((s) => s.combatCursor);
  const hoverCombatantId = useGame((s) => s.hoverCombatantId); // survol de la frise → peek caméra + réticule
  const svgRef = useRef<SVGSVGElement>(null);
  const camRef = useRef({ x: 0, y: 0 }); // caméra du rendu courant, lue par les handlers du pointeur
  const camGRef = useRef<SVGGElement>(null); // groupe à la transform CAMÉRA — recalé hors React pendant une marche volumique
  // Un pas FRANCHI pendant une marche volumique : le seul rendu que la boucle demande (cf. son battement).
  const [, setWalkStep] = useState(0);
  const demandeRef = useRef<string | null>(null);

  // ── Caméra (transition 8 crans, zoom, pan) & animations ─────────────────────────────────────────
  const { shownRot, shownEdge, turning, zoom, camPan } = useStageCamera(svgRef);
  // Marche visuelle : le token GLISSE le long du chemin. En AFFINE le glissement se peint par un rendu
  // React à la frame ; en VOLUMIQUE la boucle de rendu lit `walksRef` elle-même (#1176, P2-4).
  const walksRef = useWalkAnim(!webgl);
  const bump = useMoveBlockedBump(); // micro-secousse (#792) du jeton de groupe, pas clavier bloqué
  const { floats, projs, auras, aoes } = useCombatFx();

  // ── Vérités de scène : étage actif, hauteurs métriques, brouillard ──────────────────────────────
  // Étages rendus = l'ACTIF + ceux du DESSOUS (sélection des builders). Override DEBUG viewLevel(z).
  const viewZ = useSyncExternalStore(subscribeViewZ, getViewZ, getViewZ);
  const activeC = mode === 'battle' && battle ? battle.combatants.find((c) => c.id === battle.order[battle.turn]) : undefined;
  const activeZ = viewZ ?? ((activeC?.pos as { z?: number } | undefined)?.z ?? partyPos.z ?? 0);
  // VUE DU DESSUS (`view: 'top'`, mode tactique et source de la minimap) : on regarde UN plancher à la
  // VERTICALE — l'étage ACTIF, et lui seul ; superposer le rez à l'étage rend le plan illisible. Ce
  // n'est pas un réglage d'affichage de plus : c'est le `viewZ` du pivot (isolement d'un étage) que
  // l'APPELANT fournit, là où l'iso fournit `null` (l'actif + le contrebas, contexte utile en 3D). Les
  // builders ne connaissent PAS le mode de vue — ils ne lisent que le `viewZ` reçu.
  const layerZ = isSquareView(viewMode) ? activeZ : viewZ;
  // LIFT vertical d'une case = sa HAUTEUR MÉTRIQUE en unités de niveau, DÉCOUPLÉ de l'index de couche
  // `z` (qui ne sert qu'au TRI). Sert au JETON (qui monte avec son sol) ET aux SURLIGNAGES de case.
  const liftAt = (x: number, y: number, z = 0) => (scene ? metricToLift(heightAt(scene, Math.round(x), Math.round(y), z)) : 0);
  // BROUILLARD DE GUERRE (cases visibles) + CHAMP DE LUMIÈRE par tuile en UN calcul (`sceneLightField`,
  // potentiellement lourd, ne tourne qu'UNE fois par pas — la vue ET l'éclairage des sols le partagent).
  // Dérivé des positions LOGIQUES, pas du glissement → memo STABLE pendant la marche.
  const vl = useMemo(
    () => (scene ? computeStateVisibleAndLight({ scene, battle, party, partyPos, gameTime, lightLevel }) : { visible: new Set<string>(), light: undefined, smoke: [] }),
    [scene, battle, party, partyPos, gameTime, lightLevel],
  );
  const visible = vl.visible;
  const light = vl.light;
  // Sources PONCTUELLES (brasero posé, lanterne portée) : la MÊME liste que celle dont `vl` dérive son
  // champ de lumière (`sceneLightSources`), passée telle quelle à la voie volumique, qui en pose les
  // flaques. Elle ne dépend NI de l'heure NI du palier — seulement de qui porte quoi, et où.
  // `party` fait partie des dépendances même en COMBAT, où les sources viennent de `battle` : la purge
  // d'entretien mute `activeEffects` EN PLACE sur les combattants (`state/upkeep.ts:71`) sans changer la
  // réf `battle`, et ne repose que `party` (`upkeep.ts:90`). Un sort de Lumière qui se dissipe passerait
  // donc inaperçu d'un memo qui ne dépendrait que de `battle`.
  const lightSources = useMemo(
    () => (scene ? sceneLightSources({ scene, battle, party, partyPos }) : []),
    [scene, battle, party, partyPos],
  );
  const exploredSet = useMemo(() => new Set(explored[scene?.id ?? ''] ?? []), [explored, scene?.id]);
  // Accumulation persistante de l'exploré (no-op si rien de neuf → pas de boucle de rendu).
  useEffect(() => {
    if (visible.size) markExplored([...visible]);
  }, [visible, markExplored]);

  // ── MATÉRIAUX v2 : palier de LOD (zoom) + defs de motifs (dépendent de la PROJECTION) ───────────
  const lod = lodOf(zoom);
  const mpt = scene ? sceneMetresPerTile(scene) : 2;
  // Nuit (fenêtres allumées) : mise en scène `lightLevel` (≤ 0.5) sinon l'obscurité d'horloge (`sceneIsDark`).
  const night = scene ? (lightLevel != null ? lightLevel <= 0.5 : sceneIsDark(scene, gameTime)) : false;
  const detailOpts = useMemo(() => ({ zoom: LOD_ZOOM[lod], mpt, night }), [lod, mpt, night]);
  // LACET CONTINU (#1176, P2-7) : deux formes du MÊME regard.
  // `dims` est le CRAN — la géométrie de DÉGAGEMENT et les couches affines pré-triées s'y décident,
  // et leurs memos ne doivent pas se rejouer soixante fois par seconde pendant une rotation. Son cran
  // est celui que le lacet RÉEL regarde (`viewRot`), pas celui du store : sous lacet libre `camRot` ne
  // bouge plus, et un demi-tour laisserait le dégagement au cran du départ. Il ne change qu'au
  // FRANCHISSEMENT d'un quart — l'abonnement au lacet est ce qui fait re-rendre à ce moment-là.
  // `dimsVue` porte en plus le lacet RÉEL : c'est la projection que voient la caméra volumique, le
  // picking et TOUS les overlays SVG — le seul endroit où le lacet libre entre dans le stage,
  // `tileCenter` s'occupant du reste (`geometry/iso.ts`).
  // S'ABONNER au lacet EST la dépendance de rendu des deux formes ci-dessous (`viewRot`/`viewYawDeg`
  // lisent la source, pas une valeur passée) : sans cet abonnement, rien ne suivrait la rotation.
  useSyncExternalStore(subscribeStageYaw, getStageYaw, getStageYaw);
  const cranVue = viewRot(shownRot) ?? shownRot;
  const dims = useMemo<Dims>(() => ({ ...(scene?.dimensions ?? { w: 1, h: 1 }), rot: cranVue, view: viewMode, edge: shownEdge }), [scene, cranVue, viewMode, shownEdge]);
  const yawVue = viewYawDeg(shownRot, shownEdge); // change à chaque frame de rotation (`yawOffset`)
  const dimsVue = useMemo<Dims>(
    () => (yawVue == null ? dims : { ...dims, yawDeg: yawVue }),
    [dims, yawVue],
  );
  const patternDefs = useMemo(() => (scene && lod >= 1 ? detailPatternDefs(dims, mpt) : ''), [scene, lod, dims, mpt]);
  const partyLeader = partyLeaderOf(party);
  const wnow = performance.now();
  const walkPosOf: WalkPos = (id, x, y, z = 0) => walkPoseAt(walksRef.current[id], x, y, z, dims, wnow);

  // ── CAMÉRA À UN INSTANT (la seule définition) : point focal (paire de visée / actif / leader) puis
  // translation de la vue. Le rendu la demande à `wnow` ; la boucle volumique la redemande PAR FRAME
  // pendant une marche, ce qui la fait glisser sans aucun rendu React (#1176, P2-4).
  const targeting = mode === 'battle' && battle ? cameraTargeting(battle, actorAim) : null;
  const camAt = (now: number) => {
    if (!scene) return { x: camPan.x, y: camPan.y };
    const wp: WalkPos = (id, x, y, z = 0) => walkPoseAt(walksRef.current[id], x, y, z, dims, now);
    const focus = stageFocus({ mode, battle, partyPos, partyLeader, walkPosOf: wp, planView, hoverCombatantId, targeting, pendingAttack, pendingCast });
    // Visée du SUJET : le milieu de sa capsule (`actorCapsuleOf`, la même que consomme l'occlusion), et
    // non le sol de sa case — viser le sol décale le cadre d'une demi-capsule vers le haut de la scène,
    // donc vers ce qui SURPLOMBE le sujet (biais multiplié par le zoom).
    const fc = capsuleCenter(actorCapsuleOf(
      { x: focus.x, y: focus.y, h: heightAt(scene, Math.round(focus.x), Math.round(focus.y), activeZ) },
      dimsVue,
    ));
    return { x: VW / 2 - fc.x + camPan.x, y: VH / 2 - fc.y + camPan.y };
  };
  // ── BUILDERS (camera-free) : memos qui survivent aux rotations/projections ──────────────────────
  // Cases LOGIQUES des alliés — ce que la marche fait glisser, jamais ce qu'elle fait bouger.
  const allyBases = mode === 'battle' && battle
    ? battle.combatants.filter((c) => c.kind === 'hero' && c.pos).map((c) => ({ id: c.id, x: c.pos!.x, y: c.pos!.y, z: c.pos!.z ?? 0 }))
    : [{ id: partyLeader?.id ?? 'party', x: partyPos.x, y: partyPos.y, z: partyPos.z ?? 0 }];
  // Case ARRONDIE (grille) : la position VISUELLE glisse en continu (~60/s pendant la marche) mais la
  // case qu'elle OCCUPE (pièce/toit/prop) est un événement DISCRET — la clé ne change qu'au
  // franchissement d'une case, ce qui stabilise la RÉFÉRENCE `visualAllies` (donc `cutawayAllies`/
  // `propEls`, #817) tant que le groupe reste dans la même case ; le jeton continue de glisser sans
  // à-coup ailleurs (`walkPosOf` direct dans `dyn`/la caméra, non affecté par ce memo).
  const visualTilesAt = (now: number) => allyBases.map((a) => {
    const p = walkPoseAt(walksRef.current[a.id], a.x, a.y, a.z, dims, now);
    return { id: a.id, x: Math.round(p.x), y: Math.round(p.y), z: a.z };
  });
  const tilesKey = (tiles: readonly { id: string; x: number; y: number; z: number }[]) => tiles.map((t) => `${t.id}:${t.x},${t.y},${t.z}`).join('|');
  const visualAlliesKey = tilesKey(visualTilesAt(wnow));
  const visualAllies = useMemo(
    () => visualTilesAt(wnow).map(({ x, y, z }) => ({ x, y, z })),
    [visualAlliesKey],
  );
  const visualPartyPos = visualAllies[0] ?? partyPos;
  const roomFocus = useMemo(
    () => scene ? roomFocusAt(scene, { x: Math.round(visualPartyPos.x), y: Math.round(visualPartyPos.y), z: visualPartyPos.z }) : null,
    [scene, visualPartyPos.x, visualPartyPos.y, visualPartyPos.z],
  );
  const cutawayAllies = roomCutawayAllies(roomFocus, visualAllies);
  // En VOLUMIQUE, le monde glisse dans la boucle de rendu et React ne rend plus rien entre deux pas.
  // Ce que le stage écrit HORS de React suit donc la marche à la FRAME : la caméra que lisent les
  // handlers du pointeur (`camRef` — seule source de l'inversion pixel→tuile, `useStagePointer`), le
  // cadre de tuiles visibles (`setVisibleTileBounds`) et le transform du groupe d'overlays SVG
  // (curseur, aperçu de chemin, télégraphes), qui décrocheraient du monde d'une case entière.
  // Le FRANCHISSEMENT d'une case, lui, n'est pas une affaire d'image : c'est l'événement DISCRET dont
  // dépendent les vérités de pièce et de dégagement (`visualAllies` → `roomFocus`/`cleared`/`propEls`).
  // Il demande UN rendu — à la cadence du PAS, jamais à celle de la frame.
  useEffect(() => {
    if (!webgl) return;
    return subscribeWalkFrames(() => {
      const now = performance.now();
      const c = camAt(now);
      camRef.current = c;
      setVisibleTileBounds(computeViewBounds(c, zoom, dimsVue));
      const g = camGRef.current;
      if (g) g.style.transform = stageCamTransform(c, zoom * (turning ? 0.97 : 1));
      const k = tilesKey(visualTilesAt(now));
      if (k !== visualAlliesKey && demandeRef.current !== k) {
        demandeRef.current = k;
        setWalkStep((n) => n + 1);
      }
    });
  });
  // ESPACE DÉGAGÉ (#818, #907, #950) — UNE loi pour toute l'architecture. Une nappe n'est peinte que
  // si le groupe la VOIT (`seenSections`, nourri des cases explorées de `state/vision.ts`), et ce
  // qui le COIFFE est RETIRÉ, à l'échelle de la MASSE, jamais voilé ni découpé panneau par panneau.
  // Deux façons de savoir qu'une masse le coiffe, un seul verdict : elle le SURPLOMBE dans le monde
  // (`clearedSpace` — sa pièce, l'emprise qui l'abrite, les niveaux au-dessus de lui) ou sa nappe le
  // CACHE à l'écran (`lidCutaway`, la géométrie d'occlusion de #907). Les façades frontales de cet
  // espace tombent du même geste (`frontFacadeCutaway`), et rien au niveau du groupe n'est retiré.
  const roofGeom = useMemo(() => (scene ? buildRoofs(scene) : []), [scene]);
  const cleared = useMemo(() => {
    if (!scene) return NO_CLEARED_SPACE;
    const lids = roofGeom.map((el) => ({
      sectionId: el.sectionId ?? el.key, // nappe hors masse authorée : elle est sa propre section
      z: el.cell.z,
      cells: el.cells,
      occluder: elOccluder(el, dims),
    }));
    const actors = visualAllies.map((a) => ({
      capsule: actorCapsuleOf({ x: a.x, y: a.y, h: heightAt(scene, a.x, a.y, a.z) }, dims),
      z: a.z,
    }));
    return lidCutaway(clearedSpace(scene, visualAllies, exploredSet), lids, actors);
  }, [scene, visualAllies, exploredSet, roofGeom, dims]);
  // Les MÊMES vérités, dans la forme que consomme la voie VOLUMIQUE (#1176) : le dégagement en canal
  // GÉOMÉTRIE (une masse dégagée ne se rend pas), la visibilité en canal TEINTE. Un seul jeu de lois.
  const keepEl = useMemo<KeepEl>(() => (el) => {
    if (el.kind === 'roof')
      return cutawayForSection({
        sectionId: el.sectionId ?? el.key,
        roomZoneIds: el.roomZoneIds,
        cells: el.cells.map((c) => spaceCellKey(c.x, c.y, el.cell.z)),
      }, cleared) === 'visible';
    if (cutawayOverhead(el.cell, cleared)) return false;
    if (el.kind === 'wall') return !frontFacadeCutaway({ ...el, x: el.cell.x, y: el.cell.y, z: el.cell.z }, cleared, dims);
    return true;
  }, [cleared, dims]);
  const tintAt = useMemo(() => (key: string) => tintFor(key, visible, exploredSet), [visible, exploredSet]);
  const floorEls = useMemo(
    () => (scene ? buildFloors(scene, visible, { activeZ, viewZ: layerZ }).filter((el) => !cutawayOverhead(el.cell, cleared)) : []),
    [scene, visible, activeZ, layerZ, cleared],
  );
  const wallViewZ = scene
    ? exteriorWallViewZ(activeZ, !!roomFocus, scene.layers.map((layer) => layer.z))
    : activeZ;
  const wallEls = useMemo(
    () => (scene?.walls?.length
      ? buildWalls(scene, visible, { activeZ: wallViewZ, viewZ: layerZ })
        .filter((panel) => !cutawayOverhead(panel.cell, cleared))
        .filter((panel) => !frontFacadeCutaway({
          ...panel,
          x: panel.cell.x,
          y: panel.cell.y,
          z: panel.cell.z,
        }, cleared, dims))
      : []),
    [scene, visible, wallViewZ, layerZ, cleared, dims],
  );
  // `roofEls` garde l'identité de ses sections d'un pas à l'autre (aucune section réallouée) — ce dont
  // dépendent les memos en aval : la GÉOMÉTRIE des nappes est mémoïsée par la scène, et seul le
  // dégagement s'y rejoue, par la loi commune, sur la SECTION entière (tous les pans d'une masse).
  const roofEls = useMemo(
    () => roofGeom.filter((el) => cutawayForSection({
      sectionId: el.sectionId ?? el.key,
      roomZoneIds: el.roomZoneIds,
      cells: el.cells.map((cell) => spaceCellKey(cell.x, cell.y, el.cell.z)),
    }, cleared) === 'visible'),
    [roofGeom, cleared],
  );
  const propEls = useMemo(
    () => (scene ? buildProps(scene, visible, { activeZ, viewZ: layerZ, allies: cutawayAllies }).filter((el) => !cutawayOverhead(el.cell, cleared)) : []),
    [scene, visible, activeZ, layerZ, cutawayAllies, cleared],
  );
  const tokenEls = useMemo(
    () => (scene ? buildTokens(scene, visible, mode === 'battle' && battle ? battle : null, { activeZ, viewZ: layerZ, top: isSquareView(viewMode) }) : []),
    [scene, visible, mode, battle, activeZ, layerZ, viewMode],
  );

  // ── BACKENDS → couches STATIQUES pré-triées (fix du `objs.sort` à 60 Hz) ────────────────────────
  // #797 : op/dim (reveal/occlusion/cutaway/éclairage) ne sont PLUS bakés ici — vérités de VUE
  // écran-espace décidées par `CulledScene`, sur les seuls objets à l'écran. `floorObjs`/`wallObjs`/
  // `roofObjs` ne dépendent donc plus de `mode`/`battle`/`partyPos`/`light` (ctx passé en aval reste
  // NEUTRE, non consommé — signature conservée pour `TopoScene`, cf. layers.tsx).
  const floorObjs = useMemo(() => (scene ? floorLayerObjs(floorEls, scene, dims, NEUTRAL_LAYER_CTX, lod, detailOpts, true) : []), [scene, floorEls, dims, lod, detailOpts]);
  const wallObjs = useMemo(() => wallLayerObjs(wallEls, dims, NO_OCCLUDE, lod, detailOpts, true), [wallEls, dims, lod, detailOpts]);
  const roofObjs = useMemo(() => roofLayerObjs(roofEls, dims, detailOpts, true), [roofEls, dims, detailOpts]);
  // Les vérités de surbrillance sont assemblées UNE fois (`combatHighlightsView`) et servent les DEUX
  // voies : la projection affine ci-dessous, les quads au sol du monde volumique (`VolumetricWorld`).
  const combatBattle = mode === 'battle' && battle ? battle : null;
  const highlightOpts = useMemo<HighlightOpts>(
    () => ({ myTurn, pendingAttack, pendingCleave, pendingDualStrike, pendingCast }),
    [myTurn, pendingAttack, pendingCleave, pendingDualStrike, pendingCast],
  );
  // La projection affine ne sert QUE la couche SVG (`CulledScene`, montée sur `!webgl`) : en volumique
  // ces objets ne sont jamais consommés, et leur construction (un JSX par case de portée) est pure perte.
  const highlightObjs = useMemo(
    () => (!webgl && scene && combatBattle ? combatHighlightObjs(useGame.getState, scene, combatBattle, dims, liftAt, highlightOpts) : []),
    [webgl, scene, dims, combatBattle, highlightOpts],
  );
  const tokenCtx: TokenCtx = { dims, view: viewMode, liftAt };
  const propObjs = useMemo(() => propLayerObjs(propEls, { dims, view: viewMode, liftAt }), [propEls, dims, viewMode, scene]);
  const figurantObjs = useMemo(() => figurantLayerObjs(tokenEls, { dims, view: viewMode, liftAt }), [tokenEls, dims, viewMode, scene]);
  // Ordre de concaténation = ordre d'émission historique (départage STABLE des ex æquo de profondeur).
  const staticObjs = useMemo(
    () => sortByDepth(floorObjs, wallObjs, roofObjs, highlightObjs, propObjs, figurantObjs),
    [floorObjs, wallObjs, roofObjs, highlightObjs, propObjs, figurantObjs],
  );

  // ── Accès de PIÈCE (portes/passages des overlays) ──────────────────────────────────────────────
  // `portalsForParty` scanne toute la carte et, hors zone intérieure, teste l'accessibilité de CHAQUE
  // porte extérieure par un BFS plein-carte (`roomPortals.ts` → `pathTo`, sans borne de portée) : le
  // poste le plus lourd du stage sur une grande scène. Ses seules vraies entrées sont la SCÈNE (réf
  // neuve dès qu'une porte s'ouvre — `wallEdges`/`doorIsOpen` lisent `scene.flags`) et la case de
  // CONTRÔLE arrondie ; le glissement visuel d'une marche n'en fait pas partie, donc une image
  // d'animation ne recalcule aucun accès (#817).
  const doorCtrlKey = battle
    ? (myTurn && activeC?.kind === 'hero' && activeC.pos ? `${activeC.id}@${activeC.pos.x},${activeC.pos.y},${activeC.pos.z ?? 0}` : '')
    : `party@${partyPos.x},${partyPos.y},${partyPos.z ?? 0}`;
  const doorCtrls = useMemo<Pt[]>(
    () => (battle ? (myTurn && activeC?.kind === 'hero' && activeC.pos ? [activeC.pos] : []) : [partyPos]),
    [doorCtrlKey],
  );
  const portals = useMemo(
    () => (scene && doorCtrls.length ? portalsForParty(scene, doorCtrls[0], occupiedInteriorZoneIds(scene, doorCtrls)) : []),
    [scene, doorCtrls],
  );

  // ── Pointeur & visée au survol ──────────────────────────────────────────────────────────────────
  // Suivi du SURVOL : tout contexte où l'on cible par la carte — mode neutre (attaque implicite),
  // incantation (tooltip + gabarit ZdE), et flux différés (Frappe Mortelle / 2ᵉ frappe / Surincantation).
  const hoverTracking =
    mode === 'battle' && !!battle && !battle.over &&
    (((battle.action === null || battle.action === 'cast') && activeC?.kind === 'hero') ||
      !!preemptAiming || // Tir rapide armé pendant la pause : on suit le survol (réticule + trait de visée) alors qu'il n'y a AUCUN actif
      !!pendingCleave || !!pendingDualStrike || !!pendingCast?.pickingTargets || !!placingZoneOf({ pendingCast, pendingSiegeAim, battle }));
  const { hover, hoveredPortal, portalHandlers, handlers } = useStagePointer({ svgRef, scene, dims: dimsVue, zoom, camRef, hoverTracking, partyLeader, activeZ });
  const { hoverAim, hoveredId, hoverMove, explorePath, ghostIds, effHover } = useHoverTargeting(scene, hover, myTurn, hoveredPortal);

  if (!scene) return null;

  // ── Par-frame : position VISUELLE interpolée (anti-téléportation) + tokens dynamiques ──────────
  // Une marche en cours ? La caméra suit image par image : on COUPE la transition CSS du transform
  // (sinon elle « chasse » une cible mobile et traîne ~0,3 s derrière).
  const anyWalking = Object.keys(walksRef.current).length > 0;
  /** Ancre écran d'un combattant pour réticule/ligne de visée : centre de l'EMPREINTE, suit le glissé. */
  const reticleAnchor = (c: Combatant) => {
    const off = (sizeFootprint(c.size) - 1) / 2;
    const wp = walkPosOf(c.id, c.pos!.x, c.pos!.y);
    return tileCenter(wp.x + off, wp.y + off, dimsVue);
  };
  const liftOf = (p: Pt) => (p.z ? liftAt(p.x, p.y, p.z) : 0);

  // Éléments DYNAMIQUES de la frame, dans l'ordre d'émission historique : tether/halo de l'actif,
  // affordances de fouille, puis tokens (combat : combattants+montés ; exploration : halo PNJ + groupe).
  const dyn: StageObj[] = dynamicHighlightObjs(tokenCtx, battle, mode, dialogue, partyPos, walkPosOf);
  dyn.push(...interactHaloObjs(propEls, tokenCtx, flags, hover, mode === 'exploration'));
  if (mode === 'battle' && battle) {
    dyn.push(...combatantObjs(tokenEls, { ...tokenCtx, walkPosOf, ghostIds, hoveredId, activeId: activeC?.id ?? null }));
  } else {
    dyn.push(...npcHoverHaloObjs(scene, hover, tokenCtx));
    dyn.push(partyLeaderObj(tokenCtx, partyPos, partyLeader, walkPosOf, bump));
  }
  const objs = mergeByDepth(staticObjs, dyn);

  // ── VOIE VOLUMIQUE (#1176, DEV) : la dérivation des ACTEURS (et l'abonnement à l'orientation vivante
  // qu'elle demande) vit dans `VolumetricWorld`, monté seulement en volumique — cf. son JSDoc.

  // ── Caméra : point focal (paire de visée / actif / leader) + culling d'animation ────────────────
  const cam = camAt(wnow);
  camRef.current = cam;
  const viewBounds = computeViewBounds(cam, zoom, dimsVue);
  setVisibleTileBounds(viewBounds); // écriture dans un module = pas de re-rendu

  // Empreinte du MOBILE actif (sa MONTURE si cavalier) → aperçus/curseur à la BONNE taille.
  const activeMoveN = activeC ? footprintN(mountOf(battle!, activeC) ?? activeC) : 1;

  // Transform CAMÉRA (pan/zoom/rotation) — partagée par le groupe principal ET l'overlay d'étiquettes
  // de zone (Bug lisibilité #782 : ce dernier doit suivre la même projection tout en peignant APRÈS
  // le voile d'ambiance, cf. rendu ci-dessous).
  const camTransform = stageCamTransform(cam, zoom * (turning ? 0.97 : 1));
  const camTransition = turning ? 'opacity 0.13s ease-out' : anyWalking ? 'opacity 0.13s ease-out' : 'transform 0.3s ease-out, opacity 0.13s ease-out';
  const camOpacity = turning ? 0.6 : 1;

  return (
    <>
      {/* Voie VOLUMIQUE (#1176, DEV) : le canevas prend la couche MONDE et se pose SOUS le SVG, qui
          garde ses overlays d'interaction, son picking et ses voiles. */}
      {webgl && (
        <VolumetricWorld
          scene={scene}
          dims={dimsVue}
          mpt={mpt}
          cam={cam}
          zoom={zoom * (turning ? 0.97 : 1)}
          tintAt={tintAt}
          keepEl={keepEl}
          tokenEls={tokenEls}
          propEls={propEls}
          camAt={camAt}
          walksRef={walksRef}
          gameTime={gameTime}
          lightLevel={lightLevel}
          lights={lightSources}
          battle={combatBattle}
          highlightOpts={highlightOpts}
          partyToken={combatBattle ? null : partyLeader ? { leader: partyLeader, pos: partyPos } : null}
        />
      )}
    {/* Voie volumique : le fond du SVG s'efface (le canevas peint dessous) — un état de CHANTIER,
        pas un sélecteur de domaine de plus dans la feuille (cliquet `ui-ratchets` xii). */}
    <svg ref={svgRef} className="iso-stage" style={webgl ? { background: 'transparent' } : undefined} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice" {...handlers}>
      <defs dangerouslySetInnerHTML={{ __html: DEFS + isoAmbianceDefs() + patternDefs }} />
      <g ref={camGRef} style={{ transform: camTransform, transition: camTransition, opacity: camOpacity }}>
        {!webgl && <CulledScene objs={objs} dims={dims} cam={cam} zoom={zoom} activeZ={activeZ}
          fog={{ explored: exploredSet }} light={light} roomFocus={roomFocus} />}
        <DoorOverlays
          portals={portals}
          dims={dimsVue}
          activeZ={activeZ}
          visible={visible}
          hoveredPortalId={hoveredPortal?.id ?? null}
          lift={liftOf}
          onPortalHover={portalHandlers.onPortalHover}
          onPortalClick={portalHandlers.onPortalClick}
        />
        <ClimbOverlays scene={scene} dims={dimsVue} activeZ={activeZ} visible={visible} ctrls={doorCtrls} />
        <FallOverlays scene={scene} dims={dimsVue} activeZ={activeZ} visible={visible} ctrls={doorCtrls} />
        {battle && <SiegeHitAreas scene={scene} battle={battle} dims={dimsVue} activeZ={activeZ} visible={visible} />}
        <EnemyMoveTelegraph actorMove={actorMove} dims={dimsVue} footN={activeMoveN} lift={liftOf} />
        <EnemyAimTelegraph targeting={targeting} anchor={reticleAnchor} />
        <Flies scene={scene} dims={dimsVue} />
        <FxLayer dims={dimsVue} floats={floats} projs={projs} auras={auras} aoes={aoes} />
        {battle && hover && <ZdeTemplate battle={battle} hover={hover} pendingCast={pendingCast} pendingSiegeAim={pendingSiegeAim} activeC={activeC} dims={dimsVue} />}
        {mode === 'battle' && <EnemyAoeTelegraph actorAoe={actorAoe} dims={dimsVue} />}
        {/* Curseur LIBRE : il se tait dès qu'un ciblage carte tient la scène (verdict du registre
            `mapTargetingActive`) — le réticule/le gabarit du mode prennent alors le relais. */}
        {mode === 'battle' && battle && combatCursor
          && !mapInert && !mapTargeting
          && !hoverAim?.reticle && <CursorOverlay tile={combatCursor.tile} footN={activeMoveN} dims={dimsVue} liftAt={liftAt} />}
        {mode === 'battle' && battle && hoverMove && effHover && <HoverMovePreview move={hoverMove} at={effHover} footN={activeMoveN} dims={dimsVue} lift={liftOf} />}
        {mode === 'exploration' && explorePath && (hover || hoveredPortal) && <ExplorePathPreview path={explorePath} dims={dimsVue} lift={liftOf} walking={anyWalking} />}
        {mode === 'battle' && battle && (
          <AimOverlay battle={battle} hoverAim={hoverAim} anchor={reticleAnchor} dims={dimsVue}
            pendingAttack={pendingAttack} pendingDefense={pendingDefense} pendingTrample={pendingTrample} pendingHeal={pendingHeal} pendingCast={pendingCast} />
        )}
        {mode === 'battle' && battle && <CrewTooltip battle={battle} hoveredId={hoveredId} myTurn={myTurn} anchor={reticleAnchor} />}
        {debugLabels && <DebugMapLabels scene={scene} dims={dimsVue} liftAt={liftAt} />}
      </g>
      {debugLabels && <DebugLegend />}
      {/* Voiles d'ambiance : la voie AFFINE seule. En volumique, le canevas porte toute la luminosité
          de la scène (`stage/stageLights.ts`, dosé sur la MÊME donnée `nightVeilMax`) — un voile
          par-dessus lui appliquerait le palier de nuit une seconde fois. */}
      {!webgl && <AmbianceVeils scene={scene} dims={dimsVue} gameTime={gameTime} lightLevel={lightLevel} />}
      {/* Voile de MÉTÉO : même partage que ci-dessus (#1176, P2-6). En volumique, la précipitation
          TOMBE dans le monde (`stage/GameStage3D.tsx` → `weatherParticles.ts`) et ce voile ne se monte
          plus. La porte « y a-t-il une météo à montrer ? » est UNE (`sceneWeatherFx`, la scène
          d'intérieur comprise) : les deux voies la lisent, aucune ne la rejoue. */}
      {!webgl && <WeatherVeil scene={scene} />}
    </svg>
    </>
  );
}

/**
 * MONDE VOLUMIQUE (#1176, DEV) monté SOUS le stage. Composant à part, et c'est STRUCTUREL : les
 * abonnements au store qui n'ont de sens qu'en volumique vivent ICI, donc ne s'abonnent pas du tout
 * quand la voie affine est active. `facing` en est le cas d'école — `setFacing` reforge la référence
 * de la table à chaque orientation (`store.ts`, à chaque pas et à chaque attaque) : lu par `IsoStage`,
 * il re-rendait le stage ENTIER même l'interrupteur au repos. Un hook conditionnel est interdit ; un
 * composant conditionnel, non.
 *
 * Les ACTEURS se dérivent des ÉLÉMENTS DU BUILDER (`tokenEls`), pas de `battle.combatants` : mêmes
 * filtres que la voie affine (passager de navire abstrait, structure de siège rendue sur son arête,
 * étage isolé, surplomb, brouillard). ÉCART RÉSIDUEL : un couple MONTÉ ne rend que sa MONTURE — le
 * corps composite cavalier+monture (`MountedToken`) n'a pas d'équivalent billboard.
 */
function VolumetricWorld({ scene, dims, mpt, cam, camAt, zoom, tintAt, keepEl, tokenEls, propEls, walksRef, partyToken, gameTime, lightLevel, lights, battle, highlightOpts }: {
  scene: Scene;
  dims: Dims;
  mpt: number;
  cam: { x: number; y: number };
  /** Caméra à un instant DONNÉ : la boucle de rendu la redemande par frame pendant une marche. */
  camAt: (now: number) => { x: number; y: number };
  zoom: number;
  tintAt: TintAt;
  keepEl: KeepEl;
  tokenEls: TokenEl[];
  propEls: PropEl[];
  /** Marches vivantes — LUES par la boucle de rendu, jamais par un rendu React (cf. `anim` ci-dessous). */
  walksRef: MutableRefObject<Record<string, WalkTrack>>;
  /** Hors combat : le jeton de GROUPE (le meneur visible), à sa case. En combat : `null`. */
  partyToken: { leader: Combatant; pos: Pt } | null;
  /** Horloge de jeu (minutes) et mise en scène de lumière — la LUMIÈRE du monde volumique (P2-5) : le
   *  soleil suit l'heure et le nord de la scène, l'ambiante suit le palier. Le stage reste la source. */
  gameTime: number;
  lightLevel: number | null | undefined;
  /** Sources de lumière PONCTUELLES de la scène — celles du champ mécanique, jamais recollectées ici. */
  lights: readonly LightSource[];
  /** Combat en cours, ou `null` hors combat : la seule entrée des MARQUES DE CASES (P3-0c). */
  battle: BattleState | null;
  /** Contexte de tour/ciblage dont les marques dérivent (`stage/highlightLayer`). */
  highlightOpts: HighlightOpts;
}) {
  const facings = useGame((s) => s.facing); // orientation MONDE vivante par acteur (Dir8)
  const poses: ActorPose[] = [];
  for (const tk of tokenEls) {
    const s = tk.subject;
    const unit = s.kind === 'combatant' ? s.c : s.kind === 'mounted' ? s.mount : null;
    if (!unit?.pos) continue;
    poses.push({ c: unit, x: unit.pos.x, y: unit.pos.y, z: tk.cell.z, facing: facings[unit.id] });
  }
  if (partyToken) {
    const z = partyToken.pos.z ?? 0;
    poses.push({ c: partyToken.leader, x: partyToken.pos.x, y: partyToken.pos.y, z, facing: facings[partyToken.leader.id] });
  }
  // RÉFÉRENCE STABLE tant que rien de ce que le billboard dessine n'a bougé — même patron de clé que
  // `visualAllies` plus haut. Un tableau neuf démonte puis remonte les quads de TOUS les sujets ; la clé
  // porte donc tout ce dont la POSE et le DESSIN dépendent : identité, case LOGIQUE, orientation, et la
  // SIGNATURE des entrées de dessin (garde-robe, équipement, apparence vivante, état au sol, échelle).
  // `actorPoseKey` la compose depuis la MÊME signature que l'identité de cache de texture
  // (`BillboardSubject.identity`) : une entrée de dessin ne peut plus périmer l'une sans l'autre.
  // Le GLISSEMENT de marche n'y entre PAS (#1176, P2-4) : la boucle de rendu le lit elle-même et décale
  // des quads déjà montés, là où la clé fractionnaire les remontait tous soixante fois par seconde.
  const posesKey = poses.map(actorPoseKey).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const actors = useMemo(() => poses, [posesKey]);
  const els = useMemo(() => ({ tokens: tokenEls, props: propEls }), [tokenEls, propEls]);
  // MARQUES DE CASES (P3-0c) : le MÊME builder pur que la voie affine, sur la MÊME vue assemblée
  // (`combatHighlightsView`). L'écran volumique n'en connaît que la liste — il la pose à plat au sol.
  const highlights = useMemo<HighlightEl[]>(
    () => (battle ? buildHighlights(scene, battle, combatHighlightsView(useGame.getState, battle, highlightOpts)) : []),
    [scene, battle, highlightOpts],
  );
  // MARCHE lue par la BOUCLE (P2-4) : le stage garde l'intention (la courbe `walkPoseAt`, le cadrage
  // `camAt`), la boucle ne fait que la redemander à SA cadence. Objet reforgé à chaque rendu — c'est
  // voulu : il doit fermer sur les cases logiques du rendu courant.
  const bases = new Map(poses.map((p) => [p.c.id, { x: p.x, y: p.y, z: p.z }]));
  const solM = (x: number, y: number, z: number) => heightAt(scene, Math.round(x), Math.round(y), z);
  const anim: StageWalkAnim = {
    subscribe: subscribeWalkFrames,
    glide: (cid) => {
      const base = bases.get(cid);
      return base ? walkGlideM(walksRef.current[cid], base, dims, mpt, performance.now(), solM) : null;
    },
    cam: () => camAt(performance.now()),
  };
  return <GameStage3D scene={scene} dims={dims} mpt={mpt} cam={cam} zoom={zoom} tintAt={tintAt} keepEl={keepEl} els={els} actors={actors} gameTime={gameTime} lightLevel={lightLevel} lights={lights} highlights={highlights} anim={anim} />;
}
