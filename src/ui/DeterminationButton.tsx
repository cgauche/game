import { useState } from 'react';
import type { Combatant } from '../engine/types';
import { conditionMeta } from '../gameIso/effectIcons';
import { conditionLabel } from '../data';
import { Icon } from './Icon';
import { CodexRef } from './compendium/CodexRef';
import { RULE_REF } from '../engine/ruleRefs';

/**
 * Détermination en modale de jet (LDB 17 l.59-61) : AVANT de lancer, un héros qui subit des
 * États négatifs (À Terre, Sonné, Aveuglé… → malus au jet) peut en retirer un — le panneau
 * pré-rempli recalcule alors ses modificateurs. Bouton « Détermination ×n » → mini-picker des
 * États présents (même règle que `battleSpendResolve` de la barre d'action).
 */
export function DeterminationButton({ combatant, onSpend }: { combatant?: Combatant | null; onSpend: (condition: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!combatant || combatant.kind !== 'hero') return null;
  const resolve = combatant.resolve ?? 0;
  const conds = combatant.conditions ?? [];
  if (resolve <= 0 || conds.length === 0) return null;
  return (
    <>
      <CodexRef category={RULE_REF.determination.category} id={RULE_REF.determination.id} label="Détermination" wrap>
        <button
          className={`btn btn-resource ${open ? 'btn-primary' : ''}`}
          onClick={() => setOpen(!open)}
        >
          <Icon id="resource/resolve" size="sm" /> Détermination ×{resolve}
        </button>
      </CodexRef>
      {open &&
        conds.map((c) => (
          <button
            key={c.id}
            className="btn btn-resource"
            onClick={() => {
              setOpen(false);
              onSpend(c.id);
            }}
            title={`Retirer 1 pion ${conditionLabel(c.id)}`}
          >
            <Icon id={conditionMeta(c.id).icon} size="sm" /> {conditionLabel(c.id)}
            {c.value > 1 ? ` ×${c.value}` : ''}
          </button>
        ))}
    </>
  );
}
