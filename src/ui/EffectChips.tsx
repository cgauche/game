import { summarizeEffects, chipCodex, type EffectFlags } from '../gameIso/effectIcons';
import type { ConditionInstance, ActiveEffect } from '../engine/types';
import { roundsLabel } from '../engine/duration';
import { CodexRef } from './compendium/CodexRef';
import { Icon } from './Icon';

/**
 * Rangée de pastilles d'États (malus) et buffs (`activeEffects`), partagée (panneau Perso,
 * cartes, etc.). Malus en rouge, buffs en vert avec leur durée. Au-delà de `max`, « +N ».
 *
 * Toutes les pastilles informent par le MÊME mécanisme : `CodexRef` (popover desc + source, clic
 * vers la fiche quand l'entrée existe), routage en donnée par `chipCodex`.
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
        const ref = chipCodex(c);
        return (
          <CodexRef
            key={c.key}
            category={ref.category}
            id={ref.id}
            label={ref.label}
            instance={ref.instance}
            fallback={ref.fallback}
            className={`fx-chip ${c.kind}`}
          >
            <Icon id={c.icon} size="sm" />
            {c.count && c.count > 1 ? <b>{c.count}</b> : null}
            {c.rounds != null ? <em>{roundsLabel(c.rounds, { short: true })}</em> : null}
          </CodexRef>
        );
      })}
      {moreCount > 0 && <span className="fx-chip more">+{moreCount}</span>}
    </div>
  );
}
