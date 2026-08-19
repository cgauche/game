/**
 * Stage isométrique — la COQUILLE FINE de l'écran de jeu : elle lit le store, memoïse les BUILDERS
 * (camera-free : toits/props/tokens), tranche les vérités d'ARCHITECTURE (dégagement, façades,
 * pièce focalisée) et de VISIBILITÉ, puis les sert au MONDE VOLUMIQUE (`stage/VolumetricWorld`), seul
 * peintre du monde depuis #1176 P3-4 C5a. Le SVG qu'elle monte par-dessus ne peint plus AUCUN décor :
 * il porte les overlays d'INTERACTION (portes, hit-areas de siège, télégraphes, gabarit ZdE, réticules,
 * tooltips, debug, faune) et reçoit le picking.
 * Caméra : `useStageCamera` (crans, focus, culling) ; pointeur : `useStagePointer` (picking par la
 * projection inverse, pan, clics) ; visée au survol : `useHoverTargeting`.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import './anim.css';
import { useGame } from '../state/store';
import { heightAt, sceneMetresPerTile } from '../state/scene';
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
import { Dims, tileCenter, capsuleCenter } from '../geometry/iso';
import { getViewZ, subscribeViewZ } from '../state/viewLevel';
import { setVisibleTileBounds } from './viewport';
import { useCombatFx } from './fx/useCombatFx';
import { useWalkAnim } from './fx/useWalkAnim';
import { subscribeStageFrames, battreStageFrames, demanderFrames, relacherFrames } from './stage/stageFrames';
import { getStagePan, subscribeStagePan } from '../state/stagePan';
import { walkPoseAt } from './fx/walkPose';
import { FxLayer } from './fx/FxLayer';
import { buildRoofs, clearedSpace } from './builders/roofs';
import { buildProps } from './builders/props';
import { buildTokens } from './builders/tokens';
import { elOccluder } from './stage/occluders';
import { type HighlightOpts } from './stage/highlightLayer';
import { dynamicMarks } from './builders/dynamicMarks';
import { interactionHalos, NO_INTERACTION_HALOS, type InteractionHalos } from './builders/interactHalos';
import { tokenChromes, type TokenChromeMark } from './builders/tokenChrome';
import { TokenChromeOverlay } from './stage/TokenChromeOverlay';
import { type WalkPos } from './fx/walkPose';
import { actorCapsuleOf } from './stage/actorCapsule';
import { VolumetricWorld, type WorldFrame } from './stage/VolumetricWorld';
import { viewPolicy } from './stage/viewPolicy';
import { wallTraitObjs } from './stage/layers';
import { gridLines } from '../geometry/grid';
import { SansWebgl, useWebglRefusé } from './stage/SansWebgl';
import { getStageYaw, subscribeStageYaw, viewRot, viewYawDeg } from '../state/stageYaw';
import { visibilityField } from './backends/webgl/visibilityTint';
import { useExploreCourant } from './stage/exploreCourant';
import { roomZonesByElKey, type KeepEl, type TintAt } from './backends/webgl/sceneMeshes';
import { stageCamTransform } from './stage/stageCam';
import { occupiedInteriorZoneIds, roomCutawayAllies, roomFocusAt } from './stage/roomFocus';
import { NO_CLEARED_SPACE, frontFacadeCutaway, cutawayForSection, cutawayOverhead, spaceCellKey } from './stage/architectureVisibility';
import { clePercage } from './stage/percage';
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
import { useStageCamera, cameraTargeting, stageFocus, computeViewBounds, adoucirFocal, DUREE_FOCALE_MS, VW, VH, type LissageFocal } from './stage/useStageCamera';
import { useStagePointer } from './stage/useStagePointer';
import { useHoverTargeting } from './stage/useHoverTargeting';
import type { Pt } from '../state/path';
import { portalsForParty } from '../state/roomPortals';

/** OPACITÉ de la grille TACTIQUE (encre `--iso-grid`, partagée avec l'éditeur), plus basse que celle de
 *  l'auteur (`ui/editor/EditorCanvas`, 0,22) : en jeu la grille est un FOND qui donne l'échelle des
 *  cases, jamais l'outil qui sert à poser un mur — elle ne concurrence ni les traits de structure ni
 *  les pions posés dessus. */
