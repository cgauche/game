import { describe, it, expect } from 'vitest';
import { CULTS, blessingsOf } from './registry';
import { CULT_DEFS } from './_registry.generated';

describe('Registre des cultes (defs/ auto-chargé, gen-registry) — LDB 41', () => {
  it('les 10 cultes du panthéon sont chargés, six Bénédictions chacun', () => {
    expect(CULT_DEFS).toHaveLength(10);
    for (const c of CULT_DEFS) expect(c.blessings).toHaveLength(6);
    expect(Object.keys(CULTS).sort()).toEqual(
      ['Manann', 'Morr', 'Myrmidia', 'Ranald', 'Rhya', 'Shallya', 'Sigmar', 'Taal', 'Ulric', 'Verena'],
    );
  });
  it('blessingsOf préfixe « Bénédiction de » ; culte inconnu → []', () => {
    expect(blessingsOf('Sigmar')).toContain('Bénédiction de Protection');
    expect(blessingsOf('Khorne')).toEqual([]);
  });
});
