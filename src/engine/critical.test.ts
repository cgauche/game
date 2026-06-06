import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { rollCritical, critLocationRoll } from './critical';
import type { Combatant } from './types';

const victim = (E = 30): Combatant =>
  ({
    name: 'V',
    characteristics: { CC: 30, CT: 30, F: 30, E, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 0, max: 12 },
    conditions: [],
    skills: [],
    kind: 'hero',
  }) as unknown as Combatant;

describe('rollCritical — résolution d’une Blessure critique (LDB 18-Traumatisme)', () => {
  it("retourne une entrée de la table de la localisation, avec PB et États", () => {
    const r = rollCritical(victim(), 'tete', makeRNG(1));
    expect(r.location).toBe('tete');
    expect(typeof r.name).toBe('string');
    expect(r.woundsLoss).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(r.conditions)).toBe(true);
  });
  it('overkill > BE applique -20 au jet (résultat moins sévère, min 01)', () => {
    const a = rollCritical(victim(35), 'corps', makeRNG(7), 0); // BE(35)=3
    const b = rollCritical(victim(35), 'corps', makeRNG(7), 10); // overkill 10 > 3 → -20
    expect(b.roll).toBe(Math.max(1, a.roll - 20));
  });
  it("le résultat 00 (létal) est mortel", () => {
    const r = rollCritical(victim(), 'tete', makeRNG(1));
    if (r.roll === 100) expect(r.lethal).toBe(true);
  });
  it('les traumatismes produits portent la localisation du critique (corps) et incluent des Fractures', () => {
    let sawFracture = false;
    for (let s = 1; s <= 60; s++) {
      const r = rollCritical(victim(), 'corps', makeRNG(s));
      for (const t of r.traumas) {
        expect(t.location).toBe('corps');
        if (t.label.startsWith('Fracture')) sawFracture = true;
      }
    }
    expect(sawFracture).toBe(true); // la table corps comporte des Fractures (Côtes/Hanche/Cage/Clavicule)
  });
  it('une Fracture du Torse posée par un critique réduit Force/Agilité de 30', () => {
    for (let s = 1; s <= 60; s++) {
      const r = rollCritical(victim(), 'corps', makeRNG(s));
      const frac = r.traumas.find((t) => t.label.startsWith('Fracture'));
      if (frac) {
        expect(frac.charPenalty).toEqual({ F: -30, Ag: -30 });
        return;
      }
    }
    throw new Error('aucune Fracture trouvée sur 60 seeds');
  });
});

describe('critLocationRoll — localisation d’un Coup Critique (1d100 direct, p.159)', () => {
  it('retourne une HitLocation valide', () => {
    const loc = critLocationRoll(makeRNG(3));
    expect(['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD']).toContain(loc);
  });
});
