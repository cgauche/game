import { describe, it, expect } from 'vitest';
import { socialPsychMod, socialPsychLabel, isSocialTest, partyBest } from './skills';
import type { Combatant } from './types';

function mk(opts: Partial<Combatant>): Combatant {
  return { id: 'c', name: 'c', kind: 'enemy', advantage: 0, conditions: [], characteristics: { Soc: 40 } as never, psychState: [], psychTraits: [], groups: [], weapons: [], armour: {} as never, skills: [], talents: [], movement: 4, wounds: { current: 10, max: 10 }, ...opts } as Combatant;
}

describe('socialPsychMod — pénalités de Sociabilité psy (LDB 21, P3)', () => {
  it('Animosité POSSÉDÉE (trait), non testée → −20 « contenu » (hors combat : pas d’affliction, l.22)', () => {
    const tester = mk({ psychTraits: [{ type: 'animosite', cible: 'Elfes' }] });
    expect(socialPsychMod(tester, ['Elfe', 'Soldat'])).toBe(-20);
    expect(socialPsychMod(tester, ['Humain'])).toBe(0); // hors groupe
  });
  it('Animosité ACTIVE (Test de Psy ÉCHOUÉ) → 0 : compulsion d’attaque, PAS le malus social contenu (LDB 21 l.24)', () => {
    const tester = mk({ psychTraits: [{ type: 'animosite', cible: 'Elfes' }], psychState: [{ type: 'animosite', cible: 'Elfes', active: true }] });
    expect(socialPsychMod(tester, ['Elfe'])).toBe(0);
  });
  it('Animosité RÉSISTÉE (Test de Psy RÉUSSI, active:false) → −20 : c’est précisément l’effet du succès (LDB 21 l.22)', () => {
    const tester = mk({ psychTraits: [{ type: 'animosite', cible: 'Elfes' }], psychState: [{ type: 'animosite', cible: 'Elfes', active: false }] });
    expect(socialPsychMod(tester, ['Elfe'])).toBe(-20);
  });
  it('Préjugé (trait possédé) vs le groupe → −10 (l.43-52)', () => {
    const tester = mk({ psychTraits: [{ type: 'prejuge', cible: 'Nains' }] });
    expect(socialPsychMod(tester, ['Nain'])).toBe(-10);
    expect(socialPsychMod(tester, ['Elfe'])).toBe(0);
  });
  it('Animosité + Préjugé cumulent (−30)', () => {
    const tester = mk({ psychTraits: [{ type: 'animosite', cible: 'Gobelins' }, { type: 'prejuge', cible: 'Gobelins' }] });
    expect(socialPsychMod(tester, ['Gobelin'])).toBe(-30);
  });
  it('socialPsychLabel : libellé lisible du malus (ou undefined)', () => {
    expect(socialPsychLabel(mk({ psychTraits: [{ type: 'animosite', cible: 'Elfes' }] }), ['Elfe'])).toBe('Animosité −20');
    expect(socialPsychLabel(mk({ psychTraits: [{ type: 'animosite', cible: 'Gobelins' }, { type: 'prejuge', cible: 'Gobelins' }] }), ['Gobelin'])).toBe('Animosité −20 · Préjugé −10');
    expect(socialPsychLabel(mk({}), ['Elfe'])).toBeUndefined();
  });
});

describe('isSocialTest — un Test est-il de Sociabilité ? (LDB 21)', () => {
  it('Caractéristique Soc → vrai', () => {
    expect(isSocialTest(undefined, 'Soc')).toBe(true);
    expect(isSocialTest(undefined, 'F')).toBe(false);
  });
  it('Compétence basée sur Soc (Charme, Marchandage) → vrai ; autre → faux', () => {
    expect(isSocialTest('Charme')).toBe(true);
    expect(isSocialTest('Marchandage')).toBe(true);
    expect(isSocialTest('Escalade')).toBe(false);
  });
});

describe('partyBest — modificateur par acteur (sélection avec malus psy intégré)', () => {
  it('choisit le membre dont la valeur EFFECTIVE (avec malus) est la meilleure', () => {
    const a = mk({ id: 'a', name: 'A', characteristics: { Soc: 50 } as never, psychTraits: [{ type: 'animosite', cible: 'Elfes' }] }); // 50 − 20 = 30
    const b = mk({ id: 'b', name: 'B', characteristics: { Soc: 40 } as never }); // 40, pas de malus
    const mod = (c: Combatant) => socialPsychMod(c, ['Elfe']);
    const best = partyBest([a, b], undefined, 'Soc', mod);
    expect(best?.actor.id).toBe('b'); // B (40) > A (30 après malus) malgré la Soc brute plus basse
    expect(best?.value).toBe(40);
  });
});
