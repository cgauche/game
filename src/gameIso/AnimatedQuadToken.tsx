import { useEffect, useRef, useState } from 'react';
import { bus, EVT } from '../state/bus';
import { useGame } from '../state/store';
import { resolveQuad, quadSpeciesFromName } from './rig/quadruped/composeQuad';
import { quadWalkPose, quadBitePose, QUAD_DEATH } from './rig/quadruped/quadPose';
import { bonesToSvg } from './rig/renderBones';
import { facingView, screenDir, type View } from './rig/facing';
import type { ColorsSel } from '../state/scene';

const STEP_MS = 160; // aligné sur la marche héros / l'interpolation de déplacement

type Mode = { kind: 'rest' } | { kind: 'walk'; until: number } | { kind: 'bite'; start: number };

/**
 * Token ANIMÉ d'un quadrupède (combat) — démarche squelettique (trot diagonal) pendant le
 * déplacement, morsure à l'attaque, facing 8-dir, pose de mort sur le flanc. Rend la même
 * boîte 120×150 que le rig héros (hébergé par tokenNode). Sans event ⇒ repos (statique).
 */
export function AnimatedQuadToken({ id, name, colors, dead }: { id: string; name: string; colors?: ColorsSel; dead?: boolean }) {
  const [facing, setFacing] = useState<{ view: View; mirror: boolean }>({ view: 'front', mirror: false });
  const [, force] = useState(0);
  const modeRef = useRef<Mode>({ kind: 'rest' });
  const rafRef = useRef(0);

  useEffect(() => {
    const face = (a?: { x: number; y: number }, b?: { x: number; y: number }) => {
      if (!a || !b) return;
      const st = useGame.getState();
      const vd = st.scene ? { ...st.scene.dimensions, rot: st.camRot } : undefined;
      const { dx, dy } = screenDir(a, b, vd);
      if (dx !== 0 || dy !== 0) setFacing(facingView(dx, dy));
    };
    const loop = () => {
      const m = modeRef.current;
      const t = performance.now();
      if (m.kind === 'walk' && t > m.until) modeRef.current = { kind: 'rest' };
      else if (m.kind === 'bite' && t - m.start > 360) modeRef.current = { kind: 'rest' };
      force((n) => n + 1);
      rafRef.current = modeRef.current.kind === 'rest' ? 0 : requestAnimationFrame(loop);
    };
    const ensureLoop = () => { if (!rafRef.current) rafRef.current = requestAnimationFrame(loop); };
    const offMove = bus.on(EVT.ANIM_MOVE, (d: { id: string; path?: { x: number; y: number }[] }) => {
      if (d.id !== id) return;
      const p = d.path;
      if (p && p.length > 1) face(p[0], p[p.length - 1]);
      modeRef.current = { kind: 'walk', until: performance.now() + Math.max(1, p?.length ?? 1) * STEP_MS };
      ensureLoop();
    });
    const offAttack = bus.on(EVT.ANIM_ATTACK, (d: { from: string; to: string }) => {
      if (d.from !== id) return;
      const cs = useGame.getState().battle?.combatants;
      face(cs?.find((c) => c.id === d.from)?.pos, cs?.find((c) => c.id === d.to)?.pos);
      modeRef.current = { kind: 'bite', start: performance.now() };
      ensureLoop();
    });
    return () => { offMove(); offAttack(); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [id]);

  const m = modeRef.current;
  const now = performance.now();
  const pose: Record<string, number> = dead
    ? QUAD_DEATH
    : m.kind === 'walk'
      ? quadWalkPose(((now / STEP_MS) % 2) / 2)
      : m.kind === 'bite'
        ? quadBitePose(Math.min(1, (now - m.start) / 280))
        : {};
  const svg = bonesToSvg(resolveQuad(quadSpeciesFromName(name), facing.view, pose, colors));
  return <g transform={facing.mirror ? 'translate(120,0) scale(-1,1)' : undefined} dangerouslySetInnerHTML={{ __html: svg }} />;
}
