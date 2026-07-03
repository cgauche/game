import { describe, it, expect } from 'vitest';
import { validateEntry } from './CodexEdit';
import { traits, creatures } from '../../data';

type Entry = Record<string, unknown>;

describe('validateEntry — garde du persist de CodexEdit (Enregistrer bloqué tant que non vide)', () => {
  const traitEntries = traits as unknown as Entry[];
  const creatureEntries = creatures as unknown as Entry[];

  it('entrée réelle saine → aucune erreur', () => {
    expect(validateEntry('traits', traitEntries[0], traitEntries, 0)).toEqual([]);
  });

  it('id vide → bloquant', () => {
    const errs = validateEntry('traits', { ...traitEntries[0], id: '' }, traitEntries, 0);
    expect(errs.some((e) => /id vide/.test(e))).toBe(true);
  });

  it('id dupliqué → bloquant (édition ET création)', () => {
    // Édition : reprendre l'id d'une AUTRE entrée.
    const errs = validateEntry('traits', { ...traitEntries[0], id: traitEntries[1].id }, traitEntries, 0);
    expect(errs.some((e) => /déjà pris/.test(e))).toBe(true);
    // Création (selfIndex −1) : reprendre un id existant.
    const errsNew = validateEntry('traits', { id: traitEntries[0].id, label: 'X' }, traitEntries, -1);
    expect(errsNew.some((e) => /déjà pris/.test(e))).toBe(true);
    // Garder SON id en éditant sa propre entrée n'est pas un doublon.
    expect(validateEntry('traits', traitEntries[0], traitEntries, 0).some((e) => /déjà pris/.test(e))).toBe(false);
  });

  it('libellé vide → bloquant', () => {
    const errs = validateEntry('traits', { ...traitEntries[0], label: '' }, traitEntries, 0);
    expect(errs.some((e) => /libellé vide/.test(e))).toBe(true);
  });

  it('réf {id} résolvable → OK ; introuvable → bloquant (choice descendu, {text} ignoré)', () => {
    const good: Entry = {
      id: '___test-validate___', label: 'Test',
      traits: [{ id: traitEntries[0].id }],
      trappings: [{ text: 'collection d’alcools' }], // narratif : jamais validé par-id
    };
    expect(validateEntry('creatures', good, creatureEntries, -1)).toEqual([]);
    const bad: Entry = { ...good, traits: [{ id: '___inexistant___' }] };
    const errs = validateEntry('creatures', bad, creatureEntries, -1);
    expect(errs.some((e) => /___inexistant___.*introuvable/.test(e))).toBe(true);
    // AdvancementRef en branche choice : l'id invalide est vu au fond de la branche.
    const badChoice: Entry = { ...good, skills: [{ choice: [{ ref: { id: '___inconnu___' } }] }] };
    expect(validateEntry('creatures', badChoice, creatureEntries, -1).some((e) => /___inconnu___/.test(e))).toBe(true);
  });
});
