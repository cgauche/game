/**
 * Rendu isométrique SVG (React) — remplace le rendu Phaser. Lit le store et
 * dessine la scène courante (exploration ou combat), gère le clic→tuile, les
 * surbrillances de combat et le déplacement animé. Réutilise toute la logique.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import './anim.css';
import { useGame } from '../state/store';
import { Scene as GameScene, tileAt, isWalkable, elevAt } from '../state/scene';
import { sceneIsDark } from '../state/sceneRules';
import { pathTo, type Pt } from '../state/path';
import { planJump } from '../state/jumpMove';
import { runFlow } from '../state/combatEffects';
import { maxJumpTiles } from '../engine/movement';
import { effectiveMovement } from '../engine/encumbrance';
import { zdeRadiusTiles, spellRangeTiles } from '../engine/magic';
import { resolveFormula } from '../engine/ops';
import { spellSpecFor } from '../data/spellspecs';
import { findSpell } from '../data';
import { bus, EVT } from '../state/bus';
import { isOutOfAction, canTakeAction, hasCondition } from '../engine/conditions';
import { Combatant } from '../engine/types';
import {
  TW,
  TH,
  CELL,
  Dims,
  tileCenter,
  diamondPath,
  diamondCorners,
  stageSize,
  screenToTile,
  screenToTileAtZ,
  depth,
  floorDepth,
} from './iso';
import {
  DEFS,
  terrainOverlay,
  placeSprite,
  pnjSprite,
  entitySprite,
} from './sprites';
import { BodyToken } from './BodyToken';
import { pickBackend } from './pickBackend';
import { MountedToken } from './MountedToken';
import { groundTile } from './ground';
import { wallSeg } from './walls';
import { getViewZ, subscribeViewZ, floorEmphasisOpacity } from './viewLevel';
import { buildingObj } from './BuildingSprite';
import { roofHidden } from '../state/buildings';
import { walkXY, STEP_MS } from './walkPath';
import { useCombatFx } from './fx/useCombatFx';
import { useWalkAnim } from './fx/useWalkAnim';
import { FxLayer } from './fx/FxLayer';
import { sizeTokenScale } from './sizeScale';
import { sizeFootprint, occupiesTile, decorFootGeometry } from '../state/footprint';
import { crowdEligible, eligibleAttackTargetIds, outOfSightTargetIds, castOutOfSightTargetIds, castSightBlocked, placingZoneOf, placedZoneValidAt, displayedReach, computeRunReach, movePreviewAt, previewResourceDelta, cleaveTargets, dualStrikeTargets, overcastTargetCandidates, smokeOf, trampleTarget, firedWeapon, frenzyTarget } from '../state/combatFlow';
import { hoverTargeting } from '../state/targeting';
import { controlsActive } from '../state/netOwnership';
import { hoverClickCommits } from '../ui/pointerCaps';
import { TargetReticle } from './TargetReticle';
import { entitySize } from '../state/spawn';
import { isRider, isMount, riderOf } from '../state/mount';
import { HERO_RING, ENEMY_RING, tileTint, veilTint, teamShape } from './teamColors';
import { summarizeEffects, combatantFlags } from './effectIcons';
import { setVisibleTileBounds } from './viewport';
/** Distance de combat (Chebyshev, cases). 1 case = 2 m (LDB Déplacement). */
const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const ZOOM_MIN = 0.4; // dézoom tactique large (cf. store.setZoom)
const ZOOM_MAX = 2.6;
const PAN_THRESHOLD = 6; // px de glissement avant de passer en panoramique (sinon = clic)

// Viewport virtuel : le SVG remplit tout l'espace dispo (preserveAspectRatio
// slice) et la caméra recadre autour du point focal (groupe / combattant actif).
const VW = 1100;
const VH = 720;
const AMBIANCE_DEFS = `
  <radialGradient id="g_warm" cx="55%" cy="24%" r="78%"><stop offset="0%" stop-color="#ffce78" stop-opacity="0.10"/><stop offset="100%" stop-color="#ffce78" stop-opacity="0"/></radialGradient>
  <radialGradient id="g_vig" cx="50%" cy="48%" r="60%"><stop offset="52%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#05040a" stop-opacity="0.58"/></radialGradient>`;

/** Tracé d'un DÉPLACEMENT (chemin + case d'arrivée + badge d'action) — source unique du rendu,
 *  partagée entre l'aperçu tap-1 (battle.preview, tactile) et l'aperçu au SURVOL (desktop). */
function movePreviewEls(path: { x: number; y: number }[], dest: { x: number; y: number } | null, label: string | null, d: Dims, keyPrefix: string): JSX.Element[] {
  const els: JSX.Element[] = [];
  if (path.length > 1) {
    const pts = path.map((p) => tileCenter(p.x, p.y, d)).map((p) => `${p.cx},${p.cy}`).join(' ');
    els.push(<polyline key={`${keyPrefix}-path`} points={pts} fill="none" stroke="#ffd75e" strokeWidth={3} opacity={0.9} pointerEvents="none" />);
  }
  if (dest) els.push(<path key={`${keyPrefix}-dest`} d={diamondPath(dest.x, dest.y, d)} fill="none" stroke="#ffd75e" strokeWidth={3} opacity={0.95} pointerEvents="none" />);
  const at = dest ?? (path.length ? path[path.length - 1] : null);
  if (label && at) {
    const c0 = tileCenter(at.x, at.y, d);
    els.push(<text key={`${keyPrefix}-lbl`} x={c0.cx} y={c0.cy - 28} textAnchor="middle" className="pv-badge" pointerEvents="none">{label}</text>);
  }
  return els;
}

/** Case adjacente (8-voisins) libre et ATTEIGNABLE la plus proche d'un décor, pour le move-to-interact
 *  (P5). À l'ÉTAGE du décor (un PNJ de loge s'aborde depuis une case de loge voisine, même z). */
function adjacentWalkable(sc: GameScene, target: Pt, from: Pt): Pt | null {
  const tz = target.z ?? 0;
  let best: Pt | null = null;
  let bestLen = Infinity;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const c: Pt = tz ? { x: target.x + dx, y: target.y + dy, z: tz } : { x: target.x + dx, y: target.y + dy };
      if (!isWalkable(sc, c.x, c.y, tz)) continue;
      const p = pathTo(sc, from, c, new Set());
      if (p && p.length < bestLen) {
        best = c;
        bestLen = p.length;
      }
    }
  }
  return best;
}

