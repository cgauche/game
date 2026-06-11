import { summarizeEffects, combatantFlags } from '../gameIso/effectIcons';
import type { Combatant } from '../engine/types';

/**
 * Pastilles d'États / effets actifs d'un combattant (la colonne `.ptile-states`) — EXTRAITE de
 * PortraitTile pour être posable hors de la tuile : dans le cadre actif (ActiveFrame) elles vivent
 * À DROITE de la barre de Mouvement (et non plus en débordement DERRIÈRE elle, retour 2026-06-11 :
 * le buff +10 CC d'une Bénédiction passait sous la jauge). `max` = pastilles avant le « ▾ » de débord.
 * Pure (testable en SSR). Rien si aucun effet visible.
 */
export function StateChips({ c, max = 4 }: { c: Combatant; max?: number }) {
  const all = summarizeEffects(c.conditions, c.activeEffects, Infinity, combatantFlags(c)).visible;
  const shown = all.slice(0, max);
  const more = all.slice(max);
  if (shown.length === 0 && more.length === 0) return null;
  return (
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
  );
}
