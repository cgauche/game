import { summarizeEffects, type EffectChip, type EffectFlags } from '../gameIso/effectIcons';
import type { ConditionInstance, ActiveEffect } from '../engine/types';

function chipTitle(c: EffectChip): string {
  if (c.kind === 'buff') {
    const stat = c.char ? ` ${c.char}` : '';
    const sign = c.bonus != null && c.bonus >= 0 ? '+' : '';
    return `${c.label}${stat} ${sign}${c.bonus ?? ''} — ${c.rounds ?? 0} Round(s) restant(s)`;
  }
  return c.count && c.count > 1 ? `${c.label} ×${c.count}` : c.label;
}

/**
 * Rangée de pastilles d'États (malus) et buffs (`activeEffects`), partagée (panneau Perso,
 * cartes, etc.). Malus en rouge, buffs en vert avec leur durée. Au-delà de `max`, « +N ».
 */
export function EffectChips({
  conditions,
  effects,
  flags,
  max = Infinity,
}: {
  conditions?: ConditionInstance[];
  effects?: ActiveEffect[];
  flags?: EffectFlags;
  max?: number;
}) {
  const { visible, moreCount } = summarizeEffects(conditions, effects, max, flags);
  if (visible.length === 0 && moreCount === 0) return null;
  return (
    <div className="fx-chips">
      {visible.map((c) => (
        <span key={c.key} className={`fx-chip ${c.kind}`} title={chipTitle(c)}>
          {c.icon}
          {c.count && c.count > 1 ? <b>{c.count}</b> : null}
          {c.rounds != null ? <em>{c.rounds}t</em> : null}
        </span>
      ))}
      {moreCount > 0 && <span className="fx-chip more">+{moreCount}</span>}
    </div>
  );
}
