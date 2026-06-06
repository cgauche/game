import { describe, it, expect } from 'vitest';
import { WEAPON_FORMS, SHIELD_FORMS, norm } from './weaponForms';
import { trappings } from '../../../data';

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
