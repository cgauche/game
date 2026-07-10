import { describe, it, expect } from 'vitest';
import { woundsAtCritLocation, type AttackResult } from './combat';
import type { Combatant, Weapon } from './types';

/**
 * #80 — LDB 18 l.55 : « Pour calculer enfin les Dégâts non Critiques d'une Attaque, utilisez la nouvelle
 * Localisation déterminée par la Blessure Critique. » Un Coup Critique re-tire la localisation ; les Dégâts
 * NON-critiques (de base) utilisent la PA de CETTE localisation, pas celle de la touche d'origine.
 */
const weapon = { name: 'Épée', type: 'melee', qualities: [] } as unknown as Weapon;

const target = (): Combatant =>
  ({
    id: 'T', name: 'Cible', kind: 'enemy',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], traumas: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 }, // corps blindé (PA 4), tête nue (PA 0)
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
  }) as unknown as Combatant;

// Coup Critique : dégâts bruts 12, jet de touche PAIR (pas de Partielle), aucun PA externe (Tir sûr / opposition).
const crit: AttackResult = {
  hit: true, critical: true, attackerRoll: 12, netSL: 1, location: 'corps', damage: 12, apExternal: 0,
  woundsLost: 5, advantageTo: 'attacker', defenderDefeated: false, log: '',
};

describe('#80 — Dégâts non-critiques à la localisation RE-TIRÉE du Coup Critique (LDB 18 l.55)', () => {
  it('utilise la PA de la NOUVELLE localisation, pas celle d’origine', () => {
    const t = target(); // BE(E35) = 3
    // Origine corps (PA 4) : 12 − 3 − 4 = 5.  Loc re-tirée tête (PA 0) : 12 − 3 − 0 = 9.
    expect(woundsAtCritLocation(crit, weapon, t, 'corps')).toBe(5);
    expect(woundsAtCritLocation(crit, weapon, t, 'tete')).toBe(9);
  });

  it('PA externe (Tir sûr / opposition) reste pris en compte, indépendant de la localisation', () => {
    const t = target();
    // apExternal négatif = PA ignoré (Tir sûr ignore N PA) : tête (PA 0) inchangé, corps (PA 4) → ignore 4 → 12-3-0=9.
    const sureShot: AttackResult = { ...crit, apExternal: -4 };
    expect(woundsAtCritLocation(sureShot, weapon, t, 'corps')).toBe(9);
  });
});
