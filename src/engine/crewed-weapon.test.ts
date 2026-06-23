import { describe, it, expect } from 'vitest';
import { crewedPenalty } from './crewedWeapon';

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
