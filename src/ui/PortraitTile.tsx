import { RigPortrait } from './RigPortrait';
import { hpColor } from '../gameIso/teamColors';
import { summarizeEffects, combatantFlags } from '../gameIso/effectIcons';
import type { Combatant } from '../engine/types';

/**
 * Tuile-portrait compacte (HUD façon BG3, mobile-first) — remplace les lignes « Portrait — 11/11 ».
 * Portrait visage (RigPortrait, cadre = `ring`, plein héros / tirets ennemi), JAUGE DE PV VERTICALE
 * à l'intérieur (bord gauche, vert→orange→rouge via hpColor), PV chiffrés DANS le portrait (option),
 * états en colonne À DROITE (max 4 + « ▾ » en débordement — le détail se lit au TAP, pas au survol).
 * Pur à props (testable en SSR), aucune lecture du store.
 */
export interface PortraitTileProps {
  c: Combatant;
  /** Couleur du cadre : teinte d'équipe (frise) ou couleur d'identité du héros (dock). */
  ring: string;
  /** Côté de la vignette en px (dock 56, frise 40). */
  size?: number;
  /** Unité active : surbrillance or + caret ▼. */
  active?: boolean;
  /** PV chiffrés dans le portrait (dock d'équipe seulement, cf. spec). */
  showPv?: boolean;
  /** Jauge de PV interne (bord gauche). Off dans l'ActiveFrame : la vie y est une barre externe. */
  showGauge?: boolean;
  maxStates?: number;
  onClick?: () => void;
  title?: string;
}

export function PortraitTile({ c, ring, size = 56, active, showPv, showGauge = true, maxStates = 4, onClick, title }: PortraitTileProps) {
  const ratio = c.wounds.max > 0 ? Math.max(0, Math.min(1, c.wounds.current / c.wounds.max)) : 0;
  const ko = c.dead || c.wounds.current <= 0 || c.conditions.some((x) => x.name === 'Inconscient');
  const all = summarizeEffects(c.conditions, c.activeEffects, Infinity, combatantFlags(c)).visible;
  const shown = all.slice(0, maxStates);
  const more = all.slice(maxStates);
  return (
    <div className="ptile-wrap">
      <button
        type="button"
        className={`ptile ${active ? 'active' : ''} ${ko ? 'ko' : ''}`}
        style={{ width: size, height: size }}
        onClick={onClick}
        title={title ?? c.name}
      >
        {active && <i className="ptile-caret">▼</i>}
        <RigPortrait combatant={c} size={size} ring={ring} />
        {showGauge && (
          <i className="ptile-gauge">
            <b style={{ height: `${Math.round(ratio * 100)}%`, background: hpColor(ratio) }} />
          </i>
        )}
        {showPv && <span className="ptile-pv">{c.dead ? '☠️' : `${c.wounds.current}/${c.wounds.max}`}</span>}
        {ko && <span className="ko-cross">✕</span>}
      </button>
      {(shown.length > 0 || more.length > 0) && (
        <span className="ptile-states">
          {shown.map((v) => (
            <span key={v.key} className="pt-state" title={v.count && v.count > 1 ? `${v.label} ×${v.count}` : v.label}>
              {v.icon}
            </span>
          ))}
          {more.length > 0 && (
            <span className="pt-state ptile-more" title={more.map((m) => m.label).join(' · ')}>▾</span>
          )}
        </span>
      )}
    </div>
  );
}
