import { useEffect, useRef, useState } from 'react';
import { bus, EVT } from '../state/bus';
import { useGame } from '../state/store';
import { planById, bodyPlanOf, type BodyPlanId } from './rig/bodyPlan';
import { creatureMatch } from './rig/creatures';
import { bonesToSvg } from './rig/renderBones';
import { facingView, screenDir, type View } from './rig/facing';
import type { ColorsSel } from '../state/scene';

const STEP_MS = 160; // démarche (aligné déplacement)
const IDLE_MS = 1600; // période de l'anim de repos (battement/ondulation/dodelinement)

type Mode = { kind: 'rest' } | { kind: 'walk'; until: number } | { kind: 'attack'; start: number };

/**
 * Token ANIMÉ GÉNÉRIQUE pour TOUT gabarit rigué non-bipède (quadrupède, ailé, serpentin,
 * arachnide, aviaire, céphalopode). Pilote l'anim via les poses du PLAN (walk/attack/death +
 * idlePose joué en continu) — un seul token pour tous les plans, plus de token par-gabarit.
 * Facing 8-dir rot-aware, recolor, pose de mort. Hébergé dans la boîte 120×150 par tokenNode.
 */
export function AnimatedPlanToken({ id, name, colors, dead }: { id: string; name: string; colors?: ColorsSel; dead?: boolean }) {
  const [facing, setFacing] = useState<{ view: View; mirror: boolean }>({ view: 'front', mirror: false });
  const [, force] = useState(0);
  const modeRef = useRef<Mode>({ kind: 'rest' });
  const rafRef = useRef(0);

  const planId = bodyPlanOf(name);
  const plan = planId === 'monolithic' ? null : planById(planId as BodyPlanId);
  const hasIdle = !!plan?.idlePose;

  useEffect(() => {
    if (!plan) return;
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
      else if (m.kind === 'attack' && t - m.start > 360) modeRef.current = { kind: 'rest' };
      force((n) => n + 1);
      // tant qu'il y a une anim de repos, la boucle tourne en continu (créature vivante) ;
      // sinon elle s'arrête au repos (économie) comme l'ancien token quad.
      rafRef.current = modeRef.current.kind === 'rest' && (!hasIdle || dead) ? 0 : requestAnimationFrame(loop);
    };
    const ensureLoop = () => { if (!rafRef.current) rafRef.current = requestAnimationFrame(loop); };
    if (hasIdle && !dead) ensureLoop();
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
      modeRef.current = { kind: 'attack', start: performance.now() };
      ensureLoop();
    });
    return () => { offMove(); offAttack(); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [id, plan, hasIdle, dead]);

  if (!plan) return null;
  const species = creatureMatch(name)?.name ?? plan.speciesNames()[0] ?? '';
  const m = modeRef.current;
  const now = performance.now();
  const pose: Record<string, number> = dead
    ? plan.deathPose()
    : m.kind === 'walk'
      ? plan.walkPose(((now / STEP_MS) % 2) / 2)
      : m.kind === 'attack'
        ? plan.attackPose(Math.min(1, (now - m.start) / 280))
        : plan.idlePose
          ? plan.idlePose((now % IDLE_MS) / IDLE_MS)
          : plan.restPose();
  const svg = bonesToSvg(plan.resolve(species, facing.view, pose, { colors }));
  return <g transform={facing.mirror ? 'translate(120,0) scale(-1,1)' : undefined} dangerouslySetInnerHTML={{ __html: svg }} />;
}
