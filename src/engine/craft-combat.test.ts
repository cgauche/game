import { describe, it, expect } from 'vitest';
import { finishMelee } from './combat';
import { evaluateTest } from './tests';
import type { Combatant, Weapon } from './types';

const fighter = (cc: number, weapon: Weapon): Combatant =>
  ({
    id: 'x', name: 'X', kind: 'enemy',
    characteristics: { CC: cc, CT: cc, F: 40, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [],
    weapons: [weapon], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4,
  }) as unknown as Combatant;

const sword = (qualities: string[] = []): Weapon => ({ name: 'Épée', type: 'melee', damage: '+BF', qualities });

describe('Pratique / Peu Fiable en mêlée — Test opposé (LDB 60 l.59/88)', () => {
  // atk raté (DR -1) mais def raté pire (DR -2) → l'attaquant GAGNE l'opposé malgré son échec (DR net 1).
  const atk = evaluateTest(63, 50); // 63 > 50 → échec, DR -1
  const def = evaluateTest(72, 50); // 72 > 50 → échec, DR -2
  const run = (atkQ: string[]) => finishMelee(fighter(50, sword(atkQ)), fighter(50, sword()), sword(atkQ), atk, def, 'parade');

  it('base : jet d’attaque RATÉ mais opposé GAGNÉ (DR net 1) → touche', () => {
    const r = run([]);
    expect(r.hit).toBe(true);
    expect(r.netSL).toBe(1);
  });
  it('Pratique (+1 DR au jet raté) → DR net +1 → +1 Blessure (impacte le DR total ET les dégâts)', () => {
    const base = run([]);
    const prat = run(['Pratique']);
    expect(prat.netSL).toBe(base.netSL + 1); // 2 vs 1
    expect(prat.woundsLost!).toBe(base.woundsLost! + 1); // le DR net s'ajoute aux Dégâts
  });
  it('Peu Fiable (−1 DR au jet raté) → DR net 0 (égalité) → l’attaque échoue', () => {
    expect(run(['Peu Fiable']).hit).toBe(false);
  });
});
