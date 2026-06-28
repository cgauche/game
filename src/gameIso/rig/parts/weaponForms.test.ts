import { describe, it, expect } from 'vitest';
import { WEAPON_FORMS, SHIELD_FORMS, norm } from './weaponForms';
import { weaponFamily, shieldPart } from './equipment';
import { trappings } from '../../../data';
import type { Weapon } from '../../../engine/types';

const wep = (label: string, type: 'melee' | 'ranged'): Weapon => ({ name: label, type, damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon);

/** Sous-types NON tenus en main → hors contrat de silhouette : engins de siège servis par un équipage
 *  (Baliste/Canons/Catapultes/Mortier/Pierrier) et munitions/projectiles (flèches/cartouches/bombes/
 *  cailloux). Le rig ne dessine pas d'arme portée pour eux. */
const NON_PORTEE = new Set(['armes-de-siege', 'munitions']); // ids de Groupe

describe('weaponForms — contrat des armes tenues en main', () => {
  it('couvre toutes les armes melee/ranged de la donnée (hors siège & munitions)', () => {
    const known = new Set<string>([
      ...WEAPON_FORMS.map((f) => norm(f.label)),
      ...SHIELD_FORMS.map((s) => norm(s.label)),
      norm('Mains nues'),
    ]);
    const missing = (trappings as { label: string; type: string; subType?: string }[])
      .filter((t) => (t.type === 'melee' || t.type === 'ranged') && !NON_PORTEE.has(t.subType ?? '') && !known.has(norm(t.label)))
      .map((t) => t.label);
    expect(missing).toEqual([]);
  });

  it('slugs uniques et non vides', () => {
    const slugs = WEAPON_FORMS.map((f) => f.slug);
    expect(slugs.every((s) => /^[a-z0-9_]+$/.test(s))).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('87 armes-arts + 4 boucliers', () => {
    expect(WEAPON_FORMS).toHaveLength(87);
    expect(SHIELD_FORMS).toHaveLength(4);
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

describe('boucliers (registre data-driven shields/defs)', () => {
  const front = (a: ReturnType<typeof shieldPart>) => (typeof a === 'string' ? a : a.front);
  it('chaque bouclier du catalogue a SA silhouette (toutes distinctes)', () => {
    const arts = SHIELD_FORMS.map((f) => front(shieldPart(wep(f.label, 'melee'))));
    expect(new Set(arts).size).toBe(SHIELD_FORMS.length);
    expect(SHIELD_FORMS.length).toBeGreaterThanOrEqual(4); // rondache / grand écu / targe / pavois
  });
  it('un bouclier au nom inconnu retombe sur la rondache (fallback)', () => {
    expect(front(shieldPart(wep('Bouclier de la Garde', 'melee')))).toBe(front(shieldPart(wep('Bouclier', 'melee'))));
  });
});
