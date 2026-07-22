import { useState } from 'react';
import { useGame } from '../state/store';
import type { Objective } from '../state/store';
import { Icon } from './Icon';
import { formatImperial } from '../engine/clock';
import { t } from '../i18n';

/** Libellé de compte à rebours (#668) — dérivé de `deadline - now` en MINUTES, aux mêmes seuils que
 *  les clés `countdown.*` (i18n/messages/fr.ts). */
function countdownLabel(deadline: number, now: number): string {
  const rem = deadline - now;
  if (rem <= 0) return t('countdown.due');
  if (rem < 60) return t('countdown.soon');
  if (rem < 1440) return t('countdown.hours', { n: Math.ceil(rem / 60) });
  return t('countdown.days', { n: Math.ceil(rem / 1440) });
}

/**
 * Bandeau d'OBJECTIF courant (#238 « personne ne lit le journal ») — surface discrète mais TOUJOURS
 * visible en exploration, qui répond à « je fais quoi maintenant ? ». Affiche le plus récent objectif
 * de la pile `store.objectives` ; plusieurs → dépliable (chevron) pour voir toute la liste. Vide → rien.
 * En combat, le bandeau est MASQUÉ par l'appelant (`CampaignView`) — l'écran tactique se réserve le HUD.
 * Pur à l'état (props nulles) : testé par `ObjectiveBanner.render`.
 */
export function ObjectiveBanner({ objectives, now }: { objectives: Objective[]; now: number }) {
  const [open, setOpen] = useState(false);
  if (!objectives.length) return null;
  const current = objectives[objectives.length - 1]; // le plus récent
  const rest = objectives.slice(0, -1);
  return (
    <div className="objective-banner">
      <button
        type="button"
        className="objective-head"
        onClick={() => rest.length && setOpen((v) => !v)}
        aria-expanded={rest.length ? open : undefined}
        title={rest.length ? 'Objectifs — déplier' : undefined}
      >
        <Icon id="map-tool/start-flag" size="sm" />
        <span className="objective-text">{current.text}</span>
        {current.deadline != null && (
          <span className="objective-deadline" title={formatImperial(current.deadline)}>
            {countdownLabel(current.deadline, now)}
          </span>
        )}
        {rest.length > 0 && <span className="objective-count">+{rest.length}</span>}
      </button>
      {open && rest.length > 0 && (
        <ul className="objective-list">
          {[...rest].reverse().map((o) => (
            <li key={o.id}>{o.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Monté par `CampaignView` : lit la pile du store et se rend seul (nul si vide). */
export function ObjectiveBannerMount() {
  const objectives = useGame((s) => s.objectives);
  const now = useGame((s) => s.gameTime);
  return <ObjectiveBanner objectives={objectives} now={now} />;
}
