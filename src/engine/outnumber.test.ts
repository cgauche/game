import { describe, it, expect } from 'vitest';
import { outnumberMod, crowdMod } from './combat';
import { RULE_REF } from './ruleRefs';

/** Surnombre en mêlée — LDB « Difficulté de Combat » (14 - _GoBack.md l.85/92) :
 *  2 contre 1 → +20 (Accessible) ; 3 contre 1 → +40 (Facile). */
describe('outnumberMod', () => {
  it('seul (1 attaquant) : aucun modificateur', () => {
    expect(outnumberMod(1)).toBeNull();
    expect(outnumberMod(0)).toBeNull();
  });
  it('2 contre 1 → +20', () => {
    expect(outnumberMod(2)).toEqual({ label: 'Surnombre (2 c.1)', value: 20 });
  });
  it('3 contre 1 → +40', () => {
    expect(outnumberMod(3)).toEqual({ label: 'Surnombre (3+ c.1)', value: 40 });
  });
  it('4 et plus : plafonné à +40', () => {
    expect(outnumberMod(6)).toEqual({ label: 'Surnombre (3+ c.1)', value: 40 });
  });
});

/** « Tirer dans le tas » — LDB « Difficulté de Combat » (14 - _GoBack.md l.81/86/89). Chaque palier
 *  porte SA règle (`RULE_REF`, #1078) : la chip du breakdown ouvre la fiche `regles/tirer-dans-le-tas`. */
describe('crowdMod', () => {
  it('cible isolée ou duo (<3) : aucun modificateur', () => {
    expect(crowdMod(2)).toBeNull();
  });
  it('petit groupe (3-6) → +20', () => {
    expect(crowdMod(3)).toEqual({ label: 'Tirer dans le tas (3-6)', value: 20, ref: RULE_REF['tirer-dans-le-tas'] });
    expect(crowdMod(6)).toEqual({ label: 'Tirer dans le tas (3-6)', value: 20, ref: RULE_REF['tirer-dans-le-tas'] });
  });
  it('groupe important (7-12) → +40', () => {
    expect(crowdMod(7)).toEqual({ label: 'Tirer dans le tas (7-12)', value: 40, ref: RULE_REF['tirer-dans-le-tas'] });
  });
  it('foule (13+) → +60', () => {
    expect(crowdMod(13)).toEqual({ label: 'Tirer dans le tas (13+)', value: 60, ref: RULE_REF['tirer-dans-le-tas'] });
  });
});
