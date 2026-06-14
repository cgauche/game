import { describe, it, expect } from 'vitest';
import { groupsFor, groupMatch } from './groups';

describe('Groupes — dérivation & matching (LDB 21, P3)', () => {
  it('folder créature → catégorie (règles ordonnées, la plus spécifique d’abord)', () => {
    expect(groupsFor({ folder: 'Les hordes de peaux-vertes' })).toContain('Peau-Verte');
    expect(groupsFor({ folder: 'Les morts sans repos' })).toContain('Mort-vivant');
    expect(groupsFor({ folder: 'Hommes-bêtes, les enfants du Chaos' })).toContain('Homme-bête');
    expect(groupsFor({ folder: 'Les bêtes du Reikland' })).toContain('Bête');
    expect(groupsFor({ folder: 'Hommes-bêtes, les enfants du Chaos' })).not.toContain('Bête'); // spécificité
    expect(groupsFor({ folder: 'Démons, les armées baragouinantes' })).toContain('Démon');
    expect(groupsFor({ folder: 'Princes démons' })).toContain('Démon');
    expect(groupsFor({ folder: 'Les ignobles hommes-rats' })).toContain('Skaven');
    expect(groupsFor({ folder: 'Les peuples du Reikland' })).toEqual([]); // pas de catégorie de monstre
  });

  it('espèce → racial + carrière + extras (dédup, normalisé)', () => {
    const g = groupsFor({ species: 'Humains (Reiklander)', career: 'Soldat', extras: ['Sigmarite'] });
    expect(g).toEqual(expect.arrayContaining(['Humain', 'Soldat', 'Sigmarite']));
  });

  it('dédup : un même groupe n’apparaît qu’une fois', () => {
    const g = groupsFor({ career: 'Humain', species: 'Humains (Reiklander)' });
    expect(g.filter((x) => x === 'Humain').length).toBe(1);
  });

  it('classe « Roublards » → Groupe « Criminel » auto-dérivé (Épée de justice / Traits psy ciblés)', () => {
    for (const career of ['Voleur', 'Hors-la-loi', 'Charlatan', 'Receleur']) {
      expect(groupsFor({ career })).toEqual(expect.arrayContaining([career, 'Criminel']));
    }
    expect(groupsFor({ career: 'Soldat' })).not.toContain('Criminel'); // classe Guerriers
    expect(groupMatch('Criminel', groupsFor({ career: 'Voleur' }))).toBe(true);
  });

  it('groupMatch : insensible casse/accents + tolérance pluriel', () => {
    expect(groupMatch('Elfes', ['Elfe'])).toBe(true); // Cible pluriel vs groupe singulier
    expect(groupMatch('mort-vivant', ['Mort-vivant'])).toBe(true);
    expect(groupMatch('Peau-Verte', ['peau-verte'])).toBe(true);
    expect(groupMatch('Nains', ['Humain'])).toBe(false);
  });

  it('groupMatch : pluriel COMPOSÉ (jeton par jeton, pas un seul « s » final)', () => {
    expect(groupMatch('Hommes-bêtes', ['Homme-bête'])).toBe(true); // bug #3 (sous-match silencieux)
    expect(groupMatch('Morts-vivants', ['Mort-vivant'])).toBe(true);
    expect(groupMatch('Peaux-Vertes', ['Peau-Verte'])).toBe(true);
  });

  it('groupMatch : un radical court ne sur-matche PAS un mot non lié (bug #1)', () => {
    expect(groupMatch('Rat', ['Pirate'])).toBe(false); // 'pirate'.includes('rat') ne doit plus matcher
    expect(groupMatch('Rats', ['Aristocrate'])).toBe(false);
    expect(groupMatch('Or', ['Sorcier'])).toBe(false);
  });

  it('groupMatch : raffinement de sous-type conservé (Cible générique ⊆ groupe spécifique)', () => {
    expect(groupMatch('Elfe', ['Haut Elfe'])).toBe(true); // un anti-Elfe hait aussi les Hauts Elfes
    expect(groupMatch('Haut Elfe', ['Elfe'])).toBe(false); // mais une Cible spécifique ne matche pas le groupe générique
  });
});
