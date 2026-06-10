/**
 * Lot 5 — Surincantation (LDB 47 l.28-31), États à durée et États récurrents :
 * allocation du surplus de DR (Durée ×n, +Cibles), décrément des États posés par
 * sort, ré-application « un par Round » via effet actif porteur.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyCast, overcastTargetCandidates } from './combatFlow';
import { makePregens } from '../data/pregens';
import { findSpell } from '../data';
import { applyOps } from '../engine/ops';
import { addTimedCondition, addCondition, endOfRound, hasCondition } from '../engine/conditions';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import type { CastResult } from '../engine/magic';

const okRes = (sl: number): CastResult => ({ cast: true, roll: 21, target: 70, sl, isCritical: false, isFumble: false, log: 'lancé' });

function pair() {
  const all = makePregens();
  return { priest: all.find((h) => h.name === 'Frère Anselm')!, ally: all.find((h) => h.name === 'Sigmund Reikhardt')! };
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingReveals: [] });
  useGame.getState().seedRng(31);
});

describe('États à durée (ConditionInstance.roundsLeft)', () => {
  it('addTimedCondition pose la durée ; endOfRound décrémente puis dissipe', () => {
    const c = pair().ally;
    addTimedCondition(c, 'Sonné', 1, 2);
    expect(c.conditions.find((x) => x.name === 'Sonné')?.roundsLeft).toBe(2);
    endOfRound(c, makeRNG(1));
    expect(hasCondition(c, 'Sonné')).toBe(true);
    const log = endOfRound(c, makeRNG(1));
    expect(hasCondition(c, 'Sonné')).toBe(false);
    expect(log.join('\n')).toMatch(/Sonné \(sort\) se dissipe/);
  });

  it('un ajout NON temporisé efface la durée (on n\'écourte jamais un État normal)', () => {
    const c = pair().ally;
    addTimedCondition(c, 'Aveuglé', 1, 3);
    addCondition(c, 'Aveuglé', 1);
    expect(c.conditions.find((x) => x.name === 'Aveuglé')?.roundsLeft).toBeUndefined();
  });

  it('op condition.durationRounds → addTimedCondition (Régurgitation : Sonné 1d10 Rounds)', () => {
    const c = pair().ally;
    applyOps(c, [{ op: 'condition', name: 'Sonné', durationRounds: { dice: { n: 1, sides: 10 } } }], { rng: makeRNG(2) });
    const inst = c.conditions.find((x) => x.name === 'Sonné')!;
    expect(inst.roundsLeft).toBeGreaterThanOrEqual(1);
    expect(inst.roundsLeft).toBeLessThanOrEqual(10);
  });
});

describe('États récurrents (« un par Round »)', () => {
  it('op condition.perRound : ré-appliqué chaque fin de Round pendant la durée du sort', () => {
    const c = pair().ally;
    applyOps(c, [{ op: 'condition', name: 'Hémorragique', perRound: true }], { label: 'Malédiction', defaultDurationRounds: 2 });
    expect(hasCondition(c, 'Hémorragique')).toBe(false); // récurrent : agit en fin de Round
    endOfRound(c, makeRNG(1));
    // fin de Round 1 : +1 Hémorragique (le saignement immédiat tick aussi via endOfRound → PB)
    expect(c.conditions.find((x) => x.name === 'Hémorragique')?.value).toBeGreaterThanOrEqual(1);
    const v1 = c.conditions.find((x) => x.name === 'Hémorragique')!.value;
    endOfRound(c, makeRNG(1));
    const v2 = c.conditions.find((x) => x.name === 'Hémorragique')?.value ?? 0;
    expect(v2).toBeGreaterThanOrEqual(v1); // ré-appliqué au Round 2 (dernier de l'effet)
    expect(c.activeEffects?.length ?? 0).toBe(0); // l'effet porteur expiré
  });
});

/** Combattant minimal posé en (x,0) pour les listes de cibles. */
function stub(id: string, kind: 'hero' | 'enemy', x: number, wounds = 12): Combatant {
  return {
    id, name: id, kind,
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: wounds, max: 12, base: 12 },
    advantage: 0, conditions: [], weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, pos: { x, y: 0 },
  } as Combatant;
}

