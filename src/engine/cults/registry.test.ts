import { describe, it, expect } from 'vitest';
import { CULTS, blessingsOf, miraclesOf } from './registry';
import { CULT_DEFS } from './_registry.generated';

describe('Registre des cultes (defs/ généré par build-data depuis le type god) — LDB 41-42 + NADJ', () => {
  it('cultes chargés (10 LDB + 3 dieux gnomes NADJ), six Bénédictions chacun', () => {
    expect(CULT_DEFS).toHaveLength(13);
    for (const c of CULT_DEFS) expect(c.blessings).toHaveLength(6);
    expect(Object.keys(CULTS).sort()).toEqual(
      ['Evawn', 'Mabyn', 'Manann', 'Morr', 'Myrmidia', 'Ranald', 'Rhya', 'Ringil', 'Shallya', 'Sigmar', 'Taal', 'Ulric', 'Verena'],
    );
  });
  it('blessingsOf = libellés complets ; culte inconnu → []', () => {
    expect(blessingsOf('Sigmar')).toContain('Bénédiction de Protection');
    expect(blessingsOf('Khorne')).toEqual([]);
  });
  it('miraclesOf : cultes LDB (sorts d’Invocation raccrochés) ET dieux gnomes NADJ (colonne god)', () => {
    expect(miraclesOf('Sigmar')).toContain('Marteau ardent de Sigmar'); // LDB : sort d'Invocation
    expect(miraclesOf('Evawn')).toContain('Invitation'); // NADJ : colonne god
    expect(miraclesOf('Khorne')).toEqual([]);
  });
});
