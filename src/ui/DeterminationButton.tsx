import { useState } from 'react';
import type { Combatant } from '../engine/types';
import { conditionMeta } from '../gameIso/effectIcons';

/**
 * Détermination en modale de jet (LDB ch.17 l.62-66) : AVANT de lancer, un héros qui subit des
 * États négatifs (À Terre, Sonné, Aveuglé… → malus au jet) peut en retirer un — le panneau
 * pré-rempli recalcule alors ses modificateurs. Bouton « ✊ Détermination ×n » → mini-picker des
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
      <button
        className={`btn btn-resource ${open ? 'btn-primary' : ''}`}
        onClick={() => setOpen(!open)}
        title="Détermination (LDB 17 l.66) : retire un État négatif — le jet recalcule ses modificateurs"
      >
        ✊ Détermination ×{resolve}
      </button>
      {open &&
        conds.map((c) => (
          <button
            key={c.name}
            className="btn btn-resource"
            onClick={() => {
              setOpen(false);
              onSpend(c.name);
            }}
            title={`Retirer 1 pion ${c.name} (LDB 17 l.66)`}
          >
            {conditionMeta(c.name).icon} {c.name}
            {c.value > 1 ? ` ×${c.value}` : ''}
          </button>
        ))}
    </>
  );
}