describe('overcastTargetCandidates — cibles supplémentaires proposables (modale, LDB 47 l.28-31)', () => {
  it('Projectile : exclut la cible principale, le figurant tombé à 0 PB (hors de combat) et le mort', () => {
    const caster = stub('w', 'hero', 0);
    const downed = stub('e3', 'enemy', 3, 0); // Mort Subite (LDB 18 l.51-54) : à 0 PB il est « mort » sur le plateau
    const dead = { ...stub('e4', 'enemy', 4), dead: true };
    const pool = [caster, stub('e1', 'enemy', 1), stub('e2', 'enemy', 2), downed, dead];
    const ids = overcastTargetCandidates(pool, caster, 'e1', findSpell('Carreau')!, true).map((c) => c.id);
    expect(ids).toEqual(['e2']);
  });

  it('Projectile : les cibles supplémentaires doivent être À PORTÉE du Sort', () => {
    const caster = stub('w', 'hero', 0); // Carreau : Portée FM mètres → FM 30 = 15 cases
    const far = stub('e3', 'enemy', 90);
    const ids = overcastTargetCandidates([caster, stub('e1', 'enemy', 1), stub('e2', 'enemy', 2), far], caster, 'e1', findSpell('Carreau')!, true).map((c) => c.id);
    expect(ids).toEqual(['e2']);
  });

  it('bénéfique : le lanceur et un allié Inconscient restent proposables (un soin le réveille), un mort non', () => {
    const caster = stub('w', 'hero', 0);
    const ko = stub('h2', 'hero', 1, 0);
    addCondition(ko, 'Inconscient', 1);
    const dead = { ...stub('h3', 'hero', 2), dead: true };
    const ids = overcastTargetCandidates([caster, stub('h1', 'hero', 3), ko, dead], caster, 'h1', { range: null }, false).map((c) => c.id);
    expect(ids).toEqual(['w', 'h2']);
  });
});

describe('Surincantation (LDB 47 l.28-31)', () => {
  it('castAllocOvercast respecte le budget (+2 DR par allocation, au-delà du NI)', () => {
    const { priest, ally } = pair();
    const wiz = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
    useGame.setState({ party: [wiz, priest, ally] as Combatant[] });
    // Armure Aethyrique : NI 2 ; DR 6 → surplus 4 → budget 2 allocations.
    useGame.setState({ pendingCast: { casterId: wiz.id, targetId: wiz.id, spellLabel: 'Armure Aethyrique', missile: false, focused: false, result: okRes(6) } });
    useGame.getState().castAllocOvercast('duration');
    useGame.getState().castAllocOvercast('duration');
    useGame.getState().castAllocOvercast('duration'); // refusé : budget épuisé
    expect(useGame.getState().pendingCast!.overcast).toEqual({ duration: 2, targets: 0 });
  });

  it('les Bénédictions surincantent sur le DR ENTIER (LDB 41 « Degrés de Réussite ») : +4 DR → 2 allocations', () => {
    const { priest, ally } = pair();
    useGame.setState({ party: [priest, ally] as Combatant[] });
    useGame.setState({ pendingCast: { casterId: priest.id, targetId: ally.id, spellLabel: 'Bénédiction de Bataille', missile: false, focused: false, result: okRes(4) } });
    useGame.getState().castAllocOvercast('duration');
    useGame.getState().castAllocOvercast('targets');
    useGame.getState().castAllocOvercast('targets'); // refusé : budget 2 épuisé
    expect(useGame.getState().pendingCast!.overcast).toEqual({ duration: 1, targets: 1 });
  });

  it('durée ×(1+n) et cible supplémentaire appliquées par applyCast', () => {
    const { priest, ally } = pair();
    const wiz = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
    useGame.setState({ party: [wiz, priest, ally] as Combatant[] });
    const sort = { ...findSpell('Bénédiction de Bataille')!, type: 'Magie des Arcanes', cn: 0 }; // gabarit +10 CC 6 rounds en SORT
    applyCast(useGame.getState, useGame.setState, wiz, priest, sort, okRes(4), false, false, undefined, {
      durationMult: 2,
      extraTargets: [ally],
    });
    const p = useGame.getState().party.find((h) => h.id === priest.id)!;
    const a = useGame.getState().party.find((h) => h.id === ally.id)!;
    expect(p.activeEffects?.[0]).toMatchObject({ char: 'CC', bonus: 10, roundsLeft: 12 }); // 6 ×2
    expect(a.activeEffects?.[0]).toMatchObject({ char: 'CC', bonus: 10, roundsLeft: 12 }); // cible étendue
    expect(useGame.getState().journal.join('\n')).toMatch(/Surincantation/);
  });
});
