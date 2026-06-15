/**
 * Effets DÉCLENCHÉS génériques (`TriggeredEffect`) — preuve que le MÊME système flow+déclencheur sert
 * les Traits de créature (Toile) ET les Atouts d'arme (Immobilisante), via UN dispatcher (`fireTriggers`)
 * réutilisant l'exécuteur des sorts (`runSpellFlow`). Plus de handler en dur par trait/atout.
 */
import { describe, it, expect } from 'vitest';
import { fireTriggers } from './triggeredEffects';
import { runSpellFlow } from './combatEffects';
import { makeRNG } from '../engine/dice';
import type { Combatant, Weapon } from '../engine/types';
import type { Flow } from './flow';

const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'c', name: 'C', kind: 'enemy',
  characteristics: { CC: 35, CT: 25, F: 35, E: 35, I: 30, Ag: 30, Dex: 30, Int: 25, FM: 25, Soc: 25 },
  wounds: { current: 15, max: 15 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
  ...over,
} as Combatant);

const noBattle = () => ({ battle: undefined }) as never;
const empetre = (c: Combatant) => c.conditions.find((x) => x.name === 'Empêtré');

describe('fireTriggers — Traits et Atouts sur le même système flow+déclencheur', () => {
  it('TRAIT Toile : à la touche, la victime gagne Empêtré (Force d’évasion = Force de l’attaquant)', () => {
    const spider = mk({ id: 'sp', traits: ['Toile 40'] }); // l'Indice est descriptif ; l'effet est en donnée
    const prey = mk({ id: 'pr' });
    fireTriggers(noBattle(), spider, 'onHit', { victim: prey });
    expect(empetre(prey)?.value).toBe(1);
    expect(empetre(prey)?.escapeStrength).toBe(spider.characteristics.F); // {charOf:'F'} résolu vs l’attaquant
  });

  it('ATOUT Immobilisante : l’arme qui touche pose Empêtré — MÊME chemin que le trait', () => {
    const knight = mk({ id: 'kn' });
    const foe = mk({ id: 'fo' });
    const weapon: Weapon = { name: 'Fléau à chaîne', type: 'melee', damage: '+BF+4', qualities: ['Immobilisante'] } as Weapon;
    fireTriggers(noBattle(), knight, 'onHit', { victim: foe, weapon });
    expect(empetre(foe)?.value).toBe(1);
  });

  it('déjà Empêtré → pas de re-application (unlessCondition)', () => {
    const spider = mk({ traits: ['Toile'] });
    const prey = mk({ conditions: [{ name: 'Empêtré', value: 2 }] });
    fireTriggers(noBattle(), spider, 'onHit', { victim: prey });
    expect(empetre(prey)?.value).toBe(2); // inchangé
  });

  it('Atout authorable « à la touche : 1d10 Dégâts + Empêtré » — le Flow applique les DEUX ops', () => {
    // L'exemple exact demandé : un Flow de feuille EffectOp porté par un Atout (édité au Codex).
    const flow: Flow = {
      kind: 'seq',
      steps: [{
        kind: 'do',
        effect: { type: 'ops', on: 'target', ops: [
          { op: 'wounds', amount: { dice: { n: 1, sides: 10 } } },
          { op: 'condition', name: 'Empêtré', value: 1 },
        ] },
      }],
    };
    const attacker = mk({ id: 'a' });
    const victim = mk({ id: 'v', wounds: { current: 15, max: 15 } });
    runSpellFlow(victim, attacker, flow, { rng: makeRNG(3), caster: attacker });
    expect(victim.wounds.current).toBeLessThan(15); // 1d10 Dégâts appliqués (ignore BE/PA par défaut)
    expect(empetre(victim)?.value).toBe(1);
  });
});
