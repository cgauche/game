import { summarizeEffects, type EffectChip, type EffectFlags } from '../gameIso/effectIcons';
import type { ConditionInstance, ActiveEffect } from '../engine/types';
import { CodexRef } from './compendium/CodexRef';

/** Tooltip des chips NON-États (buffs temporisés, drapeaux d'état) — les États (malus) passent
 *  par CodexRef (desc + source du Codex). */
function chipTitle(c: EffectChip): string {
  if (c.kind === 'buff') {
    const stat = c.char ? ` ${c.char}` : '';
    const sign = c.bonus != null && c.bonus >= 0 ? '+' : '';
    return `${c.label}${stat} ${sign}${c.bonus ?? ''} — ${c.rounds ?? 0} Round(s) restant(s)`;
  }
  return c.label; // état-drapeau (Frénésie, En joue…) : libellé déjà explicite
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
      {visible.map((c) => {
        const inner = (
          <>
            {c.icon}
            {c.count && c.count > 1 ? <b>{c.count}</b> : null}
            {c.rounds != null ? <em>{c.rounds}t</em> : null}
          </>
        );
        // Les États (malus) sont des entrées du Codex → popover desc + source ; les autres gardent
        // un title (buff temporisé / drapeau, hors Codex).
        return c.kind === 'malus' ? (
          <CodexRef key={c.key} category="etats" label={c.label} className={`fx-chip ${c.kind}`}>
            {inner}
          </CodexRef>
        ) : (
          <span key={c.key} className={`fx-chip ${c.kind}`} title={chipTitle(c)}>
            {inner}
          </span>
        );
      })}
      {moreCount > 0 && <span className="fx-chip more">+{moreCount}</span>}
    </div>
  );
}