const GRILLE_OPACITE = 0.11;


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
  // L'orientation MONDE vivante (store `facing`) n'est PAS lue ici (`setFacing` reforge la référence à
  // chaque pas) : `VolumetricWorld` s'y abonne pour ses billboards, et le disque d'un pion pour son cap
  // — ce dernier seulement là où il est monté, c'est-à-dire sous `pionsEnDisques`.
  // MONDE INAFFICHABLE (#1176 C5a) : contexte volumique refusé = plus aucun peintre du monde — l'écran
  // le DIT, il ne se replie plus en silence (`stage/webglSupport`).
  const sansMonde = useWebglRefusé();
  const combatCursor = useGame((s) => s.combatCursor);
  const hoverCombatantId = useGame((s) => s.hoverCombatantId); // survol de la frise → peek caméra + réticule
  const svgRef = useRef<SVGSVGElement>(null);
  const camRef = useRef({ x: 0, y: 0 }); // caméra du rendu courant, lue par les handlers du pointeur
  const camGRef = useRef<SVGGElement>(null); // groupe à la transform CAMÉRA — recalé hors React pendant une marche volumique
  // Un pas FRANCHI pendant une marche volumique : le seul rendu que la boucle demande (cf. son battement).
  const [, setWalkStep] = useState(0);
  const demandeRef = useRef<string | null>(null);
  // ADOUCISSEMENT DE FOCALE : le point focal du dernier calcul de vue, le lissage EN COURS (départ figé
  // + horodatage) et le SUJET que la caméra suivait. Le saut se détecte au SUJET, jamais aux
  // coordonnées : un marcheur qui glisse déplace la cible sans en changer.
  const focalRef = useRef({ x: 0, y: 0 });
  const lissageRef = useRef<LissageFocal | null>(null);
  const sujetFocalRef = useRef<string | null>(null);
  // Source de battement PROPRE À CE STAGE : deux écrans montés côte à côte (jeu + aperçu) ne peuvent
  // pas se relâcher les images l'un de l'autre.
  const sourceFocale = useRef(Symbol('focale')).current;

  // ── Caméra (transition de crans, zoom, pan) & animations ───────────────────────────────────────
  const { shownRot, shownEdge, turning, zoom } = useStageCamera(svgRef);
  // Marche visuelle : le token GLISSE le long du chemin. La boucle de rendu volumique lit `walksRef`
  // elle-même (#1176, P2-4) — aucun rendu React par frame.
  const walksRef = useWalkAnim(false);
  const { floats, projs, auras, aoes } = useCombatFx();

  // ── Vérités de scène : étage actif, hauteurs métriques, brouillard ──────────────────────────────
  // Étages rendus = l'ACTIF + ceux du DESSOUS (sélection des builders). Override DEBUG viewLevel(z).
  const viewZ = useSyncExternalStore(subscribeViewZ, getViewZ, getViewZ);
  const activeC = mode === 'battle' && battle ? battle.combatants.find((c) => c.id === battle.order[battle.turn]) : undefined;
  const activeZ = viewZ ?? ((activeC?.pos as { z?: number } | undefined)?.z ?? partyPos.z ?? 0);
  // STYLE DE LA VUE (#1176, P3-5) : ce que ce regard choisit de MONTRER (`stage/viewPolicy`). Les
  // verdicts en descendent tous — l'étage isolé ci-dessous comme le découvert des toits de `keepEl`.
  const politique = useMemo(() => viewPolicy({ view: viewMode }), [viewMode]);
  // VUE DU DESSUS (`view: 'top'`, mode tactique et source de la minimap) : on regarde UN plancher à la
  // VERTICALE — l'étage ACTIF, et lui seul. Ce n'est pas un réglage d'affichage de plus : c'est le
  // `viewZ` du pivot (isolement d'un étage) que l'APPELANT fournit, là où l'iso fournit `null`
  // (l'actif + le contrebas, contexte utile en 3D). Les builders ne connaissent PAS le mode de vue —
  // ils ne lisent que le `viewZ` reçu ; la MASSE du monde, cuite en bloc, le reçoit par `keepEl`.
  const planVue = politique.etageIsole;
  const layerZ = planVue ? activeZ : viewZ;
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
  // L'EXPLORÉ DU PAS COURANT : ce que le store a retenu, PLUS ce que le groupe voit à l'instant. Un pas
  // découvre des cases, et l'accumulation persistante ci-dessous ne fait que les CONFIRMER au commit
  // SUIVANT : sans cette union, un pas passait DEUX champs de teinte (un au calcul de `visible`, un au
  // retour du store), donc deux fois toute la cascade qui en dépend (#1396).
  // Sa RÉFÉRENCE ne change qu'au CONTENU : le commit de confirmation rend un ensemble égal, et la
  // teinte qui en descend ne doit pas s'y reforger.
  const exploredSet = useExploreCourant(explored, scene?.id, visible);
  // Accumulation persistante de l'exploré (no-op si rien de neuf → pas de boucle de rendu).
  useEffect(() => {
    if (visible.size) markExplored([...visible]);
  }, [visible, markExplored]);

  const mpt = scene ? sceneMetresPerTile(scene) : 2;
  // LACET CONTINU (#1176, P2-7) : deux formes du MÊME regard.
  // `dims` est le CRAN — la géométrie de DÉGAGEMENT s'y décide, et ses memos ne doivent pas se rejouer
  // soixante fois par seconde pendant une rotation. Son cran est celui que le lacet RÉEL regarde
  // (`viewRot`), pas celui du store : sous lacet libre `camRot` ne bouge plus, et un demi-tour
  // laisserait le dégagement au cran du départ. Il ne change qu'au FRANCHISSEMENT d'un quart —
  // l'abonnement au lacet est ce qui fait re-rendre à ce moment-là.
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
  const partyLeader = partyLeaderOf(party);
  const wnow = performance.now();
  // Position VISUELLE des jetons à un instant donné : le rendu la demande au sien, les boucles hors
  // React (caméra volumique, chrome des jetons) la redemandent à chaque frame de marche.
  const walkPosAt = (now: number): WalkPos => (id, x, y) => walkPoseAt(walksRef.current[id], x, y, now);
  const walkPosOf: WalkPos = walkPosAt(wnow);

  // ── CAMÉRA À UN INSTANT (la seule définition) : point focal (paire de visée / actif / leader),
  // ADOUCI quand la cible SAUTE, puis décalage manuel de la vue. Le rendu la demande à `wnow` ; la
  // boucle de rendu la redemande PAR FRAME, ce qui la fait glisser sans aucun rendu React (#1176,
  // P2-4). UNE valeur par image pour ses DEUX clients — la caméra three (par `camAt` du cadre) et le
  // groupe d'overlays SVG : aucun d'eux ne lisse quoi que ce soit de son côté.
  const targeting = mode === 'battle' && battle ? cameraTargeting(battle, actorAim) : null;
  const argsFocal = { mode, battle, partyPos, partyLeader, planView, hoverCombatantId, targeting, pendingAttack, pendingCast };
  /** Point focal ÉCRAN à un instant (avant décalage manuel), sans adoucissement : la cible VIVE. */
  const focalBrutAt = (now: number) => {
    const focus = stageFocus({ ...argsFocal, walkPosOf: walkPosAt(now) });
    // Visée du SUJET : le milieu de sa capsule (`actorCapsuleOf`, la même que consomme l'occlusion), et
    // non le sol de sa case — viser le sol décale le cadre d'une demi-capsule vers le haut de la scène,
    // donc vers ce qui SURPLOMBE le sujet (biais multiplié par le zoom).
    const fc = capsuleCenter(actorCapsuleOf(
      { x: focus.x, y: focus.y, h: heightAt(scene!, Math.round(focus.x), Math.round(focus.y), activeZ) },
      dimsVue,
    ));
    return { x: VW / 2 - fc.x, y: VH / 2 - fc.y };
  };
  /** Caméra ET point focal adouci du même instant, en UN calcul (la boucle a besoin des deux). */
  const camEtFocalAt = (now: number) => {
    const pan = getStagePan();
    if (!scene) return { cam: { x: pan.x, y: pan.y }, focal: focalRef.current };
    const focal = adoucirFocal(lissageRef.current, focalBrutAt(now), now);
    return { cam: { x: focal.x + pan.x, y: focal.y + pan.y }, focal };
  };
  const camAt = (now: number) => camEtFocalAt(now).cam;
  // SUJET que la caméra suit à ce rendu — l'entrée du saut de focale, décidé dans la phase d'EFFET
  // ci-dessous (`useLayoutEffect`) : un rendu jeté avant commit n'arme donc aucune image et ne laisse
  // aucun lissage derrière lui.
  const sujetFocal = scene ? stageFocus({ ...argsFocal, walkPosOf }).sujet : '';
  // ZOOM APPLIQUÉ (creux de la transition de cran compris) : la même valeur pour le canevas et pour le
  // groupe d'overlays.
  const zoomVue = zoom * (turning ? 0.97 : 1);
  // REGARD servi au monde volumique : référence STABLE tant que la géométrie de la vue ne bouge pas
  // (cran/lacet, zoom). La caméra n'y est pas une VALEUR mais `camAt`, que la boucle de rendu redemande
  // à SA cadence — un cadre reforgé par image re-rendait tout le sous-arbre volumique à chaque geste.
  const camAtRef = useRef(camAt);
  camAtRef.current = camAt;
  const camAtStable = useRef((now: number) => camAtRef.current(now)).current;
  const frameMonde = useMemo<WorldFrame>(
    () => ({ mode: 'plateau', dims: dimsVue, camAt: camAtStable, zoom: zoomVue }),
    [dimsVue, zoomVue, camAtStable],
  );
  // ── BUILDERS (camera-free) : memos qui survivent aux rotations/projections ──────────────────────
  // Cases LOGIQUES des alliés — ce que la marche fait glisser, jamais ce qu'elle fait bouger.
  const allyBases = mode === 'battle' && battle
    ? battle.combatants.filter((c) => c.kind === 'hero' && c.pos).map((c) => ({ id: c.id, x: c.pos!.x, y: c.pos!.y, z: c.pos!.z ?? 0 }))
    : [{ id: partyLeader?.id ?? 'party', x: partyPos.x, y: partyPos.y, z: partyPos.z ?? 0 }];
  // Case ARRONDIE (grille) : la position VISUELLE glisse en continu (~60/s pendant la marche) mais la
  // case qu'elle OCCUPE (pièce/toit/prop) est un événement DISCRET — la clé ne change qu'au
  // franchissement d'une case, ce qui stabilise la RÉFÉRENCE `visualAllies` (donc `cutawayAllies`/
  // `propEls`, #817) tant que le groupe reste dans la même case ; le jeton continue de glisser sans
  // à-coup ailleurs (`walkPosOf` direct dans la caméra, non affecté par ce memo).
  const visualTilesAt = (now: number) => allyBases.map((a) => {
    const p = walkPoseAt(walksRef.current[a.id], a.x, a.y, now);
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
  // Le monde glisse dans la boucle de rendu et React ne rend plus rien entre deux pas — ni pendant un
  // glisser-caméra, ni pendant l'approche d'une focale. Ce que le stage écrit HORS de React suit donc
  // le BATTEMENT (`stage/stageFrames`) : la caméra que lisent les handlers du pointeur (`camRef` —
  // seule source de l'inversion pixel→tuile, `useStagePointer`), le cadre de tuiles visibles
  // (`setVisibleTileBounds`) et le transform du groupe d'overlays SVG (curseur, aperçu de chemin,
  // télégraphes), qui décrocheraient du monde d'une case entière.
  // Le FRANCHISSEMENT d'une case, lui, n'est pas une affaire d'image : c'est l'événement DISCRET dont
  // dépendent les vérités de pièce et de dégagement (`visualAllies` → `roomFocus`/`cleared`/`propEls`).
  // Il demande UN rendu — à la cadence du PAS, jamais à celle de la frame.
  useEffect(() => subscribeStageFrames(() => {
    const now = performance.now();
    const lissage = lissageRef.current;
    if (lissage && now - lissage.t0 >= DUREE_FOCALE_MS) {
      lissageRef.current = null;
      relacherFrames(sourceFocale); // la focale est arrivée : plus rien à tenir en images
    }
    const { cam: c, focal } = camEtFocalAt(now);
    camRef.current = c;
    focalRef.current = focal;
    setVisibleTileBounds(computeViewBounds(c, zoom, dimsVue));
    const g = camGRef.current;
    if (g) g.style.transform = stageCamTransform(c, zoomVue);
    const k = tilesKey(visualTilesAt(now));
    if (k !== visualAlliesKey && demandeRef.current !== k) {
      demandeRef.current = k;
      setWalkStep((n) => n + 1);
    }
  }));
  // SAUT DE FOCALE : la caméra change de SUJET (unité active, peek de frise, paire de visée). La vue y
  // court depuis le point qu'elle occupait, en JS, dans la valeur que les DEUX clients lisent, et un
  // rAF tient l'image tant que l'approche dure. Un panoramique manuel n'est pas un saut : il reste 1:1.
  // En phase d'EFFET (jamais de rendu) et AVANT la peinture : le battement immédiat réécrit la vue au
  // point quitté, que le rendu venait de poser sur la nouvelle cible.
  useLayoutEffect(() => {
    const now = performance.now();
    if (sujetFocalRef.current !== sujetFocal) {
      if (sujetFocalRef.current !== null) {
        lissageRef.current = { depart: focalRef.current, t0: now };
        demanderFrames(sourceFocale);
        battreStageFrames();
      }
      sujetFocalRef.current = sujetFocal;
    }
    focalRef.current = camEtFocalAt(now).focal;
  });
  // La demande de frames de l'adoucissement meurt AVEC l'écran : une source oubliée ferait battre la
  // boucle sur un stage démonté.
  useEffect(() => () => relacherFrames(sourceFocale), [sourceFocale]);
  // RECENTRAGE (touche dédiée, nouvelle unité active, cran de vue) : il remet le décalage vivant à zéro
  // sans qu'aucun rendu ne suive forcément — un glisser en cours n'a rien commis. La vue le peint donc
  // au battement, comme tout le reste.
  useEffect(() => subscribeStagePan(battreStageFrames), []);
  // ESPACE DÉGAGÉ (#818, #907, #950) — UNE loi pour toute l'architecture. Une nappe n'est peinte que
  // si le groupe la VOIT (`seenSections`, nourri des cases explorées de `state/vision.ts`), et ce
  // qui l'ABRITE est RETIRÉ, à l'échelle de la MASSE, jamais voilé ni découpé panneau par panneau :
  // sa pièce, l'emprise qui l'abrite, les niveaux au-dessus de lui (`clearedSpace`). Les façades
  // frontales de cet espace tombent du même geste (`frontFacadeCutaway`), et rien au niveau du groupe
  // n'est retiré. Une masse qui le CACHE à l'écran sans l'abriter n'est PAS retirée — elle reçoit un
  // trou local (#1176, M3, `stage/percage.ts`).
  const roofGeom = useMemo(() => (scene ? buildRoofs(scene) : []), [scene]);
  const lids = useMemo(
    () => roofGeom.map((el) => ({
      sectionId: el.sectionId ?? el.key, // nappe hors masse authorée : elle est sa propre section
      z: el.cell.z,
      cells: el.cells,
      occluder: elOccluder(el, dims),
    })),
    [roofGeom, dims],
  );
  // ALLIÉS COIFFABLES : leur case VISUELLE, leur `cid` et leur capsule d'écran — les entrées du trou
  // local (#1176, M3), résolues ICI parce qu'elles exigent la projection (donc le stage, jamais le
  // builder).
  const alliesCoiffables = useMemo(
    () => (scene
      ? visualTilesAt(wnow).map((t) => ({
        cid: t.id,
        capsule: actorCapsuleOf({ x: t.x, y: t.y, h: heightAt(scene, t.x, t.y, t.z) }, dims),
        z: t.z,
      }))
      : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, visualAlliesKey, dims],
  );
  const cleared = useMemo(
    () => (scene ? clearedSpace(scene, visualAllies, exploredSet) : NO_CLEARED_SPACE),
    [scene, visualAllies, exploredSet],
  );
  // DÉCOUPE LOCALE PAR OCCLUSION (#1176, M3) : ce que la boucle de rendu volumique reprend à la CLÉ
  // (pas franchi, quart de tour, étage) pour percer un trou dans la masse qui cache un héros à
  // l'écran. Les entrées sont celles ci-dessus, sans un seul second calcul.
  const percage = useMemo(
    () => (scene
      ? { cle: clePercage({ tuiles: visualTilesAt(wnow), rot: dims.rot ?? 0, view: dims.view ?? 'iso', activeZ }), lids, heros: alliesCoiffables }
      : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, visualAlliesKey, dims, activeZ, lids, alliesCoiffables],
  );
  // Les MÊMES vérités, dans la forme que consomme la voie VOLUMIQUE (#1176) : le dégagement en canal
  // GÉOMÉTRIE (une masse dégagée ne se rend pas), la visibilité en canal TEINTE. Un seul jeu de lois.
  // ZONES DE PIÈCE résolues sur la scène VIVE (#1176, P3-3) : le monde cuit ne les retient PLUS
  // (`elCuit`, `backends/webgl/sceneMeshes.ts`) parce qu'elles descendent de `scene.effectZones`, qui
  // n'est pas dans le read-set de la cuisson — un `roomZoneIds` cuit aurait périmé en silence. La loi
  // ci-dessous les redemande par la CLÉ de l'élément.
  const zonesVives = useMemo(() => (scene ? roomZonesByElKey(scene) : new Map<string, readonly string[]>()), [scene]);
  const keepEl = useMemo<KeepEl>(() => (el) => {
    // VUE DU DESSUS (#892) : on regarde UN plancher à la VERTICALE — superposer le rez à l'étage rend
    // le plan illisible. La loi voyageait dans le `viewZ` que les builders de sols et de murs
    // recevaient ; la masse est désormais CUITE en bloc (`bakeWorldGeometry` prend la scène entière),
    // c'est donc ici qu'elle s'applique. Les NAPPES en sont exemptes, comme elles l'étaient : leur
    // retrait se décide par MASSE (loi de dégagement), jamais par étage rendu.
    if (planVue && el.kind !== 'roof' && el.cell.z !== activeZ) return false;
    if (el.kind === 'roof') {
      // DÉCOUVERT PERMANENT (#1176, P3-5) : sous un regard qui ne montre pas les toits, aucune nappe
      // ne se dessine — la loi de dégagement (`clearedSpace`) reste entière pour le plateau iso, où
      // elle continue de retirer ce qui abrite le groupe.
      if (!politique.toitsVisibles) return false;
      return cutawayForSection({
        sectionId: el.sectionId ?? el.key,
        roomZoneIds: zonesVives.get(el.key),
        cells: el.cells.map((c) => spaceCellKey(c.x, c.y, el.cell.z)),
      }, cleared) === 'visible';
    }
    // Sol, mur d'étage, décor : tout ce qui se pose ou se dresse sur un niveau n'obéit qu'au couvercle
    // au-dessus des têtes (`cutawayOverhead`).
    if (cutawayOverhead(el.cell, cleared)) return false;
    if (el.kind === 'wall') {
      // MURS AU TRAIT (#1176, P3-5b) : sous un regard qui les rend au trait symbolique SVG
      // (`stage/layers.wallTraitObjs`), le monde volumique n'en peint AUCUN — verdict exclusif, jamais
      // une coiffe gardée sous le trait.
      if (politique.mursAuTrait) return false;
      return !frontFacadeCutaway({ ...el, roomZoneIds: zonesVives.get(el.key), x: el.cell.x, y: el.cell.y, z: el.cell.z }, cleared, dims);
    }
    return true;
  }, [cleared, dims, zonesVives, planVue, politique, activeZ]);
  // CHAMP de visibilité (#1176, C6) : le monde volumique l'échantillonne PAR SOMMET, les corps posés
  // sur leur case y lisent la valeur discrète de la leur. Les dimensions bornent le champ : hors carte,
  // il se rabat sur le bord au lieu d'assombrir le pourtour d'un dehors inconnu.
  const tintAt = useMemo<TintAt>(
    () => visibilityField(visible, exploredSet, scene?.dimensions ?? { w: 0, h: 0 }),
    [visible, exploredSet, scene],
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
  // Le MÊME verdict, rendu par SECTION : les nappes que la frame PEINT. La météo volumique s'en sert
  // pour écrêter ce qui tombe au-dessus d'un toit levé (#1247) — la pluie s'y arrêtait en l'air. Il se
  // LIT sur `roofEls`, la sortie même de la loi de dégagement : aucune seconde application.
  const nappesVues = useMemo(() => new Set(roofEls.map((el) => el.sectionId ?? el.key)), [roofEls]);
  const nappeVue = useMemo(() => (sectionId: string) => nappesVues.has(sectionId), [nappesVues]);
  const propEls = useMemo(
    () => (scene ? buildProps(scene, visible, { activeZ, viewZ: layerZ, allies: cutawayAllies }).filter((el) => !cutawayOverhead(el.cell, cleared)) : []),
    [scene, visible, activeZ, layerZ, cutawayAllies, cleared],
  );
  const tokenEls = useMemo(
    () => (scene ? buildTokens(scene, visible, mode === 'battle' && battle ? battle : null, { activeZ, viewZ: layerZ, top: politique.montesDissocies }) : []),
    [scene, visible, mode, battle, activeZ, layerZ, politique],
  );
  // STRUCTURE AU TRAIT (#1176, P3-5b) : la MÊME couche que le plan de station (`stage/layers`), montrée
  // ici quand le regard retire les murs du monde volumique. Le brouillard lui est passé : un mur non vu
  // n'est pas tracé. Projection par `dimsVue` (le lacet RÉEL) — la même que celle du canevas et des
  // autres overlays, sans quoi les traits décrocheraient du monde pendant une rotation.
  const mursTrait = useMemo(
    () => (scene && politique.mursAuTrait ? wallTraitObjs(scene, dimsVue, activeZ, visible) : []),
    [scene, politique, dimsVue, activeZ, visible],
  );
  // GRILLE TACTIQUE (#1176, P3-5b) : la même fonction pure que l'éditeur (`geometry/grid`), à l'encre du
  // JEU — un FOND de plateau, pas un outil d'auteur. `w+h+2` segments, jamais un par case.
  const grille = useMemo(
    () => (scene && politique.grilleTactique ? gridLines(dimsVue, activeZ) : []),
    [scene, politique, dimsVue, activeZ],
  );

  // Les vérités de surbrillance sont assemblées par le monde volumique lui-même
  // (`combatHighlightsView`), à partir de ce contexte de tour.
  const combatBattle = mode === 'battle' && battle ? battle : null;
  const highlightOpts = useMemo<HighlightOpts>(
    () => ({ myTurn, pendingAttack, pendingCleave, pendingDualStrike, pendingCast }),
    [myTurn, pendingAttack, pendingCleave, pendingDualStrike, pendingCast],
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

  // MARQUES DYNAMIQUES : dérivées UNE fois (`builders/dynamicMarks`) et servies au monde volumique — le
  // contexte qui les autorise (mode, dialogue ouvert) se tranche ici, et nulle part ailleurs. Les
  // ANNEAUX d'équipe (P3-0e) se dérivent des jetons du builder et du meneur hors combat : la population
  // des jetons RÉELLEMENT postés.
  // Les trois dérivations qui suivent sont RETENUES sur leurs entrées (#1371) : le monde volumique les
  // prend en dépendance de son redessin, et une liste neuve par rendu y faisait peindre une image à
  // chaque commit du stage — c'est ce qui les place AVANT les sorties anticipées ci-dessous.
  const partyToken = useMemo(
    () => (combatBattle ? null : partyLeader ? { leader: partyLeader, pos: partyPos } : null),
    [combatBattle, partyLeader, partyPos],
  );
  const marquesDyn = useMemo(
    () => dynamicMarks(mode === 'battle' ? battle : null, mode === 'exploration' && !dialogue ? partyPos : null, tokenEls, partyToken),
    [mode, battle, dialogue, partyPos, tokenEls, partyToken],
  );
  // JETONS POSTÉS (P3-0f, P3-5c) : même dérivation, même population que les marques dynamiques (les
  // jetons du builder, plus le meneur du groupe hors combat). La surcouche SVG en peint le chrome, et
  // le CORPS sous le verdict `pionsEnDisques` ; le monde volumique n'en reprend que l'allure, au
  // matériau de ses quads. Dérivée SANS condition de mode : un figurant d'exploration est un jeton, et
  // sous ce verdict c'est ici qu'il se dessine (le chrome, lui, reste vide pour lui).
  const chromes = useMemo<TokenChromeMark[]>(
    () => tokenChromes(tokenEls, { ghostIds, hoveredId }, partyToken),
    [tokenEls, ghostIds, hoveredId, partyToken],
  );
  // HALOS D'INTERACTION (P3-0g) : même partage que les marques dynamiques — dérivés UNE fois
  // (`builders/interactHalos`) ; le contexte qui les autorise (exploration, combat ouvert) se tranche
  // ici, et nulle part ailleurs.
  const halos = useMemo<InteractionHalos>(
    () => (scene
      ? interactionHalos(propEls, scene, flags, hover, { exploring: mode === 'exploration', combat: mode === 'battle' && !!battle })
      : NO_INTERACTION_HALOS),
    [propEls, scene, flags, hover, mode, battle],
  );

  if (!scene) return null;
  if (sansMonde) return <SansWebgl />;

  // ── Par-frame : position VISUELLE interpolée (anti-téléportation) ──────────────────────────────
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

  // ── Caméra : point focal (paire de visée / actif / leader) + culling d'animation ────────────────
  const cam = camAt(wnow);
  camRef.current = cam;
  const viewBounds = computeViewBounds(cam, zoom, dimsVue);
  setVisibleTileBounds(viewBounds); // écriture dans un module = pas de re-rendu

  // Empreinte du MOBILE actif (sa MONTURE si cavalier) → aperçus/curseur à la BONNE taille.
  const activeMoveN = activeC ? footprintN(mountOf(battle!, activeC) ?? activeC) : 1;

  // Transform CAMÉRA (pan/zoom/rotation) — partagée par le groupe principal ET l'overlay d'étiquettes
  // de zone (Bug lisibilité #782 : ce dernier doit suivre la même projection).
  // AUCUNE transition sur `transform` : ce groupe suit la caméra à l'image près, comme le canevas
  // volumique qui se pose, lui, sans le moindre lissage. Ce qui doit glisser glisse dans `camAt`
  // (`adoucirFocal`), donc pour les DEUX à la fois. Le creux du dim-and-turn reste une OPACITÉ.
  const camTransform = stageCamTransform(cam, zoomVue);
  const camTransition = 'opacity 0.13s ease-out';
  const camOpacity = turning ? 0.6 : 1;

  return (
    <>
      {/* Le MONDE : le canevas volumique prend la couche monde et se pose SOUS le SVG, qui garde ses
          overlays d'interaction et son picking. */}
      <VolumetricWorld
        scene={scene}
        mpt={mpt}
        frame={frameMonde}
        tintAt={tintAt}
        keepEl={keepEl}
        nappeVue={nappeVue}
        tokenEls={tokenEls}
        propEls={propEls}
        walksRef={walksRef}
        gameTime={gameTime}
        lightLevel={lightLevel}
        lights={lightSources}
        battle={combatBattle}
        highlightOpts={highlightOpts}
        dynMarks={marquesDyn}
        halos={halos}
        partyToken={partyToken}
        chromes={chromes}
        percage={percage}
        pionsEnDisques={politique.pionsEnDisques}
      />
    {/* Le fond du SVG est transparent : le canevas peint dessous. */}
    <svg ref={svgRef} className="iso-stage" style={{ background: 'transparent' }} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice" {...handlers}>
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
        {/* JETONS (P3-0f, P3-5c) : ils se peignent APRÈS les affordances de SOL (portes, télégraphes,
            gabarits) — l'état d'un combattant se lit par-dessus ce qui est peint sur le sol, jamais
            dessous — et, sous `pionsEnDisques`, c'est ICI que vit le pion lui-même. */}
        <TokenChromeOverlay chromes={chromes} dims={dimsVue} liftAt={liftAt} pions={politique.pionsEnDisques} tintAt={tintAt} walkPosAt={walkPosAt} />
        {/* Curseur LIBRE : il se tait dès qu'un ciblage carte tient la scène (verdict du registre
            `mapTargetingActive`) — le réticule/le gabarit du mode prennent alors le relais. */}
        {mode === 'battle' && battle && combatCursor
          && !mapInert && !mapTargeting
          && !hoverAim?.reticle && <CursorOverlay tile={combatCursor.tile} footN={activeMoveN} dims={dimsVue} liftAt={liftAt} />}
        {mode === 'battle' && battle && hoverMove && effHover && <HoverMovePreview move={hoverMove} at={effHover} footN={activeMoveN} dims={dimsVue} lift={liftOf} />}
        {mode === 'exploration' && explorePath && (hover || hoveredPortal) && <ExplorePathPreview path={explorePath} dims={dimsVue} lift={liftOf} walking={anyWalking} />}
        {combatBattle && <TapPreview battle={combatBattle} activeC={activeC} dims={dimsVue} liftAt={liftAt} myTurn={myTurn} />}
        {mode === 'battle' && battle && (
          <AimOverlay battle={battle} hoverAim={hoverAim} anchor={reticleAnchor} dims={dimsVue}
            pendingAttack={pendingAttack} pendingDefense={pendingDefense} pendingTrample={pendingTrample} pendingHeal={pendingHeal} pendingCast={pendingCast} />
        )}
        {mode === 'battle' && battle && <CrewTooltip battle={battle} hoveredId={hoveredId} myTurn={myTurn} anchor={reticleAnchor} />}
        {debugLabels && <DebugMapLabels scene={scene} dims={dimsVue} liftAt={liftAt} />}
      </g>
      {debugLabels && <DebugLegend />}
    </svg>
    </>
  );
}
