import { describe, it, expect } from 'vitest';
import { resolveVolley } from './volley';
import type { RNG } from './dice';
import type { Combatant, ShipPoste } from './types';

/** Pièce d'artillerie minimale (Dégâts plats, sans BF) sur un bord. */
const gun = (name: string): ShipPoste =>
  ({ side: 'tribord', item: { uid: name, name, kind: 'ranged', damage: { flat: 14, plusBF: false }, range: 50, qualities: [] }, crewIds: [] }) as unknown as ShipPoste;

/** Coque minimale : Endurance `E` (→ BE = E/10) + blindage de coque optionnel. */
const hull = (E: number, armourCorps = 0): Combatant =>
  ({
    id: 'h', name: 'Coque', kind: 'npc', bodyShape: 'vehicule',
    characteristics: { CC: 0, CT: 0, F: 0, E, I: 0, Ag: 0, Dex: 0, Int: 0, FM: 0, Soc: 0 },
    armour: { corps: armourCorps }, conditions: [], wounds: { current: 90, max: 90, base: 90 },
  }) as unknown as Combatant;

/** RNG figé : `d100` (= int(1,100)) renvoie toujours `n` → localisation/double déterministes. */
const fixed = (n: number): RNG => ({ int: () => n }) as unknown as RNG;

describe('resolveVolley — bordée (MDG ch.14 l.128 / ch.13)', () => {
  const firing = hull(40);
  const target = hull(40); // BE 4
  const postes = [gun('Canon moyen'), gun('Canon petit')];

  it('chaque pièce = Dégâts arme + DR partagé − BE ; Σ des Blessures (l.128)', () => {
    const r = resolveVolley(firing, postes, target, 'voile', 3, fixed(34));
    expect(r.shots).toHaveLength(2);
    expect(r.shots[0].damage).toBe(17); // 14 + 3
    expect(r.shots[0].wounds).toBe(13); // 17 − BE 4
    expect(r.totalWounds).toBe(26); // 2 pièces
    expect(r.shots[0].critical).toBe(false); // 34 ≠ double
  });

  it('DR négatif → « pour le pire » : Dégâts réduits, plancher 0 (ch.13 l.605)', () => {
    const r = resolveVolley(firing, postes, target, 'voile', -20, fixed(34));
    expect(r.shots[0].damage).toBe(-6); // 14 − 20
    expect(r.shots[0].wounds).toBe(0); // max(0, −6 − 4)
    expect(r.totalWounds).toBe(0);
  });

  it('double sur le 1d100 de localisation → Critique (ch.13 l.656)', () => {
    const r = resolveVolley(firing, postes, target, 'voile', 3, fixed(33));
    expect(r.shots.every((s) => s.critical)).toBe(true);
    expect(r.shots[0].locRoll).toBe(33); // exposé pour le forcedLocRoll du Critique
  });

  it('blindage de coque réduit les Blessures', () => {
    const armored = hull(40, 2); // BE 4 + 2 PA
    const r = resolveVolley(firing, postes, armored, 'voile', 3, fixed(34));
    expect(r.shots[0].wounds).toBe(11); // 17 − 4 − 2
  });
});
