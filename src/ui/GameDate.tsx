import { dayPhase, formatImperial, toDate } from '../engine/clock';
import { Icon } from './Icon';

/**
 * Rendu UNIQUE d'un instant de jeu (LOT 5 — composants de donnée unifiés) : icône de la phase du
 * jour (registre `time/*` via `dayPhase().icon`, libellé de phase en tooltip) + jour de semaine
 * (absent des jours intercalaires, canon) + date impériale complète (`formatImperial`). Tout écran
 * qui affiche l'horloge de campagne passe par ici (menu ☰, repos, voyage, sauvegardes, interlude).
 */
export function GameDate({ time }: { time: number }) {
  const phase = dayPhase(time);
  const d = toDate(time);
  return (
    <span className="game-date" title={phase.label}>
      <Icon id={phase.icon} size="sm" />
      <span>{d.weekday ? `${d.weekday} · ` : ''}{formatImperial(time)}</span>
    </span>
  );
}
