import { useEffect, useRef, useState } from 'react';
import { bus, EVT } from '../state/bus';
import { useGame } from '../state/store';
import { planById, bodyPlanOf, type BodyPlanId, type BodyPlan } from './rig/bodyPlan';
import { creatureMatch } from './rig/creatures';
import { quadAttackPose, hasQuadAttackPose } from './rig/anim/creatureAttackPoses';
import { project, type View } from './rig/facing';
import type { Dir8 } from '../state/dir8';
import { STEP_MS, walkMs } from './walkPath';

const IDLE_MS = 1600; // période de l'anim de repos (battement/ondulation/dodelinement)

type Mode = { kind: 'rest' } | { kind: 'walk'; until: number } | { kind: 'attack'; start: number; atk?: string };

/**
 * Pilote l'ANIMATION d'un gabarit rigué non-bipède (quadrupède/ailé/serpentin/…) : repos en
 * continu (idlePose) + marche/attaque pilotées par le bus, projeté en vue 8-dir. Renvoie le
 * `plan` (null si monolithique), l'espèce, la `pose` courante, et `view`+`mirror`. EXTRAIT
 * d'AnimatedPlanToken pour être PARTAGÉ — le token seul ET MountedToken (monture) le consomment.
 */
export function usePlanAnim(id: string, name: string, dead?: boolean, facing?: Dir8): {
  plan: BodyPlan | null;
  species: string;
  pose: Record<string, number>;
  view: View;
  mirror: boolean;
} {
  const camRot = useGame((s) => s.camRot);
  const worldDir = useGame((s) => s.facing?.[id]) ?? facing;
  const [, force] = useState(0);
  const modeRef = useRef<Mode>({ kind: 'rest' });
  const rafRef = useRef(0);

  const planId = bodyPlanOf(name);
  const plan = planId === 'monolithic' ? null : planById(planId as BodyPlanId);
  const hasIdle = !!plan?.idlePose;

  useEffect(() => {
    if (!plan) return;
    const loop = () => {
      const m = modeRef.current;
      const t = performance.now();
      if (m.kind === 'walk' && t > m.until) modeRef.current = { kind: 'rest' };
      else if (m.kind === 'attack' && t - m.start > 360) modeRef.current = { kind: 'rest' };
      force((n) => n + 1);
      rafRef.current = modeRef.current.kind === 'rest' && (!hasIdle || dead) ? 0 : requestAnimationFrame(loop);
    };
    const ensureLoop = () => { if (!rafRef.current) rafRef.current = requestAnimationFrame(loop); };
    if (hasIdle && !dead) ensureLoop();
    const offMove = bus.on(EVT.ANIM_MOVE, (d: { id: string; path?: { x: number; y: number }[] }) => {
      if (d.id !== id) return;
      const p = d.path;
      modeRef.current = { kind: 'walk', until: performance.now() + Math.max(1, walkMs(p ?? [])) }; // s'arrête à l'arrivée réelle (plus d'off-by-one)
      ensureLoop();
    });
    const offAttack = bus.on(EVT.ANIM_ATTACK, (d: { from: string; to: string; creatureAttack?: string }) => {
      if (d.from !== id) return;
      modeRef.current = { kind: 'attack', start: performance.now(), atk: d.creatureAttack };
      ensureLoop();
    });
    return () => { offMove(); offAttack(); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [id, plan, hasIdle, dead]);

  const species = plan ? (creatureMatch(name)?.name ?? plan.speciesNames()[0] ?? '') : '';
  const m = modeRef.current;
  const now = performance.now();
  const pose: Record<string, number> = !plan
    ? {}
    : dead
      ? plan.deathPose()
      : m.kind === 'walk'
        ? plan.walkPose(((now / STEP_MS) % 2) / 2)
        : m.kind === 'attack'
          ? (m.atk && (planId === 'quadruped' || planId === 'winged') && hasQuadAttackPose(m.atk)
              ? quadAttackPose(m.atk, Math.min(1, (now - m.start) / 280))
              : plan.attackPose(Math.min(1, (now - m.start) / 280)))
          : plan.idlePose
            ? plan.idlePose((now % IDLE_MS) / IDLE_MS)
            : plan.restPose();
  const fv = worldDir ? project(worldDir, camRot) : { view: 'front' as View, mirror: false };
  return { plan, species, pose, view: fv.view, mirror: fv.mirror };
}
