import { GameDate } from './GameDate';
import { Coins } from './Coins';
import type { Money } from '../engine/money';

/**
 * ScreenMeta — méta d'en-tête STANDARD `{ time?, money? }` : date/heure de campagne (`<GameDate>`,
 * chip `.hud-clock`) + bourse du groupe (`<Coins>`, `.port-purse`). Source UNIQUE composée par
 * `ScreenShell` (en-tête d'écran plein-champ) ET l'en-tête du menu ☰ (`GameMenu`) — jamais dupliquer
 * ce couple date+bourse à la main.
 */
export function ScreenMeta({ meta }: { meta?: { time?: number; money?: Money } }) {
  if (meta?.time == null && !meta?.money) return null;
  return (
    <>
      {meta?.time != null && (
        <span className="hud-clock" title="Date et heure de la campagne"><GameDate time={meta.time} /></span>
      )}
      {meta?.money && (
        <span className="port-purse">Bourse : <b><Coins money={meta.money} /></b></span>
      )}
    </>
  );
}
