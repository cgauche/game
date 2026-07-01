/**
 * Rendu isométrique SVG (React) — remplace le rendu Phaser. Lit le store et
 * dessine la scène courante (exploration ou combat), gère le clic→tuile, les
 * surbrillances de combat et le déplacement animé. Réutilise toute la logique.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import './anim.css';
import { useGame } from '../state/store';
import { Scene as GameScene, tileAt, isWalkable, heightAt, doorIsOpen, toggleDoorIn, structureIsDown, type WallSeg } from '../state/scene';
import { metricToLift } from '../state/relief';
import { sceneIsDark } from '../state/sceneRules';
import { pathTo, type Pt } from '../state/path';
import { exploreMoveDest } from '../state/exploreNav';
import { computeStateVisible } from '../state/visionState';
import { planJump } from '../state/jumpMove';
import { runFlow } from '../state/combatEffects';
import { maxJumpTiles } from '../engine/movement';
import { effectiveMovement } from '../engine/encumbrance';
import { zdeRadiusTiles, spellRangeTiles } from '../engine/magic';
import { resolveFormula } from '../engine/ops';
import { findSpellById, structureById, weaponGroupLabel } from '../data';
import { bus, EVT } from '../state/bus';
import { isOutOfAction, canTakeAction, hasCondition } from '../engine/conditions';
import { isFrenzied } from '../engine/psychology';
import { Combatant } from '../engine/types';
import {
  TW,
  TH,
  EDGE_H,
  CELL,
  Dims,
  tileCenter,
  tileEdge,
  diamondPath,
  diamondCorners,
  stageSize,
  screenToTile,
  screenToTileAtZ,
  depth,
  footprintDepth,
  rotTile,
} from './iso';
import {
  DEFS,
  terrainOverlay,
  placeSprite,
  pnjSprite,
  entitySprite,
} from './sprites';
import { BodyToken } from './BodyToken';
import { FogLayer } from './FogLayer';
import { pickBackend } from './pickBackend';
import { MountedToken } from './MountedToken';
import { groundTile, isOverhang } from './ground';
import { wallSeg } from './walls';
import { isStructure } from '../engine/structures';
import { getViewZ, subscribeViewZ } from './viewLevel';
import { roofObj } from './RoofSprite';
import { roofHidden } from '../state/buildings';
import { walkXY, STEP_MS } from './walkPath';
import { useCombatFx } from './fx/useCombatFx';
import { useWalkAnim } from './fx/useWalkAnim';
import { FxLayer } from './fx/FxLayer';
import { sizeTokenScale, footprintTokenScale } from './sizeScale';
import { sizeFootprint, footprintN, footprintTiles, decorFootGeometry } from '../state/footprint';
import { isPassengerInBattle, serveTargetPoste, isPosteManned, servingCrewPresent, posteCrewSplit, isCrewQualified } from '../state/shipPostes';
import { isMerScene } from '../state/scene';
import { crowdEligible, eligibleAttackTargetIds, outOfSightTargetIds, castOutOfSightTargetIds, castSightBlocked, placingZoneOf, placedZoneValidAt, displayedReach, computeRunReach, movePreviewAt, previewResourceDelta, trampleTarget, firedWeapon, frenzyTarget, hasFreeWeaponAttack, combatantAtTile } from '../state/combatFlow';
import { bestAttack } from '../state/attackRelevance';
import { hoverTargeting } from '../state/targeting';
import { currentTargetingMode } from '../state/targetingModes';
import { controlsActive } from '../state/netOwnership';
import { combatantClickActs } from '../state/combatOrParty';
import { resolveCursorZ } from '../state/combatCursor';
import { hoverClickCommits } from '../ui/pointerCaps';
import { TargetReticle } from './TargetReticle';
import { entitySize } from '../state/spawn';
import { isRider, isMount, riderOf, mountOf } from '../state/mount';
import { HERO_RING, ENEMY_RING, tileTint, veilTint, teamShape, relationColor } from './teamColors';
import { summarizeEffects, combatantFlags } from './effectIcons';
import { setVisibleTileBounds } from './viewport';
/** Distance de combat (Chebyshev, cases). 1 case = 2 m (LDB Déplacement). */
const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const ZOOM_MIN = 0.4; // dézoom tactique large (cf. store.setZoom)
const ZOOM_MAX = 2.6;
const PAN_THRESHOLD = 6; // px de glissement avant de passer en panoramique (sinon = clic)
/** Opacité d'un tablier de SURPLOMB rendu AU-DESSUS de la zone active (FANTÔME) : on voit la silhouette
 *  du pont/de la loge sans qu'il masque le sol où l'on se tient. TUNABLE (ajusté à l'œil). */
const OVERHANG_GHOST_OPACITY = 0.35;

// Viewport virtuel : le SVG remplit tout l'espace dispo (preserveAspectRatio
// slice) et la caméra recadre autour du point focal (groupe / combattant actif).
const VW = 1100;
const VH = 720;
const AMBIANCE_DEFS = `
  <radialGradient id="g_warm" cx="55%" cy="24%" r="78%"><stop offset="0%" stop-color="#ffce78" stop-opacity="0.10"/><stop offset="100%" stop-color="#ffce78" stop-opacity="0"/></radialGradient>
  <radialGradient id="g_vig" cx="50%" cy="48%" r="60%"><stop offset="52%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#05040a" stop-opacity="0.58"/></radialGradient>
  <filter id="lower-floor-dim" x="-5%" y="-5%" width="110%" height="110%"><feColorMatrix type="saturate" values="0.72"/><feComponentTransfer><feFuncR type="linear" slope="0.84"/><feFuncG type="linear" slope="0.84"/><feFuncB type="linear" slope="0.84"/></feComponentTransfer></filter>`;

/** Tracé d'un DÉPLACEMENT (chemin + case d'arrivée + badge d'action) — source unique du rendu,
 *  partagée entre l'aperçu tap-1 (battle.preview, tactile) et l'aperçu au SURVOL (desktop). */
