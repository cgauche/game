/**
 * Rendu isométrique SVG (React) — remplace le rendu Phaser. Lit le store et
 * dessine la scène courante (exploration ou combat), gère le clic→tuile, les
 * surbrillances de combat et le déplacement animé. Réutilise toute la logique.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import './anim.css';
import { useGame } from '../state/store';
import { Scene as GameScene, tileAt, isWalkable } from '../state/scene';
import { sceneIsDark } from '../state/sceneRules';
import { pathTo } from '../state/path';
import { rangeBandModifier, rangeBandName } from '../engine/combat';
import { bus, EVT } from '../state/bus';
import { isOutOfAction } from '../engine/conditions';
import { Combatant } from '../engine/types';
import {
  TW,
  TH,
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
import { isSupportiveCast, spellFxForLabel } from './rig/anim/spellClips';
import { groundTile } from './ground';
import { buildingObj } from './BuildingSprite';
import { roofHidden } from '../state/buildings';
import { walkXY, walkDuration } from './walkPath';

const HERO_RING = ['#4f8fe0', '#37c07a', '#e0b13f', '#b455c9'];
const STEP_MS = 160; // durée d'un pas (aligné sur AnimatedRigToken/clip walk)

/** Distance de combat (Chebyshev, cases). 1 case = 2 m (LDB Déplacement). */
const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
/** Teinte d'une bande de portée selon son modificateur. Palette froide→chaude qui CONTRASTE avec
 *  l'herbe (cyan/bleu = proche/facile → orange/rouge = loin/difficile ; le vert se noierait au sol). */
const bandColor = (mod: number): string =>
  mod >= 60 ? '#46e0c0' : mod >= 40 ? '#5aa6ff' : mod >= 0 ? '#e6d24a' : mod >= -10 ? '#e8973f' : '#e0533a';
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.6;

// Viewport virtuel : le SVG remplit tout l'espace dispo (preserveAspectRatio
// slice) et la caméra recadre autour du point focal (groupe / combattant actif).
const VW = 1100;
const VH = 720;
const AMBIANCE_DEFS = `
  <radialGradient id="g_warm" cx="55%" cy="24%" r="78%"><stop offset="0%" stop-color="#ffce78" stop-opacity="0.10"/><stop offset="100%" stop-color="#ffce78" stop-opacity="0"/></radialGradient>
  <radialGradient id="g_vig" cx="50%" cy="48%" r="60%"><stop offset="52%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#05040a" stop-opacity="0.58"/></radialGradient>`;

