import { describe, it, expect } from 'vitest';
import { WEAPON_FORMS, SHIELD_FORMS, norm } from './weaponForms';
import { weaponFamily, shieldPart } from './equipment';
import { trappings } from '../../../data';
import type { Weapon } from '../../../engine/types';

const wep = (label: string, type: 'melee' | 'ranged'): Weapon => ({ name: label, type, damage: '+4', qualities: [] } as Weapon);

describe('weaponForms — contrat des 52 armes', () => {
  it('couvre toutes les armes melee/ranged de la donnée', () => {
    const known = new Set<string>([
      ...WEAPON_FORMS.map((f) => norm(f.label)),
      ...SHIELD_FORMS.map((s) => norm(s.label)),
      norm('Mains nues'),
    ]);
    const missing = (trappings as { label: string; type: string }[])
      .filter((t) => (t.type === 'melee' || t.type === 'ranged') && !known.has(norm(t.label)))
      .map((t) => t.label);
    expect(missing).toEqual([]);
  });

  it('slugs uniques et non vides', () => {
    const slugs = WEAPON_FORMS.map((f) => f.slug);
    expect(slugs.every((s) => /^[a-z0-9_]+$/.test(s))).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('48 armes-arts + 3 boucliers', () => {
    expect(WEAPON_FORMS).toHaveLength(48);
    expect(SHIELD_FORMS).toHaveLength(3);
  });
});

describe('routage forme par libellé', () => {
  it('chaque arme catalogue résout vers son slug', () => {
    const bad = WEAPON_FORMS.filter((f) => weaponFamily(wep(f.label, f.type)) !== f.slug)
      .map((f) => `${f.label} → ${weaponFamily(wep(f.label, f.type))} (attendu ${f.slug})`);
    expect(bad).toEqual([]);
  });
  it('les arts morts sont branchés (lasso, bolas, poing)', () => {
    expect(weaponFamily(wep('Lasso', 'ranged'))).toBe('lasso');
    expect(weaponFamily(wep('Bolas', 'ranged'))).toBe('bolas');
    expect(weaponFamily(wep('Coup-de-poing', 'melee'))).toBe('poing');
  });
});

describe('boucliers', () => {
  it('3 noms → 3 silhouettes distinctes', () => {
    const r = shieldPart(wep('Bouclier', 'melee'));
    const g = shieldPart(wep('Bouclier (Grand)', 'melee'));
    const t = shieldPart(wep('Bouclier (Targe)', 'melee'));
    const front = (a: typeof r) => (typeof a === 'string' ? a : a.front);
    expect(front(r)).not.toBe(front(g));
    expect(front(g)).not.toBe(front(t));
    expect(front(r)).not.toBe(front(t));
  });
});
