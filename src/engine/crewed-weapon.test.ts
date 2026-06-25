import { describe, it, expect } from 'vitest';
import { crewedPenalty, crewedFireWeapon } from './crewedWeapon';
import type { Weapon } from './types';

/**
 * ARME D'ÉQUIPE — sous-effectif (MDG ch.12 l.448-460), GÉNÉRAL (sièges au sol comme naval). Pénalités
 * CUMULATIVES selon le déficit (Indice requis − servants présents) : 1 manquant → temps de recharge DOUBLÉ ;
 * 2 → + Défaut *Imprécise* ; 3 → + Défaut *Dangereuse*. Le doublement de recharge ne se cumule pas (×2, pas ×4).
 */
describe('crewedPenalty — table de sous-effectif d’une Arme d’équipe (MDG ch.12 l.448-460)', () => {
  it('équipage complet (présents ≥ Indice) → aucune pénalité', () => {
    expect(crewedPenalty(4, 4)).toEqual({ reloadFactor: 1, addFlaws: [] });
    expect(crewedPenalty(5, 3)).toEqual({ reloadFactor: 1, addFlaws: [] });
  });

  it('Arme d’équipe 4 : 3 → recharge ×2 ; 2 → +Imprécise ; 1 → +Dangereuse (cumulatif)', () => {
    expect(crewedPenalty(3, 4)).toEqual({ reloadFactor: 2, addFlaws: [] });
    expect(crewedPenalty(2, 4)).toEqual({ reloadFactor: 2, addFlaws: ['imprecise'] });
    expect(crewedPenalty(1, 4)).toEqual({ reloadFactor: 2, addFlaws: ['imprecise', 'dangereuse'] });
  });

  it('Arme d’équipe 3 : 2 → recharge ×2 ; 1 → +Imprécise', () => {
    expect(crewedPenalty(2, 3)).toEqual({ reloadFactor: 2, addFlaws: [] });
    expect(crewedPenalty(1, 3)).toEqual({ reloadFactor: 2, addFlaws: ['imprecise'] });
  });

  it('Arme d’équipe 2 : 1 servant → recharge ×2 seulement', () => {
    expect(crewedPenalty(1, 2)).toEqual({ reloadFactor: 2, addFlaws: [] });
  });
});

const cannon = (over: Partial<Weapon> = {}): Weapon =>
  ({ name: 'Canon', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 100,
    qualities: [{ id: 'arme-d-equipe', value: 3 }], subType: 'poudre-noire', reload: 3, ...over }) as Weapon;
const hasQ = (w: Weapon, id: string) => w.qualities.some((q) => q.id === id);

describe('crewedFireWeapon — Défauts de sous-effectif BAKÉS sur l’arme tirée (MDG ch.12 l.448-460)', () => {
  it('équipage complet (présents ≥ Indice) → arme NETTE : Arme d’équipe retirée, aucun Défaut, recharge normale', () => {
    const w = crewedFireWeapon(cannon(), 3); // Indice 3, 3 servants
    expect(hasQ(w, 'arme-d-equipe')).toBe(false); // retirée → dispatch ne re-pénalise pas en « solo »
    expect(hasQ(w, 'imprecise')).toBe(false);
    expect(hasQ(w, 'dangereuse')).toBe(false);
    expect(w.reload).toBe(3);
  });

  it('1 servant manquant → recharge ×2, aucun Défaut', () => {
    const w = crewedFireWeapon(cannon(), 2); // déficit 1
    expect(w.reload).toBe(6);
    expect(hasQ(w, 'imprecise')).toBe(false);
  });

  it('2 manquants → recharge ×2 + Imprécise', () => {
    const w = crewedFireWeapon(cannon(), 1); // déficit 2
    expect(w.reload).toBe(6);
    expect(hasQ(w, 'imprecise')).toBe(true);
    expect(hasQ(w, 'dangereuse')).toBe(false);
  });

  it('Indice 4 manié seul → recharge ×2 + Imprécise + Dangereuse', () => {
    const w = crewedFireWeapon(cannon({ qualities: [{ id: 'arme-d-equipe', value: 4 }] }), 1); // déficit 3
    expect(hasQ(w, 'imprecise')).toBe(true);
    expect(hasQ(w, 'dangereuse')).toBe(true);
  });

  it('un Défaut DÉJÀ porté n’est pas redoublé (pas de doublon dans qualities)', () => {
    const w = crewedFireWeapon(cannon({ qualities: [{ id: 'arme-d-equipe', value: 3 }, { id: 'imprecise' }] }), 1); // déficit 2 → ajoute Imprécise
    expect(w.qualities.filter((q) => q.id === 'imprecise').length).toBe(1);
  });

  it('arme NON Arme d’équipe → inchangée', () => {
    const arc = cannon({ qualities: [], reload: 0 });
    expect(crewedFireWeapon(arc, 1)).toEqual(arc);
  });
});
