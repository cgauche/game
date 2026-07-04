import { describe, it, expect } from 'vitest';
import { groupsFor, groupMatch } from './groups';

describe('Groupes — dérivation par id canonique & matching strict (LDB 21, P3)', () => {
  it('folder créature → id de catégorie (règles ordonnées, la plus spécifique d’abord)', () => {
    expect(groupsFor({ folder: 'Les hordes de peaux-vertes' })).toContain('peau-verte');
    expect(groupsFor({ folder: 'Les morts sans repos' })).toContain('mort-vivant');
    expect(groupsFor({ folder: 'Hommes-bêtes, les enfants du Chaos' })).toContain('homme-bete');
    expect(groupsFor({ folder: 'Les bêtes du Reikland' })).toContain('bete');
    expect(groupsFor({ folder: 'Hommes-bêtes, les enfants du Chaos' })).not.toContain('bete'); // spécificité
    expect(groupsFor({ folder: 'Démons, les armées baragouinantes' })).toContain('demon');
    expect(groupsFor({ folder: 'Princes démons' })).toContain('demon');
    expect(groupsFor({ folder: 'Les ignobles hommes-rats' })).toContain('skaven');
    expect(groupsFor({ folder: 'Les peuples du Reikland' })).toEqual([]); // pas de catégorie de monstre
  });

  it('espèce → id racial + carrière + extras (dédup, ids)', () => {
    const g = groupsFor({ species: 'Humains (Reiklander)', careerId: 'soldat', extras: ['sigmarite'] });
    expect(g).toEqual(expect.arrayContaining(['humain', 'soldat', 'sigmarite']));
  });

  it('dédup : un même id n’apparaît qu’une fois', () => {
    const g = groupsFor({ careerId: 'humain', species: 'Humains (Reiklander)' });
    expect(g.filter((x) => x === 'humain').length).toBe(1);
  });

  it('Trait (mort-vivant/demoniaque) → id de Groupe, même hors folder (unifie avec domainAttributes)', () => {
    expect(groupsFor({ traits: [{ id: 'mort-vivant' }] })).toEqual(['mort-vivant']);
    expect(groupsFor({ traits: [{ id: 'demoniaque' }] })).toEqual(['demon']);
    expect(groupsFor({ traits: [{ id: 'vol' }] })).toEqual([]); // trait sans règle → aucun Groupe
  });

  it('classe « Roublards » → Groupe « criminel » auto-dérivé (Épée de justice / Traits psy ciblés)', () => {
    for (const id of ['voleur', 'hors-la-loi', 'charlatan', 'receleur']) {
      expect(groupsFor({ careerId: id })).toContain('criminel');
    }
    expect(groupsFor({ careerId: 'soldat' })).not.toContain('criminel'); // classe Guerriers
    expect(groupMatch('criminel', groupsFor({ careerId: 'voleur' }))).toBe(true);
  });

  it('carrières MILITAIRES précises (soldat/garde/chevalier) → leur propre id — pas toute la classe Guerriers', () => {
    expect(groupsFor({ careerId: 'soldat' })).toContain('soldat');
    expect(groupsFor({ careerId: 'garde' })).toContain('garde');
    expect(groupsFor({ careerId: 'chevalier' })).toContain('chevalier');
    // Cavalier est aussi classe Guerriers mais N'EST PAS une des 3 carrières militaires ciblées.
    expect(groupsFor({ careerId: 'cavalier' })).toEqual([]);
  });

  it('groupMatch : appartenance STRICTE par id (plus de tolérance pluriel/casse/sous-type)', () => {
    expect(groupMatch('elfe', ['elfe'])).toBe(true);
    expect(groupMatch('mort-vivant', ['mort-vivant'])).toBe(true);
    expect(groupMatch('peau-verte', ['peau-verte'])).toBe(true);
    expect(groupMatch('nain', ['humain'])).toBe(false);
    expect(groupMatch('Elfe', ['elfe'])).toBe(false); // casse différente → id DIFFÉRENT (pas de normalisation)
    expect(groupMatch('elfe', ['Elfe'])).toBe(false);
    expect(groupMatch('elfe', ['elfe-noir'])).toBe(false); // pas de raffinement de sous-type (YAGNI)
  });
});
