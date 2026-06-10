/**
 * Rendu isométrique SVG (React) — remplace le rendu Phaser. Lit le store et
 * dessine la scène courante (exploration ou combat), gère le clic→tuile, les
 * surbrillances de combat et le déplacement animé. Réutilise toute la logique.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import './anim.css';
import { useGame } from '../state/store';
import { Scene as GameScene, tileAt, isWalkable } from '../state/scene';
import { sceneIsDark } from '../state/sceneRules';
import { pathTo } from '../state/path';
import { rangeBandModifier, rangeBandName } from '../engine/combat';
import { zdeRadiusTiles, spellRangeTiles } from '../engine/magic';
import { resolveFormula } from '../engine/ops';
import { spellSpecFor } from '../data/spellspecs';
import { findSpell } from '../data';
import { bus, EVT } from '../state/bus';
import { isOutOfAction } from '../engine/conditions';
import { Combatant } from '../engine/types';
import {
  TW,
  TH,
  CELL,
  Dims,
  tileCenter,
  diamondPath,
  stageSize,
  screenToTile,
  depth,
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
import { buildingObj } from './BuildingSprite';
import { roofHidden } from '../state/buildings';
import { walkXY, STEP_MS } from './walkPath';
import { useCombatFx } from './fx/useCombatFx';
import { useWalkAnim } from './fx/useWalkAnim';
import { FxLayer } from './fx/FxLayer';
import { sizeTokenScale } from './sizeScale';
import { sizeFootprint, occupiesTile } from '../state/footprint';
import { crowdEligible, eligibleAttackTargetIds, previewAttack, displayedReach } from '../state/combatFlow';
import { entitySize } from '../state/spawn';
import { isRider, isMount, riderOf } from '../state/mount';
import { HERO_RING, ENEMY_RING, tileTint, veilTint, teamShape } from './teamColors';
import { summarizeEffects, combatantFlags } from './effectIcons';
import { setVisibleTileBounds } from './viewport';
/** Distance de combat (Chebyshev, cases). 1 case = 2 m (LDB Déplacement). */
const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
/** Teinte d'une bande de portée selon son modificateur. Palette froide→chaude qui CONTRASTE avec
 *  l'herbe (cyan/bleu = proche/facile → orange/rouge = loin/difficile ; le vert se noierait au sol). */
const bandColor = (mod: number): string =>
  mod >= 60 ? '#46e0c0' : mod >= 40 ? '#5aa6ff' : mod >= 0 ? '#e6d24a' : mod >= -10 ? '#e8973f' : '#e0533a';
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

