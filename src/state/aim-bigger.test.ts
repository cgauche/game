import { describe, it, expect } from 'vitest';
import { statblockToCombatant } from './spawn';
import { attackModifiers } from '../engine/combat';
import type { Weapon } from '../engine/types';

// LDB « Point d'Impact des Créatures » p.312 / 76 l.39 : contre une créature de Taille ≥ 2 catégories
// supérieure, on CHOISIT gratuitement la zone (la plus proche / en Ligne de Vue) — pas le −10 « Complexe ».
const sword: Weapon = { name: 'Épée', type: 'melee', damage: '+BF', qualities: [] };

describe('Localisation visée vs créature ≥ 2 catégories plus grande (LDB 76 l.39)', () => {
  const atk = statblockToCombatant({ name: 'A', char: {} }, 'a', { x: 0, y: 0 }); // Moyenne

  it('cible de Taille normale : viser une zone coûte −10 (Complexe)', () => {
    const t = statblockToCombatant({ name: 'T', char: {}, traits: [{ id: 'taille', arg: 'Moyenne' }] }, 't', { x: 1, y: 0 });
    const m = attackModifiers(atk, t, sword, { kind: 'melee', location: 'tete' });
    expect(m.some((x) => x.label === 'Localisation visée' && x.value === -10)).toBe(true);
  });

  it('cible ≥ 2 catégories plus grande : choix de zone GRATUIT (pas de −10)', () => {
    const t = statblockToCombatant({ name: 'Géant', char: {}, traits: [{ id: 'taille', arg: 'Énorme' }] }, 't', { x: 1, y: 0 }); // Énorme vs Moyenne = +2
    const m = attackModifiers(atk, t, sword, { kind: 'melee', location: 'tete' });
    expect(m.some((x) => x.label === 'Localisation visée')).toBe(false);
  });

  it('cible +1 catégorie seulement : viser coûte encore −10', () => {
    const t = statblockToCombatant({ name: 'Ogre', char: {}, traits: [{ id: 'taille', arg: 'Grande' }] }, 't', { x: 1, y: 0 }); // Grande vs Moyenne = +1
    const m = attackModifiers(atk, t, sword, { kind: 'melee', location: 'tete' });
    expect(m.some((x) => x.label === 'Localisation visée' && x.value === -10)).toBe(true);
  });
});
