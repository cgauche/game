/**
 * Marche visuelle (extraite d'IsoStage) : le token GLISSE le long du chemin (ANIM_MOVE) au lieu
 * de se téléporter à la destination. `walksRef` = id → {path, start} ; rAF tant qu'actif (le
 * `setWalkTick` force le re-rendu image par image).
 */
import { useEffect, useRef, useState } from 'react';
import { bus, EVT } from '../../state/bus';
import { walkDuration, STEP_MS } from '../walkPath';

export function useWalkAnim() {
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
  return walksRef;
}
