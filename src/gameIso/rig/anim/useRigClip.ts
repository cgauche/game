import { useCallback, useEffect, useRef, useState } from 'react';
import type { Pose } from '../poses';
import { CLIPS, sampleClip, type Clip, type ClipName } from './clips';

interface Active {
  clip: Clip;
  start: number;
  onImpact?: () => void;
  impactDone: boolean;
  onDone?: () => void;
  hold: boolean;
}

/** Anime le rig : boucle rAF qui échantillonne le clip courant en Pose. play()/hold().
 *  `restClip` = posture de REPOS (sinon idle) : un clip d'ambiance (dévore/hurle…) vers
 *  lequel on retombe après chaque geste — un seul token sert combat ET exploration. */
export function useRigClip(restClip?: Clip) {
  const [pose, setPose] = useState<Pose>({});
  const rest = useRef<Clip | undefined>(restClip);
  rest.current = restClip;
  const restState = (): Active => ({ clip: rest.current ?? CLIPS.idle, start: performance.now(), impactDone: true, hold: !!rest.current });
  const active = useRef<Active>({ clip: restClip ?? CLIPS.idle, start: 0, impactDone: true, hold: !!restClip });
  const raf = useRef(0);

  useEffect(() => {
    let mounted = true;
    if (active.current.start === 0) active.current.start = performance.now();
    const loop = (now: number) => {
      const a = active.current;
      const clip = a.clip;
      const elapsed = now - a.start;
      const { pose: p, done } = sampleClip(clip, elapsed);
      setPose(p);
      if (!a.impactDone && clip.onImpact != null && elapsed >= clip.onImpact) {
        a.impactDone = true;
        a.onImpact?.();
      }
      if (done && !clip.loop && !a.hold) {
        a.onDone?.();
        active.current = restState(); // retombe au repos (idle OU clip d'ambiance)
      }
      if (mounted) raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf.current);
    };
  }, []);

  /** Joue un clip nommé du registre de base (idle/walk/hit/dodge…). */
  const play = useCallback((name: ClipName, opts?: { onImpact?: () => void; onDone?: () => void }) => {
    active.current = { clip: CLIPS[name], start: performance.now(), onImpact: opts?.onImpact, onDone: opts?.onDone, impactDone: false, hold: false };
  }, []);
  /** Joue un clip arbitraire (gestes par-arme/par-sort résolus dynamiquement). */
  const playClip = useCallback((clip: Clip, opts?: { onImpact?: () => void; onDone?: () => void }) => {
    active.current = { clip, start: performance.now(), onImpact: opts?.onImpact, onDone: opts?.onDone, impactDone: false, hold: false };
  }, []);
  const hold = useCallback((name: ClipName) => {
    active.current = { clip: CLIPS[name], start: performance.now(), impactDone: true, hold: true };
  }, []);
  /** Maintient un clip arbitraire (boucle d'ambiance ou posture tenue). */
  const holdClip = useCallback((clip: Clip) => {
    active.current = { clip, start: performance.now(), impactDone: true, hold: true };
  }, []);

  return { pose, play, playClip, hold, holdClip };
}
