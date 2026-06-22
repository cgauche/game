import { describe, it, expect } from 'vitest';
import { encounterPsych } from './encounterPsych';
import type { Combatant } from './types';

const hero = (opts: Partial<Combatant>): Combatant =>
  ({ id: 'h', name: 'H', kind: 'hero', size: 'moyenne', psychState: [], psychTraits: [], groups: [], ...opts } as unknown as Combatant);
const npc = (id: string, opts: Partial<Combatant>): Combatant =>
  ({ id, name: id, kind: 'npc', size: 'moyenne', groups: [], ...opts } as unknown as Combatant);

describe('encounterPsych — Psychologie à la rencontre, HORS COMBAT (Peur/Terreur = combat seulement)', () => {
  it('rencontrer un PNJ ÉNORME (Terreur de Taille) → AUCUN Test hors combat', () => {
    expect(encounterPsych(hero({}), [npc('geant', { size: 'enorme' })])).toBeNull();
  });

  it('rencontrer un PNJ « Peur 3 » au statbloc → AUCUN Test hors combat', () => {
    expect(encounterPsych(hero({}), [npc('spectre', { causesPeur: 3 })])).toBeNull();
  });

  it('héros avec Animosité (Elfes) face à un Elfe présent → trait ciblé SOCIAL (taverne, l.16)', () => {
    const t = encounterPsych(hero({ psychTraits: [{ type: 'animosite', cible: 'Elfes' }] }), [npc('elfe', { groups: ['Elfe'] })]);
    expect(t).toEqual({ kind: 'animosite', sourceId: 'elfe', indice: 0, cible: 'Elfes' });
  });

  it('PNJ de même Taille, aucun trait → aucun Test', () => {
    expect(encounterPsych(hero({}), [npc('paysan', { groups: ['Humain'] })])).toBeNull();
  });

  it('Immunité (Psychologie) bloque même un Trait social ; Frénésie aussi', () => {
    const immune = hero({ psychImmune: true, psychTraits: [{ type: 'animosite', cible: 'Elfes' }] });
    expect(encounterPsych(immune, [npc('elfe', { groups: ['Elfe'] })])).toBeNull();
    const frenzied = hero({ psychState: [{ type: 'frenesie' }], psychTraits: [{ type: 'animosite', cible: 'Elfes' }] });
    expect(encounterPsych(frenzied, [npc('elfe', { groups: ['Elfe'] })])).toBeNull();
  });
});
