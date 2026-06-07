import { describe, it, expect } from 'vitest';
import { encounterPsych } from './encounterPsych';
import type { Combatant } from './types';

const hero = (opts: Partial<Combatant>): Combatant =>
  ({ id: 'h', name: 'H', kind: 'hero', size: 'moyenne', psychState: [], psychTraits: [], groups: [], ...opts } as unknown as Combatant);
const npc = (id: string, opts: Partial<Combatant>): Combatant =>
  ({ id, name: id, kind: 'npc', size: 'moyenne', groups: [], ...opts } as unknown as Combatant);

describe('encounterPsych — Psychologie à la rencontre, hors combat (couture C, LDB 21)', () => {
  it('rencontrer un PNJ ÉNORME → Terreur (écart de Taille ≥ 2)', () => {
    const t = encounterPsych(hero({}), [npc('geant', { size: 'enorme' })]);
    expect(t).toEqual({ kind: 'terreur', sourceId: 'geant', indice: 2 });
  });

  it('rencontrer un PNJ « Peur 3 » au statbloc → Peur 3', () => {
    const t = encounterPsych(hero({}), [npc('spectre', { causesPeur: 3 })]);
    expect(t).toEqual({ kind: 'peur', sourceId: 'spectre', indice: 3 });
  });

  it('héros avec Animosité (Elfes) face à un Elfe présent → trait ciblé (taverne, l.16)', () => {
    const t = encounterPsych(hero({ psychTraits: [{ type: 'animosite', cible: 'Elfes' }] }), [npc('elfe', { groups: ['Elfe'] })]);
    expect(t).toEqual({ kind: 'animosite', sourceId: 'elfe', indice: 0, cible: 'Elfes' });
  });

  it('PNJ de même Taille, aucun trait → aucun Test', () => {
    expect(encounterPsych(hero({}), [npc('paysan', { groups: ['Humain'] })])).toBeNull();
  });

  it('source déjà en psychState → pas re-déclenchée', () => {
    const h = hero({ psychState: [{ type: 'peur', sourceId: 'geant', indice: 2, calmeDR: 0 }] });
    expect(encounterPsych(h, [npc('geant', { size: 'enorme' })])).toBeNull();
  });

  it('Immunité (Psychologie) ou Frénésie → aucun Test', () => {
    expect(encounterPsych(hero({ psychImmune: true }), [npc('geant', { size: 'enorme' })])).toBeNull();
    expect(encounterPsych(hero({ frenzied: true }), [npc('geant', { size: 'enorme' })])).toBeNull();
  });
});
