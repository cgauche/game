import { useState } from 'react';
import { bus, EVT } from '../state/bus';

/**
 * Frisson du jet — helper PARTAGÉ (source unique) : un beat cosmétique ~480 ms avant le jet réel,
 * consommé par la RANGÉE (`RollRow`, multi) ET par le bouton « Lancer » hissé dans la barre du
 * `RollShell` (mono). Reprend EXACTEMENT la logique de l'ancien `RollRow.doRoll` : émet
 * `EVT.DICE_ROLL`, puis — sans frisson ou en `prefers-reduced-motion` — résout immédiatement ;
 * sinon anime (`rolling=true`) le temps du `setTimeout`.
 *
 * @param onRoll  Résolveur du jet (peut être absent → `trigger` n'émet que l'événement).
 * @param opts.frisson  Anime avant de résoudre (défaut : false = immédiat).
 */
export function useRollFrisson(onRoll?: () => void, opts?: { frisson?: boolean }): { rolling: boolean; trigger: () => void } {
  const frisson = opts?.frisson ?? false;
  const [rolling, setRolling] = useState(false);
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const trigger = () => {
    bus.emit(EVT.DICE_ROLL);
    if (!onRoll) return;
    if (!frisson || reduceMotion) return onRoll();
    setRolling(true);
    window.setTimeout(() => { setRolling(false); onRoll(); }, 480);
  };
  return { rolling, trigger };
}
