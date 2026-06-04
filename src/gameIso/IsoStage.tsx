/**
 * Rendu isométrique SVG (React) — remplace le rendu Phaser. Lit le store et
 * dessine la scène courante (exploration ou combat), gère le clic→tuile, les
 * surbrillances de combat et le déplacement animé. Réutilise toute la logique.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import './anim.css';
import { useGame } from '../state/store';
import { Scene as GameScene, tileAt, isWalkable } from '../state/scene';
import { pathTo } from '../state/path';
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
  wallBlock,
  tree,
  placeSprite,
  enemySprite,
  pnjSprite,
  entitySprite,
} from './sprites';
import { hashSeed } from './appearance';
import { RigSprite } from './rig/composeRig';
import { defaultAppearance } from './rig/appearance';
import { equipFromCombatant } from './rig/parts/equipment';
import { groundTile } from './ground';
import { buildingObj } from './BuildingSprite';
import { roofHidden } from '../state/buildings';

const HERO_RING = ['#4f8fe0', '#37c07a', '#e0b13f', '#b455c9'];

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
  const dialogue = useGame((s) => s.dialogue);
  const svgRef = useRef<SVGSVGElement>(null);
  const movingRef = useRef(false);

  // Dégâts flottants en combat (déclenchés par l'évènement ANIM_ATTACK du moteur).
  type Float = { key: number; x: number; y: number; text: string; crit: boolean };
  const [floats, setFloats] = useState<Float[]>([]);
  const floatId = useRef(0);
  useEffect(() => {
    const off = bus.on(EVT.ANIM_ATTACK, (d: any) => {
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

  if (!scene) return null;
  const dims: Dims = scene.dimensions;
  const size = stageSize(dims);

  // --- Couche sol (losanges + raccord d'arêtes) ---
  const floor: JSX.Element[] = [];
  for (let y = 0; y < dims.h; y++)
    for (let x = 0; x < dims.w; x++)
      floor.push(<g key={`f${x}-${y}`} dangerouslySetInnerHTML={{ __html: groundTile(scene, x, y, dims) }} />);

  // --- Surbrillances de combat ---
  const highlights: JSX.Element[] = [];
  if (mode === 'battle' && battle) {
    for (const k of battle.reachable.keys()) {
      const [x, y] = k.split(',').map(Number);
      highlights.push(<path key={`h${k}`} d={diamondPath(x, y, dims)} fill="#4f8fe0" opacity={0.32} />);
    }
    const active = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
    if (active?.pos)
      highlights.push(
        <path key="active" d={diamondPath(active.pos.x, active.pos.y, dims)} fill="none" stroke="#ffe066" strokeWidth={3} />,
      );
  }

  // --- Objets triés par profondeur (murs, arbres, entités, tokens) ---
  type Obj = { d: number; el: JSX.Element };
  const objs: Obj[] = [];

  // décor statique
  for (let y = 0; y < dims.h; y++)
    for (let x = 0; x < dims.w; x++) {
      const t = tileAt(scene, x, y);
      if (t === 'mur') objs.push({ d: depth(x, y), el: <g key={`w${x}-${y}`} dangerouslySetInnerHTML={{ __html: wallBlock(x, y, dims) }} /> });
      if (t === 'bois') objs.push({ d: depth(x, y) - 0.1, el: <g key={`t${x}-${y}`} dangerouslySetInnerHTML={{ __html: tree(x, y, dims) }} /> });
    }

  // bâtiments multi-tuiles (toit togglable pour le cutaway)
  const allies =
    mode === 'battle' && battle
      ? battle.combatants.filter((c) => c.kind === 'hero' && c.pos).map((c) => c.pos!)
      : [partyPos];
  const night = scene.ambiance === 'nuit';
  for (const b of scene.buildings ?? []) objs.push(buildingObj(b, dims, roofHidden(b, allies), night));

  const token = (id: string, x: number, y: number, inner: string, scale: number, ringColor?: string, dim?: boolean) => {
    const { cx, cy } = tileCenter(x, y, dims);
    const feetY = cy + TH / 2;
    return (
      <g
        key={id}
        style={{ transform: `translate(${cx}px,${feetY}px)`, transition: 'transform 0.14s linear', opacity: dim ? 0.4 : 1 }}
      >
        <ellipse cx={0} cy={0} rx={16 * scale + 5} ry={(16 * scale + 5) / 2} fill="#000" opacity={0.33} />
        {ringColor && <ellipse cx={0} cy={0} rx={18 * scale} ry={9 * scale} fill="none" stroke={ringColor} strokeWidth={2.5} />}
        <g transform={`translate(${-60 * scale},${-150 * scale}) scale(${scale})`} dangerouslySetInnerHTML={{ __html: inner }} />
      </g>
    );
  };

  // Variante de token() hébergeant des enfants React (rig héros) — même ombre/anneau/échelle.
  const tokenNode = (id: string, x: number, y: number, child: ReactNode, scale: number, ringColor?: string, dim?: boolean) => {
    const { cx, cy } = tileCenter(x, y, dims);
    const feetY = cy + TH / 2;
    return (
      <g
        key={id}
        style={{ transform: `translate(${cx}px,${feetY}px)`, transition: 'transform 0.14s linear', opacity: dim ? 0.4 : 1 }}
      >
        <ellipse cx={0} cy={0} rx={16 * scale + 5} ry={(16 * scale + 5) / 2} fill="#000" opacity={0.33} />
        {ringColor && <ellipse cx={0} cy={0} rx={18 * scale} ry={9 * scale} fill="none" stroke={ringColor} strokeWidth={2.5} />}
        <g transform={`translate(${-60 * scale},${-150 * scale}) scale(${scale})`}>{child}</g>
      </g>
    );
  };

  if (mode === 'battle' && battle) {
    let hi = 0;
    for (const c of battle.combatants) {
      if (!c.pos) continue;
      const isHero = c.kind === 'hero';
      const ring = isHero ? HERO_RING[hi++ % HERO_RING.length] : '#c0392b';
      if (isHero) {
        const el = tokenNode(
          c.id, c.pos.x, c.pos.y,
          <RigSprite appearance={c.appearance ?? defaultAppearance(c)} equip={equipFromCombatant(c)} career={c.career} />,
          0.62, ring, isOutOfAction(c),
        );
        objs.push({ d: depth(c.pos.x, c.pos.y) + 0.5, el });
      } else {
        const inner = enemySprite(c.name, hashSeed(c.id));
        objs.push({ d: depth(c.pos.x, c.pos.y) + 0.5, el: token(c.id, c.pos.x, c.pos.y, inner, 0.62, ring, isOutOfAction(c)) });
      }
    }
  } else {
    for (const ent of scene.entities) {
      if (ent.kind === 'heroStart') continue;
      const inner = entitySprite(ent);
      objs.push({ d: depth(ent.pos.x, ent.pos.y), el: token(`e-${ent.id}`, ent.pos.x, ent.pos.y, inner, 0.55) });
    }
    // groupe (token = 1er héros)
    const leader = party[0];
    const el = leader
      ? tokenNode(
          '__party', partyPos.x, partyPos.y,
          <RigSprite appearance={leader.appearance ?? defaultAppearance(leader)} equip={equipFromCombatant(leader)} career={leader.career} />,
          0.6, HERO_RING[0],
        )
      : token('__party', partyPos.x, partyPos.y, pnjSprite(), 0.6, HERO_RING[0]);
    objs.push({ d: depth(partyPos.x, partyPos.y) + 0.5, el });
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

  // --- Interaction (clic → tuile) ---
  const onPointerDown = (ev: React.PointerEvent) => {
    const st = useGame.getState();
    const sc = st.scene;
    if (!sc || st.dialogue) return;
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const { x, y } = screenToTile(loc.x - cam.x, loc.y - cam.y, dims);
    if (x < 0 || y < 0 || x >= dims.w || y >= dims.h) return;

    if (st.mode === 'battle') {
      const occ = st.battle?.combatants.find((c) => c.pos && c.pos.x === x && c.pos.y === y && !isOutOfAction(c));
      // En mode incantation, on peut cibler n'importe quel combattant (allié,
      // ennemi ou soi) ; sinon seuls les ennemis sont cliquables pour attaquer.
      if (occ && (occ.kind === 'enemy' || st.battle?.action === 'cast')) st.battleClickEntity(occ.id);
      else st.battleClickTile({ x, y });
      return;
    }
    const ent = sc.entities.find((e) => e.pos.x === x && e.pos.y === y);
    if (ent && (ent.dialogueId || ent.kind === 'objet')) {
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
    >
      <defs dangerouslySetInnerHTML={{ __html: DEFS + AMBIANCE_DEFS }} />
      <g style={{ transform: `translate(${cam.x}px,${cam.y}px)`, transition: 'transform 0.45s ease-out' }}>
        <g>{floor}</g>
        <g>{highlights}</g>
        {mode === 'exploration' && !dialogue && (
          <path d={diamondPath(partyPos.x, partyPos.y, dims)} fill="none" stroke="#ffe066" strokeWidth={1.5} opacity={0.5} />
        )}
        <g>{objs.map((o) => o.el)}</g>
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
      </g>
      {/* Ambiance : fixe par-dessus la scène (ne suit pas la caméra) */}
      <rect x={0} y={0} width={VW} height={VH} fill="url(#g_warm)" pointerEvents="none" />
      <rect x={0} y={0} width={VW} height={VH} fill="url(#g_vig)" pointerEvents="none" />
    </svg>
  );
}