/** Case adjacente (8-voisins) libre et ATTEIGNABLE la plus proche d'un décor, pour le move-to-interact (P5). */
function adjacentWalkable(
  sc: GameScene,
  target: { x: number; y: number },
  from: { x: number; y: number },
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestLen = Infinity;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const c = { x: target.x + dx, y: target.y + dy };
      if (!isWalkable(sc, c.x, c.y)) continue;
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
  const dialogue = useGame((s) => s.dialogue);
  // Réticule = TÉLÉGRAPHE de tir ennemi (« qui l'adversaire vise ») ; rien sur les actions du joueur.
  const enemyAim = useGame((s) => s.enemyAim);
  const planView = useGame((s) => s.pendingRoundStart?.round === 1); // ouverture du combat : cadrer tout le champ
  const pendingAttack = useGame((s) => s.pendingAttack);
  const pendingCast = useGame((s) => s.pendingCast);
  const svgRef = useRef<SVGSVGElement>(null);
  const movingRef = useRef(false);
  // Glisser-caméra : on diffère l'action de clic au relâchement ; un glissement > seuil = panoramique.
  const dragRef = useRef<{ sx: number; sy: number; lastX: number; lastY: number; panned: boolean; button: number; tile: { x: number; y: number } | null } | null>(null);
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
  // Tuile survolée (pour l'infobulle de portée en mode tir).
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
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
  const floorEls = useMemo<JSX.Element[]>(() => {
    if (!scene) return [];
    const d: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode };
    const out: JSX.Element[] = [];
    for (let y = 0; y < d.h; y++)
      for (let x = 0; x < d.w; x++)
        out.push(<g key={`f${x}-${y}`} dangerouslySetInnerHTML={{ __html: groundTile(scene, x, y, d) }} />);
    return out;
  }, [scene, shownRot, viewMode]);

  const decorObjs = useMemo<{ d: number; el: JSX.Element }[]>(() => {
    if (!scene) return [];
    const d: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode };
    // Tuiles occupées par un ACTEUR — pour estomper l'arbre/mur qui masquerait un personnage derrière.
    const actorTiles: { x: number; y: number }[] = [];
    if (mode === 'battle' && battle) {
      for (const c of battle.combatants) if (c.pos && !isOutOfAction(c)) actorTiles.push(c.pos);
    } else {
      actorTiles.push(partyPos);
      for (const ent of scene.entities) if (ent.kind === 'personnage') actorTiles.push(ent.pos);
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

  // Surbrillances de combat LOURDES (grilles W×H) — figées hors changement d'état de combat. Les
  // éléments qui SUIVENT le token qui glisse (tether d'engagement, halo de l'actif) restent calculés
  // à la frame (peu coûteux) plus bas.
  const staticHighlights = useMemo<JSX.Element[]>(() => {
    if (!scene || mode !== 'battle' || !battle) return [];
    const d: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode };
    const hl: JSX.Element[] = [];
    const activeC = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
    const aimWeapon =
      battle.action === 'attack' && activeC?.kind === 'hero' && activeC.pos
        ? activeC.weapons.find((w) => w.type === 'ranged' && w.range)
        : undefined;
    // Bandes de portée concentriques autour du tireur (peintes SOUS les tokens).
    if (aimWeapon && activeC?.pos) {
      for (let y = 0; y < d.h; y++)
        for (let x = 0; x < d.w; x++) {
          const dist = cheb(activeC.pos, { x, y });
          if (dist === 0) continue;
          const m = rangeBandModifier(dist, aimWeapon.range!);
          if (m == null) continue; // hors de portée → pas de teinte
          hl.push(<path key={`rb${x}-${y}`} d={diamondPath(x, y, d)} fill={bandColor(m)} opacity={0.26} pointerEvents="none" />);
        }
    }
    // Portée de Marche AFFICHÉE EN PERMANENCE au tour d'un héros (modèle de clic implicite) :
    // budget spécial stocké (Course, post-Désengagement) prioritaire, sinon Marche restante dérivée.
    for (const k of displayedReach(useGame.getState).keys()) {
      const [x, y] = k.split(',').map(Number);
      hl.push(<path key={`h${k}`} d={diamondPath(x, y, d)} fill="#4f8fe0" opacity={0.32} />);
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
    // Fumée (R7) : les nuages bloquent la Ligne de Vue → peints en gris.
    for (const s of battle.smoke ?? []) {
      hl.push(<path key={`smoke-${s.x}-${s.y}`} d={diamondPath(s.x, s.y, d)} fill="#9aa0a6" opacity={0.5} pointerEvents="none" />);
    }
    // Cibles VALIDES de l'attaque (R4) : anneau « cliquable pour attaquer ».
    if (battle.action === 'attack' && activeC?.kind === 'hero' && !pendingAttack) {
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
    return hl;
  }, [scene, shownRot, viewMode, mode, battle, pendingAttack]);

  // Tokens des ENTITÉS de scène (exploration) memoïsés : ils ne BOUGENT pas pendant que le groupe
  // marche (seul le leader glisse, rendu à part). Sans ça, le rAF de marche (setWalkTick) re-rendait
  // les ~180 modèles de la galerie à chaque frame EN PLUS de leur propre anim → saccade. Réfs d'éléments
  // stables → React saute ces sous-arbres ; chaque créature continue de s'auto-animer via SON rAF
  // (usePlanAnim/useRigClip), indépendamment du re-rendu d'IsoStage.
  const entityObjs = useMemo<{ d: number; el: JSX.Element }[]>(() => {
    if (!scene || mode === 'battle') return [];
    const d: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode };
    const isTop = viewMode === 'top';
    const discRfn = (sz: Combatant['size']) => (sizeFootprint(sz) * CELL) / 2 * 0.85;
    const out: { d: number; el: JSX.Element }[] = [];
    for (const ent of scene.entities) {
      if (ent.kind === 'heroStart' || ent.kind === 'prop') continue;
      const r = pickBackend({ kind: 'sceneEntity', ent }, viewMode);
      if (r.backend === 'sprite') {
        out.push({
          d: depth(ent.pos.x, ent.pos.y, d),
          el: (
            <BodyToken key={r.id} x={ent.pos.x} y={ent.pos.y} dims={d} scale={0.55} fx={ent.anim}>
              <g dangerouslySetInnerHTML={{ __html: entitySprite(ent) }} />
            </BodyToken>
          ),
        });
      } else {
        const base = r.backend === 'rig' ? 0.58 : 0.55;
        const dBoost = r.backend === 'rig' ? 0.1 : 0;
        const off = (sizeFootprint(entitySize(ent)) - 1) / 2;
        const ex = ent.pos.x + off, ey = ent.pos.y + off;
        out.push({
          d: depth(ex, ey, d) + dBoost,
          el: (
            <BodyToken key={r.id} x={ex} y={ey} dims={d} scale={base * r.speciesScale * sizeTokenScale(entitySize(ent))} bakedDeath flat={isTop} portraitBox={r.portraitBox} discR={discRfn(entitySize(ent))}>
              {r.body}
            </BodyToken>
          ),
        });
      }
    }
    return out;
  }, [scene, shownRot, viewMode, mode]);

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

  // Tir en cours de visée : le combattant actif est un héros en mode « attaque » avec une arme à
  // distance → on peint les bandes de portée + une infobulle au survol (lisibilité du tir).
  const activeC = mode === 'battle' && battle ? battle.combatants.find((c) => c.id === battle.order[battle.turn]) : undefined;
  const aimWeapon =
    mode === 'battle' && battle && battle.action === 'attack' && activeC?.kind === 'hero' && activeC.pos
      ? activeC.weapons.find((w) => w.type === 'ranged' && w.range)
      : undefined;

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

  // --- Objets triés par profondeur (murs, arbres, entités, tokens) ---
  type Obj = { d: number; el: JSX.Element };
  const objs: Obj[] = [];

  // décor statique + bâtiments multi-tuiles : éléments memoïsés (cf. decorObjs/buildingObjs), juste
  // ré-insérés dans le tri de profondeur (leurs `el` gardent une réf stable → React saute le sous-arbre).
  objs.push(...decorObjs, ...buildingObjs);

  // token()/tokenNode() : adaptateurs minces vers la coquille partagée BodyToken (positionnement
  // unique). token() = corps SVG string ; tokenNode() = enfant React (rig) dont la mort est déjà
  // bakée (CORPSE_POSE / pose effondrée) → pas de bascule externe (bakedDeath).
  const token = (id: string, x: number, y: number, inner: string, scale: number, ringColor?: string, dim?: boolean, fx?: string, walking?: boolean, bakedDeath?: boolean) => (
    <BodyToken key={id} x={x} y={y} dims={dims} scale={scale} ring={ringColor} dim={dim} walking={walking} fx={fx} bakedDeath={bakedDeath}>
      <g dangerouslySetInnerHTML={{ __html: inner }} />
    </BodyToken>
  );

  type TokenExtras = { hp?: { current: number; max: number }; icons?: string[]; iconsMore?: number; veil?: string; active?: boolean; ringDash?: string; flat?: boolean; portraitBox?: string; discR?: number };
  const tokenNode = (id: string, x: number, y: number, child: ReactNode, scale: number, ringColor?: string, dim?: boolean, walking?: boolean, extras?: TokenExtras) => (
    <BodyToken key={id} x={x} y={y} dims={dims} scale={scale} ring={ringColor} ringDash={extras?.ringDash} dim={dim} walking={walking} bakedDeath
      hp={extras?.hp} icons={extras?.icons} iconsMore={extras?.iconsMore} veil={extras?.veil} active={extras?.active}
      flat={extras?.flat} portraitBox={extras?.portraitBox} discR={extras?.discR}>
      {child}
    </BodyToken>
  );

  // Décors (props : épave, cadavres, sang…) rendus dans LES DEUX modes → restent
  // visibles pendant le combat. L'anim d'ambiance CSS (ent.anim) passe par le calque fx.
  for (const ent of scene.entities) {
    if (ent.kind !== 'prop') continue;
    if (ent.interact) {
      // Affordance : halo doux pulsé au sol sous un décor fouillable/ramassable (cf. anim.css).
      const c = tileCenter(ent.pos.x, ent.pos.y, dims);
      objs.push({
        d: depth(ent.pos.x, ent.pos.y, dims) - 0.02, // juste sous le sprite
        el: (
          <g key={`halo-${ent.id}`} className="interact-halo" pointerEvents="none">
            <ellipse cx={c.cx} cy={c.cy + 4} rx={16} ry={8} fill="#ffe27a" opacity={0.18} />
            <ellipse cx={c.cx} cy={c.cy + 4} rx={16} ry={8} fill="none" stroke="#ffe27a" strokeWidth={1.5} opacity={0.7} />
          </g>
        ),
      });
    }
    objs.push({ d: depth(ent.pos.x, ent.pos.y, dims), el: token(`e-${ent.id}`, ent.pos.x, ent.pos.y, entitySprite(ent), 0.55, undefined, false, ent.anim) });
  }

  if (mode === 'battle' && battle) {
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
    // groupe (token = 1er héros VIVANT et conscient — #27b : si le principal est mort/à terre, on
    // affiche le suivant encore debout) — glisse le long du chemin (ANIM_MOVE émis par moveAlong)
    const leader = party.find((h) => !h.dead && h.wounds.current > 0) ?? party[0];
    const wp = leader ? walkPosOf(leader.id, partyPos.x, partyPos.y) : { x: partyPos.x, y: partyPos.y, walking: false };
    const r = pickBackend({ kind: 'partyLeader', leader }, viewMode);
    const el =
      r.backend === 'sprite'
        ? token(r.id, partyPos.x, partyPos.y, pnjSprite(), 0.6, HERO_RING[0])
        : tokenNode(r.id, wp.x, wp.y, r.body, 0.6, HERO_RING[0], false, wp.walking, { flat: top, portraitBox: r.portraitBox, discR: discR(undefined) });
    objs.push({ d: depth(wp.x, wp.y, dims) + 0.5, el });
  }
  objs.sort((a, b) => a.d - b.d);

  // --- Caméra : recadre autour du point focal (groupe / combattant actif) ---
  // Tir ENNEMI télégraphié (enemyAim) : ligne de tir + réticule + cadrage des deux. Uniquement
  // pour les attaques ennemies — sur les actions du joueur, la modale suffit (réticule retiré).
  let targeting: { from: { x: number; y: number }; to: { x: number; y: number } } | null = null;
  if (mode === 'battle' && battle && enemyAim) {
    const a = battle.combatants.find((c) => c.id === enemyAim.fromId);
    const b = battle.combatants.find((c) => c.id === enemyAim.toId);
    if (a?.pos && b?.pos) targeting = { from: a.pos, to: b.pos };
  }

  // Cadrage CAMÉRA (découplé du réticule, R8) : on cadre la paire attaquant↔cible aussi pour une attaque
  // DU JOUEUR en cours de résolution (pendingAttack), pas seulement pour le télégraphe ennemi — sinon on
  // voit mieux ce que fait l'IA que soi-même. Le RÉTICULE dessiné (`targeting`) reste, lui, ennemi-only.
  let camPair = targeting;
  if (!camPair && mode === 'battle' && battle && pendingAttack) {
    const a = battle.combatants.find((c) => c.id === pendingAttack.attackerId);
    const b = battle.combatants.find((c) => c.id === pendingAttack.targetId);
    if (a?.pos && b?.pos) camPair = { from: a.pos, to: b.pos };
  }

  let focus = partyPos;
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
  const tileFromEvent = (ev: React.PointerEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const gx = (loc.x - VW / 2) / zoom + VW / 2 - cam.x;
    const gy = (loc.y - VH / 2) / zoom + VH / 2 - cam.y;
    const { x, y } = screenToTile(gx, gy, dims);
    if (x < 0 || y < 0 || x >= dims.w || y >= dims.h) return null;
    return { x, y };
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
  const performClick = (t: { x: number; y: number } | null) => {
    const st = useGame.getState();
    const sc = st.scene;
    if (!sc || st.dialogue || !t) return;
    const { x, y } = t;
    if (st.mode === 'battle') {
      const occ = st.battle?.combatants.find((c) => c.pos && occupiesTile(c.pos, c.size, x, y) && !isOutOfAction(c)); // clic sur N'IMPORTE quelle tuile de l'empreinte
      // En mode incantation, on peut cibler n'importe quel combattant (allié, ennemi ou soi) ;
      // sinon seuls les ennemis sont cliquables pour attaquer.
      if (occ && (occ.kind === 'enemy' || st.battle?.action === 'cast')) st.battleClickEntity(occ.id);
      else st.battleClickTile({ x, y });
      return;
    }
    const ent = sc.entities.find((e) => e.pos.x === x && e.pos.y === y);
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
    st.setPendingInteract(null); // clic ailleurs : annule un déplacement-puis-fouille en attente
    moveAlong(sc, st.partyPos, { x, y });
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
      sc.entities.some((e) => e.pos.x === t.x && e.pos.y === t.y && (e.dialogueId || !!e.interact || !!e.merchant));
    (ev.currentTarget as SVGElement).style.cursor = overInteractive ? 'pointer' : '';
    if (!aimWeapon) {
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

  const moveAlong = (sc: GameScene, from: { x: number; y: number }, to: { x: number; y: number }) => {
    if (movingRef.current || !isWalkable(sc, to.x, to.y)) return;
    const path = pathTo(sc, from, to, new Set());
    if (!path || path.length < 2) return;
    movingRef.current = true;
    // Le déplacement d'exploration n'émet pas ANIM_MOVE côté store → on déclenche ici
    // la marche du leader (token '__party') pour le chemin complet.
    if (party[0]) bus.emit(EVT.ANIM_MOVE, { id: party[0].id, path });
    let i = 1;
    const step = () => {
      const st = useGame.getState();
      if (st.mode !== 'exploration' || st.dialogue || i >= path.length) {
        movingRef.current = false;
        return;
      }
      st.moveParty(path[i]);
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
        <g>{floorEls}</g>
        <g>{highlights}</g>
        {mode === 'exploration' && !dialogue && (
          <path d={diamondPath(partyPos.x, partyPos.y, dims)} fill="none" stroke="#ffe066" strokeWidth={1.5} opacity={0.5} />
        )}
        <g>{objs.map((o) => o.el)}</g>
        {/* Tir/sort à distance : ligne de tir tireur→cible + réticule (Lot 1 tranche 3). */}
        {targeting && (() => {
          const f = tileCenter(targeting.from.x, targeting.from.y, dims);
          const t = tileCenter(targeting.to.x, targeting.to.y, dims);
          const fy = f.cy - 34, ty = t.cy - 34; // viser le buste, pas les pieds
          return (
            <g pointerEvents="none">
              <line x1={f.cx} y1={fy} x2={t.cx} y2={ty} stroke="#e0533a" strokeWidth={2.5} strokeDasharray="7 6" opacity={0.85} />
              <g transform={`translate(${t.cx},${ty})`}>
                <circle r={20} fill="none" stroke="#ffd34d" strokeWidth={2} />
                <circle r={13} fill="none" stroke="#ffd34d" strokeWidth={1} opacity={0.6} />
                <line x1={0} y1={-26} x2={0} y2={-14} stroke="#ffd34d" strokeWidth={2} />
                <line x1={0} y1={14} x2={0} y2={26} stroke="#ffd34d" strokeWidth={2} />
                <line x1={-26} y1={0} x2={-14} y2={0} stroke="#ffd34d" strokeWidth={2} />
                <line x1={14} y1={0} x2={26} y2={0} stroke="#ffd34d" strokeWidth={2} />
              </g>
            </g>
          );
        })()}
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
        {/* Gabarit de ZONE D'EFFET (LDB 47 l.44) au survol : sort ZdE sélectionné → halo du
            diamètre autour de la case visée + portée respectée (vert = OK, gris = hors de portée). */}
        {battle?.action === 'cast' && battle.selectedSpell && activeC?.kind === 'hero' && activeC.pos && hover && !pendingCast &&
          (() => {
            const spell = findSpell(battle.selectedSpell!);
            // Même calcul que battleClickTile : rayon de spec curée prioritaire sur le champ Cible.
            const specRadius = spell ? spellSpecFor(spell).zdeRadiusMeters : undefined;
            const radius = spell
              ? specRadius != null
                ? Math.max(0, Math.floor(resolveFormula(specRadius, activeC) / 2))
                : zdeRadiusTiles(spell.target, activeC)
              : null;
            if (spell == null || radius == null) return null;
            const range = spellRangeTiles(spell.range, activeC);
            const ok = range == null || cheb(activeC.pos!, hover) <= range;
            const tiles: JSX.Element[] = [];
            for (let dy = -radius; dy <= radius; dy++)
              for (let dx = -radius; dx <= radius; dx++) {
                const x = hover.x + dx, y = hover.y + dy;
                if (x < 0 || y < 0 || x >= dims.w || y >= dims.h) continue;
                tiles.push(<path key={`zde${x}-${y}`} d={diamondPath(x, y, dims)} fill={ok ? '#8e54c8' : '#666'} opacity={0.35} pointerEvents="none" />);
              }
            return <g pointerEvents="none">{tiles}</g>;
          })()}
        {/* Infobulle de ciblage au survol (mode attaque, R4) — UNIFIÉE mêlée + tir :
            • sur un ENNEMI → toucher % + dégâts probables (previewAttack), avec états « hors de portée » /
              « pas de ligne de vue » ;
            • sur une case VIDE avec une arme à distance → bande de portée (aide au positionnement). */}
        {battle?.action === 'attack' && activeC?.kind === 'hero' && activeC.pos && hover && !pendingAttack &&
          (() => {
            const enemy = battle.combatants.find((c) => c.kind !== 'hero' && !isOutOfAction(c) && c.pos && occupiesTile(c.pos, c.size, hover.x, hover.y));
            let label: string;
            let col: string;
            let at: { x: number; y: number };
            if (enemy) {
              const p = previewAttack(useGame.getState, activeC, enemy);
              at = enemy.pos!;
              if (p.blocked) { label = '⛔ pas de ligne de vue'; col = '#888'; }
              else if (!p.inRange) { label = '⛔ hors de portée'; col = '#888'; }
              else { label = `🎯 ${Math.max(0, Math.min(100, p.target))}% · ≈${Math.max(1, p.dmg - p.soak)}+ Bl.`; col = '#ff5a4d'; }
            } else if (aimWeapon) {
              const dist = cheb(activeC.pos!, hover);
              if (dist === 0) return null;
              const m = rangeBandModifier(dist, aimWeapon.range!);
              const name = rangeBandName(dist, aimWeapon.range!);
              at = hover;
              label = m == null || !name ? `${dist * 2} m · hors de portée` : `${dist * 2} m · ${name} (${m >= 0 ? '+' : ''}${m})`;
              col = m == null ? '#888' : bandColor(m);
            } else return null;
            const { cx, cy } = tileCenter(at.x, at.y, dims);
            const w = label.length * 6.4 + 14;
            return (
              <g transform={`translate(${cx},${cy - 44})`} pointerEvents="none">
                <rect x={-w / 2} y={-13} width={w} height={20} rx={5} fill="#14141c" opacity={0.94} stroke={col} strokeWidth={1} />
                <text x={0} y={1} textAnchor="middle" dominantBaseline="middle" fill="#f0f0f0" fontSize={11} fontWeight={600}>
                  {label}
                </text>
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
    </svg>
  );
}
