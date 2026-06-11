import { RigPortrait } from './RigPortrait';
import { hpColor } from '../gameIso/teamColors';
import { summarizeEffects, combatantFlags } from '../gameIso/effectIcons';
import type { Combatant } from '../engine/types';

/**
 * Tuile-portrait compacte et UNIFIÉE (HUD façon BG3) — la SEULE façon d'afficher « portrait + vie ».
 * Réutilisée par le dock d'équipe (haut), la frise d'initiative (gauche) et le cadre du combattant
 * actif (barre d'action). Affichage cohérent partout :
 *  - cadre = couleur d'identité/équipe (`ring`), forme pleine/tirets (R9 daltonisme) via RigPortrait ;
 *  - FOND d'équipe (`team`) : vert allié / rouge ennemi derrière le portrait (indice secondaire) ;
 *  - JAUGE DE VIE HORIZONTALE en bas (comme tous les autres écrans), PV chiffrés dessus (option) ;
 *  - unité ACTIVE mise en évidence : portrait AGRANDI + liseré or + caret ▼ ;
 *  - états en colonne à droite (max N + « ▾ » en débordement).
 * Pur à props (testable en SSR), aucune lecture du store.
 */
export interface PortraitTileProps {
  c: Combatant;
  /** Couleur du cadre : teinte d'équipe (frise) ou couleur d'identité du héros (dock). */
  ring: string;
  /** Côté de la vignette en px (dock 56, frise 44, actif 72). L'unité active est agrandie (~×1.28). */
  size?: number;
  /** Unité active : portrait agrandi + liseré or + caret ▼. */
  active?: boolean;
  /** PV chiffrés sur la jauge. */
  showPv?: boolean;
  /** Jauge de vie horizontale (bas du portrait). */
  showGauge?: boolean;
  /** Fond d'équipe derrière le portrait (vert allié / rouge ennemi). */
  team?: 'ally' | 'enemy';
  maxStates?: number;
  onClick?: () => void;
  title?: string;
}

export function PortraitTile({ c, ring, size = 56, active, showPv, showGauge = true, team, maxStates = 4, onClick, title }: PortraitTileProps) {
  const ratio = c.wounds.max > 0 ? Math.max(0, Math.min(1, c.wounds.current / c.wounds.max)) : 0;
  const ko = c.dead || c.wounds.current <= 0 || c.conditions.some((x) => x.name === 'Inconscient');
  const all = summarizeEffects(c.conditions, c.activeEffects, Infinity, combatantFlags(c)).visible;
  const shown = all.slice(0, maxStates);
  const more = all.slice(maxStates);
  // R6 : l'unité active est plus grosse que les autres pour la mettre en évidence.
  const s = active ? Math.round(size * 1.28) : size;
  return (
    <div className="ptile-wrap">
      <button
        type="button"
        className={`ptile ${active ? 'active' : ''} ${ko ? 'ko' : ''} ${team ? `team-${team}` : ''}`}
        style={{ width: s }}
        onClick={onClick}
        title={title ?? c.name}
      >
        {active && <i className="ptile-caret">▼</i>}
        <span className="ptile-face" style={{ width: s, height: s }}>
          <RigPortrait combatant={c} size={s} ring={ring} />
          {ko && <span className="ko-cross">✕</span>}
        </span>
        {showGauge && (
          <span className="ptile-gauge" title={`Blessures : ${c.wounds.current}/${c.wounds.max}`}>
            <b style={{ width: `${Math.round(ratio * 100)}%`, background: hpColor(ratio) }} />
            {showPv && <span className="ptile-pv">{c.dead ? '☠️' : `${c.wounds.current}/${c.wounds.max}`}</span>}
          </span>
        )}
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
