/**
 * Marche visuelle (extraite d'IsoStage) : le token GLISSE le long du chemin (ANIM_MOVE) au lieu
 * de se téléporter à la destination. `walksRef` = id → {path, start} ; rAF tant qu'actif.
 *
 * Le rAF ne fait plus que ce qui est COMMUN aux deux voies de rendu : purger les marches finies et
 * BATTRE la frame (`subscribeWalkFrames`). Qui PEINT décide du reste (#1176, P2-4) — la voie affine
 * repeint ses jetons SVG par un rendu React (`repaint`), la voie volumique lit `walksRef` depuis sa
 * propre boucle de rendu et ne re-rend rien ; seule l'ARRIVÉE y re-synchronise React, en un rendu, pour
 * que les vérités dérivées de l'état de marche (transition de caméra, aperçu de chemin) reprennent la
 * main sur la pose committée du store.
 */
import { useEffect, useRef, useState } from 'react';
import { bus, EVT } from '../../state/bus';
import { walkDuration, STEP_MS } from '../../geometry/walk';
import type { WalkTrack } from './walkPose';

const battements = new Set<() => void>();

/** S'abonne au BATTEMENT de la marche : une passe par frame tant qu'un glissement dure. */
export function subscribeWalkFrames(cb: () => void): () => void {
  battements.add(cb);
  return () => {
    battements.delete(cb);
  };
}

/** `repaint` : la voie qui peint a-t-elle besoin d'un rendu React par frame ? (SVG oui, volumique non.) */
export function useWalkAnim(repaint: boolean) {
  const [, setWalkTick] = useState(0);
  const walksRef = useRef<Record<string, WalkTrack>>({});
  const walkRaf = useRef(0);
  const repaintRef = useRef(repaint);
  useEffect(() => {
    repaintRef.current = repaint;
  }, [repaint]);
  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      let any = false;
      for (const id of Object.keys(walksRef.current)) {
        const w = walksRef.current[id];
        if (now - w.start >= walkDuration(w.path, STEP_MS)) delete walksRef.current[id];
        else any = true;
      }
      for (const cb of [...battements]) cb();
      if (repaintRef.current || !any) setWalkTick((t) => t + 1);
      walkRaf.current = any ? requestAnimationFrame(tick) : 0;
    };
    const off = bus.on(EVT.ANIM_MOVE, (d: any) => {
      if (!d?.path || d.path.length < 2) return;
      walksRef.current[d.id] = { path: d.path, start: performance.now() };
      if (!walkRaf.current) walkRaf.current = requestAnimationFrame(tick);
    });
    return () => { off(); if (walkRaf.current) cancelAnimationFrame(walkRaf.current); walkRaf.current = 0; };
  }, []);
  return walksRef;
}

/** Nonce de micro-secousse (#792) : incrémenté à chaque pas clavier d'exploration REFUSÉ
 *  (MOVE_BLOCKED — snap latéral/zigzag tué, `exploreNav.ALIGN_MIN`). Transmis au jeton du groupe
 *  (`BodyToken.bump`) qui rejoue son animation CSS `token-bump` (80ms) à chaque changement. */
export function useMoveBlockedBump() {
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const off = bus.on(EVT.MOVE_BLOCKED, () => setBump((n) => n + 1));
    return off;
  }, []);
  return bump;
}
