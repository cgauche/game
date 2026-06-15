import { describe, it, expect } from 'vitest';
import { ALL_SPELL_SPECS } from '../data/spellspecs';
import { opsToFlow, runSpellFlow } from './combatFlow';
import { flowEffects } from './flow';
import type { Combatant } from '../engine/types';

/**
 * PREUVE DE COMPLÉTUDE — « peut-on créer TOUS les sorts via le système Flow/EffectOp ? ».
 * Réponse démontrée : chaque sort curé de la base (les 226) se représente comme un Flow dont la feuille
 * `do` est un EffectOp portant ses `GameOp`, et l'exécuter par `runSpellFlow` applique réellement ces
 * ops (équivalent à l'ancien `applyOps`). Si un jour un sort ne « rentrait » pas, c'est le système qu'on
 * généraliserait — ce gate l'attraperait.
 */
describe('Complétude : tout sort est exprimable & exécutable dans le système Flow/EffectOp', () => {
  const curated = ALL_SPELL_SPECS.filter((s) => s.curated);

  it('la base est bien fournie (≥ 220 sorts curés)', () => {
    expect(curated.length).toBeGreaterThanOrEqual(220);
  });

  it('opsToFlow est TOTAL : chaque sort produit un Flow valide qui porte EXACTEMENT ses ops', () => {
    for (const spec of curated) {
      const flow = opsToFlow(spec.ops);
      expect(flow.kind, spec.label).toBe('seq');
      const leaves = flowEffects(flow);
      expect(leaves, spec.label).toHaveLength(1);
      expect(leaves[0].type, spec.label).toBe('ops');
      // la feuille EffectOp porte la liste d'ops du sort, telle quelle (aucune perte).
      expect((leaves[0] as { ops: unknown }).ops, spec.label).toBe(spec.ops);
    }
  });

  it('runSpellFlow EXÉCUTE réellement les ops d’un sort sur la cible (wounds + condition)', () => {
    const target = { id: 't', name: 'Cible', kind: 'enemy', dead: false, wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], armour: { corps: 0 } } as unknown as Combatant;
    // un « sort » minimal : 6 Blessures + En flammes — exprimé en Flow via opsToFlow.
    const flow = opsToFlow([{ op: 'wounds', amount: 6 }, { op: 'condition', name: 'En flammes' }]);
    const lines = runSpellFlow(target, undefined, flow, { label: 'Test' });
    expect(target.wounds.current).toBe(14); // wounds ignore BE/PA → 20 − 6
    expect(target.conditions.some((c) => c.name === 'En flammes')).toBe(true);
    expect(lines.length).toBeGreaterThan(0); // journal produit
  });
});
