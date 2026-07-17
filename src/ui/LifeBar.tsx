import type { ReactNode } from 'react';
import type { GaugeTone } from './NotchGauge';

/**
 * Barre de remplissage LISSE (pas de crans) — la jauge de vie horizontale des portraits
 * (`PortraitTile`, `hpColor`), extraite en primitive partagée (arbitrage user 2026-07-17 : « pourquoi
 * la version crantée ? […] on sait gérer de vraies barres de blessures, on s'en sert sous les
 * portraits »). Deux présentations : `row` (label à gauche, piste, valeur à droite — colonne de fiche,
 * jauges de ressource) et `overlay` (piste seule, valeur superposée AU CENTRE — portraits compacts).
 * Ton : `tone` fixe/dérivé (palier, comme `NotchGauge`) OU `color` littérale (teinte CONTINUE, `hpColor`).
 * Dépassement (`value > max`) explicite : piste pleine + surplus affiché + valeur en gras danger —
 * générique, aucune classe par écran.
 */
export interface LifeBarProps {
  value: number;
  max: number;
  label?: ReactNode;
  /** Ton par PALIER, fixe ou dérivé `(value,max)→ton` — ignoré si `color` est fourni. Défaut `neutral`. */
  tone?: GaugeTone | ((value: number, max: number) => GaugeTone);
  /** Couleur CSS littérale (teinte CONTINUE, ex. `hpColor(ratio)`) — surcharge `tone` pour le remplissage. */
  color?: string;
  /** Rendu de la valeur affichée (droite en `row`, superposée en `overlay`). Défaut `value/max`, ou
   *  `value/max · +surplus` en dépassement. `null` masque la valeur (ex. PV réservés à l'Inspection). */
  format?: (value: number, max: number) => ReactNode;
  /** Piste seule, valeur superposée au centre (portraits compacts) — sans label. */
  overlay?: boolean;
  className?: string;
  title?: string;
}

export function LifeBar({ value, max, label, tone, color, format, overlay, className, title }: LifeBarProps) {
  const overflowing = max > 0 && value > max;
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const t: GaugeTone = overflowing ? 'danger' : typeof tone === 'function' ? tone(value, max) : tone ?? 'neutral';
  const display = format
    ? format(value, max)
    : overflowing
      ? `${value}/${max} · +${value - max}`
      : `${value}/${max}`;

  return (
    <div
      className={`life-bar${className ? ` ${className}` : ''}`}
      data-tone={color ? undefined : t}
      data-overflow={overflowing ? '' : undefined}
      data-overlay={overlay ? '' : undefined}
      title={title}
    >
      {!overlay && label != null && <span className="life-bar__label">{label}</span>}
      <div
        className="life-bar__track"
        role="meter"
        aria-label={typeof label === 'string' ? label : undefined}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <span className="life-bar__fill" style={{ width: `${Math.round((overflowing ? 1 : frac) * 100)}%`, ...(color ? { background: color } : {}) }} />
      </div>
      {display != null && <span className="life-bar__value">{display}</span>}
    </div>
  );
}
