import { describe, it, expect } from 'vitest';
import { gods, CULT_KEYS, blessingsOf, miraclesOf, findGodById } from './index';

describe('Cultes (dataset gods.json, façade data, éditable au Codex) — LDB 41-42 + NADJ', () => {
  it('13 cultes (10 LDB + 3 dieux gnomes NADJ), six Bénédictions chacun', () => {
    expect(gods).toHaveLength(13);
    for (const g of gods) expect(g.blessings).toHaveLength(6);
    expect(CULT_KEYS).toEqual(
      ['Evawn', 'Mabyn', 'Manann', 'Morr', 'Myrmidia', 'Ranald', 'Rhya', 'Ringil', 'Shallya', 'Sigmar', 'Taal', 'Ulric', 'Verena'],
    );
  });
  it('blessingsOf = IDS de sort (le runtime compare par id) ; culte inconnu → []', () => {
    expect(blessingsOf('Sigmar')).toContain('benediction-de-protection');
    expect(blessingsOf('Khorne')).toEqual([]);
  });
  it('miraclesOf : LDB (sorts d’Invocation) ET dieux gnomes NADJ ; findGodById', () => {
    expect(miraclesOf('Sigmar')).toContain('marteau-ardent-de-sigmar'); // LDB : sort d'Invocation (id)
    expect(miraclesOf('Evawn')).toContain('invitation'); // NADJ : colonne god (id)
    expect(miraclesOf('Khorne')).toEqual([]);
    expect(findGodById('Sigmar')?.title).toBeTruthy();
  });
});
