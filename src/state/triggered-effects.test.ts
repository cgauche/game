/**
 * Effets DÉCLENCHÉS génériques (`TriggeredEffect`) — preuve que le MÊME système flow+déclencheur sert
 * les Traits de créature (Toile) ET les Atouts d'arme (Immobilisante), via UN dispatcher (`fireTriggers`)
 * réutilisant l'exécuteur des sorts (`runSpellFlowLines`). Plus de handler en dur par trait/atout.
 */
import { describe, it, expect } from 'vitest';
import { fireTriggers } from './triggeredEffects';
import { runSpellFlowLines } from './combatEffects';
import { evalCondition } from './flow';
import { applyOps } from '../engine/ops';
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
const empetre = (c: Combatant) => c.conditions.find((x) => x.name === 'empetre');

describe('fireTriggers — Traits et Atouts sur le même système flow+déclencheur', () => {
  it('TRAIT Toile : à la touche, la victime gagne Empêtré (Force d’évasion = Force de l’attaquant)', () => {
    const spider = mk({ id: 'sp', traits: [{ id: 'toile', value: 40 }] }); // l'Indice est descriptif ; l'effet est en donnée
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
    const spider = mk({ traits: [{ id: 'toile' }] });
    const prey = mk({ conditions: [{ name: 'empetre', value: 2 }] });
    fireTriggers(noBattle(), spider, 'onHit', { victim: prey });
    expect(empetre(prey)?.value).toBe(2); // inchangé
  });

  it('TRAIT Nerveux : déclencheur onStartled (magie/bruit) → +3 Brisé sur soi', () => {
    const skittish = mk({ traits: [{ id: 'nerveux' }] });
    fireTriggers(noBattle(), skittish, 'onStartled', {});
    expect(skittish.conditions.find((c) => c.name === 'brise')?.value).toBe(3);
  });

  it('TRAIT Sang corrosif : onWoundLoss → les Engagés subissent 1d10 (BE+PA, min 1)', () => {
    const acid = mk({ id: 'ac', traits: [{ id: 'sang-corrosif' }] });
    const foe = mk({ id: 'fo', engagedWith: ['ac'], characteristics: { ...mk().characteristics, E: 80 } }); // BE élevé → mitigation forte
    const get = () => ({ battle: { combatants: [acid, foe] } }) as never;
    const before = foe.wounds.current;
    fireTriggers(get, acid, 'onWoundLoss', { rng: makeRNG(1) });
    expect(foe.wounds.current).toBeLessThan(before); // au moins 1 (min) malgré BE 80
    expect(before - foe.wounds.current).toBeGreaterThanOrEqual(1);
  });

  it('TRAIT Affamé : déclencheur onKill → Test de FM (op test) ; échec → perd Action+Mouvement (op loseTurn)', () => {
    const hungry = mk({ traits: [{ id: 'affame' }] });
    const lines = fireTriggers(noBattle(), hungry, 'onKill', { rng: makeRNG(1) });
    expect(lines.join(' ')).toMatch(/Force Mentale/); // le test FM s'est joué (op test, non-interactif)
  });

  it('TRAIT Vampirique : Morsure infligeant N PB → l’attaquant draine N PB (Vol de vie, gaté par attackKind)', () => {
    const vampire = mk({ id: 'vp', traits: [{ id: 'vampirique' }], wounds: { current: 10, max: 30 } });
    const prey = mk({ id: 'pr' });
    // onHit d'une Morsure ayant infligé 6 PB → lifeSteal 1/1 sur l'attaquant (ctx.caster).
    fireTriggers(noBattle(), vampire, 'onHit', { victim: prey, attackKind: 'morsure', woundsDealt: 6 });
    expect(vampire.wounds.current).toBe(16); // 10 + 6, plafonné au max (30)
  });

  it('TRAIT Vampirique : un coup d’ARME (≠ Morsure) ne draine PAS (Condition attackKind)', () => {
    const vampire = mk({ id: 'vp', traits: [{ id: 'vampirique' }], wounds: { current: 10, max: 30 } });
    const prey = mk({ id: 'pr' });
    fireTriggers(noBattle(), vampire, 'onHit', { victim: prey, attackKind: 'arme', woundsDealt: 6 });
    expect(vampire.wounds.current).toBe(10); // attackKind ≠ 'morsure' → branche then non prise
  });

  it('op loseTurn : pose les drapeaux lus au début du Round', () => {
    const c = mk();
    runSpellFlowLines(c, c, { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'loseTurn' }] } }, { rng: makeRNG(1), caster: c });
    expect(c.loseNextAction).toBe(true);
    expect(c.loseNextMovement).toBe(true);
  });

  it('Condition `compare` générique : who (cible/lanceur) × donnée/État · opérateur · valeur (const ou acteur)', () => {
    const target = { id: 't', woundsCurrent: 5, woundsMax: 15, size: 2, advantage: 0, camp: 'hostile' as const, groups: ['Morts-vivants'], talents: [], traits: ['mort-vivant'], conditions: { brise: 3 } }; // Petite (2), ennemi mort-vivant (conditions keyées par id)
    const caster = { id: 'c', woundsCurrent: 12, woundsMax: 12, size: 4, advantage: 1, camp: 'party' as const, groups: [], talents: [{ id: 'magie-des-arcanes', spec: 'Feu' }], traits: [], conditions: {} as Record<string, number> }; // Grande (4), mage de Feu
    const ctx = { flags: {}, gameTime: 0, target, caster };
    expect(evalCondition({ kind: 'compare', subject: { who: 'target', field: 'woundsCurrent' }, op: '>=', value: 1 }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'compare', subject: { who: 'target', condition: 'brise' }, op: '>=', value: 3 }, ctx)).toBe(true); // valeur d'État (stacks)
    expect(evalCondition({ kind: 'compare', subject: { who: 'caster', field: 'woundsCurrent' }, op: '>', value: 10 }, ctx)).toBe(true); // données du LANCEUR
    // ACTEUR-vs-ACTEUR : « cible plus petite que l'attaquant » (Attaque caudale)
    expect(evalCondition({ kind: 'compare', subject: { who: 'target', field: 'size' }, op: '<', value: { who: 'caster', field: 'size' } }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'compare', subject: { who: 'caster', field: 'size' }, op: '<', value: { who: 'target', field: 'size' } }, ctx)).toBe(false);
    expect(evalCondition({ kind: 'compare', subject: { who: 'target', field: 'woundsCurrent' }, op: '>=', value: 1 }, { flags: {}, gameTime: 0 })).toBe(false); // acteur absent
    // Condition `relation` : camp ABSOLU (kind) + relation RELATIVE au lanceur.
    expect(evalCondition({ kind: 'relation', who: 'target', is: 'hostile' }, ctx)).toBe(true); // la cible EST un ennemi (absolu)
    expect(evalCondition({ kind: 'relation', who: 'target', is: 'opponent' }, ctx)).toBe(true); // adversaire du lanceur (camp ≠)
    expect(evalCondition({ kind: 'relation', who: 'target', is: 'ally' }, ctx)).toBe(false);
    expect(evalCondition({ kind: 'relation', who: 'caster', is: 'party' }, ctx)).toBe(true); // le lanceur est du groupe
    expect(evalCondition({ kind: 'relation', who: 'target', is: 'self' }, ctx)).toBe(false); // cible ≠ lanceur
    // Condition `has` : appartenance Groupe / Talent (spec) / Trait.
    expect(evalCondition({ kind: 'has', who: 'target', what: 'group', value: 'Morts-vivants' }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'has', who: 'target', what: 'trait', value: 'mort-vivant' }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'has', who: 'caster', what: 'talent', value: 'magie-des-arcanes', spec: 'Feu' }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'has', who: 'caster', what: 'talent', value: 'magie-des-arcanes', spec: 'Mort' }, ctx)).toBe(false); // spec ≠
  });

  it('op rollThreshold : UN d10 → soin = la valeur du dé via Formula {rolled}', () => {
    const c = mk({ wounds: { current: 0, max: 20 } });
    applyOps(c, [{ op: 'rollThreshold', sides: 10, thresholds: [{ atLeast: 1, ops: [{ op: 'heal', amount: { rolled: true } }] }] }], { rng: makeRNG(3) });
    expect(c.wounds.current).toBeGreaterThanOrEqual(1); // a soigné le dé (1..10)
    expect(c.wounds.current).toBeLessThanOrEqual(10);
  });

  it('TRAIT Régénération : onRoundStart, PB>0 → régénère la valeur du dé (if « état de soi » + rollThreshold)', () => {
    const troll = mk({ traits: [{ id: 'regeneration' }], wounds: { current: 5, max: 30 } });
    fireTriggers(noBattle(), troll, 'onRoundStart', { rng: makeRNG(2) });
    expect(troll.wounds.current).toBeGreaterThan(5); // branche PB>0 → heal {rolled}
  });

  it('Atout authorable « à la touche : 1d10 Dégâts + Empêtré » — le Flow applique les DEUX ops', () => {
    // L'exemple exact demandé : un Flow de feuille EffectOp porté par un Atout (édité au Codex).
    const flow: Flow = {
      kind: 'seq',
      steps: [{
        kind: 'do',
        effect: { type: 'ops', on: 'target', ops: [
          { op: 'wounds', amount: { dice: { n: 1, sides: 10 } } },
          { op: 'condition', name: 'empetre', value: 1 },
        ] },
      }],
    };
    const attacker = mk({ id: 'a' });
    const victim = mk({ id: 'v', wounds: { current: 15, max: 15 } });
    runSpellFlowLines(victim, attacker, flow, { rng: makeRNG(3), caster: attacker });
    expect(victim.wounds.current).toBeLessThan(15); // 1d10 Dégâts appliqués (ignore BE/PA par défaut)
    expect(empetre(victim)?.value).toBe(1);
  });
});
