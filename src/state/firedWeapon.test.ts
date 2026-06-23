import { describe, it, expect } from 'vitest';
import { firedWeapon } from './combatFlow';
import type { Combatant, Weapon } from '../engine/types';

const W = (uid: string, name: string): Weapon =>
  ({ uid, name, type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], hand: uid === 'm' ? 'main' : 'off', hands: 1 });
const atk = (): Combatant =>
  ({ id: 'a', name: 'A', kind: 'hero', pos: { x: 0, y: 0 }, weapons: [W('m', 'Épée'), W('o', 'Dague')], size: 3 } as unknown as Combatant);
const tgt = (): Combatant =>
  ({ id: 't', name: 'T', kind: 'enemy', pos: { x: 1, y: 0 }, size: 3 } as unknown as Combatant);

describe('firedWeapon : honore weaponUid', () => {
  it('sans weaponUid : auto-choix (1ʳᵉ mêlée au contact)', () => {
    expect(firedWeapon(atk(), tgt()).name).toBe('Épée');
  });
  it('weaponUid valide : renvoie l’arme choisie (main secondaire)', () => {
    expect(firedWeapon(atk(), tgt(), 'o').name).toBe('Dague');
  });
  it('weaponUid inconnu : repli auto', () => {
    expect(firedWeapon(atk(), tgt(), 'zzz').name).toBe('Épée');
  });
});