// `lift` = élévation-écran (px) d'un point selon son étage z (multi-niveau) ; défaut `() => 0` ⇒ tracé
// plan-sol byte-identique pour tous les appelants mono-niveau (z absent ⇒ lift 0 ⇒ tileCenter/diamondPath
// sans 4ᵉ argument). Un appelant de COMBAT passe `(p) => p.z ? liftAt(...) : 0` → chemin/destination posés
// au bon étage (rempart) au lieu d'être écrasés sur la cour.
function movePreviewEls(path: Pt[], dest: Pt | null, label: string | null, d: Dims, keyPrefix: string, color = '#ffd75e', footN = 1, lift: (p: Pt) => number = () => 0): JSX.Element[] {
  const els: JSX.Element[] = [];
  if (path.length > 1) {
    const pts = path.map((p) => tileCenter(p.x, p.y, d, lift(p))).map((p) => `${p.cx},${p.cy}`).join(' ');
    els.push(<polyline key={`${keyPrefix}-path`} points={pts} fill="none" stroke={color} strokeWidth={3} opacity={0.9} pointerEvents="none" />);
  }
  // Destination = TOUTE l'empreinte du mobile (un grand / un cavalier sur monture 2×2 → 4 cases), pas
  // une seule (footN dérivé de la monture par l'appelant). footN=1 → un losange unique (iso-historique).
  const dz = dest ? lift(dest) : 0; // toute l'empreinte est au même étage que la destination
  if (dest) for (const t of footprintTiles(dest, footN)) els.push(<path key={`${keyPrefix}-dest-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, d, dz)} fill="none" stroke={color} strokeWidth={3} opacity={0.95} pointerEvents="none" />);
  const at = dest ?? (path.length ? path[path.length - 1] : null);
  if (label && at) {
    const c0 = tileCenter(at.x, at.y, d, lift(at));
    els.push(<text key={`${keyPrefix}-lbl`} x={c0.cx} y={c0.cy - 28} textAnchor="middle" className="pv-badge" pointerEvents="none">{label}</text>);
  }
  return els;
}

export function IsoStage() {
  const scene = useGame((s) => s.scene);
  const mode = useGame((s) => s.mode);
  const partyPos = useGame((s) => s.partyPos);
  const flags = useGame((s) => s.flags); // B4 : masquer le halo d'un décor déjà fouillé (flag __fouille_<id>)
  const party = useGame((s) => s.party);
  const battle = useGame((s) => s.battle);
  const gameTime = useGame((s) => s.gameTime);
  const lightLevel = useGame((s) => s.lightLevel);
  const explored = useGame((s) => s.explored);
  const markExplored = useGame((s) => s.markExplored);
  const dialogue = useGame((s) => s.dialogue);
  // Télégraphe ENNEMI (« qui l'adversaire vise ») — le ciblage du JOUEUR a son propre réticule
  // (survol hoverAim + jets à cible pendants), même rendu partagé (TargetReticle).
  const actorAim = useGame((s) => s.actorAim);
  const actorMove = useGame((s) => s.actorMove); // télégraphe de déplacement ENNEMI (chemin avant le glissé)
  const actorAoe = useGame((s) => s.actorAoe); // télégraphe de ZONE ENNEMI (disque cible avant la résolution d'une ZdE)
  // COOP : le tour du héros d'un AUTRE joueur s'affiche comme un tour ennemi — AUCUNE affordance
  // (grille de déplacement, visée au survol, anneaux de cible, clics). Source unique : netFlow.
  const myTurn = useGame(controlsActive);
  const planView = useGame((s) => s.pendingRoundStart?.round === 1); // ouverture du combat : cadrer tout le champ
  const pendingAttack = useGame((s) => s.pendingAttack);
  const pendingCast = useGame((s) => s.pendingCast);
  const pendingSiegeAim = useGame((s) => s.pendingSiegeAim); // pilonnage indirect : placeur de CASE
  // Ciblage carte des flux différés (TargetPrompt) : surbrillances des cibles cliquables.
  const pendingCleave = useGame((s) => s.pendingCleave);
  const pendingDualStrike = useGame((s) => s.pendingDualStrike);
  // Réticule persistant sur la cible des jets différés à cible sur carte (Piétinement, Guérison,
  // défense d'un héros attaqué).
  const pendingTrample = useGame((s) => s.pendingTrample);
  const pendingHeal = useGame((s) => s.pendingHeal);
  const pendingDefense = useGame((s) => s.pendingDefense);
  const svgRef = useRef<SVGSVGElement>(null);
  const movingRef = useRef(false);
  // Glisser-caméra : on diffère l'action de clic au relâchement ; un glissement > seuil = panoramique.
  const dragRef = useRef<{ sx: number; sy: number; lastX: number; lastY: number; panned: boolean; button: number; tile: Pt | null } | null>(null);
  const zoom = useGame((s) => s.zoom);
  const setZoom = useGame((s) => s.setZoom);
  // Rotation caméra (cran de 90°). `camRot` = cible (store, lu en live par le rig) ;
  // `shownRot` = orientation AFFICHÉE, retardée pour masquer le ré-agencement sous le
  // creux d'opacité de la transition « dim-and-turn ».
  const camRot = useGame((s) => s.camRot);
  const camEdge = useGame((s) => s.camEdge); // cran impair : vue « de face » (edge-on) — grille axis-alignée 3D
  const viewMode = useGame((s) => s.viewMode);
  const debugLabels = useGame((s) => s.debugLabels); // overlay d'annotation de carte (recette __wfrp.labels)
  const camPan = useGame((s) => s.camPan);
  const panCamBy = useGame((s) => s.panCamBy);
  const resetCamPan = useGame((s) => s.resetCamPan);
  // Combattant survolé depuis un PORTRAIT (frise) : pilote le réticule sur la carte + le peek caméra,
  // à parité du survol d'un token. Read-only (jamais réseau).
  const hoverCombatantId = useGame((s) => s.hoverCombatantId);
  // Curseur de combat clavier/manette : pilote le réticule/aperçu EXISTANT comme un survol souris
  // (cf. combatCursor.ts) — prime sur la souris/frise (cf. effHover/effFocusId plus bas).
  const combatCursor = useGame((s) => s.combatCursor);
  const setHovered = useGame((s) => s.setHovered);
  const [shownRot, setShownRot] = useState<0 | 1 | 2 | 3>(camRot);
  const [shownEdge, setShownEdge] = useState(camEdge);
  const [turning, setTurning] = useState(false);
  // Tuile survolée (tooltip + réticule de visée ; suivie dans tous les modes de ciblage).
  const [hover, setHover] = useState<Pt | null>(null);
  // Recette (DEV) : pilotage PROGRAMMATIQUE du survol — __wfrp.hover('id') passe par ce hook,
  // le tooltip/réticule se rendent sans souris réelle (pas de chasse aux pixels).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __wfrpSetHover?: (t: Pt | null) => void };
    w.__wfrpSetHover = (t) => setHover(t);
    return () => { delete w.__wfrpSetHover; };
  }, []);
  // Dépend de camRot SEUL (pas de shownRot) : sinon le swap de shownRot à mi-course
  // re-déclenche l'effet et son cleanup annule le timer qui rétablit `turning=false`
  // → la scène resterait sombre. `prevCamRot` filtre les re-rendus non liés.
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

  // Marche visuelle (token qui GLISSE le long du chemin) — extraite dans fx/useWalkAnim.
  const walksRef = useWalkAnim();

  // Zoom molette (listener non-passif pour pouvoir preventDefault le scroll de page).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(useGame.getState().zoom - e.deltaY * 0.0015); // le store borne [1, 2.6]
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // FX de combat pilotés par le bus (flottants/projectiles/halos/zones) — extraits dans fx/useCombatFx.
  const { floats, projs, auras, aoes } = useCombatFx();

  // Refocus « sur celui qui joue après » : tout décalage manuel de caméra est annulé quand l'unité
  // active change (nouveau tour) — sinon le pion actif pourrait rester hors champ après un panoramique.
  const activeTurnKey = mode === 'battle' && battle ? battle.order[battle.turn] : 'explore';
  useEffect(() => {
    resetCamPan();
  }, [activeTurnKey, resetCamPan]);

  // ——— Couches LOURDES memoïsées (perf : « ça saccade quand le personnage bouge ») ———
  // useWalkAnim re-rend IsoStage ~60×/s pour faire GLISSER le token le long du chemin. Ces couches
  // (sol, décor, bâtiments, grilles de surbrillance) ne dépendent PAS de la position interpolée du
  // token : sans mémoïsation, chaque frame reconstruisait des centaines de chaînes SVG → dépassement
  // du budget de frame. On les fige tant que leurs vraies entrées (scène/rotation/vue/combat) n'ont
  // pas changé. Un pas de marche (setWalkTick) ne crée NI nouveau `battle` NI nouveau `partyPos` →
  // les memos tiennent ; un vrai déplacement (set({battle:{...}})/moveParty) en crée un → recalcul 1×.
  // Planchers fusionnés dans le tri de profondeur GLOBAL (objs) : chaque tuile de sol porte sa propre
  // profondeur de case (depth(x,y,z)−0.5), sous SES objets et, pour la même case, au-dessus du jeton de
  // l'étage inférieur — un sol haut SURPLOMBE localement le bas. Tuiles « vide » non rendues (on voit le dessous).
  // Étages rendus = l'ACTIF + ceux du DESSOUS (cf. renderLevels), JAMAIS au-dessus. Asymétrie voulue : d'en
  // HAUT (loges) on voit le parterre EN CONTREBAS par le puits (utile, sans occlusion) ; d'en BAS, dessiner
  // les loges en surplomb OCCULTERAIT le parterre et rendrait la navigation aveugle. Cohérent avec le
  // PICKING (z <= activeZ). Override DEBUG `viewLevel(z)` isole un étage.
  const viewZ = useSyncExternalStore(subscribeViewZ, getViewZ, getViewZ);
  const activePos = mode === 'battle' && battle ? (battle.combatants.find((c) => c.id === battle.order[battle.turn])?.pos as { z?: number } | undefined) : undefined;
  const activeZ = viewZ ?? (activePos?.z ?? partyPos.z ?? 0);

  // LIFT vertical d'une case = sa HAUTEUR MÉTRIQUE convertie en unités de niveau (`metricToLift(heightAt)`),
  // DÉCOUPLÉ de l'index de couche `z` (qui ne sert qu'au TRI de profondeur). Sert au JETON (qui monte/descend
  // avec son sol) ET aux SURLIGNAGES de case → le halo SUIT le jeton. `diamondPath(x,y,dims,liftAt(...))` :
  // tileCenter/diamondPath multiplient ce lift par LEVEL_H (cf. iso.ts).
  const liftAt = (x: number, y: number, z = 0) => (scene ? metricToLift(heightAt(scene, Math.round(x), Math.round(y), z)) : 0);

  // Étages à RENDRE : l'ACTIF + ceux du DESSOUS (z <= activeZ) — d'en haut on voit l'auditorium par le
  // puits ; d'en bas on ne dessine PAS les loges en surplomb (elles cacheraient le parterre). Les tuiles
  // « vide » d'un étage haut ne dessinent rien → on voit l'étage du dessous au travers. Override debug
  // `viewLevel(z)` isole un seul étage. Le tri de profondeur (z-aware) empile les étages correctement.
  const renderLevels = useMemo(() => (scene ? (viewZ != null ? scene.layers.filter((l) => l.z === viewZ) : scene.layers.filter((l) => l.z <= activeZ)) : []), [scene, viewZ, activeZ]);

  // Étage de SOL effectif sous (x,y) pour le BROUILLARD : à un trou (`vide`) de l'étage actif, on retombe
  // sur le premier sol en dessous → le voile reflète la visibilité du CONTREBAS (vu par le trou) au lieu
  // d'un noir « inconnu » qui masquerait l'étage inférieur. Mono-niveau (pas de trou) ⇒ rend `activeZ`
  // (byte-identique). Stable (memo) → ne recalcule le voile que si la scène/l'étage actif change.
  const fogFloorZAt = useMemo(() => (x: number, y: number): number => {
    if (!scene) return activeZ;
    for (let zz = activeZ; zz >= 0; zz--)
      if (scene.layers.some((l) => l.z === zz) && tileAt(scene, x, y, zz) !== 'vide') return zz;
    return activeZ;
  }, [scene, activeZ]);

  const floorObjs = useMemo<{ d: number; el: JSX.Element; x: number; y: number; z: number }[]>(() => {
    if (!scene) return [];
    const d: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode, edge: shownEdge };
    const out: { d: number; el: JSX.Element; x: number; y: number; z: number }[] = [];
    // « ALLER SOUS LE CHEMIN DE RONDE » : un sol d'étage SUPÉRIEUR (la passerelle) se rend SEMI-TRANSPARENT au-
    // dessus de tout combattant qui se tient EN DESSOUS (z inférieur) → on le voit, et la PORTE qu'il franchit,
    // sans rien hacker (même esprit que l'estompage `occludesActor` du décor, mais Z-aware). Critère : le sol
    // se dessine APRÈS l'acteur (depth) ET le recouvre à l'écran (tileCenter) — robuste aux 4 rotations.
    const actors: { x: number; y: number; z: number }[] = [];
    if (mode === 'battle' && battle) { for (const c of battle.combatants) if (c.pos && !isOutOfAction(c)) actors.push({ x: c.pos.x, y: c.pos.y, z: c.pos.z ?? 0 }); }
    else { actors.push({ x: partyPos.x, y: partyPos.y, z: partyPos.z ?? 0 }); for (const ent of scene.entities) if (ent.kind === 'personnage' && !ent.combat?.hiddenUntilCombat) actors.push({ x: ent.pos.x, y: ent.pos.y, z: ent.z ?? 0 }); }
    const HALF_H = (shownEdge && viewMode !== 'top' ? EDGE_H : TH) / 2, TOKEN_H = 92, TOKEN_HW = TW * 0.45;
    // « ALLER SOUS LE PONT » : une tuile de sol d'une COUCHE supérieure (passerelle) se rend semi-transparente
    // au-dessus d'un acteur qui se tient EN DESSOUS. Le TRI garde l'index de couche `z` (depth) ; la position
    // ÉCRAN et la comparaison « qui est plus haut » passent par la HAUTEUR MÉTRIQUE (`heightAt`/`liftAt`).
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
    // Couches rendues : l'active + celles du DESSOUS (z <= activeZ). Le franchissement vertical s'auto-dérive
    // du relief (parois de `groundTile`) ; plus de « chemin de ronde » d'une couche du dessus à dessiner.
    // AU-DESSUS de la zone active (z > activeZ), on dessine en plus les SURPLOMBS (tablier de pont / loge)
    // en FANTÔME (OVERHANG_GHOST_OPACITY) → on voit la silhouette du pont au-dessus de soi sans qu'il masque
    // le sol. Borné aux scènes MULTI-COUCHES (mono-niveau : aucune couche au-dessus à fantômer).
    const multiLayer = scene.layers.length > 1;
    for (const lvl of scene.layers) {
      if (viewZ != null && lvl.z !== viewZ) continue; // isolate : seule la couche isolée
      const ghost = viewZ == null && lvl.z > activeZ; // tablier au-dessus de la zone active → fantôme
      if (ghost && !multiLayer) continue;
      for (let y = 0; y < d.h; y++)
        for (let x = 0; x < d.w; x++) {
          if (ghost && !isOverhang(scene, x, y, lvl.z)) continue; // au-dessus : SEULEMENT les surplombs
          const html = groundTile(scene, x, y, d, lvl.z);
          // Profondeur PAR TUILE : depth(x,y,z) − 0.5 → le sol passe juste SOUS les objets de SA case
          // (prop +0, jeton +0.5) tout en s'interclassant avec les voisins par sa vraie position écran
          // (base ≫ z) : un sol haut surplombe les cases plus ARRIÈRE du bas sans recouvrir la cour devant.
          if (html) {
            const reveal = !ghost && coversActorBelow(x, y, lvl.z); // passerelle au-dessus d'un combattant → transparente
            const op = ghost ? OVERHANG_GHOST_OPACITY : reveal ? 0.22 : 1;
            out.push({ d: depth(x, y, d, lvl.z) - 0.5, x, y, z: lvl.z, el: <g key={`f${lvl.z}-${x}-${y}`} style={{ opacity: op, transition: 'opacity 0.2s' }} dangerouslySetInnerHTML={{ __html: html }} /> });
          }
        }
    }
    return out;
  }, [scene, shownRot, shownEdge, viewMode, activeZ, viewZ, mode, battle, partyPos]);

  // Un MUR/DÉCOR/TOIT devant un acteur (même colonne écran, camera-near, proche) s'ESTOMPE pour ne pas
  // cacher le personnage — pendant, côté murs/toit, du cutaway. Mutualisé par `wallObjs`/`decorObjs`/`roofObjs`.
  // ROTATION-AWARE : on projette par `rotTile` dans l'espace écran-aligné et on prend la colonne/profondeur
  // de la projection COURANTE (losange : anti-diag/diag ; edge-on ou dessus : x/y de rangée) — même base que
  // `depth()`/`tileCenter()`, donc l'estompe suit la caméra aux 4 crans et dans les deux projections.
  const occludesActor = useMemo(() => {
    const actorTiles: { x: number; y: number }[] = [];
    if (mode === 'battle' && battle) {
      for (const c of battle.combatants) if (c.pos && !isOutOfAction(c)) actorTiles.push(c.pos);
    } else if (scene) {
      actorTiles.push(partyPos);
      for (const ent of scene.entities) if (ent.kind === 'personnage' && !ent.combat?.hiddenUntilCombat) actorTiles.push(ent.pos);
    }
    const d: Dims = { ...(scene?.dimensions ?? { w: 1, h: 1 }), rot: shownRot, view: viewMode, edge: shownEdge };
    const axisAligned = viewMode === 'top' || shownEdge; // edge-on / dessus : profondeur par rangée (r.y)
    const proj = (x: number, y: number) => {
      const r = rotTile(x, y, d);
      return axisAligned ? { col: r.x, dep: r.y } : { col: r.x - r.y, dep: r.x + r.y };
    };
    const actors = actorTiles.map((a) => proj(a.x, a.y));
    return (tx: number, ty: number) => {
      const t = proj(tx, ty);
      return actors.some((a) => a.dep < t.dep && Math.abs(a.col - t.col) <= 1 && t.dep - a.dep <= 7);
    };
  }, [scene, mode, battle, partyPos, shownRot, viewMode, shownEdge]);

  // Murs sur arêtes (cloisons fines) : quads verticaux dressés sur les arêtes de case, fusionnés dans
  // le tri de profondeur global (un mur avant occulte ce qui est derrière ; les portes sont ajourées).
  const wallObjs = useMemo<{ d: number; el: JSX.Element; x: number; y: number; z: number }[]>(() => {
    if (!scene?.walls?.length) return [];
    const d: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode, edge: shownEdge };
    const zs = new Set(renderLevels.map((l) => l.z));
    // Cloisons des étages rendus (raised par leur z) → les murs des loges se dressent au-dessus du parterre.
    // Une arête à STRUCTURE de siège se rend en fortification (intacte) ou brèche (abattue) — l'état
    // `structureIsDown` est passé comme l'overlay porte passe `doorIsOpen` ; le memo dépend de `scene`,
    // donc l'Effondrement (nouvelle réf de scène, `collapseStructure`) recalcule la brèche.
    return scene.walls.filter((w) => zs.has(w.z ?? 0)).map((w, i) => {
      const seg = wallSeg(w, d, w.structure ? structureIsDown(scene, w) : false);
      // `z` d'atténuation = la couche du mur (son sommet est une cloison de hauteur FIXE, plus un rempart
      // porteur de passerelle) → il borde le sol de SA couche et reste à sa lumière.
      return { d: seg.d, x: w.x, y: w.y, z: w.z ?? 0, el: <g key={`wall-${i}`} style={{ opacity: occludesActor(w.x, w.y) ? 0.4 : 1, transition: 'opacity 0.25s' }} dangerouslySetInnerHTML={{ __html: seg.svg }} /> };
    });
  }, [scene, shownRot, shownEdge, viewMode, renderLevels, occludesActor]);

  const decorObjs = useMemo<{ d: number; el: JSX.Element; x: number; y: number }[]>(() => {
    if (!scene) return [];
    const d: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode, edge: shownEdge };
    const out: { d: number; el: JSX.Element; x: number; y: number }[] = [];
    for (let y = 0; y < d.h; y++)
      for (let x = 0; x < d.w; x++) {
        const ov = terrainOverlay(tileAt(scene, x, y), x, y, d);
        if (ov)
          out.push({
            d: ov.d,
            x,
            y,
            el: (
              <g key={`ov${x}-${y}`} style={{ opacity: occludesActor(x, y) ? 0.4 : 1, transition: 'opacity 0.25s' }} dangerouslySetInnerHTML={{ __html: ov.html }} />
            ),
          });
      }
    return out;
  }, [scene, shownRot, shownEdge, viewMode, occludesActor]);

  const roofObjs = useMemo<{ d: number; el: JSX.Element }[]>(() => {
    if (!scene) return [];
    const d: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode, edge: shownEdge };
    const allies =
      mode === 'battle' && battle
        ? battle.combatants.filter((c) => c.kind === 'hero' && c.pos).map((c) => c.pos!)
        : [partyPos];
    const night = sceneIsDark(scene, gameTime); // jour/nuit = horloge (#T1c)
    // Cutaway TOUT-EN-SCÈNE : le toit se lève quand un allié est DANS l'empreinte (`roofHidden`) OU DERRIÈRE
    // le bâtiment (une case de l'empreinte `occludesActor` → sinon le toit cacherait le perso qui passe derrière).
    return (scene.roofs ?? []).map((roof) => {
      const f = roof.foot;
      let behind = false;
      for (let dy = 0; dy < f.h && !behind; dy++)
        for (let dx = 0; dx < f.w && !behind; dx++) if (occludesActor(f.x + dx, f.y + dy)) behind = true;
      return roofObj(roof, d, roofHidden(roof, allies) || behind, night);
    });
  }, [scene, shownRot, shownEdge, viewMode, mode, battle, partyPos, gameTime, occludesActor]);

  // Grisage hors-LdV : ennemis que le héros actif ne peut PAS viser au tir faute de Ligne de Vue
  // (LDB 13 l.123) → pion fantomatique. Distingue « hors LdV » de « hors de portée » (aucun
  // n'a d'anneau rouge). Actif pendant la visée — mode neutre (attaque implicite au clic) ou
  // catégorie Tir ouverte — tant que l'Action n'est pas consommée.
  const ghostIds = useMemo<Set<string>>(() => {
    if (mode !== 'battle' || !battle || battle.over) return new Set();
    // Mode incantation : grisage hors-LdV du SORT (LDB 46 l.170), indépendant de l'arme portée.
    if (battle.action === 'cast' && battle.selectedSpellId) return castOutOfSightTargetIds(useGame.getState);
    if (battle.acted || battle.action !== null) return new Set();
    return outOfSightTargetIds(useGame.getState);
  }, [scene, mode, battle]);

  // BROUILLARD DE GUERRE — cases actuellement visibles (union des alliés/groupe) et déjà explorées.
  // Dérivé de l'état (positions LOGIQUES), pas du glissement → memo STABLE pendant la marche : les
  // couches lourdes (sol/décor/FogLayer) ne se reconstruisent pas à 60 Hz. Les créatures hors-vue
  // sont COUPÉES au rendu (ci-dessous) ; le décor/terrain est recouvert par le FogLayer.
  const visible = useMemo(
    () => computeStateVisible({ scene, battle, party, partyPos, gameTime, lightLevel }),
    [scene, battle, party, partyPos, gameTime, lightLevel],
  );
  const exploredSet = useMemo(() => new Set(explored[scene?.id ?? ''] ?? []), [explored, scene?.id]);
  // Accumulation persistante de l'exploré (no-op si rien de neuf → pas de boucle de rendu).
  useEffect(() => {
    if (visible.size) markExplored([...visible]);
  }, [visible, markExplored]);

  // Signaux de survol EFFECTIFS : le curseur clavier/manette (combatCursor) PRIME sur la souris locale
  // (hover) ET sur le survol de frise (hoverCombatantId) — un seul réticule/aperçu à la fois, partagé
  // par les trois memos de survol ci-dessous (réticule, halo de focus, aperçu de déplacement). La
  // souris reprend la main dès qu'elle bouge (onPointerMove appelle clearCursor()).
  const effHover = combatCursor?.tile ?? hover;
  const effFocusId = combatCursor?.snappedId ?? hoverCombatantId;

  // Ciblage du JOUEUR au survol — MEMOÏSÉ (previewAttack/LdV ne tournent pas à 60 Hz pendant les
  // glissements de token). Rejoue les MÊMES prédicats que le clic : réticule présent = clic valide.
  const hoverAim = useMemo<{
    fromId: string | null; // départ de la ligne (résolu en pixels au rendu — suit le glissement)
    toId: string;
    line: 'dashed' | 'solid' | null;
    /** Chemin RÉEL d'un déplacement combiné (Charge / rejoindre) — tracé à la place de la ligne droite. */
    path?: { x: number; y: number }[];
    /** Carte d'infobulle : nom / compétence + valeur / dégâts / manœuvre — ou erreur ⛔ courte. */
    tip: { kind: 'info'; title: string; skill: string; base: number; mod: number; dmg: number | null; note?: string } | { kind: 'err'; text: string } | null;
    /** Aperçu synthétisé (forme battle.preview) pour le clignotant des jauges (previewResourceDelta). */
    preview?: { kind: 'attack' | 'charge' | 'moveAttack'; targetId: string; path?: { x: number; y: number }[]; dest?: { x: number; y: number }; cost?: number; adv?: 0 | 1 };
    reticle: boolean;
  } | null>(() => {
    if (mode !== 'battle' || !battle || battle.over || (!effHover && !effFocusId) || !myTurn) return null;
    // Un jet à cible est déjà en cours (modale) : le réticule PERSISTANT prend le relais au rendu.
    if (pendingAttack || pendingDefense || pendingTrample || pendingHeal || (pendingCast && !pendingCast.pickingTargets)) return null;
    // Source du survol EFFECTIF : la cible aimantée du curseur clavier/manette (effFocusId) ou un PORTRAIT
    // de frise priment sur la tuile sous la souris (effHover) → réticule + infobulle identiques, qu'on
    // survole le token, son portrait, ou qu'on navigue au pad.
    const occ = effFocusId
      ? battle.combatants.find((c) => c.id === effFocusId && c.pos && !isOutOfAction(c))
      : effHover ? combatantAtTile(battle.combatants, effHover.x, effHover.y, effHover.z ?? 0) : null;
    if (!occ) return null;
    const st = useGame.getState;
    // Flux différés (bandeau TargetPrompt — Frappe Mortelle / 2ᵉ frappe (Deux armes) / Surincantation
    // +Cible) : le réticule vient du MODE courant (targetingModes via hoverTargeting), AVANT les verrous
    // acted/Frénésie (ces ciblages surviennent APRÈS l'attaque-Action). Plus de logique de cibles dupliquée.
    if (pendingCleave || pendingDualStrike || pendingCast?.pickingTargets) {
      const actor = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
      if (!actor) return null;
      const ht = hoverTargeting(st, actor, occ);
      return ht.kind === 'ok' ? { fromId: actor.id, toId: occ.id, line: ht.line, tip: null, reticle: true } : null;
    }
    const activeH = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
    if (!activeH || activeH.kind !== 'hero' || !activeH.pos) return null;
    // Mêmes verrous que battleClickEntity : Action consommée (sauf attaque libre de Frénésie),
    // Sonné/Brisé, cible de Frénésie IMPOSÉE (le plus proche en LdV).
    const freeFrenzy = battle.action === null && hasFreeWeaponAttack(activeH);
    if (battle.acted && !freeFrenzy) return null;
    if (battle.action === null && (!canTakeAction(activeH) || hasCondition(activeH, 'brise'))) return null;
    if (battle.action === null && isFrenzied(activeH)) {
      const ft = frenzyTarget(st, activeH);
      if (ft && ft.id !== occ.id) return null;
    }
    // Piétinement / zone / mêlée : tout l'aperçu (réticule + chemin + tip) passe désormais par
    // hoverTargeting, qui lit l'`AttackOption` armée (selectedAttack) — plus de branche par mode.
    const ht = hoverTargeting(st, activeH, occ);
    if (ht.kind === 'none') return null;
    if (ht.kind === 'invalid') {
      const text =
        ht.reason === 'los' ? '⛔ pas de ligne de vue'
        : ht.reason === 'engaged' ? '⛔ Engagé — se désengager'
        : ht.reason === 'unloaded' ? '⛔ Arme déchargée — recharger'
        : ht.reason === 'noammo' ? '⛔ Plus de munitions'
        : '⛔ hors de portée';
      return { fromId: null, toId: occ.id, line: null, tip: { kind: 'err', text }, reticle: false };
    }
    return { fromId: activeH.id, toId: occ.id, line: ht.line, path: ht.path, tip: { kind: 'info', title: ht.title, skill: ht.skill, base: ht.base, mod: ht.mod, dmg: ht.dmg, note: ht.note }, preview: ht.preview, reticle: true };
  }, [combatCursor, hover, hoverCombatantId, mode, battle, scene, myTurn, pendingAttack, pendingDefense, pendingCast, pendingCleave, pendingDualStrike, pendingTrample, pendingHeal]);

  // Combattant SOUS le focus (tuile survolée OU portrait de frise/Tab) — INDÉPENDANT du ciblage
  // (hoverAim exige Mon Tour + cible valide). Pilote le halo de focus du token ET, synchronisé au
  // store (`hovered`), le miroir réciproque sur la frise. Source unique du « qui est mis en évidence ».
  const hoveredId = useMemo<string | null>(() => {
    if (mode !== 'battle' || !battle) return null;
    const occ = effFocusId
      ? battle.combatants.find((c) => c.id === effFocusId && c.pos && !isOutOfAction(c))
      : effHover ? combatantAtTile(battle.combatants, effHover.x, effHover.y, effHover.z ?? 0) : null;
    return occ?.id ?? null;
  }, [combatCursor, mode, battle, hover, hoverCombatantId]);
  useEffect(() => { setHovered(hoveredId); }, [hoveredId, setHovered]);

  // Aperçu de DÉPLACEMENT au SURVOL (desktop) : le chemin + le coût se matérialisent sous la
  // souris, le clic UNIQUE commet — le tap-1 (battle.preview) reste le flux tactile. Mêmes
  // sources que le clic (movePreviewAt) ; memoïsé : pathTo ne tourne pas à 60 Hz.
  const hoverMove = useMemo<{ kind: 'move' | 'run'; path: { x: number; y: number }[]; cost: number } | null>(() => {
    if (mode !== 'battle' || !battle || battle.over || !effHover || battle.preview || !myTurn) return null;
    if (pendingAttack || pendingDefense || pendingTrample || pendingHeal || pendingCast || pendingCleave || pendingDualStrike) return null;
    const occ = combatantAtTile(battle.combatants, effHover.x, effHover.y, effHover.z ?? 0);
    if (occ) return null; // une cible a sa propre visée (hoverAim)
    return movePreviewAt(useGame.getState, effHover);
  }, [combatCursor, hover, mode, battle, myTurn, pendingAttack, pendingDefense, pendingCast, pendingCleave, pendingDualStrike, pendingTrample, pendingHeal]);

  // Empreinte du MOBILE actif (sa MONTURE si cavalier) → aperçu de déplacement à la BONNE taille (4 cases
  // pour un cavalier sur monture 2×2). Mobile = combattant actif (héros au survol/curseur, ennemi au télégraphe).
  const activeMover = mode === 'battle' && battle ? battle.combatants.find((c) => c.id === battle.order[battle.turn]) : undefined;
  const activeMoveN = activeMover ? footprintN(mountOf(battle!, activeMover) ?? activeMover) : 1;

  // Aperçu de DÉPLACEMENT au SURVOL hors combat : même calcul que le clic (moveAlong) — pathTo avec
  // la portée de saut du GROUPE. Memoïsé sur (hover, partyPos, scene) → le BFS ne tourne PAS à la frame
  // (le hover ne change qu'au changement de tuile). null sur tuile de départ / non marchable / pas de chemin.
  const explorePath = useMemo<Pt[] | null>(() => {
    if (mode !== 'exploration' || dialogue || !scene || !hover) return null;
    if (hover.x === partyPos.x && hover.y === partyPos.y && (hover.z ?? 0) === (partyPos.z ?? 0)) return null;
    // Même cible que le clic : un objet/PNJ interactif route vers une case adjacente (sa case est souvent
    // bloquée) — c'est ce qui rend l'aperçu visible au survol d'un objet ; sinon déplacement simple.
    const dest = exploreMoveDest(scene, partyPos, hover);
    if (!dest) return null;
    const heroes = party.filter((h) => !h.dead && h.wounds.current > 0);
    const partyM = heroes.length ? Math.min(...heroes.map((h) => effectiveMovement(h))) : 0;
    const path = pathTo(scene, partyPos, dest, { blocked: new Set(), jump: maxJumpTiles(partyM) });
    return path && path.length >= 2 ? path : null;
  }, [hover, mode, dialogue, scene, partyPos, party]);

  // Jauges EN DIRECT (clignotant de l'ActiveFrame) : le coût/gain (Action/Mouvement/Avantage) de
  // l'intention SOUS LA SOURIS — un aperçu de la forme tap-1 est synthétisé du survol et passe par
  // la MÊME source (`previewResourceDelta`). Écrit au store seulement quand le delta CHANGE.
  useEffect(() => {
    const pvLike = hoverAim?.preview ?? (hoverMove && hover ? { kind: hoverMove.kind, tile: { ...hover }, path: hoverMove.path, cost: hoverMove.cost } : null);
    const delta = pvLike && battle ? previewResourceDelta({ ...battle, preview: pvLike as never }) : null;
    const cur = useGame.getState().hoverDelta;
    const same = (!delta && !cur) || (!!delta && !!cur && delta.action === cur.action && delta.move === cur.move && delta.adv === cur.adv);
    if (!same) useGame.setState({ hoverDelta: delta });
  }, [hoverAim, hoverMove, battle, hover]);

  // Surbrillances de combat LOURDES (grilles W×H) — figées hors changement d'état de combat. Les
  // éléments qui SUIVENT le token qui glisse (tether d'engagement, halo de l'actif) restent calculés
  // à la frame (peu coûteux) plus bas.
  const staticHighlights = useMemo<{ d: number; el: JSX.Element }[]>(() => {
    if (!scene || mode !== 'battle' || !battle) return [];
    const d: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode, edge: shownEdge };
    // Chaque surbrillance porte sa PROFONDEUR de case `depth(x,y,z)+0.25` : elle se trie à SA position
    // écran (juste au-dessus du sol −0.5, sous les jetons +0.5), pas en bande par étage — sinon un
    // overlay z>0 à constante unique serait enterré par les sols à (x+y) élevé. Helpers : `dPath`
    // losange soulevé de son lift (z=0 ⇒ sans 4ᵉ arg, byte-identique mono-niveau) ; `liftOf` lift-écran
    // d'un point pour movePreviewEls.
    const hl: { d: number; el: JSX.Element }[] = [];
    const dPath = (x: number, y: number, z = 0) => diamondPath(x, y, d, z ? liftAt(x, y, z) : 0);
    const liftOf = (p: Pt) => (p.z ? liftAt(p.x, p.y, p.z) : 0);
    const activeC = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
    // COOP : le tour du héros d'un AUTRE joueur s'affiche comme un tour ennemi — aucune affordance
    // (ni grille de déplacement, ni anneaux de cible, ni aperçu) ; teintes d'équipe/zones restent.
    // (Plus AUCUN indicateur de distance au sol — ni bandes de tir ni portée de sort : la portée se
    // lit au survol — réticule présent = cible valide, ⛔ sinon. Seuls marche/course restent.)
    // Portée de Marche AFFICHÉE EN PERMANENCE au tour d'un héros (modèle de clic implicite) :
    // budget spécial stocké (post-Désengagement) prioritaire, sinon Marche restante dérivée.
    const walkReach = myTurn ? displayedReach(useGame.getState) : new Map<string, number>();
    for (const k of walkReach.keys()) {
      const [x, y, z = 0] = k.split(',').map(Number); // clé z-aware : « x,y » (sol) ou « x,y,z » (étage)
      hl.push({ d: depth(x, y, d, z) + 0.25, el: <path key={`h${k}`} d={dPath(x, y, z)} fill="#4f8fe0" opacity={0.32} /> });
    }
    // Zone de COURSE (LDB 15 l.79-82) au-delà de la Marche, dans une AUTRE couleur : y cliquer
    // demandera le Test d'Athlétisme, et le jet peut porter moins loin que la case visée.
    if (myTurn)
      for (const k of computeRunReach(useGame.getState).keys()) {
        if (walkReach.has(k)) continue;
        const [x, y, z = 0] = k.split(',').map(Number);
        hl.push({ d: depth(x, y, d, z) + 0.25, el: <path key={`r${k}`} d={dPath(x, y, z)} fill="#9b6be0" opacity={0.24} /> });
      }
    // Aperçu tap-1 (tactile) : chemin + case d'arrivée + badge — MÊME rendu que le survol desktop
    // (movePreviewEls, source unique du tracé de déplacement).
    const pv = myTurn ? battle.preview : null;
    if (pv) {
      const pvTgt = 'targetId' in pv ? battle.combatants.find((c) => c.id === pv.targetId) : undefined;
      const pvDest = pv.kind === 'move' || pv.kind === 'run' ? pv.tile : pv.kind === 'attack' ? pvTgt?.pos : pv.dest;
      const pvLbl = pv.kind === 'move' ? `Aller (${pv.cost})` : pv.kind === 'run' ? 'Courir' : pv.kind === 'charge' ? (pv.adv ? 'Charger (+1 Av)' : 'Charger') : pv.kind === 'moveAttack' ? 'Rejoindre + attaquer' : 'Attaquer';
      const pvZ = (pvDest?.z) ?? 0;
      // Aperçu multi-cases (chemin + destination + badge) : une seule profondeur pragmatique à la case
      // d'ARRIVÉE (l'exactitude par-segment du tracé est secondaire ; on garde leur ordre relatif).
      const pvD = pvDest ? depth(pvDest.x, pvDest.y, d, pvZ) + 0.25 : 0;
      for (const el of movePreviewEls(pv.kind === 'attack' ? [] : pv.path, pvDest ?? null, pvLbl, d, 'pv', '#ffd75e', pv.kind === 'attack' ? 1 : (activeC ? footprintN(mountOf(battle, activeC) ?? activeC) : 1), liftOf)) hl.push({ d: pvD, el });
      if (pvTgt?.pos) { const tz = pvTgt.pos.z ?? 0; for (const t of footprintTiles(pvTgt.pos, footprintN(pvTgt))) hl.push({ d: depth(t.x, t.y, d, tz) + 0.25, el: <path key={`pv-tgt-${t.x}-${t.y}`} d={dPath(t.x, t.y, tz)} fill="#ffd75e" opacity={0.18} pointerEvents="none" /> }); } // tout le bloc N×N d'un grand
    }
    // Teinte d'équipe des CASES occupées (choix C, Lot 1) : allié vert / ennemi rouge / actif jaune.
    for (const c of battle.combatants) {
      if (!c.pos || isOutOfAction(c)) continue;
      if (isRider(c)) continue; // le cavalier est REPRÉSENTÉ par l'empreinte de sa MONTURE — pas de pastille 1×1 séparée
      const isActiveC = c.id === activeC?.id || c.riderId === activeC?.id; // une monture est « active » si SON cavalier l'est
      const fill = tileTint(c.kind === 'hero', isActiveC);
      const fp = footprintN(c);
      const cz = c.pos.z ?? 0;
      for (let dx = 0; dx < fp; dx++)
        for (let dy = 0; dy < fp; dy++)
          hl.push({ d: depth(c.pos.x + dx, c.pos.y + dy, d, cz) + 0.25, el: <path key={`tt${c.id}-${dx}-${dy}`} d={dPath(c.pos.x + dx, c.pos.y + dy, cz)} fill={fill} opacity={isActiveC ? 0.3 : 0.2} pointerEvents="none" /> });
    }
    // Zones persistantes (L11) : fumée opaque en gris ; zones de feu/effet (Mur de feu,
    // Grands feux) en orange translucide — l'occupant voit le danger.
    for (const zone of battle.zones ?? []) {
      const fill = zone.blocksLoS ? '#9aa0a6' : '#e2641e';
      for (const t of zone.tiles) {
        hl.push({ d: depth(t.x, t.y, d, 0) + 0.25, el: <path key={`zone-${zone.label}-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, d)} fill={fill} opacity={zone.blocksLoS ? 0.5 : 0.35} pointerEvents="none" /> });
      }
    }
    // Cibles VALIDES de l'attaque (R4) : anneau « cliquable pour attaquer » — en mode neutre
    // (attaque implicite), tant que l'Action est disponible (ou attaque libre de Frénésie).
    if (myTurn && battle.action === null && activeC?.kind === 'hero' && !pendingAttack && (!battle.acted || hasFreeWeaponAttack(activeC))) {
      const eligible = eligibleAttackTargetIds(useGame.getState);
      for (const c of battle.combatants) {
        if (!c.pos || !eligible.has(c.id)) continue;
        const cz = c.pos.z ?? 0;
        hl.push({ d: depth(c.pos.x, c.pos.y, d, cz) + 0.25, el: <path key={`tgt-${c.id}`} d={dPath(c.pos.x, c.pos.y, cz)} fill="none" stroke="#ff5a4d" strokeWidth={2.5} opacity={0.9} pointerEvents="none" /> });
      }
    }
    // « Tirer dans le tas » : cibles ÉLIGIBLES touchables au hasard.
    if (pendingAttack?.intoCrowd) {
      const atk = battle.combatants.find((c) => c.id === pendingAttack.attackerId);
      const tgt = battle.combatants.find((c) => c.id === pendingAttack.targetId);
      if (atk && tgt)
        for (const v of crowdEligible(battle, atk, tgt)) {
          if (!v.pos) continue;
          const vz = v.pos.z ?? 0;
          hl.push({ d: depth(v.pos.x, v.pos.y, d, vz) + 0.25, el: <path key={`crowd-${v.id}`} d={dPath(v.pos.x, v.pos.y, vz)} fill="#ff7a3c" opacity={0.34} stroke="#ff7a3c" strokeWidth={2} pointerEvents="none" /> });
        }
    }
    // Cibles cliquables du MODE de ciblage courant (targetingModes → MÊME source que réticule/curseur/clic) :
    // Soin (alliés soignables → anneau AMI) ; flux différés Frappe Mortelle / 2ᵉ frappe / Surincantation
    // « +Cible » (ennemis → anneau hostile). L'attaque a son propre bloc rouge (eligibleAttackTargetIds).
    if (myTurn && !pendingAttack && (pendingCleave || pendingDualStrike || pendingCast?.pickingTargets || battle.action === 'heal')) {
      const active = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
      const mode = currentTargetingMode(useGame.getState);
      const cands = active ? mode.candidates?.(useGame.getState, active) ?? [] : [];
      const friendly = mode.id === 'heal'; // soin = anneau ami (vert)
      const checked = pendingCast?.pickingTargets ? new Set(pendingCast.extraTargetIds ?? []) : null; // surincantation : déjà coché en vert
      for (const t of cands)
        if (t.pos) {
          const tz = t.pos.z ?? 0;
          hl.push({ d: depth(t.pos.x, t.pos.y, d, tz) + 0.25, el: <path key={`cand-${t.id}`} d={dPath(t.pos.x, t.pos.y, tz)} fill="none" stroke={friendly || checked?.has(t.id) ? '#5db87a' : '#ff5a4d'} strokeWidth={2.5} opacity={0.9} pointerEvents="none" /> });
        }
    }
    return hl;
  }, [scene, shownRot, shownEdge, viewMode, mode, battle, myTurn, pendingAttack, pendingCleave, pendingDualStrike, pendingCast]);

  // Tokens des ENTITÉS de scène (exploration) memoïsés : ils ne BOUGENT pas pendant que le groupe
  // marche (seul le leader glisse, rendu à part). Sans ça, le rAF de marche (setWalkTick) re-rendait
  // les ~180 modèles de la galerie à chaque frame EN PLUS de leur propre anim → saccade. Réfs d'éléments
  // stables → React saute ces sous-arbres ; chaque créature continue de s'auto-animer via SON rAF
  // (usePlanAnim/useRigClip), indépendamment du re-rendu d'IsoStage.
  const entityObjs = useMemo<{ d: number; el: JSX.Element; z: number }[]>(() => {
    if (!scene) return [];
    const inBattle = mode === 'battle' && !!battle;
    const d: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode, edge: shownEdge };
    const isTop = viewMode === 'top';
    const discRfn = (sz: Combatant['size']) => (sizeFootprint(sz) * CELL) / 2 * 0.85;
    const out: { d: number; el: JSX.Element; z: number }[] = [];
    // En combat, les FIGURANTS (PNJ d'ambiance : spectateurs, prisonnier en cage…) ne « dépop »
    // plus — ils restent visibles, estompés et NON interactifs ; on ne les dessine pas si un
    // combattant occupe leur case (pas d'empilement de corps).
    const covered = (x: number, y: number) =>
      inBattle && !!combatantAtTile(battle!.combatants, x, y, 0); // figurants de décor = sol (z0) uniquement
    // Figurant en combat : estompé + non interactif (inchangé). L'étage est géré par le filtre ci-dessous.
    const wrap = (key: string, el: JSX.Element) =>
      inBattle ? (
        <g key={`fig-${key}`} opacity={0.7} pointerEvents="none">
          {el}
        </g>
      ) : (
        el
      );
    // Entités ENRÔLÉES (membres d'une rencontre) → combattantes : elles affichent leur équipement dérivé
    // du record en exploration (parité avec le spawn). Source UNIQUE = `scene.encounters` (pas de drapeau
    // miroir sur l'entité). Une entité d'ambiance non enrôlée reste mains libres.
    const enrolledIds = new Set(scene.encounters.flatMap((e) => (e.members ?? []).map((m) => m.entityId)));
    for (const ent of scene.entities) {
      if (ent.kind === 'heroStart' || ent.kind === 'prop') continue;
      if (ent.combat?.hiddenUntilCombat) continue; // ennemi d'embuscade : invisible avant le combat
      if (inBattle && battle!.combatants.some((c) => c.id === ent.id)) continue; // enrôlé : c'est le combattant qui le rend (pas de figurant dupliqué)
      const ez = ent.z ?? 0;
      if (viewZ != null ? ez !== viewZ : ez > activeZ) continue; // isole ; sinon couche active + dessous
      if (!ez && covered(ent.pos.x, ent.pos.y)) continue; // l'occlusion par décor ne vaut qu'au sol
      // Brouillard : une créature/PNJ hors-vue n'est PAS dessinée (le décor/prop, lui, reste « mémorisé »).
      if (!visible.has(`${ent.pos.x},${ent.pos.y},${ez}`)) continue;
      const r = pickBackend({ kind: 'sceneEntity', ent, enrolled: enrolledIds.has(ent.id) }, viewMode);
      if (r.backend === 'sprite') {
        out.push({
          d: depth(ent.pos.x, ent.pos.y, d, ez),
          z: ez,
          el: wrap(
            r.id,
            <BodyToken key={r.id} x={ent.pos.x} y={ent.pos.y} z={liftAt(ent.pos.x, ent.pos.y, ez)} dims={d} scale={0.55} fx={ent.anim}>
              <g dangerouslySetInnerHTML={{ __html: entitySprite(ent, d.rot) }} />
            </BodyToken>,
          ),
        });
      } else {
        const base = r.backend === 'rig' ? 0.58 : 0.55;
        const dBoost = r.backend === 'rig' ? 0.1 : 0;
        const off = (sizeFootprint(entitySize(ent)) - 1) / 2;
        const ex = ent.pos.x + off, ey = ent.pos.y + off;
        out.push({
          d: depth(ex, ey, d, ez) + dBoost,
          z: ez,
          el: wrap(
            r.id,
            <BodyToken key={r.id} x={ex} y={ey} z={liftAt(ent.pos.x, ent.pos.y, ez)} dims={d} scale={base * r.speciesScale * sizeTokenScale(entitySize(ent))} bakedDeath flat={isTop} portraitBox={r.portraitBox} discR={discRfn(entitySize(ent))}>
              {r.body}
            </BodyToken>,
          ),
        });
      }
    }
    return out;
  }, [scene, shownRot, shownEdge, viewMode, mode, battle, viewZ, activeZ, visible]);

  if (!scene) return null;
  const dims: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode, edge: shownEdge };
  const size = stageSize(dims);
  // Vue du dessus : les acteurs deviennent des pions-portraits (disques). Rayon = empreinte × ½ case.
  const top = viewMode === 'top';
  const discR = (n: number) => (n * CELL) / 2 * 0.85;

  // Position VISUELLE d'un token : interpolée le long du chemin si une marche est en cours
  // (anti-téléportation), sinon la position logique. Défini TÔT pour que les surbrillances (halo
  // d'actif) ET la caméra suivent le token qui GLISSE — et non sa destination logique déjà écrite.
  const wnow = performance.now();
  const walkPosOf = (id: string, x: number, y: number, z = 0) => {
    const w = walksRef.current[id];
    if (!w) return { x, y, walking: false, sortPt: { x, y } };
    const elapsed = wnow - w.start;
    const p = walkXY(w.path, elapsed, STEP_MS);
    // PROFONDEUR DE TRI (≠ position visuelle) : la case de plus grande BASE (anti-diagonale écran) parmi
    // les 2 extrémités du SEGMENT courant — le token chevauche ces 2 cases pendant le pas, donc il doit se
    // trier DEVANT leurs DEUX sols. Sans ça, le sol de la case d'arrivée (base plus grande) passait DEVANT
    // le perso (le +0.5 ne compense pas un cran de base ≈ BASE_SCALE). La BASE seule arbitre (z constant) ;
    // la position VISUELLE `p` reste interpolée → le token GLISSE. `sortPt` (sans offset d'empreinte) est
    // re-décalée par l'appelant (depth(sortPt + off)) comme la case logique l'était (invariant à l'offset).
    const seg = w.path.length < 2 ? 0 : Math.min(w.path.length - 2, Math.max(0, Math.floor(elapsed / STEP_MS)));
    const a = w.path[seg], b = w.path[seg + 1] ?? a;
    const sortPt = depth(b.x, b.y, dims, z) >= depth(a.x, a.y, dims, z) ? { x: b.x, y: b.y } : { x: a.x, y: a.y };
    return { x: p.x, y: p.y, walking: true, sortPt };
  };
  // Une marche est-elle en cours ? Si oui, la caméra suit le token image par image : on COUPE la
  // transition CSS du transform (sinon elle « chasse » une cible mobile et traîne ~0,3 s derrière).
  const anyWalking = Object.keys(walksRef.current).length > 0;
  /** Ancre écran d'un combattant pour réticule/ligne de visée : centre de l'EMPREINTE (les grands
   *  N×N sont visés au milieu, pas au coin NO) et suit le token qui GLISSE (walkPosOf). */
  const reticleAnchor = (c: Combatant) => {
    const off = (sizeFootprint(c.size) - 1) / 2;
    const wp = walkPosOf(c.id, c.pos!.x, c.pos!.y);
    return tileCenter(wp.x + off, wp.y + off, dims);
  };

  // Suivi du SURVOL : tout contexte où l'on cible par la carte — mode neutre (attaque implicite,
  // mêlée comprise), incantation (tooltip + gabarit ZdE), Piétinement, et flux différés (Frappe
  // Mortelle / 2ᵉ frappe / Surincantation). Le hover ne change qu'au changement de tuile.
  const activeC = mode === 'battle' && battle ? battle.combatants.find((c) => c.id === battle.order[battle.turn]) : undefined;
  const hoverTracking =
    mode === 'battle' && !!battle && !battle.over &&
    (((battle.action === null || battle.action === 'cast') && activeC?.kind === 'hero') ||
      !!pendingCleave || !!pendingDualStrike || !!pendingCast?.pickingTargets || !!placingZoneOf({ pendingCast, pendingSiegeAim, battle }));

  // --- Surbrillances de combat : grilles LOURDES memoïsées + éléments DYNAMIQUES (suivent le
  //     token qui glisse : tether d'engagement, halo de l'actif) recalculés à la frame (peu coûteux). ---
  const highlights: { d: number; el: JSX.Element }[] = [...staticHighlights];
  if (mode === 'battle' && battle) {
    // État ENGAGÉ (R7) : tether de mêlée entre paires Engagées (zone de contrôle). Dédupliqué (id < otherId).
    for (const c of battle.combatants) {
      if (!c.pos || isOutOfAction(c)) continue;
      for (const oid of c.engagedWith ?? []) {
        if (c.id >= oid) continue; // une seule ligne par paire
        const o = battle.combatants.find((x) => x.id === oid);
        if (!o?.pos || isOutOfAction(o)) continue;
        const za = c.pos.z ?? 0, zb = o.pos.z ?? 0; // chaque extrémité posée à l'étage de SON combattant
        const pa = walkPosOf(c.id, c.pos.x, c.pos.y);
        const pb = walkPosOf(o.id, o.pos.x, o.pos.y);
        const ca = tileCenter(pa.x, pa.y, dims, za ? liftAt(pa.x, pa.y, za) : 0);
        const cb = tileCenter(pb.x, pb.y, dims, zb ? liftAt(pb.x, pb.y, zb) : 0);
        // tether posé à la profondeur de l'extrémité la plus PROCHE caméra (+0.25 ⇒ sous les jetons)
        highlights.push({ d: Math.max(depth(pa.x, pa.y, dims, za), depth(pb.x, pb.y, dims, zb)) + 0.25, el: <line key={`eng-${c.id}-${oid}`} x1={ca.cx} y1={ca.cy} x2={cb.cx} y2={cb.cy} stroke="#d98a3a" strokeWidth={2} strokeDasharray="4 3" opacity={0.6} pointerEvents="none" /> });
      }
    }
    if (activeC?.pos) {
      const haloUnit = mountOf(battle, activeC) ?? activeC; // cavalier → halo sur l'empreinte de la MONTURE (2×2), pas sa case 1×1
      const hz = (haloUnit.pos as { z?: number }).z ?? 0;
      const ap = walkPosOf(haloUnit.id, haloUnit.pos!.x, haloUnit.pos!.y); // le halo SUIT le token qui glisse
      for (const t of footprintTiles(ap, footprintN(haloUnit)))
        highlights.push({ d: depth(t.x, t.y, dims, hz) + 0.25, el: <path key={`active-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, dims, liftAt(t.x, t.y, hz))} fill="none" stroke="#ffe066" strokeWidth={3} /> });
    }
  }
  if (mode === 'exploration' && !dialogue)
    highlights.push({ d: depth(partyPos.x, partyPos.y, dims, partyPos.z ?? 0) + 0.25, el: <path key="party-pos" d={diamondPath(partyPos.x, partyPos.y, dims, liftAt(partyPos.x, partyPos.y, partyPos.z ?? 0))} fill="none" stroke="#ffe066" strokeWidth={1.5} opacity={0.5} /> });

  // --- Objets triés par profondeur (murs, arbres, entités, tokens) ---
  // `z` = étage de l'objet (absent ⇒ non concerné) : un objet d'un étage SOUS l'actif (z < activeZ)
  // est désaturé/assombri au rendu (filtre `lower-floor-dim`) → l'étage du dessous se distingue de
  // l'actif. activeZ=0 (toute scène plate) ⇒ aucun z<0 ⇒ aucun changement (byte-identique).
  type Obj = { d: number; el: JSX.Element; x?: number; y?: number; z?: number };
  const objs: Obj[] = [];

  // décor statique + toits multi-tuiles : éléments memoïsés (cf. decorObjs/roofObjs), juste
  // ré-insérés dans le tri de profondeur (leurs `el` gardent une réf stable → React saute le sous-arbre).
  // Planchers (floorObjs) et surbrillances au sol participent au MÊME tri : un sol haut surplombe les
  // tokens du bas, et les surbrillances (z=0) restent au-dessus du sol mais sous tout le reste.
  objs.push(...floorObjs, ...wallObjs, ...decorObjs, ...roofObjs);
  // Surbrillances : chaque surlignage porte DÉJÀ sa profondeur de case (depth(x,y,z)+0.25) → réinséré
  // tel quel dans le tri global, il se peint juste au-dessus de SON sol (−0.5) et sous les jetons (+0.5),
  // en s'interclassant avec les voisins par sa vraie position écran (les cases z>0 du rempart restent
  // sur le chemin de ronde sans recouvrir la cour). Plus de regroupement par bande d'étage.
  objs.push(...highlights);

  // token()/tokenNode() : adaptateurs minces vers la coquille partagée BodyToken (positionnement
  // unique). token() = corps SVG string ; tokenNode() = enfant React (rig) dont la mort est déjà
  // bakée (CORPSE_POSE / pose effondrée) → pas de bascule externe (bakedDeath).
  const feetZ = liftAt; // pieds d'un token = lift de sa case (cf. liftAt, partagé avec les surlignages)

  const token = (id: string, x: number, y: number, inner: string, scale: number, ringColor?: string, dim?: boolean, fx?: string, walking?: boolean, bakedDeath?: boolean, z = 0) => (
    <BodyToken key={id} x={x} y={y} z={feetZ(x, y, z)} dims={dims} scale={scale} ring={ringColor} dim={dim} walking={walking} fx={fx} bakedDeath={bakedDeath}>
      <g dangerouslySetInnerHTML={{ __html: inner }} />
    </BodyToken>
  );

  type TokenExtras = { hp?: { current: number; max: number }; icons?: string[]; iconsMore?: number; veil?: string; active?: boolean; ringDash?: string; flat?: boolean; portraitBox?: string; discR?: number; ghost?: boolean; cid?: string; highlight?: string };
  const tokenNode = (id: string, x: number, y: number, child: ReactNode, scale: number, ringColor?: string, dim?: boolean, walking?: boolean, extras?: TokenExtras, z = 0) => (
    <BodyToken key={id} x={x} y={y} z={feetZ(x, y, z)} dims={dims} scale={scale} ring={ringColor} ringDash={extras?.ringDash} dim={dim} ghost={extras?.ghost} walking={walking} bakedDeath
      hp={extras?.hp} icons={extras?.icons} iconsMore={extras?.iconsMore} veil={extras?.veil} active={extras?.active}
      flat={extras?.flat} portraitBox={extras?.portraitBox} discR={extras?.discR} cid={extras?.cid} highlight={extras?.highlight}>
      {child}
    </BodyToken>
  );

  // Décors (props : épave, cadavres, sang…) rendus dans LES DEUX modes → restent
  // visibles pendant le combat. L'anim d'ambiance CSS (ent.anim) passe par le calque fx.
  // Empreinte multi-cases (`foot {w,h}` : tente 2×2, tribune 3×1…) : token centré sur le bloc,
  // agrandi au côté max, profondeur au coin le plus PROCHE (comme les bâtiments).
  for (const ent of scene.entities) {
    if (ent.kind !== 'prop') continue;
    const ez = ent.z ?? 0;
    if (viewZ != null ? ez !== viewZ : ez > activeZ) continue; // isole ; sinon couche active + dessous
    const fg = decorFootGeometry(ent.foot);
    const px = ent.pos.x + fg.offX, py = ent.pos.y + fg.offY;
    // Échelle = côté MAX de l'empreinte (`fg.scale`) : un prop multi-cases garde sa pleine taille à
    // TOUS les crans (l'échelle « largeur projetée » l'écrasait en 1×1 quand l'empreinte pointait vers
    // la profondeur — cf. retour utilisateur). La projection edge est gérée par `billboardScale` (BodyToken).
    const pd = footprintDepth(ent.pos.x, ent.pos.y, ent.foot?.w ?? 1, ent.foot?.h ?? 1, dims, ez);
    if (ent.interact && !flags[`__fouille_${ent.id}`]) { // affordance « fouille » — masquée dès l'objet épuisé (B4)
      // Affordance : halo pulsé + onde « sonar » au sol, et étincelle dorée flottant AU-DESSUS du
      // décor fouillable — l'objet cliquable se repère de loin, sans texte (cf. anim.css).
      const c = tileCenter(px, py, dims, feetZ(px, py, ez));
      // SURVOL direct du décor (hors combat) : la tuile sous le curseur == la tuile du prop → halo renforcé.
      const haloHovered = mode === 'exploration' && !!hover && hover.x === ent.pos.x && hover.y === ent.pos.y && (hover.z ?? 0) === ez;
      objs.push({
        d: pd - 0.02, // juste sous le sprite
        z: ez,
        el: (
          <g key={`halo-${ent.id}`} pointerEvents="none">
            <g className={haloHovered ? 'interact-halo hovered' : 'interact-halo'}>
              <ellipse cx={c.cx} cy={c.cy + 4} rx={17 * fg.scale} ry={8.5 * fg.scale} fill="#ffe27a" opacity={0.26} />
              <ellipse cx={c.cx} cy={c.cy + 4} rx={17 * fg.scale} ry={8.5 * fg.scale} fill="none" stroke="#ffd75e" strokeWidth={2} opacity={0.9} />
            </g>
            <ellipse className="halo-ping" cx={c.cx} cy={c.cy + 4} rx={17 * fg.scale} ry={8.5 * fg.scale} fill="none" stroke="#ffd75e" strokeWidth={1.6} />
          </g>
        ),
      });
      objs.push({
        d: pd + 0.02, // au-dessus du sprite : l'étincelle « il y a quelque chose ici »
        z: ez,
        el: (
          <g key={`spark-${ent.id}`} className="halo-spark" pointerEvents="none" transform={`translate(${c.cx + 9 * fg.scale}, ${c.cy - 26 * fg.scale})`}>
            <path d="M0,-6 L1.7,-1.7 L6,0 L1.7,1.7 L0,6 L-1.7,1.7 L-6,0 L-1.7,-1.7 Z" fill="#ffd75e" stroke="#7a5b16" strokeWidth={0.7} />
          </g>
        ),
      });
    }
    objs.push({ d: pd, z: ez, el: token(`e-${ent.id}`, px, py, entitySprite(ent, dims.rot), 0.55 * fg.scale, undefined, false, ent.anim, false, false, ez) });
  }

  // Leader VISIBLE du groupe (#27b : si le principal est mort/à terre, le suivant debout) —
  // partagé entre le token d'exploration, l'émission ANIM_MOVE et le suivi caméra (même id).
  const partyLeader = party.find((h) => !h.dead && h.wounds.current > 0) ?? party[0];

  if (mode === 'battle' && battle) {
    // Figurants de scène (PNJ d'ambiance) : maintenus en combat — estompés, cases libres seulement
    // (cf. entityObjs). Plus de spectateurs qui « dépop » dès l'Initiative.
    objs.push(...entityObjs);
    let hi = 0;
    for (const c of battle.combatants) {
      if (!c.pos) continue;
      // À l'échelle MER, l'ÉQUIPAGE d'un navire est ABSTRAIT — pas de jeton individuel sur la mer (la coque agit
      // en unité et le représente, MDG ch.14). MÊME prédicat « passager » que l'exclusion de l'ordre d'initiative.
      if (isPassengerInBattle(c, battle.combatants, isMerScene(scene))) continue;
      // Structure de siège (AA p.120) : AUCUN jeton de case — elle se rend SUR son arête (wallSeg : rempart
      // crénelé intact / brèche de gravats) et se cible via l'overlay d'arête à `data-cid` (ci-dessous).
      // Sans ce saut, `pickBackend`/`resolveRender` la classerait en bipède Humain (un bonhomme au pied du mur).
      if (isStructure(c)) continue;
      // Levage par étage : un combattant se rend à SON niveau (`pos.z`), comme les entités multi-niveaux
      // (cf. boucles entités/props) — soulevé à sa hauteur métrique. On rend la couche active + celles du
      // DESSOUS, PLUS les combattants posés sur un SURPLOMB au-dessus (chemin de ronde au-dessus de la cour) :
      // sinon, depuis la cour (activeZ=0), défenseurs et pièces de la muraille seraient INVISIBLES et donc
      // inciblables à la souris — or un siège se DOIT de les montrer/cibler d'en bas (parité avec le picking
      // cross-couche). Le SOL de surplomb reste FANTÔME (cf. floorObjs) ; seuls les JETONS sont nets, triés
      // z-correctement (depth + lift). `isOverhang` borne au multi-couche (z>0 + surface marchable dessous) →
      // mono-niveau inchangé. En mode ISOLÉ (viewZ), on garde la seule couche isolée.
      const cz = c.pos.z ?? 0;
      const overhang = viewZ == null && cz > activeZ && isOverhang(scene, c.pos.x, c.pos.y, cz); // jeton de muraille vu d'en bas
      if (viewZ != null ? cz !== viewZ : (cz > activeZ && !overhang)) continue; // isole ; sinon couche active + dessous (+ surplomb)
      const isHero = c.kind === 'hero';
      // Brouillard : un ennemi/PNJ que PERSONNE du groupe ne voit n'est pas dessiné (les alliés, qui
      // SONT les viewers, restent toujours rendus). Clé z-aware = l'étage du combattant.
      if (!isHero && !visible.has(`${c.pos.x},${c.pos.y},${cz}`)) continue;
      // Combat monté (iso seulement) : un CAVALIER n'est pas dessiné au sol — il est rendu EN SELLE
      // sur sa monture (ci-dessous). En vue du dessus, cavalier et monture sont deux pions distincts.
      if (!top && isRider(c)) { if (isHero) hi++; continue; }
      // Monture MONTÉE (iso) : dessinée avec son cavalier en UN corps composite (boucle ci-dessous).
      if (!top && isMount(c)) continue;
      const ring = isHero ? HERO_RING[hi++ % HERO_RING.length] : ENEMY_RING;
      const wp = walkPosOf(c.id, c.pos.x, c.pos.y);
      // Backend choisi par le classifieur unique (rig humanoïde / plan non-bipède) ; base 0.62,
      // l'échelle d'espèce (bipède ou créature) vient du backend.
      const r = pickBackend({ kind: 'combatant', combatant: c }, viewMode);
      // Empreinte multi-cases (LDB 15 l.55) : token CENTRÉ sur le bloc N×N et mis à l'échelle pour le remplir.
      // `footprintN(c)` lit l'EMPREINTE (Taille créature OU `footprint` autoré d'un NAVIRE) ; l'échelle visuelle
      // suit (`footprintTokenScale` pour un objet à empreinte, sinon `sizeTokenScale`) — un navire remplit ses
      // cases SANS être une créature (aucune Taille → aucune Peur de Taille).
      const fp = footprintN(c);
      const off = (fp - 1) / 2; // ancre (coin NO) → centre du bloc
      const cx = wp.x + off, cy = wp.y + off;
      const fxSum = summarizeEffects(c.conditions, c.activeEffects, 3, combatantFlags(c));
      const el = tokenNode(r.id, cx, cy, r.body, 0.62 * r.speciesScale * (c.footprint ? footprintTokenScale(c.footprint) : sizeTokenScale(c.size)), ring, isOutOfAction(c), wp.walking, {
        hp: c.inert ? undefined : c.wounds, // engin INERTE (Blessures {0,0,0}, immune) = pas de jauge de PV (un objet n'a pas de santé)
        icons: fxSum.visible.map((v) => v.icon),
        iconsMore: fxSum.moreCount,
        veil: veilTint(isHero),
        active: c.id === activeC?.id,
        ringDash: teamShape(isHero), // R9 : ennemi = anneau pointillé (indice d'équipe non-coloré)
        flat: top,
        portraitBox: r.portraitBox,
        discR: discR(fp),
        ghost: ghostIds.has(c.id), // hors-LdV du tireur actif → fantomatique
        cid: c.id, // ciblage DOM (recettes Playwright : survol/clic par data-cid)
        highlight: c.id === hoveredId ? relationColor(c.kind) : undefined, // FOCUS (survol token/frise) → halo couleur de relation, indépendant du ciblage (hoverAim = réticule)
      }, cz);
      objs.push({ d: depth(wp.sortPt.x + off, wp.sortPt.y + off, dims, cz) + 0.5, z: cz, el }); // tri constant sur le pas (sortPt) → le token reste DEVANT les 2 sols qu'il chevauche
    }
    // Combat monté (LDB 14) : le couple CAVALIER+MONTURE est dessiné comme UN corps composite
    // (MountedToken) trié au niveau de l'os → vraie profondeur (jambe lointaine derrière le
    // barillet, buste derrière la tête). Un seul BodyToken à la tuile/échelle de la monture
    // (une ombre partagée). L'empreinte/échelle restent celles de la monture.
    if (!top) for (const mount of battle.combatants) {
      if (!isMount(mount) || !mount.pos) continue;
      const rider = riderOf(battle, mount);
      if (!rider) continue;
      const off = (footprintN(mount) - 1) / 2;
      const mz = mount.pos.z ?? 0;
      const wp = walkPosOf(mount.id, mount.pos.x, mount.pos.y, mz); // suit l'animation de marche de la monture
      const cx = wp.x + off, cy = wp.y + off;
      const mountScale = 0.62 * pickBackend({ kind: 'combatant', combatant: mount }).speciesScale * sizeTokenScale(mount.size);
      const el = tokenNode(`${mount.id}-mtd`, cx, cy, <MountedToken mount={mount} rider={rider} />, mountScale, undefined, isOutOfAction(mount), wp.walking);
      objs.push({ d: depth(wp.sortPt.x + off, wp.sortPt.y + off, dims, mz) + 0.5, z: mz, el }); // tri constant sur le pas (sortPt)
    }
  } else {
    // Entités de scène (créatures/PNJ d'ambiance) : tokens memoïsés (cf. entityObjs) — ré-insérés
    // dans le tri de profondeur, réfs stables → React saute leur re-rendu pendant la marche.
    objs.push(...entityObjs);
    // (Plus de halo de PORTE de bâtiment : un toit composé n'a plus de porte propre — on entre par les
    //  portes de mur (`WallSeg.door`, overlay cliquable) et l'intérieur se révèle au cutaway du toit.)
    // PNJ / marchand (interlocuteurs) : PAS de halo permanent (ils ne « réclament » pas comme une
    // fouille/porte) — halo révélé au SURVOL seul, cohérent avec le curseur main. Rendu HORS du memo
    // entityObjs (qui ignore `hover` pour rester stable) → 1 seule tuile à la fois, peu coûteux.
    if (hover) for (const ent of scene.entities) {
      if (ent.kind === 'prop' || ent.interact) continue; // fouille = halo permanent (boucle props ci-dessus)
      if (!ent.dialogueId && !ent.merchant) continue;
      if (ent.pos.x !== hover.x || ent.pos.y !== hover.y || (ent.z ?? 0) !== (hover.z ?? 0)) continue;
      const cc = tileCenter(ent.pos.x, ent.pos.y, dims, feetZ(ent.pos.x, ent.pos.y, ent.z ?? 0));
      objs.push({
        d: depth(ent.pos.x, ent.pos.y, dims, ent.z ?? 0) + 0.55,
        z: ent.z ?? 0,
        el: (
          <g key={`npc-halo-${ent.id}`} className="interact-halo hovered" pointerEvents="none">
            <ellipse cx={cc.cx} cy={cc.cy + 4} rx={15} ry={7.5} fill="#ffe27a" opacity={0.2} />
            <ellipse cx={cc.cx} cy={cc.cy + 4} rx={15} ry={7.5} fill="none" stroke="#ffd75e" strokeWidth={1.8} opacity={0.85} />
          </g>
        ),
      });
    }
    // groupe — glisse le long du chemin (ANIM_MOVE émis par moveAlong)
    const wp = partyLeader ? walkPosOf(partyLeader.id, partyPos.x, partyPos.y, partyPos.z ?? 0) : { x: partyPos.x, y: partyPos.y, walking: false, sortPt: { x: partyPos.x, y: partyPos.y } };
    const pZ = partyPos.z ?? 0; // le groupe se rend à son étage (loge) — token soulevé + trié au bon niveau
    const r = pickBackend({ kind: 'partyLeader', leader: partyLeader }, viewMode);
    const el =
      r.backend === 'sprite'
        ? token(r.id, partyPos.x, partyPos.y, pnjSprite(), 0.6, HERO_RING[0], false, undefined, false, false, pZ)
        : tokenNode(r.id, wp.x, wp.y, r.body, 0.6, HERO_RING[0], false, wp.walking, { flat: top, portraitBox: r.portraitBox, discR: discR(1) }, pZ);
    objs.push({ d: depth(wp.sortPt.x, wp.sortPt.y, dims, pZ) + 0.5, z: pZ, el }); // tri constant sur le pas (sortPt) → le groupe reste DEVANT les 2 sols qu'il chevauche
  }
  objs.sort((a, b) => a.d - b.d);

  // --- Caméra : recadre autour du point focal (groupe / combattant actif) ---
  // Attaque/sort ENNEMI télégraphié (actorAim) : ligne (pleine en mêlée, pointillée tir/sort) +
  // réticule + cadrage des deux. Le ciblage du JOUEUR a son propre réticule (survol + pending*).
  let targeting: { from: Combatant; to: Combatant; melee?: boolean } | null = null;
  if (mode === 'battle' && battle && actorAim) {
    const a = battle.combatants.find((c) => c.id === actorAim.fromId);
    const b = battle.combatants.find((c) => c.id === actorAim.toId);
    if (a?.pos && b?.pos) targeting = { from: a, to: b, melee: actorAim.kind === 'melee' || actorAim.kind === 'charge' };
  }

  // Cadrage CAMÉRA (découplé du réticule, R8) : on cadre la paire attaquant↔cible aussi pour une
  // attaque OU une incantation en cours de résolution (pendingAttack/pendingCast) — sinon on voit
  // mieux ce que fait l'IA que soi-même.
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
  // tuile logique partyPos qui avance d'une case toutes les 150 ms — sinon, la transition transform
  // étant coupée pendant la marche, l'écran bondit de case en case.
  let focus: { x: number; y: number } = partyPos;
  if (mode !== 'battle' && partyLeader) focus = walkPosOf(partyLeader.id, partyPos.x, partyPos.y);
  if (camPair) {
    // Cadrer les DEUX : on centre sur le milieu attaquant ↔ cible (« centré sur lui » corrigé).
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
  // Peek caméra (survol d'un portrait dans la FRISE d'initiative) : recadre temporairement sur le
  // combattant survolé ; au relâchement (hoverCombatantId = null), focus revient sur l'actif → la
  // transition CSS (0.3 s) ramène la vue là où elle était. Local/read-only — actif même hors de son
  // tour (coop) ; le survol d'un TOKEN sur la carte, lui, ne bouge pas la caméra (peek = frise only).
  if (mode === 'battle' && battle && hoverCombatantId) {
    const peeked = battle.combatants.find((c) => c.id === hoverCombatantId && c.pos);
    if (peeked?.pos) focus = walkPosOf(peeked.id, peeked.pos.x, peeked.pos.y);
  }
  const fc = tileCenter(focus.x, focus.y, dims);
  // Caméra libre tactique : le suivi auto-cadre le point focal, + un décalage manuel (camPan) qu'on
  // accumule au glisser. Remis à zéro quand l'unité active change (refocus « sur celui qui joue après »).
  const cam = { x: VW / 2 - fc.cx + camPan.x, y: VH / 2 - fc.cy + camPan.y };

  // CULLING d'animation : publie le cadre VISIBLE (AABB en tuiles des 4 coins de la fenêtre projetés)
  // pour que les hooks d'anim (usePlanAnim/useRigClip) sautent le rAF des acteurs hors-champ. Recalculé
  // à chaque rendu (donc suit la caméra pendant la marche). Écriture dans un module = pas de re-rendu.
  const _toTile = (sx: number, sy: number) => screenToTile((sx - VW / 2) / zoom + VW / 2 - cam.x, (sy - VH / 2) / zoom + VH / 2 - cam.y, dims);
  const _cs = [_toTile(0, 0), _toTile(VW, 0), _toTile(0, VH), _toTile(VW, VH)];
  const _xs = _cs.map((c) => c.x), _ys = _cs.map((c) => c.y);
  // Cadre VISIBLE en tuiles (entiers) : culling d'animation (setVisibleTileBounds) ET du brouillard
  // (FogLayer ne dessine que les tuiles à l'écran → chemin borné par la fenêtre, pas par la scène).
  const viewBounds = { minX: Math.floor(Math.min(..._xs)), maxX: Math.ceil(Math.max(..._xs)), minY: Math.floor(Math.min(..._ys)), maxY: Math.ceil(Math.max(..._ys)) };
  setVisibleTileBounds(viewBounds);

  // --- Interaction (clic / survol → tuile) ---
  // Écran → tuile : annule le zoom (scale autour du centre viewport) puis la translation caméra.
  const tileFromEvent = (ev: React.PointerEvent): Pt | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const gx = (loc.x - VW / 2) / zoom + VW / 2 - cam.x;
    const gy = (loc.y - VH / 2) / zoom + VH / 2 - cam.y;
    // Picking CROSS-COUCHE aligné sur le curseur clavier (PARITÉ souris↔clavier) : SANS borne d'étage
    // `≤ activeZ`, on vise la couche RÉELLE LA PLUS HAUTE de la case écran sous le curseur — ainsi survoler/
    // cliquer le chemin de ronde z1 depuis la cour z0 cible z1 (là où se tiennent défenseurs et pièces). On
    // itère du HAUT vers le bas : chaque couche est inversée À SON lift (`screenToTileAtZ`), et `resolveCursorZ`
    // (SOURCE UNIQUE de « la couche réelle la plus haute d'une case », partagée avec `nextCursorTile`) tranche
    // — la 1ʳᵉ couche dont la case résout à ELLE-MÊME gagne (un surplomb dessiné lifté capte le clic ; sinon on
    // tombe dans le puits jusqu'au sol). Sol plat mono-couche : `resolveCursorZ`→0 ⇒ comportement byte-identique.
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

  // Survol : suit la tuile sous le curseur quand on vise (infobulle de portée). Ne met à jour
  // l'état que sur changement de tuile (pas à chaque pixel) → re-rendus bornés.
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
      else if (occ) { if (st.inspectEnabled) st.setInspectId(occ.id); } // allié/soi non-actionnable → inspecter (parité frise : « inspection depuis le token »)
      else st.battleClickTile(tz ? { x, y, z: tz } : { x, y }, { confirm: hoverClickCommits() }); // z-aware : escalier / case de rempart
      return;
    }
    const ent = sc.entities.find((e) => e.pos.x === x && e.pos.y === y && (e.z ?? 0) === tz);
    // Case d'arrivée partagée avec l'aperçu de survol (explorePath) — JAMAIS recalculée à part (cf.
    // exploreMoveDest) : escalier (autre bout), case adjacente d'un objet/PNJ interactif, ou déplacement simple.
    const dest = exploreMoveDest(sc, st.partyPos, t);
    if (ent && (ent.dialogueId || !!ent.interact || !!ent.merchant)) {
      if (cheb(st.partyPos, ent.pos) <= 1) {
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
      // d'une case adjacente, ou on le dit s'il est déjà à côté (sinon le groupe entre dans son corps).
      st.setPendingInteract(null);
      if (cheb(st.partyPos, ent.pos) <= 1) st.log(`${ent.label ?? 'Ce badaud'} n’a rien à vous dire.`);
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
    // déplacement) — borné aux changements de tuile (cf. garde plus bas), donc peu de re-rendus.
    if (!hoverTracking && useGame.getState().mode !== 'exploration') {
      if (hover) setHover(null);
      return;
    }
    if (!t) {
      if (hover) setHover(null);
      return;
    }
    if (!hover || hover.x !== t.x || hover.y !== t.y || (hover.z ?? 0) !== (t.z ?? 0)) {
      if (useGame.getState().combatCursor) useGame.getState().clearCursor(); // la souris (nouvelle tuile) reprend la main sur le curseur clavier/manette — un seul réticule à la fois
      setHover(t);
      const st = useGame.getState();
      if (st.hoverCombatantId) st.setHoverCombatant(null); // la souris (nouvelle tuile) reprend la main sur le ciblage clavier (Tab) / frise
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

  return (
    <svg
      ref={svgRef}
      className="iso-stage"
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid slice"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => {
        // Clic droit en combat = attaque la plus PERTINENTE sur l'ennemi survolé (scoreur partagé avec l'IA :
        // poids éditable × dégâts/multi-cible), sans muter `selectedAttack`. Raccourci sur `availableAttacks`.
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
      }}
    >
      <defs dangerouslySetInnerHTML={{ __html: DEFS + AMBIANCE_DEFS }} />
      <g style={{ transform: `translate(${VW / 2}px,${VH / 2}px) scale(${zoom * (turning ? 0.97 : 1)}) translate(${-VW / 2}px,${-VH / 2}px) translate(${cam.x}px,${cam.y}px)`, transition: turning ? 'opacity 0.13s ease-out' : anyWalking ? 'opacity 0.13s ease-out' : 'transform 0.3s ease-out, opacity 0.13s ease-out', opacity: turning ? 0.6 : 1 }}>
        {/* CULLING au viewport (espace ÉCRAN, PAS l'AABB de tuiles — qui en iso couvre quasi toute la
            scène) : on projette la tuile de chaque objet lourd tagué (sol/décor/murs) et on ne rend que
            ceux dont le centre tombe dans le rectangle écran (+ marge pour les corps/murs HAUTS). Le
            navigateur ne rastérise alors que l'écran à chaque frame → fini le re-raster de toute la carte. */}
        {(() => {
          const hw = VW / (2 * zoom), hh = VH / (2 * zoom), M = 220;
          const cl = VW / 2 - cam.x - hw - M, cr = VW / 2 - cam.x + hw + M;
          const ct = VH / 2 - cam.y - hh - M, cb = VH / 2 - cam.y + hh + M;
          const onScreen = (o: Obj) => {
            if (o.x === undefined) return true; // non tagué (tokens/FX) : toujours rendu
            const c = tileCenter(o.x, o.y!, dims);
            return c.cx >= cl && c.cx <= cr && c.cy >= ct && c.cy <= cb;
          };
          // .filter().map() (PAS map→null) : React ne réconcilie que les ~centaines d'éléments à l'écran,
          // pas les milliers de la scène entière.
          return (
            <g>
              {objs.filter(onScreen).map((o) =>
                o.z !== undefined && o.z < activeZ ? (
                  // Atténuer SANS opacité (sinon on verrait À TRAVERS les murs du dessous) : désaturation +
                  // assombrissement seuls (filtre `lower-floor-dim`) → l'étage inférieur recule, reste OPAQUE.
                  <g key={o.el.key} filter="url(#lower-floor-dim)">
                    {o.el}
                  </g>
                ) : (
                  o.el
                ),
              )}
            </g>
          );
        })()}
        {/* Brouillard de guerre : voile sombre sur l'inconnu / grisé sur l'exploré-hors-vue / clair en
            vue. Au-dessus du décor+tokens, SOUS les FX/réticules (les infos de combat restent lisibles). */}
        <FogLayer w={scene.dimensions.w} h={scene.dimensions.h} z={activeZ} rot={shownRot} view={viewMode} edge={shownEdge} visible={visible} explored={exploredSet} bounds={viewBounds} floorZAt={fogFloorZAt} />
        {/* Portes dynamiques : cliquer une porte VISIBLE et ADJACENTE l'ouvre/ferme (exploration : le
            groupe ; combat : le héros actif, à son tour). Une porte fermée bloque vue ET passage. */}
        {(() => {
          const ctrls: Pt[] = battle ? (myTurn && activeC?.kind === 'hero' && activeC.pos ? [activeC.pos] : []) : [partyPos];
          if (!ctrls.length) return null;
          const adj = (p: Pt, c: Pt) => Math.max(Math.abs(p.x - c.x), Math.abs(p.y - c.y)) <= 1;
          return (scene.walls ?? [])
            .filter((w) => w.door && (w.z ?? 0) === activeZ && (w.side === 'N' || w.side === 'E'))
            .map((w) => {
              const z = w.z ?? 0;
              const c1 = { x: w.x, y: w.y };
              const c2 = w.side === 'E' ? { x: w.x + 1, y: w.y } : { x: w.x, y: w.y - 1 };
              if (!visible.has(`${c1.x},${c1.y},${z}`) && !visible.has(`${c2.x},${c2.y},${z}`)) return null;
              if (!ctrls.some((p) => adj(p, c1) || adj(p, c2))) return null;
              const [a, b] = tileEdge(w.x, w.y, w.side as 'N' | 'E', dims, z);
              const open = doorIsOpen(scene, w);
              return (
                <line key={`door-${w.x}-${w.y}-${w.side}-${z}`} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
                  stroke={open ? '#caa14a' : '#d4534a'} strokeWidth={11} strokeLinecap="round" opacity={0.45}
                  className="door-toggle" style={{ cursor: 'pointer' }}
                  onPointerDown={(ev) => {
                    ev.stopPropagation();
                    useGame.setState((s) => (s.scene ? { scene: toggleDoorIn(s.scene, w.x, w.y, w.side, z) } : {}));
                    bus.emit(EVT.SCENE_DIRTY);
                  }}
                >
                  <title>{open ? 'Fermer la porte' : 'Ouvrir la porte'}</title>
                </line>
              );
            });
        })()}
        {/* Structures de siège (AA p.120) : la fortification d'arête est une CIBLE de combat. Hit-area
            TRANSPARENTE posée sur l'arête, portant le `data-cid` du Combattant-structure → survol (réticule
            de visée) + clic-attaque (`battleClickEntity`, comme un token ; `stopPropagation` court-circuite
            le clic-sol du SVG, comme l'overlay porte). Présente tant que la structure TIENT (Combattant
            présent) et qu'une de ses deux cases est visible — PAS de garde d'adjacence : on la pilonne à
            distance. À la BRÈCHE, `collapseStructure` retire le Combattant et pose le flag → l'overlay
            disparaît, l'arête reste en gravats (wallObjs). */}
        {battle && (scene.walls ?? [])
          .filter((w) => !!w.structure && (w.z ?? 0) === activeZ && (w.side === 'N' || w.side === 'E') && !structureIsDown(scene, w))
          .map((w) => {
            const z = w.z ?? 0;
            const id = `structure-${w.x}-${w.y}-${w.side}-${z}`;
            const sc = battle.combatants.find((c) => c.id === id);
            if (!sc) return null; // abattue / pas (encore) enrôlée
            const c1 = { x: w.x, y: w.y };
            const c2 = w.side === 'E' ? { x: w.x + 1, y: w.y } : { x: w.x, y: w.y - 1 };
            if (!visible.has(`${c1.x},${c1.y},${z}`) && !visible.has(`${c2.x},${c2.y},${z}`)) return null;
            const [a, b] = tileEdge(w.x, w.y, w.side as 'N' | 'E', dims, z);
            return (
              <line key={`struct-${w.x}-${w.y}-${w.side}-${z}`} data-cid={id} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
                stroke="transparent" strokeWidth={16} strokeLinecap="round" style={{ pointerEvents: 'stroke', cursor: 'crosshair' }}
                onPointerDown={(ev) => {
                  const st = useGame.getState();
                  if (!controlsActive(st)) return;
                  // Aperçu-puis-commit (parité token, targetingModes) : un 1er clic ARME seulement la
                  // structure et LAISSE l'événement remonter → le clic-sol résout un MOVE (s'approcher,
                  // passer le long du mur). Seul un 2e clic sur la structure DÉJÀ armée la frappe — frapper
                  // une enceinte est une action DÉLIBÉRÉE, pas le réflexe d'un clic.
                  const prev = st.battle?.preview;
                  const armed = !!prev && 'targetId' in prev && prev.targetId === id;
                  if (armed) {
                    ev.stopPropagation();
                    st.battleClickEntity(id, { confirm: hoverClickCommits() });
                  } else {
                    st.battleClickEntity(id, { confirm: false });
                  }
                }}
              >
                <title>{sc.name}</title>
              </line>
            );
          })}
        {/* Télégraphe de DÉPLACEMENT ENNEMI (actorMove) : chemin + destination en ROUGE, montré avant le
            glissé — même tracé que l'aperçu héros (movePreviewEls), teinté ennemi. */}
        {actorMove && actorMove.path.length > 0 &&
          movePreviewEls(actorMove.path, actorMove.path[actorMove.path.length - 1], null, dims, 'enmv', '#e0533a', activeMoveN, (p) => (p.z ? liftAt(p.x, p.y, p.z) : 0))}
        {/* Télégraphe ENNEMI (actorAim) : réticule + ligne — PLEINE en mêlée, pointillée tir/sort. */}
        {targeting && (
          <TargetReticle
            from={reticleAnchor(targeting.from)}
            to={reticleAnchor(targeting.to)}
            line={targeting.melee ? 'solid' : 'dashed'}
            lineColor="#e0533a"
          />
        )}
        {/* Mouches qui tournoient au-dessus de chaque cadavre (faune d'ambiance). */}
        {scene.entities
          .filter((e) => e.kind === 'prop' && e.ref === 'cadavre')
          .map((e) => {
            const { cx, cy } = tileCenter(e.pos.x, e.pos.y, dims);
            return (
              <g key={`flies-${e.id}`} transform={`translate(${cx},${cy - 14})`} pointerEvents="none">
                {['f1', 'f2', 'f3'].map((f) => (
                  <circle key={f} className={`fly ${f}`} r={1.5} fill="#0d0d0d" />
                ))}
              </g>
            );
          })}
        <FxLayer dims={dims} floats={floats} projs={projs} auras={auras} aoes={aoes} />
        {/* Gabarit de ZONE D'EFFET (LDB 47 l.29/44) : pendant la POSE (rayon FINAL surincanté, le
            gabarit suit le curseur) — ou aperçu au rayon initial si un sort de ZdE est sélectionné
            sans modale (re-cliquer l'ouvre). Contour POINTILLÉ ROUGE ANIMÉ (fourmis) + remplissage ;
            gris quand la case est invalide (hors portée OU hors Ligne de Vue). */}
        {battle && hover && (() => {
          // Source UNIQUE de pose (placingZoneOf — toute zone à poser librement) ; sinon aperçu
          // au rayon initial quand un sort de ZdE est sélectionné sans modale ouverte.
          const pz = placingZoneOf({ pendingCast, pendingSiegeAim, battle });
          let radius: number | null = null;
          let caster: Combatant | undefined;
          let ok: boolean | null = null;
          if (pz) {
            radius = pz.radius;
            caster = battle.combatants.find((c) => c.id === pz.casterId);
            ok = placedZoneValidAt(useGame.getState, pz, hover);
          } else if (battle.action === 'cast' && battle.selectedSpellId && activeC?.kind === 'hero' && !pendingCast) {
            const spell = findSpellById(battle.selectedSpellId);
            // Rayon depuis la cible STRUCTURÉE (source unique — gère les spans rayon ET diamètre).
            radius = spell ? zdeRadiusTiles(spell.target, activeC) : null;
            caster = activeC;
            if (radius != null && spell && caster?.pos) {
              const range = spellRangeTiles(spell.range, caster);
              ok = (range == null || cheb(caster.pos, hover) <= range) && !castSightBlocked(useGame.getState, caster.pos, hover);
            }
          }
          if (radius == null || !caster?.pos || ok == null) return null;
          const col = ok ? '#e0533a' : '#777';
          const tiles: JSX.Element[] = [];
          for (let dy = -radius; dy <= radius; dy++)
            for (let dx = -radius; dx <= radius; dx++) {
              const x = hover.x + dx, y = hover.y + dy;
              if (x < 0 || y < 0 || x >= dims.w || y >= dims.h) continue;
              tiles.push(<path key={`zde${x}-${y}`} d={diamondPath(x, y, dims)} fill={col} opacity={0.22} pointerEvents="none" />);
            }
          // Contour du BLOC (2r+1)² : enveloppe des 4 tuiles d'angle — fourmis qui tournent (anim.css).
          const x0 = hover.x - radius, x1 = hover.x + radius, y0 = hover.y - radius, y1 = hover.y + radius;
          const pts = [diamondCorners(x0, y0, dims), diamondCorners(x1, y0, dims), diamondCorners(x1, y1, dims), diamondCorners(x0, y1, dims)]
            .flatMap((c) => [c.top, c.right, c.bot, c.left]);
          const top = pts.reduce((a, b) => (b[1] < a[1] ? b : a));
          const right = pts.reduce((a, b) => (b[0] > a[0] ? b : a));
          const bot = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
          const left = pts.reduce((a, b) => (b[0] < a[0] ? b : a));
          return (
            <g pointerEvents="none">
              {tiles}
              <path
                className="zde-ants"
                d={`M${top[0]},${top[1]} L${right[0]},${right[1]} L${bot[0]},${bot[1]} L${left[0]},${left[1]} Z`}
                fill="none"
                stroke={col}
                strokeWidth={2.5}
                strokeDasharray="9 7"
                opacity={0.95}
              />
            </g>
          );
        })()}
        {/* Télégraphe de ZONE ENNEMI : disque Chebyshev (centre ± rayon) peint ~0,7 s AVANT la
            résolution d'une ZdE d'un lanceur IA — montre « où l'aire va tomber » (parité avec le
            réticule du missile). Teinte de MENACE rouge (≠ orange/bleu de l'aperçu joueur). */}
        {mode === 'battle' && actorAoe && (() => {
          const { center, radius } = actorAoe;
          const tiles: JSX.Element[] = [];
          for (let dy = -radius; dy <= radius; dy++)
            for (let dx = -radius; dx <= radius; dx++) {
              const x = center.x + dx, y = center.y + dy;
              if (x < 0 || y < 0 || x >= dims.w || y >= dims.h) continue;
              tiles.push(<path key={`aoe${x}-${y}`} d={diamondPath(x, y, dims)} fill="#d11a1a" opacity={0.25} pointerEvents="none" />);
            }
          return <g pointerEvents="none">{tiles}</g>;
        })()}
        {/* Losange du CURSEUR clavier/manette : repère de case TOUJOURS visible tant qu'aucune modale de jet
            à cible (pending*) n'est ouverte ET que hoverAim ne peint pas déjà un réticule (anti-doublon
            quand le curseur est aimanté sur une cible). Même géométrie que les autres surbrillances
            (diamondPath + liftAt) ; style délégué à la classe `combat-cursor`. */}
        {mode === 'battle' && battle && combatCursor
          && !pendingAttack && !pendingDefense && !pendingTrample && !pendingHeal && !pendingCast && !pendingCleave && !pendingDualStrike
          && !hoverAim?.reticle && (
          <g pointerEvents="none">
            {/* Curseur = TOUTE l'empreinte du mobile actif (4 cases pour un cavalier sur monture 2×2), ancrée
                au coin NO de la case visée — c'est là que le bloc atterrira (battleClickTile). */}
            {footprintTiles(combatCursor.tile, activeMoveN).map((t) => (
              <path key={`cursor-${t.x}-${t.y}`} className="combat-cursor" d={diamondPath(t.x, t.y, dims, liftAt(t.x, t.y, combatCursor.tile.z ?? 0))} fill="none" />
            ))}
          </g>
        )}
        {/* Aperçu de DÉPLACEMENT au survol (desktop) ET sous le curseur clavier/manette (effHover) :
            chemin + badge de coût — le clic/A commet. Ancré sur la case EFFECTIVE (souris ou curseur). */}
        {mode === 'battle' && battle && hoverMove && effHover && (
          <g pointerEvents="none">
            {movePreviewEls(hoverMove.path, effHover, hoverMove.kind === 'move' ? `Aller (${hoverMove.cost})` : 'Courir', dims, 'hmv', '#ffd75e', activeMoveN, (p) => (p.z ? liftAt(p.x, p.y, p.z) : 0))}
          </g>
        )}
        {/* Aperçu de DÉPLACEMENT au survol HORS combat : même tracé partagé (movePreviewEls), pas de badge. */}
        {mode === 'exploration' && explorePath && hover && (
          <g pointerEvents="none">
            {/* Case d'arrivée = fin du chemin (case adjacente pour un objet/PNJ interactif), pas le survol.
                Chaque point se rend à SON z et SA hauteur (lift) → le trait MONTE la rampe et court sur le
                tablier au lieu de rester écrasé sur la cour (z0). */}
            {movePreviewEls(explorePath, explorePath[explorePath.length - 1], null, dims, 'exp', '#ffd75e', 1, (p) => (p.z ? liftAt(p.x, p.y, p.z) : 0))}
          </g>
        )}
        {/* Ciblage du JOUEUR — réticule persistant des jets à cible en cours (modale ouverte), sinon
            survol (hoverAim) : réticule sur cible VALIDE + infobulle unifiée mêlée/tir/sort
            « arme ou sort · compétence base ±mod · Dégâts N » (états ⛔ LdV / portée / Engagé). */}
        {mode === 'battle' && battle && (() => {
          const byId = (id?: string | null) => (id ? battle.combatants.find((c) => c.id === id && c.pos) : undefined);
          if (pendingAttack) {
            const a = byId(pendingAttack.attackerId), t = byId(pendingAttack.victimId ?? pendingAttack.targetId);
            if (!a || !t) return null;
            const ranged = firedWeapon(a, t, pendingAttack.weaponUid).type === 'ranged';
            return <TargetReticle from={reticleAnchor(a)} to={reticleAnchor(t)} line={ranged ? 'dashed' : 'solid'} lineColor={a.kind === 'hero' ? '#ffd75e' : '#e0533a'} />;
          }
          if (pendingDefense) {
            const a = byId(pendingDefense.attackerId), t = byId(pendingDefense.defenderId);
            return a && t ? <TargetReticle from={reticleAnchor(a)} to={reticleAnchor(t)} line={pendingDefense.weapon.type === 'ranged' ? 'dashed' : 'solid'} lineColor="#e0533a" /> : null;
          }
          if (pendingTrample) {
            const a = byId(pendingTrample.attackerId), t = byId(pendingTrample.targetId);
            return a && t ? <TargetReticle from={reticleAnchor(a)} to={reticleAnchor(t)} line="solid" lineColor={a.kind === 'hero' ? '#ffd75e' : '#e0533a'} /> : null;
          }
          if (pendingCast && !pendingCast.pickingTargets) {
            const a = byId(pendingCast.casterId);
            const t = byId(pendingCast.targetId);
            // Zone NON posée (flux « jet puis pose ») : rien à viser encore — le gabarit suit le curseur.
            const to = pendingCast.zone
              ? pendingCast.zone.center ? tileCenter(pendingCast.zone.center.x, pendingCast.zone.center.y, dims) : null
              : t ? reticleAnchor(t) : null;
            if (!a || !to) return null;
            const self = !pendingCast.zone && pendingCast.casterId === pendingCast.targetId; // sort sur SOI : réticule seul
            return <TargetReticle from={self ? null : reticleAnchor(a)} to={to} line={self ? null : 'dashed'} lineColor={a.kind === 'hero' ? '#ffd75e' : '#e0533a'} />;
          }
          if (pendingHeal) {
            const t = byId(pendingHeal.targetId);
            return t ? <TargetReticle to={reticleAnchor(t)} /> : null;
          }
          if (!hoverAim) return null;
          const t = byId(hoverAim.toId);
          if (!t) return null;
          const to = reticleAnchor(t);
          const a = byId(hoverAim.fromId);
          const tip = hoverAim.tip;
          // Charge / rejoindre : on trace le CHEMIN réel du déplacement combiné (le clic UNIQUE
          // commet mouvement + attaque) — la ligne droite ne vaut que pour l'attaque sur place.
          const pathPts = (hoverAim.path?.length ?? 0) > 1
            ? hoverAim.path!.map((p) => tileCenter(p.x, p.y, dims)).map((p) => `${p.cx},${p.cy}`).join(' ')
            : null;
          const relCol = relationColor(t.kind); // couleur de relation de la cible : rouge adversaire / vert allié / or neutre
          return (
            <g pointerEvents="none">
              {pathPts && <polyline points={pathPts} fill="none" stroke={relCol} strokeWidth={3} opacity={0.9} />}
              {hoverAim.reticle && <TargetReticle from={pathPts ? null : a ? reticleAnchor(a) : null} to={to} line={pathPts ? null : hoverAim.line} lineColor={relCol} />}
              {tip?.kind === 'err' && (() => {
                const w = tip.text.length * 6.4 + 14;
                return (
                  <g transform={`translate(${to.cx},${to.cy - 64})`}>
                    <rect x={-w / 2} y={-13} width={w} height={20} rx={5} fill="#14141c" opacity={0.94} stroke="#888" strokeWidth={1} />
                    <text x={0} y={1} textAnchor="middle" dominantBaseline="middle" fill="#f0f0f0" fontSize={11} fontWeight={600}>
                      {tip.text}
                    </text>
                  </g>
                );
              })()}
              {tip?.kind === 'info' && !t.postes?.length && (() => {
                // Carte compacte : nom (or) / compétence + valeur EFFECTIVE (mod entre parenthèses) /
                // dégâts « +N » / manœuvre (Charge…) — une info par ligne.
                const eff = tip.base + tip.mod;
                const modTxt = tip.mod ? ` (${tip.mod > 0 ? '+' : '−'}${Math.abs(tip.mod)})` : '';
                const l2 = `${tip.skill}  ${eff}${modTxt}`;
                const l3 = tip.dmg != null ? `Dégâts +${tip.dmg}` : null;
                const l4 = tip.note ?? null;
                const w = Math.max(tip.title.length * 6.6, l2.length * 6, (l3 ?? '').length * 6, (l4 ?? '').length * 6) + 20;
                const h = 38 + (l3 ? 14 : 0) + (l4 ? 14 : 0);
                const x0 = -w / 2 + 10;
                let y = -h + 30; // la ligne 2 démarre sous le titre ; chaque ligne suivante descend de 14
                return (
                  <g transform={`translate(${to.cx},${to.cy - 60})`}>
                    <rect x={-w / 2} y={-h} width={w} height={h} rx={6} fill="#14141c" fillOpacity={0.95} stroke="#ffd75e" strokeOpacity={0.75} strokeWidth={1} />
                    <text x={x0} y={-h + 16} fill="#ffd75e" fontSize={11.5} fontWeight={700}>{tip.title}</text>
                    <text x={x0} y={y} fontSize={10.5}>
                      <tspan fill="#b9b2a6">{tip.skill}</tspan>
                      <tspan fill="#f0f0f0" fontWeight={700}>{`  ${eff}`}</tspan>
                      {tip.mod !== 0 && <tspan fill={tip.mod > 0 ? '#5db87a' : '#e0533a'} fontWeight={700}>{modTxt}</tspan>}
                    </text>
                    {l3 && (
                      <text x={x0} y={(y += 14)} fontSize={10.5}>
                        <tspan fill="#b9b2a6">Dégâts</tspan>
                        <tspan fill="#f0f0f0" fontWeight={700}>{`  +${tip.dmg}`}</tspan>
                      </text>
                    )}
                    {l4 && (
                      <text x={x0} y={y + 14} fontSize={10.5} fill="#e3c45a" fontWeight={600}>
                        {l4}
                      </text>
                    )}
                  </g>
                );
              })()}
            </g>
          );
        })()}
        {mode === 'battle' && battle && (() => {
          // Tooltip ÉQUIPE d'une pièce de siège/artillerie SURVOLÉE (turn-INDÉPENDANT, via hoveredId) : chef +
          // renforts + Indice d'Arme d'équipe + effectif (sous-effectif en rouge), et l'invite « Clic : rejoindre »
          // si le héros actif peut la servir. Données pures (poste.crewIds / qualité arme-d-equipe) — zéro mécanique.
          const occ = hoveredId ? battle.combatants.find((c) => c.id === hoveredId) : null;
          if (!occ?.postes?.length || !occ.pos) return null;
          const active = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
          // Pièce que le héros ACTIF pourrait REJOINDRE (affordance « Servir cette pièce ») → carte d'ACTION
          // (qualifié/aide), à l'image de la carte d'attaque quand on cible un ennemi.
          const servePoste = active && active.kind === 'hero' && myTurn ? serveTargetPoste(active, occ, battle.combatants) : undefined;
          const lines: { text: string; color: string; bold?: boolean }[] = [];
          for (const p of occ.postes) {
            const indice = p.item.qualities?.find((q) => q.id === 'arme-d-equipe')?.value ?? 0;
            const manned = isPosteManned(p, battle.combatants);
            const chefId = p.crewIds?.[0];
            const chef = manned ? battle.combatants.find((c) => c.id === chefId) : undefined;
            // Équipage réparti par QUALIFICATION (AA p.122 l.3900-3902) : qualifiés = comptent dans l'effectif ;
            // aides = présents mais non qualifiés (déplacent/compensent, ne comptent pas). Chef listé à part.
            const { qualified, aides } = posteCrewSplit(p, battle.combatants);
            const renforts = qualified.filter((c) => c.id !== chefId).map((c) => c.name);
            const aideNames = aides.filter((c) => c.id !== chefId).map((c) => c.name);
            const present = chef ? servingCrewPresent(chef, battle.combatants) : undefined;
            const groupLabel = p.item.weaponGroup ? weaponGroupLabel(p.item.weaponGroup) : '';
            lines.push({ text: indice > 0 ? `${p.item.name} · Arme d’équipe ${indice}` : p.item.name, color: '#ffd75e', bold: true });
            lines.push({ text: `Chef : ${manned ? chef?.name ?? 'aucun' : 'aucun'}`, color: '#f0f0f0' });
            if (renforts.length) lines.push({ text: `Renforts : ${renforts.join(', ')}`, color: '#b9b2a6' });
            if (aideNames.length) lines.push({ text: `Aides (non qual.) : ${aideNames.join(', ')}`, color: '#7f8893' });
            if (indice > 0 && present != null) lines.push({ text: `Effectif (qualifié) : ${present}/${indice}${present < indice ? ' ⚠ sous-effectif' : ''}`, color: present < indice ? '#e0533a' : '#5db87a' });
            // Carte d'ACTION du héros actif : SA qualification pour CETTE pièce (même check RAW que l'effectif),
            // affichée DÈS le survol (même non adjacent) → on sait d'un coup d'œil si ce héros peut l'armer.
            if (active && active.kind === 'hero' && myTurn) {
              const canServeNow = !!(servePoste && servePoste.item.uid === p.item.uid); // adjacent + servable maintenant
              if (isCrewQualified(active, p)) {
                lines.push({ text: `✅ Qualifié${groupLabel ? ` (Projectiles ${groupLabel})` : ''}`, color: '#5db87a', bold: true });
                lines.push({ text: !canServeNow ? '↳ approchez-vous pour servir' : manned ? '↳ compte pour l’effectif' : '↳ chef : peut tirer (pièce libre)', color: '#9fb8a6' });
              } else {
                lines.push({ text: `⚠ NON qualifié (Projectiles ${groupLabel})`, color: '#e0a53a', bold: true });
                lines.push({ text: '↳ AIDE : ne compte pas, ne tire pas', color: '#b9926a' });
              }
            }
          }
          const anchor = reticleAnchor(occ);
          const w = Math.max(...lines.map((l) => l.text.length)) * 6.1 + 20;
          const h = lines.length * 14 + 12;
          const x0 = -w / 2 + 10;
          return (
            <g pointerEvents="none" transform={`translate(${anchor.cx},${anchor.cy - 64})`}>
              <rect x={-w / 2} y={-h} width={w} height={h} rx={6} fill="#14141c" fillOpacity={0.95} stroke="#ffd75e" strokeOpacity={0.6} strokeWidth={1} />
              {lines.map((l, i) => (
                <text key={i} x={x0} y={-h + 15 + i * 14} fontSize={l.bold ? 11.5 : 10.5} fontWeight={l.bold ? 700 : 500} fill={l.color}>{l.text}</text>
              ))}
            </g>
          );
        })()}
        {/* OVERLAY DEBUG (recette `__wfrp.labels`) — annotation PARTAGÉE de la carte, rendue EN DERNIER
            dans le groupe caméra (au-dessus de TOUTE la scène) et UNIQUEMENT quand le flag est ON (zéro
            coût off). Pour chaque case non 'vide' de CHAQUE couche : coordonnées `x,y` (+`z{n}`) en blanc
            cerné de noir + teinte par couche (z1 cyan / z2 violet). Pastilles de rôle de structure sur les
            arêtes (porte jaune / courtine rouge). Purement additif : n'altère NI le rendu NI le tri. */}
        {debugLabels && (() => {
          const W = scene.dimensions.w, H = scene.dimensions.h;
          const els: JSX.Element[] = [];
          // 1) Teinte par couche + coordonnées centrées (lift = HAUTEUR MÉTRIQUE → posé sur le sol réel).
          for (const lvl of scene.layers) {
            const z = lvl.z;
            const tint = z >= 2 ? '#9a5cff' : z === 1 ? '#13c4d6' : null; // z0 : aucune teinte
            for (let y = 0; y < H; y++)
              for (let x = 0; x < W; x++) {
                if (lvl.tiles[y * W + x] === 'vide') continue;
                const lift = liftAt(x, y, z);
                if (tint) els.push(<path key={`dbgtint-${z}-${x}-${y}`} d={diamondPath(x, y, dims, lift)} fill={tint} opacity={0.18} pointerEvents="none" />);
                // Coord UNIQUEMENT sur la couche la plus HAUTE de la case → un seul label par colonne (plus de z0/z1 superposés).
                const isTop = !scene.layers.some((l) => l.z > z && l.tiles[y * W + x] !== 'vide');
                if (isTop) {
                  const { cx, cy } = tileCenter(x, y, dims, lift);
                  els.push(
                    <text key={`dbgxy-${z}-${x}-${y}`} x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                      fontSize={10} fontWeight={700} fill="#fff" stroke="#0a0a12" strokeWidth={3}
                      style={{ paintOrder: 'stroke' }} pointerEvents="none">
                      {z > 0 ? `${x},${y}z${z}` : `${x},${y}`}
                    </text>,
                  );
                }
              }
          }
          // 2) Rôle des MURS/structures : porte jaune / courtine rouge ; marqueur dressé sur l'arête à sa couche.
          const edgePts = (w: WallSeg, z: number): [{ cx: number; cy: number }, { cx: number; cy: number }] => {
            if (w.side === 'N' || w.side === 'E') return tileEdge(w.x, w.y, w.side, dims, z);
            const gc = (gx: number, gy: number) => tileCenter(gx - 0.5, gy - 0.5, dims, z);
            return w.side === '\\' ? [gc(w.x, w.y), gc(w.x + 1, w.y + 1)] : [gc(w.x + 1, w.y), gc(w.x, w.y + 1)];
          };
          for (const w of scene.walls ?? []) {
            const role = structureById.get(w.structure ?? '')?.kind === 'porte' ? '#f4d020' : '#e03a3a';
            const z = w.z ?? 0;
            const [a, b] = edgePts(w, z);
            const key = `${w.x}-${w.y}-${w.side}-${w.z ?? 0}`;
            els.push(<line key={`dbgwall-${key}`} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke={role} strokeWidth={4} strokeLinecap="round" opacity={0.92} pointerEvents="none" />);
            els.push(<circle key={`dbgwalldot-${key}`} cx={(a.cx + b.cx) / 2} cy={(a.cy + b.cy) / 2} r={3.2} fill={role} stroke="#0a0a12" strokeWidth={0.8} pointerEvents="none" />);
          }
          return <g pointerEvents="none">{els}</g>;
        })()}
      </g>
      {/* Légende DEBUG (recette `__wfrp.labels`) — FIXE dans un coin (hors groupe caméra : ne pan/zoome pas). */}
      {debugLabels && (() => {
        const items: [string, string][] = [
          ['couche z1 (teinte cyan)', '#13c4d6'],
          ['couche z2 (teinte violet)', '#9a5cff'],
          ['courtine (mur)', '#e03a3a'],
          ['porte', '#f4d020'],
        ];
        const x0 = 12, y0 = 12, rowH = 18, w = 200, h = 30 + items.length * rowH;
        return (
          <g pointerEvents="none">
            <rect x={x0} y={y0} width={w} height={h} rx={6} fill="#0a0a12" opacity={0.82} stroke="#444" strokeWidth={1} />
            <text x={x0 + 10} y={y0 + 18} fill="#fff" fontSize={11} fontWeight={700}>🏷️ Debug carte (labels)</text>
            {items.map(([label, col], i) => {
              const ly = y0 + 28 + i * rowH;
              return (
                <g key={`dbgleg-${i}`}>
                  <rect x={x0 + 10} y={ly} width={14} height={12} fill={col} stroke="#000" strokeWidth={0.8} />
                  <text x={x0 + 30} y={ly + 10} fill="#e8e8e8" fontSize={10.5}>{label}</text>
                </g>
              );
            })}
          </g>
        );
      })()}
      {/* Ambiance : fixe par-dessus la scène (ne suit pas la caméra) */}
      <rect x={0} y={0} width={VW} height={VH} fill="url(#g_warm)" pointerEvents="none" />
      {/* Corbeau qui traverse le ciel (extérieurs) — vie d'ambiance. */}
      {scene.ambiance !== 'interieur' && (
        <g className="crow" style={{ transform: 'translate(-140px,90px)' }} pointerEvents="none">
          <ellipse cx={0} cy={0} rx={7} ry={3} fill="#0a0a0a" />
          <path className="wing" d="M-2 0 q-14 -8 -22 -2 q12 4 22 2" fill="#0a0a0a" />
          <path className="wing" d="M2 0 q14 -8 22 -2 q-12 4 -22 2" fill="#0a0a0a" />
          <circle cx={6} cy={-1} r={2.4} fill="#0a0a0a" />
        </g>
      )}
      <rect x={0} y={0} width={VW} height={VH} fill="url(#g_vig)" pointerEvents="none" />
      {/* Mise en scène (Lot L) : assombrissement piloté par setLight (`lightLevel`), sinon l'obscurité
          d'horloge/ambiance. 1 = plein jour (aucun voile) → 0 = noir. Transition douce (rideau qui tombe). */}
      {(() => {
        const light = lightLevel ?? (scene && sceneIsDark(scene, gameTime) ? 0.4 : 1);
        const veil = (1 - Math.max(0, Math.min(1, light))) * 0.82;
        return veil > 0.001 ? (
          <rect x={0} y={0} width={VW} height={VH} fill="#05040a" opacity={veil} pointerEvents="none" style={{ transition: 'opacity 1.1s ease' }} />
        ) : null;
      })()}
    </svg>
  );
}
