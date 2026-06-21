import { describe, it, expect } from 'vitest';
import { canFireWhileEngaged, attackWeapon } from './combat';
import { Weapon } from './types';

const arbalete: Weapon = { name: 'Arbalète', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [] };
const pistolet: Weapon = { name: 'Pistolet', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 20, qualities: ['Pistolet', 'Recharge'] };
const epee: Weapon = { name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

describe('canFireWhileEngaged — Atout Pistolet (LDB Armes l.297-298)', () => {
  it('seule une arme à distance « Pistolet » tire en Combat rapproché', () => {
    expect(canFireWhileEngaged(pistolet)).toBe(true);
    expect(canFireWhileEngaged(arbalete)).toBe(false); // arbalète : pas de tir en mêlée
    expect(canFireWhileEngaged(epee)).toBe(false); // mêlée, pas concernée
  });
});

describe('attackWeapon — choisit l’arme selon la distance', () => {
  it('cible au contact : privilégie l’arme de MÊLÉE (Knud : Épée, pas l’Arbalète)', () => {
    expect(attackWeapon([arbalete, epee], true)).toBe(epee);
  });
  it('cible au contact, pas d’arme de mêlée mais un Pistolet : tir à bout portant autorisé', () => {
    expect(attackWeapon([pistolet], true)).toBe(pistolet);
  });
  it('cible au contact, arme à distance simple seule : dernier recours = weapons[0]', () => {
    expect(attackWeapon([arbalete], true)).toBe(arbalete);
  });
  it('cible distante : privilégie l’arme à DISTANCE', () => {
    expect(attackWeapon([epee, arbalete], false)).toBe(arbalete);
  });
});
