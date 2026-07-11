import { summarizeEffects, combatantFlags } from '../gameIso/effectIcons';
import type { Combatant } from '../engine/types';
import { Icon } from './Icon';

/**
 * Pastilles d'États / effets actifs d'un combattant (la colonne `.ptile-states`) — EXTRAITE de
 * PortraitTile pour être posable hors de la tuile : dans le cadre actif (ActiveFrame) elles vivent
 * À DROITE de la barre de Mouvement (et non plus en débordement DERRIÈRE elle, retour 2026-06-11 :
 * le buff +10 CC d'une Bénédiction passait sous la jauge). `max` = pastilles avant le « ▾ » de débord.
 * Pure (testable en SSR).
 *
 * `reserve` : la cellule garde une EMPREINTE STABLE même sans État (arbitrage user 2026-07-11) — les
 * listes de rangées-personnages (nuit, batch) alignent ainsi leurs colonnes, un État ne décale plus
 * les rangées voisines. Sans `reserve`, rien n'est rendu quand il n'y a aucun effet (défaut HUD).
 */
export function StateChips({ c, max = 4, reserve = false }: { c: Combatant; max?: number; reserve?: boolean }) {
  const all = summarizeEffects(c.conditions, c.activeEffects, Infinity, combatantFlags(c)).visible;
  const shown = all.slice(0, max);
  const more = all.slice(max);
  if (shown.length === 0 && more.length === 0) return reserve ? <span className="ptile-states" data-reserve /> : null;
  return (
    <span className="ptile-states" data-reserve={reserve ? '' : undefined}>
      {shown.map((v) => (
        <span key={v.key} className="pt-state" title={v.count && v.count > 1 ? `${v.label} ×${v.count}` : v.label}>
          <Icon id={v.icon} size="sm" />
        </span>
      ))}
      {more.length > 0 && (
        <span className="pt-state ptile-more" title={more.map((m) => m.label).join(' · ')}>▾</span>
      )}
    </span>
  );
}
