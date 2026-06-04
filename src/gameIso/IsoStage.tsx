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
  terrainOverlay,
  placeSprite,
  enemySprite,
  creatureView,
  pnjSprite,
  entitySprite,
} from './sprites';
import { hashSeed } from './appearance';
import { AnimatedRigToken } from './AnimatedRigToken';
import { enemyRigProfile } from './rig/enemyProfile';
import { facingView, screenDir } from './rig/facing';
import { isSupportiveCast } from './rig/anim/spellClips';
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

  // Anim légère des créatures monolithiques (non riggées) : fente/recul de token entier.
  const [creatureFx, setCreatureFx] = useState<Record<string, string>>({});
  useEffect(() => {
    const fire = (id: string, cls: string) => {
      setCreatureFx((m) => ({ ...m, [id]: cls }));
      setTimeout(() => setCreatureFx((m) => { const n = { ...m }; delete n[id]; return n; }), 340);
    };
    const offA = bus.on(EVT.ANIM_ATTACK, (d: any) => {
      const b = useGame.getState().battle;
      const from = b?.combatants.find((c) => c.id === d.from);
      if (from && from.kind !== 'hero') fire(d.from, 'tok-lunge');
    });
    const offI = bus.on(EVT.ANIM_IMPACT, (d: any) => {
      const b = useGame.getState().battle;
      if (!d?.result?.hit) return;
      const to = b?.combatants.find((c) => c.id === d.to);
      if (to && to.kind !== 'hero') fire(d.to, 'tok-recoil');
    });
    return () => { offA(); offI(); };
  }, []);

  // Facing 8-dir des créatures monolithiques : vue (front/back/profile) + miroir,
  // mis à jour à l'attaque (vers la cible) et au déplacement (vers la destination).
  const [creatureFacing, setCreatureFacing] = useState<Record<string, { view: 'front' | 'back' | 'profile'; mirror: boolean }>>({});
  useEffect(() => {
    const faceTo = (id: string, from?: { x: number; y: number }, to?: { x: number; y: number }) => {
      if (!from || !to) return;
      const { dx, dy } = screenDir(from, to);
      if (dx === 0 && dy === 0) return;
      setCreatureFacing((m) => ({ ...m, [id]: facingView(dx, dy) }));
    };
    const offA = bus.on(EVT.ANIM_ATTACK, (d: any) => {
      const b = useGame.getState().battle;
      const from = b?.combatants.find((c) => c.id === d.from);
      if (from && from.kind !== 'hero') faceTo(d.from, from.pos, b?.combatants.find((c) => c.id === d.to)?.pos);
    });
    const offM = bus.on(EVT.ANIM_MOVE, (d: any) => {
      const p = d?.path;
      if (p && p.length > 1) faceTo(d.id, p[0], p[p.length - 1]);
    });
    return () => { offA(); offM(); };
  }, []);

  // Projectiles volants (distance + sort-missile) : vol from→to synchronisé à l'impact.
  type Proj = { key: number; from: { x: number; y: number }; to: { x: number; y: number }; kind: string };
  const [projs, setProjs] = useState<Proj[]>([]);
  const projId = useRef(0);
  // Halos d'incantation de soutien (bénédiction/miracle) : pulsation sur la cible.
  const [auras, setAuras] = useState<{ key: number; x: number; y: number }[]>([]);
  const auraId = useRef(0);
  useEffect(() => {
    const off = bus.on(EVT.ANIM_ATTACK, (d: any) => {
      if (d.kind !== 'ranged' && d.kind !== 'spell') return;
      const b = useGame.getState().battle;
      const from = b?.combatants.find((c) => c.id === d.from)?.pos;
      const to = b?.combatants.find((c) => c.id === d.to)?.pos;
      if (!from || !to) return;
      if (d.kind === 'spell') {
        const caster = b?.combatants.find((c) => c.id === d.from);
        const tgt = b?.combatants.find((c) => c.id === d.to);
        if (isSupportiveCast(caster?.kind, tgt?.kind, d.from === d.to)) {
          const key = ++auraId.current; // soutien : halo sur la cible, pas de projectile
          setAuras((a) => [...a, { key, x: to.x, y: to.y }]);
          setTimeout(() => setAuras((a) => a.filter((x) => x.key !== key)), 620);
          return;
        }
      }
      const key = ++projId.current;
      setProjs((p) => [...p, { key, from, to, kind: d.kind }]);
      setTimeout(() => setProjs((p) => p.filter((x) => x.key !== key)), 340);
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
      const ov = terrainOverlay(tileAt(scene, x, y), x, y, dims);
      if (ov) objs.push({ d: ov.d, el: <g key={`ov${x}-${y}`} dangerouslySetInnerHTML={{ __html: ov.html }} /> });
    }

  // bâtiments multi-tuiles (toit togglable pour le cutaway)
  const allies =
    mode === 'battle' && battle
      ? battle.combatants.filter((c) => c.kind === 'hero' && c.pos).map((c) => c.pos!)
      : [partyPos];
  const night = scene.ambiance === 'nuit';
  for (const b of scene.buildings ?? []) objs.push(buildingObj(b, dims, roofHidden(b, allies), night));

  const token = (id: string, x: number, y: number, inner: string, scale: number, ringColor?: string, dim?: boolean, fx?: string, mirror?: boolean) => {
    const { cx, cy } = tileCenter(x, y, dims);
    const feetY = cy + TH / 2;
    return (
      <g
        key={id}
        style={{ transform: `translate(${cx}px,${feetY}px)`, transition: 'transform 0.14s linear', opacity: dim ? 0.4 : 1 }}
      >
        <ellipse cx={0} cy={0} rx={16 * scale + 5} ry={(16 * scale + 5) / 2} fill="#000" opacity={0.33} />
        {ringColor && <ellipse cx={0} cy={0} rx={18 * scale} ry={9 * scale} fill="none" stroke={ringColor} strokeWidth={2.5} />}
        {/* calque fx (anim légère token entier pour les créatures) — sans transform de base */}
        <g className={fx}>
          <g transform={`translate(${-60 * scale},${-150 * scale}) scale(${scale})`}>
            {/* miroir gauche/droite autour du centre de la boîte créature (x=80) */}
            <g transform={mirror ? 'translate(160,0) scale(-1,1)' : undefined} dangerouslySetInnerHTML={{ __html: inner }} />
          </g>
        </g>
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
      const prof = isHero ? null : enemyRigProfile(c);
      if (isHero || prof) {
        // Héros ET ennemis humanoïdes : rig (arme visible, facing 8-dir, anims).
        const el = tokenNode(c.id, c.pos.x, c.pos.y, <AnimatedRigToken combatant={c} profile={prof ?? undefined} />, 0.62, ring, isOutOfAction(c));
        objs.push({ d: depth(c.pos.x, c.pos.y) + 0.5, el });
      } else {
        const f = creatureFacing[c.id] ?? { view: 'front' as const, mirror: false };
        const inner = creatureView(c.name, f.view, hashSeed(c.id));
        objs.push({ d: depth(c.pos.x, c.pos.y) + 0.5, el: token(c.id, c.pos.x, c.pos.y, inner, 0.62, ring, isOutOfAction(c), creatureFx[c.id], f.mirror) });
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
      ? tokenNode('__party', partyPos.x, partyPos.y, <AnimatedRigToken combatant={leader} />, 0.6, HERO_RING[0])
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
                <circle r={5} fill="url(#g_glow)" />
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
          return (
            <g key={`au${au.key}`} transform={`translate(${cx},${cy - 18})`} pointerEvents="none">
              <circle r={6} fill="url(#g_glow)" opacity={0.85}>
                <animate attributeName="r" from="6" to="30" dur="0.6s" fill="freeze" />
                <animate attributeName="opacity" from="0.85" to="0" dur="0.6s" fill="freeze" />
              </circle>
              <circle r={3} fill="#fff6c0" opacity={0.9}>
                <animate attributeName="opacity" from="0.9" to="0" dur="0.6s" fill="freeze" />
              </circle>
            </g>
          );
        })}
      </g>
      {/* Ambiance : fixe par-dessus la scène (ne suit pas la caméra) */}
      <rect x={0} y={0} width={VW} height={VH} fill="url(#g_warm)" pointerEvents="none" />
      <rect x={0} y={0} width={VW} height={VH} fill="url(#g_vig)" pointerEvents="none" />
    </svg>
  );
}
