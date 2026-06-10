import type { RollBreakdown } from '../engine/combat';

/** Libellés des Traits psy ciblés (LDB 21) — partagé par les modales psy combat ET rencontre. */
export const CIBLE_LABEL: Record<string, { emoji: string; label: string }> = {
  animosite: { emoji: '😤', label: 'Animosité' },
  haine: { emoji: '😡', label: 'Haine' },
  prejuge: { emoji: '🙄', label: 'Préjugé' },
  amour: { emoji: '❤️', label: 'Amour' },
  camaraderie: { emoji: '🤝', label: 'Camaraderie' },
  phobie: { emoji: '🕷️', label: 'Phobie' },
};

/** Ligne de jet (RollLine) d'un Test de Calme : base = Sang-froid, cible effective, d100, DR. */
export function calmeBreakdown(base: number, r: { roll: number; target?: number; sl?: number; success?: boolean }): RollBreakdown {
  const target = r.target ?? base;
  return {
    label: 'Sang-froid',
    base,
    modifier: target - base,
    target,
    roll: r.roll,
    success: r.success ?? r.roll <= target,
    sl: r.sl ?? 0,
  };
}
