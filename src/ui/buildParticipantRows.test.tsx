// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildParticipantRows } from './buildParticipantRows';
import { refLabel } from '../data';
import type { Combatant } from '../engine/types';

/**
 * #1117 G1 — SOURCE UNIQUE du libellé de LIGNE d'une rangée-participant (Z5) : il se DÉRIVE de la
 * paire `{skillId, spec}` par le résolveur canonique. Le producteur peut porter un libellé de RÔLE
 * (provenance) : il ne doit JAMAIS devenir le nom de la ligne — c'est le défaut vu en recette
 * (« Timonier » là où le jet est « Voile (Chaland) »).
 */
const actor = { id: 'h1', label: 'Hilda', kind: 'hero' } as Combatant;

const bundle = {
  onRoll: () => {}, onReroll: () => {}, onBonusSL: () => {}, onDarkPact: () => {}, onForce: () => {},
  // La modale ne fournit QUE sa présentation — ici avec un libellé de rôle, comme le naval le faisait.
  row: (part: { label?: string }, a: Combatant) => ({ combatant: a, pending: { label: part.label ?? a.label, base: 40, target: 40 } }),
};

describe('buildParticipantRows — le libellé de ligne vient de {skillId, spec} (#1117)', () => {
  it('la spécialisation est rendue : « Voile (Chaland) », jamais le rôle', () => {
    const rows = buildParticipantRows(
      [{ id: 'h1', interactive: true, result: null, skillId: 'voile', spec: 'Chaland', label: 'Timonier' } as never],
      [actor], bundle as never,
    );
    expect(rows[0].row.pending!.label).toBe(refLabel('skills', { id: 'voile', spec: 'Chaland' }));
    expect(rows[0].row.pending!.label).not.toBe('Timonier');
  });

  it('sans paire déclarée, la présentation de la modale fait foi (aucune invention)', () => {
    const rows = buildParticipantRows(
      [{ id: 'h1', interactive: true, result: null, label: 'Timonier' } as never],
      [actor], bundle as never,
    );
    expect(rows[0].row.pending!.label).toBe('Timonier');
  });

  it('post-jet : la ligne résolue porte AUSSI la Compétence dérivée', () => {
    const withResult = {
      onRoll: () => {}, onReroll: () => {}, onBonusSL: () => {}, onDarkPact: () => {}, onForce: () => {},
      row: (part: { label?: string }, a: Combatant) => ({ combatant: a, d: { label: part.label ?? a.label, base: 40, modifier: 0, target: 40, roll: 12, success: true, sl: 3 } }),
    };
    const rows = buildParticipantRows(
      [{ id: 'h1', interactive: true, result: { roll: 12, target: 40, sl: 3, success: true }, skillId: 'ramer', label: 'Mousse' } as never],
      [actor], withResult as never,
    );
    expect(rows[0].row.d!.label).toBe(refLabel('skills', { id: 'ramer' }));
  });
});
