import { describe, it, expect } from 'vitest';
import { weaponPart } from '../equipment';
import type { Weapon } from '../../../../engine/types';

const w = (name: string, skin?: Record<string, string>): Weapon =>
  ({ name, type: 'melee', damage: '+4', qualities: [], skin } as Weapon);

describe('skin d’arme — recolorisation par-objet (tokens palette)', () => {
  it('au défaut, l’art est entièrement résolu (aucun @token résiduel)', () => {
    const art = weaponPart(w('Épée bâtarde')) as string;
    expect(typeof art).toBe('string');
    expect(art).not.toMatch(/@[a-zA-Z]/); // tous les @tokens substitués en hex
  });

  it('un skin override recolore (≠ défaut, la couleur du skin apparaît)', () => {
    const base = weaponPart(w('Épée bâtarde')) as string;
    const gold = weaponPart(w('Épée bâtarde', { metal: '#caa64a' })) as string;
    expect(gold).not.toBe(base);
    expect(gold.toLowerCase()).toContain('#caa64a'); // la lame dorée
    expect(gold).not.toMatch(/@[a-zA-Z]/);
  });

  it('un skin vide = rendu par défaut (résolution idempotente)', () => {
    expect(weaponPart(w('Dague', {}))).toEqual(weaponPart(w('Dague')));
  });
});