export function IsoStage() {
  const scene = useGame((s) => s.scene);
  const mode = useGame((s) => s.mode);
  const partyPos = useGame((s) => s.partyPos);
  const party = useGame((s) => s.party);
  const battle = useGame((s) => s.battle);
  const gameTime = useGame((s) => s.gameTime);
  const lightLevel = useGame((s) => s.lightLevel);
  const dialogue = useGame((s) => s.dialogue);
  // Télégraphe ENNEMI (« qui l'adversaire vise ») — le ciblage du JOUEUR a son propre réticule
  // (survol hoverAim + jets à cible pendants), même rendu partagé (TargetReticle).
  const enemyAim = useGame((s) => s.enemyAim);
  // COOP : le tour du héros d'un AUTRE joueur s'affiche comme un tour ennemi — AUCUNE affordance
  // (grille de déplacement, visée au survol, anneaux de cible, clics). Source unique : netFlow.
  const myTurn = useGame(controlsActive);
  const planView = useGame((s) => s.pendingRoundStart?.round === 1); // ouverture du combat : cadrer tout le champ
  const pendingAttack = useGame((s) => s.pendingAttack);
  const pendingCast = useGame((s) => s.pendingCast);
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
  const rotateCam = useGame((s) => s.rotateCam);
  const viewMode = useGame((s) => s.viewMode);
  const camPan = useGame((s) => s.camPan);
  const panCamBy = useGame((s) => s.panCamBy);
  const resetCamPan = useGame((s) => s.resetCamPan);
  const [shownRot, setShownRot] = useState<0 | 1 | 2 | 3>(camRot);
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
  const prevCamRot = useRef(camRot);
  useEffect(() => {
    if (prevCamRot.current === camRot) return;
    prevCamRot.current = camRot;
    setTurning(true);
    const t1 = window.setTimeout(() => setShownRot(camRot), 130); // swap au creux
    const t2 = window.setTimeout(() => setTurning(false), 260); // remontée
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [camRot]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useGame.getState().dialogue) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) || ae.isContentEditable)) return;
      // e.key (la LETTRE) → touches Q/E étiquetées, AZERTY comme QWERTY.
      const k = e.key.toLowerCase();
      if (k === 'e') rotateCam(1);
      else if (k === 'q') rotateCam(-1);
      else if (e.key === 'Escape') {
        // Échap purge l'aperçu tap-1 du modèle de clic implicite.
        const st = useGame.getState();
        if (st.battle?.preview) useGame.setState({ battle: { ...st.battle, preview: null } });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rotateCam]);

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
  // Planchers fusionnés dans le tri de profondeur GLOBAL (objs) : chaque étage porte une profondeur de
  // bande unique (floorDepth) le plaçant sous SES objets et au-dessus de tout le niveau inférieur — un
  // sol haut SURPLOMBE ainsi les tokens du sol. Tuiles « vide » non rendues (on voit le dessous).
  // « Un étage à la fois » : l'étage ACTIF (celui du groupe, ou du combattant dont c'est le tour) se rend
  // PLEIN, les autres en FANTÔME léger → on distingue enfin le sol, l'étage en surplomb et la fosse au
  // lieu d'un magma de bois superposé. Override DEBUG : devtool `__wfrp.viewLevel(z)`.
  const viewZ = useSyncExternalStore(subscribeViewZ, getViewZ, getViewZ);
  const activePos = mode === 'battle' && battle ? (battle.combatants.find((c) => c.id === battle.order[battle.turn])?.pos as { z?: number } | undefined) : undefined;
  const activeZ = viewZ ?? (activePos?.z ?? partyPos.z ?? 0);

  const floorObjs = useMemo<{ d: number; el: JSX.Element }[]>(() => {
    if (!scene) return [];
    const d: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode };
    const out: { d: number; el: JSX.Element }[] = [];
    for (const lvl of [...scene.levels].sort((a, b) => a.z - b.z)) {
      const fd = floorDepth(d, lvl.z);
      const op = floorEmphasisOpacity(lvl.z, activeZ);
      for (let y = 0; y < d.h; y++)
        for (let x = 0; x < d.w; x++) {
          const html = groundTile(scene, x, y, d, lvl.z);
          if (html) out.push({ d: fd, el: <g key={`f${lvl.z}-${x}-${y}`} opacity={op} dangerouslySetInnerHTML={{ __html: html }} /> });
        }
    }
    return out;
  }, [scene, shownRot, viewMode, activeZ]);

  // Murs sur arêtes (cloisons fines) : quads verticaux dressés sur les arêtes de case, fusionnés dans
  // le tri de profondeur global (un mur avant occulte ce qui est derrière ; les portes sont ajourées).
  const wallObjs = useMemo<{ d: number; el: JSX.Element }[]>(() => {
    if (!scene?.walls?.length) return [];
    const d: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode };
    // Gated par étage comme les sols : un mur d'un autre niveau passe en fantôme (plus de « fusion » des
    // cloisons du rez et de l'étage).
    return (scene.walls).map((w, i) => {
      const seg = wallSeg(w, d);
      return { d: seg.d, el: <g key={`wall-${i}`} opacity={floorEmphasisOpacity(w.z ?? 0, activeZ)} dangerouslySetInnerHTML={{ __html: seg.svg }} /> };
    });
  }, [scene, shownRot, viewMode, activeZ]);

  const decorObjs = useMemo<{ d: number; el: JSX.Element }[]>(() => {
    if (!scene) return [];
    const d: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode };
    // Tuiles occupées par un ACTEUR — pour estomper l'arbre/mur qui masquerait un personnage derrière.
    const actorTiles: { x: number; y: number }[] = [];
    if (mode === 'battle' && battle) {
      for (const c of battle.combatants) if (c.pos && !isOutOfAction(c)) actorTiles.push(c.pos);
    } else {
      actorTiles.push(partyPos);
      for (const ent of scene.entities) if (ent.kind === 'personnage' && !ent.combat?.hiddenUntilCombat) actorTiles.push(ent.pos);
    }
    const occludesActor = (tx: number, ty: number) =>
      actorTiles.some((a) => a.x + a.y < tx + ty && Math.abs(a.x - a.y - (tx - ty)) <= 1 && tx + ty - (a.x + a.y) <= 7);
    const out: { d: number; el: JSX.Element }[] = [];
    for (let y = 0; y < d.h; y++)
      for (let x = 0; x < d.w; x++) {
        const ov = terrainOverlay(tileAt(scene, x, y), x, y, d);
        if (ov)
          out.push({
            d: ov.d,
            el: (
              <g key={`ov${x}-${y}`} style={{ opacity: occludesActor(x, y) ? 0.4 : 1, transition: 'opacity 0.25s' }} dangerouslySetInnerHTML={{ __html: ov.html }} />
            ),
          });
      }
    return out;
  }, [scene, shownRot, viewMode, mode, battle, partyPos]);

  const buildingObjs = useMemo<{ d: number; el: JSX.Element }[]>(() => {
    if (!scene) return [];
    const d: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode };
    const allies =
      mode === 'battle' && battle
        ? battle.combatants.filter((c) => c.kind === 'hero' && c.pos).map((c) => c.pos!)
        : [partyPos];
    const night = sceneIsDark(scene, gameTime); // jour/nuit = horloge (#T1c)
    return (scene.buildings ?? []).map((b) => buildingObj(b, d, roofHidden(b, allies), night));
  }, [scene, shownRot, viewMode, mode, battle, partyPos, gameTime]);

  // Grisage hors-LdV : ennemis que le héros actif ne peut PAS viser au tir faute de Ligne de Vue
  // (LDB 13 l.123) → pion fantomatique. Distingue « hors LdV » de « hors de portée » (aucun
  // n'a d'anneau rouge). Actif pendant la visée — mode neutre (attaque implicite au clic) ou
  // catégorie Tir ouverte — tant que l'Action n'est pas consommée.
  const ghostIds = useMemo<Set<string>>(() => {
    if (mode !== 'battle' || !battle || battle.over) return new Set();
    // Mode incantation : grisage hors-LdV du SORT (LDB 46 l.170), indépendant de l'arme portée.
    if (battle.action === 'cast' && battle.selectedSpell) return castOutOfSightTargetIds(useGame.getState);
    if (battle.acted || battle.action !== null) return new Set();
    return outOfSightTargetIds(useGame.getState);
  }, [scene, mode, battle]);

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
    if (mode !== 'battle' || !battle || battle.over || !hover || !myTurn) return null;
    // Un jet à cible est déjà en cours (modale) : le réticule PERSISTANT prend le relais au rendu.
    if (pendingAttack || pendingDefense || pendingTrample || pendingHeal || (pendingCast && !pendingCast.pickingTargets)) return null;
    const occ = battle.combatants.find((c) => c.pos && !isOutOfAction(c) && occupiesTile(c.pos, c.size, hover.x, hover.y));
    if (!occ) return null;
    const st = useGame.getState;
    // Flux différés (bandeau TargetPrompt) : validité = appartenance aux ensembles candidats existants.
    if (pendingCleave) {
      const atk = battle.combatants.find((c) => c.id === pendingCleave.attackerId);
      const ok = !!atk && cleaveTargets(battle, atk, pendingCleave.hitIds).some((t) => t.id === occ.id);
      return ok ? { fromId: atk!.id, toId: occ.id, line: 'solid', tip: null, reticle: true } : null;
    }
    if (pendingDualStrike) {
      const atk = battle.combatants.find((c) => c.id === pendingDualStrike.attackerId);
      const off = atk?.weapons.find((w) => w.uid === pendingDualStrike.offWeaponUid);
      const ok = !!atk && !!off && dualStrikeTargets(battle, atk, off).some((t) => t.id === occ.id);
      return ok ? { fromId: atk!.id, toId: occ.id, line: 'solid', tip: null, reticle: true } : null;
    }
    if (pendingCast?.pickingTargets) {
      const caster = battle.combatants.find((c) => c.id === pendingCast.casterId);
      const spell = findSpell(pendingCast.spellLabel);
      const ok = !!caster && !!spell && !!scene &&
        overcastTargetCandidates(battle.combatants, caster, pendingCast.targetId, spell, !!pendingCast.missile, { scene, smoke: smokeOf(battle) }).some((t) => t.id === occ.id);
      return ok ? { fromId: caster!.id, toId: occ.id, line: 'dashed', tip: null, reticle: true } : null;
    }
    const activeH = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
    if (!activeH || activeH.kind !== 'hero' || !activeH.pos) return null;
    // Mêmes verrous que battleClickEntity : Action consommée (sauf attaque libre de Frénésie),
    // Sonné/Brisé, cible de Frénésie IMPOSÉE (le plus proche en LdV).
    const freeFrenzy = battle.action === null && !!activeH.frenzied && !activeH.frenzyFreeUsed;
    if (battle.acted && !freeFrenzy) return null;
    if (battle.action === null && (!canTakeAction(activeH) || hasCondition(activeH, 'Brisé'))) return null;
    if (battle.action === null && activeH.frenzied) {
      const ft = frenzyTarget(st, activeH);
      if (ft && ft.id !== occ.id) return null;
    }
    // Piétinement : mêmes prédicats que battleTrample (≥1 Avantage, adjacent plus petit).
    if (battle.action === 'trample') {
      const ok = (activeH.advantage ?? 0) >= 1 && !!trampleTarget(battle, activeH, occ.id);
      return ok ? { fromId: activeH.id, toId: occ.id, line: 'solid', tip: null, reticle: true } : null;
    }
    const ht = hoverTargeting(st, activeH, occ);
    if (ht.kind === 'none') return null;
    if (ht.kind === 'invalid') {
      const text = ht.reason === 'los' ? '⛔ pas de ligne de vue' : ht.reason === 'engaged' ? '⛔ Engagé — se désengager' : '⛔ hors de portée';
      return { fromId: null, toId: occ.id, line: null, tip: { kind: 'err', text }, reticle: false };
    }
    return { fromId: activeH.id, toId: occ.id, line: ht.line, path: ht.path, tip: { kind: 'info', title: ht.title, skill: ht.skill, base: ht.base, mod: ht.mod, dmg: ht.dmg, note: ht.note }, preview: ht.preview, reticle: true };
  }, [hover, mode, battle, scene, myTurn, pendingAttack, pendingDefense, pendingCast, pendingCleave, pendingDualStrike, pendingTrample, pendingHeal]);

  // Aperçu de DÉPLACEMENT au SURVOL (desktop) : le chemin + le coût se matérialisent sous la
  // souris, le clic UNIQUE commet — le tap-1 (battle.preview) reste le flux tactile. Mêmes
  // sources que le clic (movePreviewAt) ; memoïsé : pathTo ne tourne pas à 60 Hz.
  const hoverMove = useMemo<{ kind: 'move' | 'run'; path: { x: number; y: number }[]; cost: number } | null>(() => {
    if (mode !== 'battle' || !battle || battle.over || !hover || battle.preview || !myTurn) return null;
    if (pendingAttack || pendingDefense || pendingTrample || pendingHeal || pendingCast || pendingCleave || pendingDualStrike) return null;
    const occ = battle.combatants.find((c) => c.pos && !isOutOfAction(c) && occupiesTile(c.pos, c.size, hover.x, hover.y));
    if (occ) return null; // une cible a sa propre visée (hoverAim)
    return movePreviewAt(useGame.getState, hover);
  }, [hover, mode, battle, myTurn, pendingAttack, pendingDefense, pendingCast, pendingCleave, pendingDualStrike, pendingTrample, pendingHeal]);

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
  const staticHighlights = useMemo<JSX.Element[]>(() => {
    if (!scene || mode !== 'battle' || !battle) return [];
    const d: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode };
    const hl: JSX.Element[] = [];
    const activeC = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
    // COOP : le tour du héros d'un AUTRE joueur s'affiche comme un tour ennemi — aucune affordance
    // (ni grille de déplacement, ni anneaux de cible, ni aperçu) ; teintes d'équipe/zones restent.
    // (Plus AUCUN indicateur de distance au sol — ni bandes de tir ni portée de sort : la portée se
    // lit au survol — réticule présent = cible valide, ⛔ sinon. Seuls marche/course restent.)
    // Portée de Marche AFFICHÉE EN PERMANENCE au tour d'un héros (modèle de clic implicite) :
    // budget spécial stocké (post-Désengagement) prioritaire, sinon Marche restante dérivée.
    const walkReach = myTurn ? displayedReach(useGame.getState) : new Map<string, number>();
    for (const k of walkReach.keys()) {
      const [x, y] = k.split(',').map(Number);
      hl.push(<path key={`h${k}`} d={diamondPath(x, y, d)} fill="#4f8fe0" opacity={0.32} />);
    }
    // Zone de COURSE (LDB 15 l.79-82) au-delà de la Marche, dans une AUTRE couleur : y cliquer
    // demandera le Test d'Athlétisme, et le jet peut porter moins loin que la case visée.
    if (myTurn)
      for (const k of computeRunReach(useGame.getState).keys()) {
        if (walkReach.has(k)) continue;
        const [x, y] = k.split(',').map(Number);
        hl.push(<path key={`r${k}`} d={diamondPath(x, y, d)} fill="#9b6be0" opacity={0.24} />);
      }
    // Aperçu tap-1 (tactile) : chemin + case d'arrivée + badge — MÊME rendu que le survol desktop
    // (movePreviewEls, source unique du tracé de déplacement).
    const pv = myTurn ? battle.preview : null;
    if (pv) {
      const pvTgt = 'targetId' in pv ? battle.combatants.find((c) => c.id === pv.targetId) : undefined;
      const pvDest = pv.kind === 'move' || pv.kind === 'run' ? pv.tile : pv.kind === 'attack' ? pvTgt?.pos : pv.dest;
      const pvLbl = pv.kind === 'move' ? `Aller (${pv.cost})` : pv.kind === 'run' ? 'Courir' : pv.kind === 'charge' ? (pv.adv ? 'Charger (+1 Av)' : 'Charger') : pv.kind === 'moveAttack' ? 'Rejoindre + attaquer' : 'Attaquer';
      hl.push(...movePreviewEls(pv.kind === 'attack' ? [] : pv.path, pvDest ?? null, pvLbl, d, 'pv'));
      if (pvTgt?.pos) hl.push(<path key="pv-tgt" d={diamondPath(pvTgt.pos.x, pvTgt.pos.y, d)} fill="#ffd75e" opacity={0.18} pointerEvents="none" />);
    }
    // Teinte d'équipe des CASES occupées (choix C, Lot 1) : allié vert / ennemi rouge / actif jaune.
    for (const c of battle.combatants) {
      if (!c.pos || isOutOfAction(c)) continue;
      const isActiveC = c.id === activeC?.id;
      const fill = tileTint(c.kind === 'hero', isActiveC);
      const fp = sizeFootprint(c.size);
      for (let dx = 0; dx < fp; dx++)
        for (let dy = 0; dy < fp; dy++)
          hl.push(<path key={`tt${c.id}-${dx}-${dy}`} d={diamondPath(c.pos.x + dx, c.pos.y + dy, d)} fill={fill} opacity={isActiveC ? 0.3 : 0.2} pointerEvents="none" />);
    }
    // Zones persistantes (L11) : fumée opaque en gris ; zones de feu/effet (Mur de feu,
    // Grands feux) en orange translucide — l'occupant voit le danger.
    for (const z of battle.zones ?? []) {
      const fill = z.blocksLoS ? '#9aa0a6' : '#e2641e';
      for (const t of z.tiles) {
        hl.push(<path key={`zone-${z.label}-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, d)} fill={fill} opacity={z.blocksLoS ? 0.5 : 0.35} pointerEvents="none" />);
      }
    }
    // Cibles VALIDES de l'attaque (R4) : anneau « cliquable pour attaquer » — en mode neutre
    // (attaque implicite), tant que l'Action est disponible (ou attaque libre de Frénésie).
    if (myTurn && battle.action === null && activeC?.kind === 'hero' && !pendingAttack && (!battle.acted || (activeC.frenzied && !activeC.frenzyFreeUsed))) {
      const eligible = eligibleAttackTargetIds(useGame.getState);
      for (const c of battle.combatants) {
        if (!c.pos || !eligible.has(c.id)) continue;
        hl.push(<path key={`tgt-${c.id}`} d={diamondPath(c.pos.x, c.pos.y, d)} fill="none" stroke="#ff5a4d" strokeWidth={2.5} opacity={0.9} pointerEvents="none" />);
      }
    }
    // « Tirer dans le tas » : cibles ÉLIGIBLES touchables au hasard.
    if (pendingAttack?.intoCrowd) {
      const atk = battle.combatants.find((c) => c.id === pendingAttack.attackerId);
      const tgt = battle.combatants.find((c) => c.id === pendingAttack.targetId);
      if (atk && tgt)
        for (const v of crowdEligible(battle, atk, tgt)) {
          if (!v.pos) continue;
          hl.push(<path key={`crowd-${v.id}`} d={diamondPath(v.pos.x, v.pos.y, d)} fill="#ff7a3c" opacity={0.34} stroke="#ff7a3c" strokeWidth={2} pointerEvents="none" />);
        }
    }
    // Ciblage CHAMP DE BATAILLE des flux différés (bandeau TargetPrompt) : anneau sur les cibles
    // cliquables — Frappe Mortelle / 2ᵉ frappe (Deux armes) / Surincantation « +Cible ».
    if (myTurn && !pendingAttack) {
      const ring = (c: Combatant, key: string, color = '#ff5a4d') =>
        hl.push(<path key={key} d={diamondPath(c.pos!.x, c.pos!.y, d)} fill="none" stroke={color} strokeWidth={2.5} opacity={0.9} pointerEvents="none" />);
      if (pendingCleave) {
        const atk = battle.combatants.find((c) => c.id === pendingCleave.attackerId);
        if (atk) for (const t of cleaveTargets(battle, atk, pendingCleave.hitIds)) if (t.pos) ring(t, `clv-${t.id}`);
      }
      if (pendingDualStrike) {
        const atk = battle.combatants.find((c) => c.id === pendingDualStrike.attackerId);
        const off = atk?.weapons.find((w) => w.uid === pendingDualStrike.offWeaponUid);
        if (atk && off) for (const t of dualStrikeTargets(battle, atk, off)) if (t.pos) ring(t, `dsk-${t.id}`);
      }
      if (pendingCast?.pickingTargets) {
        const caster = battle.combatants.find((c) => c.id === pendingCast.casterId);
        const spell = findSpell(pendingCast.spellLabel);
        if (caster && spell)
          for (const t of overcastTargetCandidates(battle.combatants, caster, pendingCast.targetId, spell, !!pendingCast.missile, { scene, smoke: smokeOf(battle) })) {
            // Cibles déjà cochées en vert (re-cliquer décoche), candidates restantes en rouge.
            if (t.pos) ring(t, `oct-${t.id}`, (pendingCast.extraTargetIds ?? []).includes(t.id) ? '#5db87a' : '#ff5a4d');
          }
      }
    }
    return hl;
  }, [scene, shownRot, viewMode, mode, battle, myTurn, pendingAttack, pendingCleave, pendingDualStrike, pendingCast]);

  // Tokens des ENTITÉS de scène (exploration) memoïsés : ils ne BOUGENT pas pendant que le groupe
  // marche (seul le leader glisse, rendu à part). Sans ça, le rAF de marche (setWalkTick) re-rendait
  // les ~180 modèles de la galerie à chaque frame EN PLUS de leur propre anim → saccade. Réfs d'éléments
  // stables → React saute ces sous-arbres ; chaque créature continue de s'auto-animer via SON rAF
  // (usePlanAnim/useRigClip), indépendamment du re-rendu d'IsoStage.
  const entityObjs = useMemo<{ d: number; el: JSX.Element }[]>(() => {
    if (!scene) return [];
    const inBattle = mode === 'battle' && !!battle;
    const d: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode };
    const isTop = viewMode === 'top';
    const discRfn = (sz: Combatant['size']) => (sizeFootprint(sz) * CELL) / 2 * 0.85;
    const out: { d: number; el: JSX.Element }[] = [];
    // En combat, les FIGURANTS (PNJ d'ambiance : spectateurs, prisonnier en cage…) ne « dépop »
    // plus — ils restent visibles, estompés et NON interactifs ; on ne les dessine pas si un
    // combattant occupe leur case (pas d'empilement de corps).
    const covered = (x: number, y: number) =>
      inBattle && battle!.combatants.some((c) => c.pos && !isOutOfAction(c) && occupiesTile(c.pos, c.size, x, y));
    const wrap = (key: string, el: JSX.Element) =>
      inBattle ? (
        <g key={`fig-${key}`} opacity={0.7} pointerEvents="none">
          {el}
        </g>
      ) : (
        el
      );
    for (const ent of scene.entities) {
      if (ent.kind === 'heroStart' || ent.kind === 'prop') continue;
      if (ent.combat?.hiddenUntilCombat) continue; // ennemi d'embuscade : invisible avant le combat
      const ez = ent.z ?? 0;
      if (!ez && covered(ent.pos.x, ent.pos.y)) continue; // l'occlusion par décor ne vaut qu'au sol
      const r = pickBackend({ kind: 'sceneEntity', ent }, viewMode);
      if (r.backend === 'sprite') {
        out.push({
          d: depth(ent.pos.x, ent.pos.y, d, ez),
          el: wrap(
            r.id,
            <BodyToken key={r.id} x={ent.pos.x} y={ent.pos.y} z={ez + elevAt(scene, ent.pos.x, ent.pos.y, ez)} dims={d} scale={0.55} fx={ent.anim}>
              <g dangerouslySetInnerHTML={{ __html: entitySprite(ent) }} />
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
          el: wrap(
            r.id,
            <BodyToken key={r.id} x={ex} y={ey} z={ez + elevAt(scene, ent.pos.x, ent.pos.y, ez)} dims={d} scale={base * r.speciesScale * sizeTokenScale(entitySize(ent))} bakedDeath flat={isTop} portraitBox={r.portraitBox} discR={discRfn(entitySize(ent))}>
              {r.body}
            </BodyToken>,
          ),
        });
      }
    }
    return out;
  }, [scene, shownRot, viewMode, mode, battle]);

  if (!scene) return null;
  const dims: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode };
  const size = stageSize(dims);
  // Vue du dessus : les acteurs deviennent des pions-portraits (disques). Rayon = empreinte × ½ case.
  const top = viewMode === 'top';
  const discR = (sz: Combatant['size']) => (sizeFootprint(sz) * CELL) / 2 * 0.85;

  // Position VISUELLE d'un token : interpolée le long du chemin si une marche est en cours
  // (anti-téléportation), sinon la position logique. Défini TÔT pour que les surbrillances (halo
  // d'actif) ET la caméra suivent le token qui GLISSE — et non sa destination logique déjà écrite.
  const wnow = performance.now();
  const walkPosOf = (id: string, x: number, y: number) => {
    const w = walksRef.current[id];
    if (!w) return { x, y, walking: false };
    const p = walkXY(w.path, wnow - w.start, STEP_MS);
    return { x: p.x, y: p.y, walking: true };
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
    (((battle.action === null || battle.action === 'cast' || battle.action === 'trample') && activeC?.kind === 'hero') ||
      !!pendingCleave || !!pendingDualStrike || !!pendingCast?.pickingTargets || !!placingZoneOf({ pendingCast, battle }));

  // --- Surbrillances de combat : grilles LOURDES memoïsées + éléments DYNAMIQUES (suivent le
  //     token qui glisse : tether d'engagement, halo de l'actif) recalculés à la frame (peu coûteux). ---
  const highlights: JSX.Element[] = [...staticHighlights];
  if (mode === 'battle' && battle) {
    // État ENGAGÉ (R7) : tether de mêlée entre paires Engagées (zone de contrôle). Dédupliqué (id < otherId).
    for (const c of battle.combatants) {
      if (!c.pos || isOutOfAction(c)) continue;
      for (const oid of c.engagedWith ?? []) {
        if (c.id >= oid) continue; // une seule ligne par paire
        const o = battle.combatants.find((x) => x.id === oid);
        if (!o?.pos || isOutOfAction(o)) continue;
        const pa = walkPosOf(c.id, c.pos.x, c.pos.y);
        const pb = walkPosOf(o.id, o.pos.x, o.pos.y);
        const ca = tileCenter(pa.x, pa.y, dims);
        const cb = tileCenter(pb.x, pb.y, dims);
        highlights.push(<line key={`eng-${c.id}-${oid}`} x1={ca.cx} y1={ca.cy} x2={cb.cx} y2={cb.cy} stroke="#d98a3a" strokeWidth={2} strokeDasharray="4 3" opacity={0.6} pointerEvents="none" />);
      }
    }
    if (activeC?.pos) {
      const ap = walkPosOf(activeC.id, activeC.pos.x, activeC.pos.y); // le halo SUIT le token qui glisse
      highlights.push(
        <path key="active" d={diamondPath(ap.x, ap.y, dims)} fill="none" stroke="#ffe066" strokeWidth={3} />,
      );
    }
  }
  if (mode === 'exploration' && !dialogue)
    highlights.push(<path key="party-pos" d={diamondPath(partyPos.x, partyPos.y, dims)} fill="none" stroke="#ffe066" strokeWidth={1.5} opacity={0.5} />);

  // --- Objets triés par profondeur (murs, arbres, entités, tokens) ---
  type Obj = { d: number; el: JSX.Element };
  const objs: Obj[] = [];

  // décor statique + bâtiments multi-tuiles : éléments memoïsés (cf. decorObjs/buildingObjs), juste
  // ré-insérés dans le tri de profondeur (leurs `el` gardent une réf stable → React saute le sous-arbre).
  // Planchers (floorObjs) et surbrillances au sol participent au MÊME tri : un sol haut surplombe les
  // tokens du bas, et les surbrillances (z=0) restent au-dessus du sol mais sous tout le reste.
  objs.push(...floorObjs, ...wallObjs, ...decorObjs, ...buildingObjs);
  objs.push({ d: floorDepth(dims, 0) + 0.25, el: <g key="ground-overlays">{highlights}</g> });

  // token()/tokenNode() : adaptateurs minces vers la coquille partagée BodyToken (positionnement
  // unique). token() = corps SVG string ; tokenNode() = enfant React (rig) dont la mort est déjà
  // bakée (CORPSE_POSE / pose effondrée) → pas de bascule externe (bakedDeath).
  // Pieds d'un token : l'étage z + l'élévation LOCALE de sa case (scène surélevée / fosse). tileCenter
  // soulève d'un z fractionnaire → le pion monte/descend avec son sol ; la PROFONDEUR (tri) reste à z
  // entier (calculée par l'appelant), l'élévation est purement positionnelle.
  const feetZ = (x: number, y: number, z = 0) => z + elevAt(scene, Math.round(x), Math.round(y), z);

  const token = (id: string, x: number, y: number, inner: string, scale: number, ringColor?: string, dim?: boolean, fx?: string, walking?: boolean, bakedDeath?: boolean, z = 0) => (
    <BodyToken key={id} x={x} y={y} z={feetZ(x, y, z)} dims={dims} scale={scale} ring={ringColor} dim={dim} walking={walking} fx={fx} bakedDeath={bakedDeath}>
      <g dangerouslySetInnerHTML={{ __html: inner }} />
    </BodyToken>
  );

  type TokenExtras = { hp?: { current: number; max: number }; icons?: string[]; iconsMore?: number; veil?: string; active?: boolean; ringDash?: string; flat?: boolean; portraitBox?: string; discR?: number; ghost?: boolean; cid?: string };
  const tokenNode = (id: string, x: number, y: number, child: ReactNode, scale: number, ringColor?: string, dim?: boolean, walking?: boolean, extras?: TokenExtras, z = 0) => (
    <BodyToken key={id} x={x} y={y} z={feetZ(x, y, z)} dims={dims} scale={scale} ring={ringColor} ringDash={extras?.ringDash} dim={dim} ghost={extras?.ghost} walking={walking} bakedDeath
      hp={extras?.hp} icons={extras?.icons} iconsMore={extras?.iconsMore} veil={extras?.veil} active={extras?.active}
      flat={extras?.flat} portraitBox={extras?.portraitBox} discR={extras?.discR} cid={extras?.cid}>
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
    const fg = decorFootGeometry(ent.foot);
    const px = ent.pos.x + fg.offX, py = ent.pos.y + fg.offY;
    const pd = depth(ent.pos.x + (ent.foot ? ent.foot.w - 1 : 0), ent.pos.y + (ent.foot ? ent.foot.h - 1 : 0), dims, ez);
    if (ent.interact) {
      // Affordance : halo pulsé + onde « sonar » au sol, et étincelle dorée flottant AU-DESSUS du
      // décor fouillable — l'objet cliquable se repère de loin, sans texte (cf. anim.css).
      const c = tileCenter(px, py, dims, feetZ(px, py, ez));
      objs.push({
        d: pd - 0.02, // juste sous le sprite
        el: (
          <g key={`halo-${ent.id}`} pointerEvents="none">
            <g className="interact-halo">
              <ellipse cx={c.cx} cy={c.cy + 4} rx={17 * fg.scale} ry={8.5 * fg.scale} fill="#ffe27a" opacity={0.26} />
              <ellipse cx={c.cx} cy={c.cy + 4} rx={17 * fg.scale} ry={8.5 * fg.scale} fill="none" stroke="#ffd75e" strokeWidth={2} opacity={0.9} />
            </g>
            <ellipse className="halo-ping" cx={c.cx} cy={c.cy + 4} rx={17 * fg.scale} ry={8.5 * fg.scale} fill="none" stroke="#ffd75e" strokeWidth={1.6} />
          </g>
        ),
      });
      objs.push({
        d: pd + 0.02, // au-dessus du sprite : l'étincelle « il y a quelque chose ici »
        el: (
          <g key={`spark-${ent.id}`} className="halo-spark" pointerEvents="none" transform={`translate(${c.cx + 9 * fg.scale}, ${c.cy - 26 * fg.scale})`}>
            <path d="M0,-6 L1.7,-1.7 L6,0 L1.7,1.7 L0,6 L-1.7,1.7 L-6,0 L-1.7,-1.7 Z" fill="#ffd75e" stroke="#7a5b16" strokeWidth={0.7} />
          </g>
        ),
      });
    }
    objs.push({ d: pd, el: token(`e-${ent.id}`, px, py, entitySprite(ent), 0.55 * fg.scale, undefined, false, ent.anim, false, false, ez) });
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
      const isHero = c.kind === 'hero';
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
      const off = (sizeFootprint(c.size) - 1) / 2; // ancre (coin NO) → centre du bloc
      const cx = wp.x + off, cy = wp.y + off;
      const fxSum = summarizeEffects(c.conditions, c.activeEffects, 3, combatantFlags(c));
      const el = tokenNode(r.id, cx, cy, r.body, 0.62 * r.speciesScale * sizeTokenScale(c.size), ring, isOutOfAction(c), wp.walking, {
        hp: c.wounds,
        icons: fxSum.visible.map((v) => v.icon),
        iconsMore: fxSum.moreCount,
        veil: veilTint(isHero),
        active: c.id === activeC?.id,
        ringDash: teamShape(isHero), // R9 : ennemi = anneau pointillé (indice d'équipe non-coloré)
        flat: top,
        portraitBox: r.portraitBox,
        discR: discR(c.size),
        ghost: ghostIds.has(c.id), // hors-LdV du tireur actif → fantomatique
        cid: c.id, // ciblage DOM (recettes Playwright : survol/clic par data-cid)
      });
      objs.push({ d: depth(cx, cy, dims) + 0.5, el });
    }
    // Combat monté (LDB 14) : le couple CAVALIER+MONTURE est dessiné comme UN corps composite
    // (MountedToken) trié au niveau de l'os → vraie profondeur (jambe lointaine derrière le
    // barillet, buste derrière la tête). Un seul BodyToken à la tuile/échelle de la monture
    // (une ombre partagée). L'empreinte/échelle restent celles de la monture.
    if (!top) for (const mount of battle.combatants) {
      if (!isMount(mount) || !mount.pos) continue;
      const rider = riderOf(battle, mount);
      if (!rider) continue;
      const off = (sizeFootprint(mount.size) - 1) / 2;
      const wp = walkPosOf(mount.id, mount.pos.x, mount.pos.y); // suit l'animation de marche de la monture
      const cx = wp.x + off, cy = wp.y + off;
      const mountScale = 0.62 * pickBackend({ kind: 'combatant', combatant: mount }).speciesScale * sizeTokenScale(mount.size);
      const el = tokenNode(`${mount.id}-mtd`, cx, cy, <MountedToken mount={mount} rider={rider} />, mountScale, undefined, isOutOfAction(mount), wp.walking);
      objs.push({ d: depth(cx, cy, dims) + 0.5, el });
    }
  } else {
    // Entités de scène (créatures/PNJ d'ambiance) : tokens memoïsés (cf. entityObjs) — ré-insérés
    // dans le tri de profondeur, réfs stables → React saute leur re-rendu pendant la marche.
    objs.push(...entityObjs);
    // Affordance d'ENTRÉE des bâtiments : halo pulsé sur la tuile de PORTE (mêmes codes que la
    // fouille) — on voit d'un coup d'œil où l'on peut entrer (intérieur `door` comme cutaway).
    for (const b of scene.buildings ?? []) {
      if (!b.door) continue;
      const c = tileCenter(b.door.x, b.door.y, dims);
      objs.push({
        d: depth(b.door.x, b.door.y, dims) + 0.6, // au-dessus du mur de façade (même tuile)
        el: (
          <g key={`door-halo-${b.id}`} className="interact-halo" pointerEvents="none">
            <ellipse cx={c.cx} cy={c.cy + 4} rx={15} ry={7.5} fill="#ffe27a" opacity={0.16} />
            <ellipse cx={c.cx} cy={c.cy + 4} rx={15} ry={7.5} fill="none" stroke="#ffe27a" strokeWidth={1.5} opacity={0.65} />
          </g>
        ),
      });
    }
    // groupe — glisse le long du chemin (ANIM_MOVE émis par moveAlong)
    const wp = partyLeader ? walkPosOf(partyLeader.id, partyPos.x, partyPos.y) : { x: partyPos.x, y: partyPos.y, walking: false };
    const pZ = partyPos.z ?? 0; // le groupe se rend à son étage (loge) — token soulevé + trié au bon niveau
    const r = pickBackend({ kind: 'partyLeader', leader: partyLeader }, viewMode);
    const el =
      r.backend === 'sprite'
        ? token(r.id, partyPos.x, partyPos.y, pnjSprite(), 0.6, HERO_RING[0], false, undefined, false, false, pZ)
        : tokenNode(r.id, wp.x, wp.y, r.body, 0.6, HERO_RING[0], false, wp.walking, { flat: top, portraitBox: r.portraitBox, discR: discR(undefined) }, pZ);
    objs.push({ d: depth(wp.x, wp.y, dims, pZ) + 0.5, el });
  }
  objs.sort((a, b) => a.d - b.d);

  // --- Caméra : recadre autour du point focal (groupe / combattant actif) ---
  // Attaque/sort ENNEMI télégraphié (enemyAim) : ligne (pleine en mêlée, pointillée tir/sort) +
  // réticule + cadrage des deux. Le ciblage du JOUEUR a son propre réticule (survol + pending*).
  let targeting: { from: Combatant; to: Combatant; melee?: boolean } | null = null;
  if (mode === 'battle' && battle && enemyAim) {
    const a = battle.combatants.find((c) => c.id === enemyAim.fromId);
    const b = battle.combatants.find((c) => c.id === enemyAim.toId);
    if (a?.pos && b?.pos) targeting = { from: a, to: b, melee: enemyAim.melee };
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
  const fc = tileCenter(focus.x, focus.y, dims);
  // Caméra libre tactique : le suivi auto-cadre le point focal, + un décalage manuel (camPan) qu'on
  // accumule au glisser. Remis à zéro quand l'unité active change (refocus « sur celui qui joue après »).
  const cam = { x: VW / 2 - fc.cx + camPan.x, y: VH / 2 - fc.cy + camPan.y };

  // CULLING d'animation : publie le cadre VISIBLE (AABB en tuiles des 4 coins de la fenêtre projetés)
  // pour que les hooks d'anim (usePlanAnim/useRigClip) sautent le rAF des acteurs hors-champ. Recalculé
  // à chaque rendu (donc suit la caméra pendant la marche). Écriture dans un module = pas de re-rendu.
  {
    const toTile = (sx: number, sy: number) => screenToTile((sx - VW / 2) / zoom + VW / 2 - cam.x, (sy - VH / 2) / zoom + VH / 2 - cam.y, dims);
    const cs = [toTile(0, 0), toTile(VW, 0), toTile(0, VH), toTile(VW, VH)];
    const xs = cs.map((c) => c.x), ys = cs.map((c) => c.y);
    setVisibleTileBounds({ minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) });
  }

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
    // Picking multi-niveaux : on teste les étages du HAUT vers le bas et on retient la 1re tuile
    // RÉELLE (terrain présent, pas « vide ») sous le curseur — un plancher haut intercepte le clic
    // avant le parterre (cohérent avec son rendu en surplomb). z=0 (sol plein) est le filet final.
    for (const z of scene.levels.map((l) => l.z).sort((a, b) => b - a)) {
      const { x, y } = screenToTileAtZ(gx, gy, dims, z);
      if (x < 0 || y < 0 || x >= dims.w || y >= dims.h) continue;
      if (z > 0) { const ter = tileAt(scene, x, y, z); if (!ter || ter === 'vide') continue; }
      return z ? { x, y, z } : { x, y };
    }
    return null;
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
      const occ = st.battle?.combatants.find((c) => c.pos && occupiesTile(c.pos, c.size, x, y) && !isOutOfAction(c)); // clic sur N'IMPORTE quelle tuile de l'empreinte
      // En mode incantation — ou pendant le choix des cibles de Surincantation (carte) — on peut
      // cibler n'importe quel combattant (allié, ennemi ou soi) ; sinon seuls les ennemis sont
      // cliquables pour attaquer. Desktop (survol) : la visée a déjà tout montré → un clic COMMET
      // l'attaque ; tactile : deux-taps (tap 1 = aperçu) — cf. pointerCaps.
      if (occ && (occ.kind === 'enemy' || st.battle?.action === 'cast' || st.pendingCast?.pickingTargets)) st.battleClickEntity(occ.id, { confirm: hoverClickCommits() });
      else st.battleClickTile({ x, y }, { confirm: hoverClickCommits() });
      return;
    }
    const ent = sc.entities.find((e) => e.pos.x === x && e.pos.y === y && (e.z ?? 0) === tz);
    if (ent && (ent.dialogueId || !!ent.interact || !!ent.merchant)) {
      const dist = Math.max(Math.abs(st.partyPos.x - ent.pos.x), Math.abs(st.partyPos.y - ent.pos.y));
      if (dist <= 1) {
        st.setPendingInteract(null);
        st.interactEntity(ent.id); // adjacent → fouille / dialogue immédiat
      } else {
        // Déplacement-puis-fouille (P5) : marche vers une case adjacente libre, puis fouille à l'arrivée.
        const adj = adjacentWalkable(sc, ent.pos, st.partyPos);
        if (adj) {
          st.setPendingInteract(ent.id);
          moveAlong(sc, st.partyPos, adj);
        }
      }
      return;
    }
    if (ent && ent.kind === 'personnage') {
      // FIGURANT (PNJ sans dialogue/boutique/fouille) : on ne lui marche pas DESSUS — on s'approche
      // à une case adjacente et on le dit (sinon le groupe « entre dans » le corps du PNJ).
      st.setPendingInteract(null);
      const dist = Math.max(Math.abs(st.partyPos.x - ent.pos.x), Math.abs(st.partyPos.y - ent.pos.y));
      if (dist > 1) {
        const adj = adjacentWalkable(sc, ent.pos, st.partyPos);
        if (adj) moveAlong(sc, st.partyPos, adj);
      } else {
        st.log(`${ent.label ?? 'Ce badaud'} n’a rien à vous dire.`);
      }
      return;
    }
    st.setPendingInteract(null); // clic ailleurs : annule un déplacement-puis-fouille en attente
    moveAlong(sc, st.partyPos, t);
  };

  // Caméra libre : on ARME un glisser au pointer-down (sans agir), on panoramique au mouvement
  // au-delà du seuil, et le clic ne se déclenche au relâchement QUE si on n'a pas glissé.
  const onPointerDown = (ev: React.PointerEvent) => {
    if (useGame.getState().dialogue) return;
    const p = clientToSvg(ev);
    dragRef.current = { sx: ev.clientX, sy: ev.clientY, lastX: p?.x ?? 0, lastY: p?.y ?? 0, panned: false, button: ev.button, tile: tileFromEvent(ev) };
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
    const t = tileFromEvent(ev);
    // Affordance : curseur main au survol d'un décor interactif / dialogue (DOM direct, sans re-render).
    const sc = useGame.getState().scene;
    const overInteractive =
      !!sc && !!t && useGame.getState().mode === 'exploration' &&
      sc.entities.some((e) => e.pos.x === t.x && e.pos.y === t.y && (e.z ?? 0) === (t.z ?? 0) && (e.dialogueId || !!e.interact || !!e.merchant));
    (ev.currentTarget as SVGElement).style.cursor = overInteractive ? 'pointer' : '';
    if (!hoverTracking) {
      if (hover) setHover(null);
      return;
    }
    if (!t) {
      if (hover) setHover(null);
      return;
    }
    if (!hover || hover.x !== t.x || hover.y !== t.y) setHover(t);
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
    const path = pathTo(sc, from, to, new Set(), 1, maxJumpTiles(partyM));
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
      onContextMenu={(e) => e.preventDefault()}
    >
      <defs dangerouslySetInnerHTML={{ __html: DEFS + AMBIANCE_DEFS }} />
      <g style={{ transform: `translate(${VW / 2}px,${VH / 2}px) scale(${zoom * (turning ? 0.9 : 1)}) translate(${-VW / 2}px,${-VH / 2}px) translate(${cam.x}px,${cam.y}px)`, transition: turning ? 'transform 0.13s ease-out, opacity 0.13s ease-out' : anyWalking ? 'opacity 0.13s ease-out' : 'transform 0.3s ease-out, opacity 0.13s ease-out', opacity: turning ? 0.22 : 1 }}>
        <g>{objs.map((o) => o.el)}</g>
        {/* Télégraphe ENNEMI (enemyAim) : réticule + ligne — PLEINE en mêlée, pointillée tir/sort. */}
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
          const pz = placingZoneOf({ pendingCast, battle });
          let radius: number | null = null;
          let caster: Combatant | undefined;
          let ok: boolean | null = null;
          if (pz) {
            radius = pz.radius;
            caster = battle.combatants.find((c) => c.id === pz.casterId);
            ok = placedZoneValidAt(useGame.getState, pz, hover);
          } else if (battle.action === 'cast' && battle.selectedSpell && activeC?.kind === 'hero' && !pendingCast) {
            const spell = findSpell(battle.selectedSpell);
            // Même calcul que castZoneSpell : rayon de spec curée prioritaire sur le champ Cible.
            const specRadius = spell ? spellSpecFor(spell).zdeRadiusMeters : undefined;
            radius = spell
              ? specRadius != null
                ? Math.max(0, Math.floor(resolveFormula(specRadius, activeC) / 2))
                : zdeRadiusTiles(spell.target, activeC)
              : null;
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
        {/* Aperçu de DÉPLACEMENT au survol (desktop) : chemin + badge — le clic unique commet. */}
        {mode === 'battle' && battle && hoverMove && hover && (
          <g pointerEvents="none">
            {movePreviewEls(hoverMove.path, hover, hoverMove.kind === 'move' ? `Aller (${hoverMove.cost})` : 'Courir', dims, 'hmv')}
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
          return (
            <g pointerEvents="none">
              {pathPts && <polyline points={pathPts} fill="none" stroke="#ffd75e" strokeWidth={3} opacity={0.9} />}
              {hoverAim.reticle && <TargetReticle from={pathPts ? null : a ? reticleAnchor(a) : null} to={to} line={pathPts ? null : hoverAim.line} lineColor="#ffd75e" />}
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
              {tip?.kind === 'info' && (() => {
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
      </g>
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
