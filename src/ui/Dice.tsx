import { useEffect, useState } from 'react';

/** Affichage canonique d'un d100 (100 → « 00 », zéro-paddé). */
export const fmtD100 = (roll: number) => (roll === 100 ? '00' : String(roll).padStart(2, '0'));

const TICK_MS = 45; // cadence du « roulement »
const TICKS = 10; // ~0,45 s avant de se poser

/**
 * Dé d100 ANIMÉ : au montage et à chaque NOUVEAU jet (relance Chance), le nombre « roule »
 * (valeurs au hasard ~0,5 s) avant de se poser sur le résultat. Le rendu initial est la valeur
 * FINALE — SSR et tests (renderToStaticMarkup) voient toujours le vrai dé ; l'animation ne
 * démarre qu'au montage côté client et est sautée avec `prefers-reduced-motion`.
 */
export function Dice({ roll }: { roll: number }) {
  const [shown, setShown] = useState(roll);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      setShown(roll);
      return;
    }
    let tick = 0;
    setRolling(true);
    const id = window.setInterval(() => {
      tick += 1;
      if (tick >= TICKS) {
        window.clearInterval(id);
        setShown(roll);
        setRolling(false);
      } else {
        setShown(1 + Math.floor(Math.random() * 100));
      }
    }, TICK_MS);
    return () => {
      window.clearInterval(id);
      setShown(roll);
      setRolling(false);
    };
  }, [roll]);

  return <span className={`d100${rolling ? ' d100-rolling' : ''}`}>{fmtD100(shown)}</span>;
}
