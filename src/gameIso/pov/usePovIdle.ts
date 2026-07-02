import { useEffect, useRef, useState } from 'react';

/**
 * Horloge d'idle PURE et ISOLÉE de la couche billboards POV : une boucle rAF autonome qui renvoie le
 * temps écoulé (ms) depuis le montage. SEUL le sous-arbre qui la consomme se re-rend par frame — la
 * géométrie POV mémoïsée (sols/murs) ne bouge pas. Aucune lecture de store/bus (≠ `usePlanAnim`, couplé
 * au combat iso via `useGame` + le bus d'anim) → utilisable dans la couche billboards PURE, testée sous
 * `renderToStaticMarkup` : là, aucun effet/rAF ne tourne, l'horloge reste FIGÉE à 0 → le consommateur
 * rend sa pose de repos INITIALE (phase 0), markup identique au rendu statique.
 *
 * PARTAGÉE par les deux chemins d'idle POV : PovPerson échantillonne `CLIPS.idle` (respiration humanoïde,
 * cadence propre du clip) et PovCreature dérive une phase 0→1 pour `plan.idlePose` (gabarits) — chacun
 * applique SA cadence à cette même horloge, plutôt qu'une phase imposée (les deux périodes diffèrent).
 */
export function usePovIdle(): number {
  const [ms, setMs] = useState(0);
  const start = useRef(0);
  useEffect(() => {
    let raf = 0;
    start.current = performance.now();
    const loop = (now: number) => {
      setMs(now - start.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return ms;
}
