import { describe, it, expect } from 'vitest';
import { heroMustPassTurn, applyZeroWounds } from './conditions';
import type { Combatant } from './types';

const mk = (over: Partial<Combatant> = {}): Combatant =>
  ({
    name: 'C',
    kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 12 },
    conditions: [],
    skills: [],
    ...over,
  }) as unknown as Combatant;

describe('heroMustPassTurn — auto-skip du héros à terre à 0 PB (bug « 38 tours à vide »)', () => {
  it('héros À Terre à 0 PB sans Détermination → passe son tour', () => {
    const h = mk({ wounds: { current: 0, max: 12 } });
    applyZeroWounds(h); // pose l'État À Terre
    expect(heroMustPassTurn(h)).toBe(true);
  });
  it('héros À Terre à 0 PB AVEC Détermination → ne passe pas (peut récupérer +1 PB / retirer un État)', () => {
    const h = mk({ wounds: { current: 0, max: 12 }, resolve: 1 });
    applyZeroWounds(h);
    expect(heroMustPassTurn(h)).toBe(false);
  });
  it('héros debout (PB>0) → ne passe pas', () => {
    expect(heroMustPassTurn(mk())).toBe(false);
  });
  it('héros Sonné mais PB>0 → ne passe pas (peut encore se déplacer)', () => {
    expect(heroMustPassTurn(mk({ conditions: [{ name: 'Sonné', value: 1 }] }))).toBe(false);
  });
  it('ennemi : jamais auto-passé par ce prédicat (géré par l’IA)', () => {
    const e = mk({ kind: 'enemy', wounds: { current: 0, max: 12 } });
    expect(heroMustPassTurn(e)).toBe(false);
  });
  it('héros Inconscient : déjà hors de combat, pas concerné', () => {
    expect(heroMustPassTurn(mk({ conditions: [{ name: 'Inconscient', value: 1 }], wounds: { current: 0, max: 12 } }))).toBe(false);
  });
});