export function IsoStage() {
  const scene = useGame((s) => s.scene);
  const mode = useGame((s) => s.mode);
  const partyPos = useGame((s) => s.partyPos);
  const party = useGame((s) => s.party);
  const battle = useGame((s) => s.battle);
  const gameTime = useGame((s) => s.gameTime);
  const dialogue = useGame((s) => s.dialogue);
  const svgRef = useRef<SVGSVGElement>(null);
  const movingRef = useRef(false);
  const zoom = useGame((s) => s.zoom);
  const setZoom = useGame((s) => s.setZoom);
  // Rotation caméra (cran de 90°). `camRot` = cible (store, lu en live par le rig) ;
  // `shownRot` = orientation AFFICHÉE, retardée pour masquer le ré-agencement sous le
  // creux d'opacité de la transition « dim-and-turn ».
  const camRot = useGame((s) => s.camRot);
  const rotateCam = useGame((s) => s.rotateCam);
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

  // Marche visuelle : le token GLISSE le long du chemin (ANIM_MOVE) au lieu de se
  // téléporter à la destination. walksRef = id → {path, start} ; rAF tant qu'actif.
  const [, setWalkTick] = useState(0);
  const walksRef = useRef<Record<string, { path: { x: number; y: number }[]; start: number }>>({});
  const walkRaf = useRef(0);
  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      let any = false;
      for (const id of Object.keys(walksRef.current)) {
        const w = walksRef.current[id];
        if (now - w.start >= walkDuration(w.path, STEP_MS)) delete walksRef.current[id];
        else any = true;
      }
      setWalkTick((t) => t + 1);
      walkRaf.current = any ? requestAnimationFrame(tick) : 0;
    };
    const off = bus.on(EVT.ANIM_MOVE, (d: any) => {
      if (!d?.path || d.path.length < 2) return;
      walksRef.current[d.id] = { path: d.path, start: performance.now() };
      if (!walkRaf.current) walkRaf.current = requestAnimationFrame(tick);
    });
    return () => { off(); if (walkRaf.current) cancelAnimationFrame(walkRaf.current); };
  }, []);

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

  // Dégâts flottants — déclenchés sur ANIM_IMPACT (timing de l'impact du clip), pas à l'émission.
  type Float = { key: number; x: number; y: number; text: string; crit: boolean };
  const [floats, setFloats] = useState<Float[]>([]);
  const floatId = useRef(0);
  useEffect(() => {
    const off = bus.on(EVT.ANIM_IMPACT, (d: any) => {
      const b = useGame.getState().battle;
      if (!b || !d?.result?.hit) return;
      const target = b.combatants.find((c) => c.id === d.to);
      if (!target?.pos) return;
      const key = ++floatId.current;
      setFloats((f) => [...f, { key, x: target.pos!.x, y: target.pos!.y, text: `-${d.result.woundsLost}`, crit: !!d.result.critical }]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.key !== key)), 850);
    });
    return off;
  }, []);

  // Projectiles volants (distance + sort-missile) : vol from→to synchronisé à l'impact.
  // `gradient` = tintage à l'école pour un sort (cf. spellFxForLabel) ; absent pour une flèche.
  type Proj = { key: number; from: { x: number; y: number }; to: { x: number; y: number }; kind: string; gradient?: string };
  const [projs, setProjs] = useState<Proj[]>([]);
  const projId = useRef(0);
  // Halos d'incantation, tintés à l'école (arcane/divin). Deux usages :
  //  - `channel` : canalisation sur le LANCEUR (toute incantation, brève pulsation serrée) ;
  //  - sinon (bloom) : bénédiction/miracle reçu sur la CIBLE (expansion soutenue).
  type Aura = { key: number; x: number; y: number; gradient: string; core: string; channel?: boolean };
  const [auras, setAuras] = useState<Aura[]>([]);
  const auraId = useRef(0);
  useEffect(() => {
    const off = bus.on(EVT.ANIM_ATTACK, (d: any) => {
      if (d.kind !== 'ranged' && d.kind !== 'spell') return;
      const b = useGame.getState().battle;
      const from = b?.combatants.find((c) => c.id === d.from)?.pos;
      const to = b?.combatants.find((c) => c.id === d.to)?.pos;
      if (!from || !to) return;
      if (d.kind === 'spell') {
        const fx = spellFxForLabel(d.spell);
        // Canalisation à l'école sur le lanceur (toute incantation : offensive ou soutien).
        const ck = ++auraId.current;
        setAuras((a) => [...a, { key: ck, x: from.x, y: from.y, gradient: fx.gradient, core: fx.core, channel: true }]);
        setTimeout(() => setAuras((a) => a.filter((x) => x.key !== ck)), 480);
        const caster = b?.combatants.find((c) => c.id === d.from);
        const tgt = b?.combatants.find((c) => c.id === d.to);
        if (isSupportiveCast(caster?.kind, tgt?.kind, d.from === d.to)) {
          const key = ++auraId.current; // soutien : halo sur la cible, pas de projectile
          setAuras((a) => [...a, { key, x: to.x, y: to.y, gradient: fx.gradient, core: fx.core }]);
          setTimeout(() => setAuras((a) => a.filter((x) => x.key !== key)), 620);
          return;
        }
        const key = ++projId.current; // offensif : projectile magique tinté
        setProjs((p) => [...p, { key, from, to, kind: d.kind, gradient: fx.gradient }]);
        setTimeout(() => setProjs((p) => p.filter((x) => x.key !== key)), 340);
        return;
      }
      const key = ++projId.current;
      setProjs((p) => [...p, { key, from, to, kind: d.kind }]);
      setTimeout(() => setProjs((p) => p.filter((x) => x.key !== key)), 340);
    });
    return off;
  }, []);

  if (!scene) return null;
  const dims: Dims = { ...scene.dimensions, rot: shownRot };
  const size = stageSize(dims);

  // Tir en cours de visée : le combattant actif est un héros en mode « attaque » avec une arme à
  // distance → on peint les bandes de portée + une infobulle au survol (lisibilité du tir).
  const activeC = mode === 'battle' && battle ? battle.combatants.find((c) => c.id === battle.order[battle.turn]) : undefined;
  const aimWeapon =
    mode === 'battle' && battle && battle.action === 'attack' && activeC?.kind === 'hero' && activeC.pos
      ? activeC.weapons.find((w) => w.type === 'ranged' && w.range)
      : undefined;

  // --- Couche sol (losanges + raccord d'arêtes) ---
  const floor: JSX.Element[] = [];
  for (let y = 0; y < dims.h; y++)
    for (let x = 0; x < dims.w; x++)
      floor.push(<g key={`f${x}-${y}`} dangerouslySetInnerHTML={{ __html: groundTile(scene, x, y, dims) }} />);

  // --- Surbrillances de combat ---
  const highlights: JSX.Element[] = [];
  if (mode === 'battle' && battle) {
    // Bandes de portée concentriques autour du tireur (peintes SOUS les tokens).
    if (aimWeapon && activeC?.pos) {
      for (let y = 0; y < dims.h; y++)
        for (let x = 0; x < dims.w; x++) {
          const dist = cheb(activeC.pos, { x, y });
          if (dist === 0) continue;
          const m = rangeBandModifier(dist, aimWeapon.range!);
          if (m == null) continue; // hors de portée → pas de teinte
          highlights.push(<path key={`rb${x}-${y}`} d={diamondPath(x, y, dims)} fill={bandColor(m)} opacity={0.26} pointerEvents="none" />);
        }
    }
    for (const k of battle.reachable.keys()) {
      const [x, y] = k.split(',').map(Number);
      highlights.push(<path key={`h${k}`} d={diamondPath(x, y, dims)} fill="#4f8fe0" opacity={0.32} />);
    }
    if (activeC?.pos)
      highlights.push(
        <path key="active" d={diamondPath(activeC.pos.x, activeC.pos.y, dims)} fill="none" stroke="#ffe066" strokeWidth={3} />,
      );
  }

  // --- Objets triés par profondeur (murs, arbres, entités, tokens) ---
  type Obj = { d: number; el: JSX.Element };
  const objs: Obj[] = [];

  // Tuiles occupées par un ACTEUR (héros/ennemi/pnj) — pour estomper l'arbre/mur
  // qui les masquerait. Un occulteur haut (arbre ~5 tuiles) peint par-dessus un
  // acteur situé DERRIÈRE (depth plus faible) et dans sa colonne écran → on le rend
  // semi-transparent pour qu'on voie toujours le personnage (« à la Baldur's Gate »).
  const actorTiles: { x: number; y: number }[] = [];
  if (mode === 'battle' && battle) {
    for (const c of battle.combatants) if (c.pos && !isOutOfAction(c)) actorTiles.push(c.pos);
  } else {
    actorTiles.push(partyPos);
    for (const ent of scene.entities) if (ent.kind === 'personnage') actorTiles.push(ent.pos);
  }
  const occludesActor = (tx: number, ty: number) =>
    actorTiles.some(
      (a) => a.x + a.y < tx + ty && Math.abs(a.x - a.y - (tx - ty)) <= 1 && tx + ty - (a.x + a.y) <= 7,
    );

  // décor statique
  for (let y = 0; y < dims.h; y++)
    for (let x = 0; x < dims.w; x++) {
      const ov = terrainOverlay(tileAt(scene, x, y), x, y, dims);
      if (ov)
        objs.push({
          d: ov.d,
          el: (
            <g
              key={`ov${x}-${y}`}
              style={{ opacity: occludesActor(x, y) ? 0.4 : 1, transition: 'opacity 0.25s' }}
              dangerouslySetInnerHTML={{ __html: ov.html }}
            />
          ),
        });
    }

  // bâtiments multi-tuiles (toit togglable pour le cutaway)
  const allies =
    mode === 'battle' && battle
      ? battle.combatants.filter((c) => c.kind === 'hero' && c.pos).map((c) => c.pos!)
      : [partyPos];
  const night = sceneIsDark(scene, gameTime); // jour/nuit = horloge (#T1c)
  for (const b of scene.buildings ?? []) objs.push(buildingObj(b, dims, roofHidden(b, allies), night));

  // token()/tokenNode() : adaptateurs minces vers la coquille partagée BodyToken (positionnement
  // unique). token() = corps SVG string ; tokenNode() = enfant React (rig) dont la mort est déjà
  // bakée (CORPSE_POSE / pose effondrée) → pas de bascule externe (bakedDeath).
  const token = (id: string, x: number, y: number, inner: string, scale: number, ringColor?: string, dim?: boolean, fx?: string, walking?: boolean, bakedDeath?: boolean) => (
    <BodyToken key={id} x={x} y={y} dims={dims} scale={scale} ring={ringColor} dim={dim} walking={walking} fx={fx} bakedDeath={bakedDeath}>
      <g dangerouslySetInnerHTML={{ __html: inner }} />
    </BodyToken>
  );

  const tokenNode = (id: string, x: number, y: number, child: ReactNode, scale: number, ringColor?: string, dim?: boolean, walking?: boolean) => (
    <BodyToken key={id} x={x} y={y} dims={dims} scale={scale} ring={ringColor} dim={dim} walking={walking} bakedDeath>
      {child}
    </BodyToken>
  );

  // Position VISUELLE d'un token : interpolée le long du chemin si une marche est en
  // cours (anti-téléportation), sinon la position logique.
  const wnow = performance.now();
  const walkPosOf = (id: string, x: number, y: number) => {
    const w = walksRef.current[id];
    if (!w) return { x, y, walking: false };
    const p = walkXY(w.path, wnow - w.start, STEP_MS);
    return { x: p.x, y: p.y, walking: true };
  };

  // Décors (props : épave, cadavres, sang…) rendus dans LES DEUX modes → restent
  // visibles pendant le combat. L'anim d'ambiance CSS (ent.anim) passe par le calque fx.
  for (const ent of scene.entities) {
    if (ent.kind !== 'prop') continue;
    objs.push({ d: depth(ent.pos.x, ent.pos.y, dims), el: token(`e-${ent.id}`, ent.pos.x, ent.pos.y, entitySprite(ent), 0.55, undefined, false, ent.anim) });
  }

  if (mode === 'battle' && battle) {
    let hi = 0;
    for (const c of battle.combatants) {
      if (!c.pos) continue;
      const isHero = c.kind === 'hero';
      const ring = isHero ? HERO_RING[hi++ % HERO_RING.length] : '#c0392b';
      const wp = walkPosOf(c.id, c.pos.x, c.pos.y);
      // Backend choisi par le classifieur unique (rig humanoïde / plan non-bipède) ; base 0.62,
      // l'échelle d'espèce (bipède ou créature) vient du backend.
      const r = pickBackend({ kind: 'combatant', combatant: c });
      const el = tokenNode(r.id, wp.x, wp.y, r.body, 0.62 * r.speciesScale, ring, isOutOfAction(c), wp.walking);
      objs.push({ d: depth(wp.x, wp.y, dims) + 0.5, el });
    }
  } else {
    for (const ent of scene.entities) {
      if (ent.kind === 'heroStart' || ent.kind === 'prop') continue; // props déjà rendus (au-dessus)
      // Backend par le classifieur unique : rig humanoïde (0.58, +0.1 de profondeur) /
      // plan non-bipède animé (0.55) / sprite statique (objet, 0.55 + anim CSS d'ambiance).
      const r = pickBackend({ kind: 'sceneEntity', ent });
      if (r.backend === 'sprite') {
        objs.push({ d: depth(ent.pos.x, ent.pos.y, dims), el: token(r.id, ent.pos.x, ent.pos.y, entitySprite(ent), 0.55, undefined, false, ent.anim) });
      } else {
        const base = r.backend === 'rig' ? 0.58 : 0.55;
        const dBoost = r.backend === 'rig' ? 0.1 : 0;
        objs.push({ d: depth(ent.pos.x, ent.pos.y, dims) + dBoost, el: tokenNode(r.id, ent.pos.x, ent.pos.y, r.body, base * r.speciesScale) });
      }
    }
    // groupe (token = 1er héros) — glisse le long du chemin (ANIM_MOVE émis par moveAlong)
    const leader = party[0];
    const wp = leader ? walkPosOf(leader.id, partyPos.x, partyPos.y) : { x: partyPos.x, y: partyPos.y, walking: false };
    const r = pickBackend({ kind: 'partyLeader', leader });
    const el =
      r.backend === 'sprite'
        ? token(r.id, partyPos.x, partyPos.y, pnjSprite(), 0.6, HERO_RING[0])
        : tokenNode(r.id, wp.x, wp.y, r.body, 0.6, HERO_RING[0], false, wp.walking);
    objs.push({ d: depth(wp.x, wp.y, dims) + 0.5, el });
  }
  objs.sort((a, b) => a.d - b.d);

  // --- Caméra : recadre autour du point focal (groupe / combattant actif) ---
  let focus = partyPos;
  if (mode === 'battle' && battle) {
    const active = battle.combatants.find((c) => c.id === battle.order[battle.turn] && c.pos);
    if (active?.pos) focus = active.pos;
    else {
      const alive = battle.combatants.filter((c) => c.pos && !isOutOfAction(c));
      if (alive.length)
        focus = {
          x: Math.round(alive.reduce((s, c) => s + c.pos!.x, 0) / alive.length),
          y: Math.round(alive.reduce((s, c) => s + c.pos!.y, 0) / alive.length),
        };
    }
  }
  const fc = tileCenter(focus.x, focus.y, dims);
  const cam = { x: VW / 2 - fc.cx, y: VH / 2 - fc.cy };

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
  const onPointerMove = (ev: React.PointerEvent) => {
    if (!aimWeapon) {
      if (hover) setHover(null);
      return;
    }
    const t = tileFromEvent(ev);
    if (!t) {
      if (hover) setHover(null);
      return;
    }
    if (!hover || hover.x !== t.x || hover.y !== t.y) setHover(t);
  };
  const onPointerLeave = () => {
    if (hover) setHover(null);
  };

  const onPointerDown = (ev: React.PointerEvent) => {
    const st = useGame.getState();
    const sc = st.scene;
    if (!sc || st.dialogue) return;
    const t = tileFromEvent(ev);
    if (!t) return;
    const { x, y } = t;

    if (st.mode === 'battle') {
      const occ = st.battle?.combatants.find((c) => c.pos && c.pos.x === x && c.pos.y === y && !isOutOfAction(c));
      // En mode incantation, on peut cibler n'importe quel combattant (allié,
      // ennemi ou soi) ; sinon seuls les ennemis sont cliquables pour attaquer.
      if (occ && (occ.kind === 'enemy' || st.battle?.action === 'cast')) st.battleClickEntity(occ.id);
      else st.battleClickTile({ x, y });
      return;
    }
    const ent = sc.entities.find((e) => e.pos.x === x && e.pos.y === y);
    if (ent && (ent.dialogueId || !!ent.interact)) {
      st.interactEntity(ent.id);
      return;
    }
    moveAlong(sc, st.partyPos, { x, y });
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
      onPointerLeave={onPointerLeave}
    >
      <defs dangerouslySetInnerHTML={{ __html: DEFS + AMBIANCE_DEFS }} />
      <g style={{ transform: `translate(${VW / 2}px,${VH / 2}px) scale(${zoom * (turning ? 0.9 : 1)}) translate(${-VW / 2}px,${-VH / 2}px) translate(${cam.x}px,${cam.y}px)`, transition: turning ? 'transform 0.13s ease-out, opacity 0.13s ease-out' : 'transform 0.3s ease-out, opacity 0.13s ease-out', opacity: turning ? 0.22 : 1 }}>
        <g>{floor}</g>
        <g>{highlights}</g>
        {mode === 'exploration' && !dialogue && (
          <path d={diamondPath(partyPos.x, partyPos.y, dims)} fill="none" stroke="#ffe066" strokeWidth={1.5} opacity={0.5} />
        )}
        <g>{objs.map((o) => o.el)}</g>
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
        {floats.map((f) => {
          const { cx, cy } = tileCenter(f.x, f.y, dims);
          return (
            <text
              key={f.key}
              className="dmg-float"
              x={cx}
              y={cy - 28}
              textAnchor="middle"
              fill={f.crit ? '#ffd166' : '#ff5a5a'}
              stroke="#1a0606"
              strokeWidth={0.6}
            >
              {f.text}
              {f.crit ? ' ✸' : ''}
            </text>
          );
        })}
        {projs.map((p) => {
          const a = tileCenter(p.from.x, p.from.y, dims);
          const b = tileCenter(p.to.x, p.to.y, dims);
          const ang = (Math.atan2(b.cy - a.cy, b.cx - a.cx) * 180) / Math.PI;
          return (
            <g
              key={`p${p.key}`}
              className="proj"
              style={{ ['--ax' as never]: `${a.cx}px`, ['--ay' as never]: `${a.cy - 18}px`, ['--bx' as never]: `${b.cx}px`, ['--by' as never]: `${b.cy - 18}px` }}
            >
              {p.kind === 'spell' ? (
                <circle r={5} fill={`url(#${p.gradient ?? 'g_glow'})`} />
              ) : (
                <g transform={`rotate(${ang})`}>
                  <rect x={-8} y={-1} width={16} height={2} rx={1} fill="#caa882" />
                  <path d="M8 0 l-4 -2 v4 z" fill="#caa882" />
                </g>
              )}
            </g>
          );
        })}
        {auras.map((au) => {
          const { cx, cy } = tileCenter(au.x, au.y, dims);
          // Canalisation (lanceur) : pulsation serrée et brève. Bénédiction (cible) : expansion soutenue.
          const r0 = au.channel ? 4 : 6, r1 = au.channel ? 18 : 30, dur = au.channel ? '0.45s' : '0.6s';
          return (
            <g key={`au${au.key}`} transform={`translate(${cx},${cy - 18})`} pointerEvents="none">
              <circle r={r0} fill={`url(#${au.gradient})`} opacity={0.85}>
                <animate attributeName="r" from={r0} to={r1} dur={dur} fill="freeze" />
                <animate attributeName="opacity" from="0.85" to="0" dur={dur} fill="freeze" />
              </circle>
              <circle r={3} fill={au.core} opacity={0.9}>
                <animate attributeName="opacity" from="0.9" to="0" dur={dur} fill="freeze" />
              </circle>
            </g>
          );
        })}
        {/* Infobulle de portée au survol (mode tir) : « N m · Courte portée (+40) ». */}
        {aimWeapon &&
          activeC?.pos &&
          hover &&
          (() => {
            const dist = cheb(activeC.pos!, hover);
            if (dist === 0) return null;
            const m = rangeBandModifier(dist, aimWeapon.range!);
            const name = rangeBandName(dist, aimWeapon.range!);
            const { cx, cy } = tileCenter(hover.x, hover.y, dims);
            const label = m == null || !name ? `${dist * 2} m · hors de portée` : `${dist * 2} m · ${name} (${m >= 0 ? '+' : ''}${m})`;
            const col = m == null ? '#888' : bandColor(m);
            const w = label.length * 6.2 + 14;
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
