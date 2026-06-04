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

/** Anime le rig : boucle rAF qui échantillonne le clip courant en Pose. play()/hold(). */
export function useRigClip() {
  const [pose, setPose] = useState<Pose>({});
  const active = useRef<Active>({ clip: CLIPS.idle, start: 0, impactDone: true, hold: false });
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
        active.current = { clip: CLIPS.idle, start: now, impactDone: true, hold: false };
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

  return { pose, play, playClip, hold };
}
