import { useEffect, useState } from 'react';

/** Affichage canonique d'un d100 (100 → « 00 », zéro-paddé). */
export const fmtD100 = (roll: number) => (roll === 100 ? '00' : String(roll).padStart(2, '0'));

/** Les DEUX faces physiques d'un d100 (LDB 04 : un d10 « dizaines » + un d10 « unités ») — [tens, units],
 *  chacun 0-9. 100 → [0, 0] (« 00 »), 73 → [7, 3], 7 → [0, 7] (« 07 »). Source UNIQUE de la conversion
 *  percentile → faces physiques (#396 v3, « les dés doivent afficher le bon score »). */
export function d100Faces(roll: number): [number, number] {
  const n = roll === 100 ? 0 : roll;
  return [Math.floor(n / 10), n % 10];
}

/** Face physique d'UN d10 (numéroté 0-9, « 0 » = 10) — un jet `[1,10]` → un chiffre affichable. */
export const d10Face = (v: number): number => (v === 10 ? 0 : v);

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
    let arrete = false;
    setRolling(true);
    // Minuterie prise sur le GLOBAL, jamais sur `window`. Un tick qui survit à la disparition du
    // document (teardown jsdom) ne doit RIEN poser : le `setState` de React y lit `window.event`
    // (getCurrentEventPriority) et jetterait hors de toute pile rattrapable. Sans document, il n'y
    // a plus rien à animer : la minuterie s'éteint d'elle-même.
    const id = setInterval(() => {
      if (arrete || typeof window === 'undefined') {
        arrete = true;
        clearInterval(id);
        return;
      }
      tick += 1;
      if (tick >= TICKS) {
        arrete = true;
        clearInterval(id);
        setShown(roll);
        setRolling(false);
      } else {
        setShown(1 + Math.floor(Math.random() * 100));
      }
    }, TICK_MS);
    return () => {
      arrete = true;
      clearInterval(id);
      setShown(roll);
      setRolling(false);
    };
  }, [roll]);

  return <span className={`d100${rolling ? ' d100-rolling' : ''}`}>{fmtD100(shown)}</span>;
}
