/**
 * Rendu isométrique SVG (React) — remplace le rendu Phaser. Lit le store et
 * dessine la scène courante (exploration ou combat), gère le clic→tuile, les
 * surbrillances de combat et le déplacement animé. Réutilise toute la logique.
 */
import { useEffect, useRef } from 'react';
import { useGame } from '../state/store';
import { Scene as GameScene, tileAt, isWalkable } from '../state/scene';
import { pathTo } from '../state/path';
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
  TILE_GRAD,
  wallBlock,
  tree,
  placeSprite,
  heroSprite,
  enemySprite,
  pnjSprite,
  objetSprite,
  propSprite,
} from './sprites';

const HERO_RING = ['#4f8fe0', '#37c07a', '#e0b13f', '#b455c9'];

export function IsoStage() {
  const scene = useGame((s) => s.scene);
  const mode = useGame((s) => s.mode);
  const partyPos = useGame((s) => s.partyPos);
  const party = useGame((s) => s.party);
  const battle = useGame((s) => s.battle);
  const dialogue = useGame((s) => s.dialogue);
  const svgRef = useRef<SVGSVGElement>(null);
  const movingRef = useRef(false);

  if (!scene) return null;
  const dims: Dims = scene.dimensions;
  const size = stageSize(dims);

  // --- Couche sol (losanges) ---
  const floor: JSX.Element[] = [];
  for (let y = 0; y < dims.h; y++)
    for (let x = 0; x < dims.w; x++) {
      const t = tileAt(scene, x, y);
      floor.push(
        <path key={`f${x}-${y}`} d={diamondPath(x, y, dims)} fill={`url(#${TILE_GRAD[t]})`} stroke="rgba(0,0,0,0.16)" />,
      );
    }

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

  if (mode === 'battle' && battle) {
    let hi = 0;
    for (const c of battle.combatants) {
      if (!c.pos) continue;
      const isHero = c.kind === 'hero';
      const ring = isHero ? HERO_RING[hi++ % HERO_RING.length] : '#c0392b';
      const inner = isHero ? heroSprite(c) : enemySprite(c.name);
      objs.push({ d: depth(c.pos.x, c.pos.y) + 0.5, el: token(c.id, c.pos.x, c.pos.y, inner, 0.62, ring, isOutOfAction(c)) });
    }
  } else {
    for (const ent of scene.entities) {
      if (ent.kind === 'heroStart') continue;
      const inner =
        ent.kind === 'pnj' ? pnjSprite() : ent.kind === 'ennemi' ? enemySprite(ent.ref ?? '') : ent.kind === 'objet' ? objetSprite() : propSprite();
      objs.push({ d: depth(ent.pos.x, ent.pos.y), el: token(`e-${ent.id}`, ent.pos.x, ent.pos.y, inner, 0.55) });
    }
    // groupe (token = 1er héros)
    const leader = party[0];
    const inner = leader ? heroSprite(leader) : pnjSprite();
    objs.push({ d: depth(partyPos.x, partyPos.y) + 0.5, el: token('__party', partyPos.x, partyPos.y, inner, 0.6, HERO_RING[0]) });
  }
  objs.sort((a, b) => a.d - b.d);

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
    const { x, y } = screenToTile(loc.x, loc.y, dims);
    if (x < 0 || y < 0 || x >= dims.w || y >= dims.h) return;

    if (st.mode === 'battle') {
      const occ = st.battle?.combatants.find((c) => c.pos && c.pos.x === x && c.pos.y === y && !isOutOfAction(c));
      if (occ && occ.kind === 'enemy') st.battleClickEntity(occ.id);
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
      viewBox={`0 0 ${size.w} ${size.h}`}
      width={size.w}
      height={size.h}
      onPointerDown={onPointerDown}
    >
      <defs dangerouslySetInnerHTML={{ __html: DEFS }} />
      <g>{floor}</g>
      <g>{highlights}</g>
      <g>{objs.map((o) => o.el)}</g>
      {mode === 'exploration' && !dialogue && (
        <g>
          {(() => {
            const { cx, cy } = tileCenter(partyPos.x, partyPos.y, dims);
            return <path d={diamondPath(partyPos.x, partyPos.y, dims)} fill="none" stroke="#ffe066" strokeWidth={1.5} opacity={0.5} />;
          })()}
        </g>
      )}
    </svg>
  );
}
