import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import type { Combatant } from '../engine/types';

/**
 * RAW LDB 17 l.73 — « Je ne faillirai pas ! » : « au lieu de lancer les dés pour un Test, vous
 * CHOISISSEZ LE RÉSULTAT ». L'exemple (l.75) : Salundra rate, dépense 1 Résilience, et « choisit
 * également le résultat du dé, 11, ce qui donne un Coup Critique ». Donc sur une attaque forcée,
 * le joueur peut CHOISIR la valeur du dé (un double ≤ cible → Critique ; 01 → DR max ; le chiffre
 * des unités nourrit Percutante/Dévastatrice et la localisation inversée).
 */
const C = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'X', name: 'X', kind: 'hero',
    characteristics: { CC: 45, CT: 45, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], traumas: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    ...over,
  }) as unknown as Combatant;

function setupForcedAttack() {
  seedBattleRng(7);
  const attacker = C({ id: 'A', name: 'Att', resilience: 2 });
  const target = C({ id: 'B', name: 'Cible', kind: 'enemy', pos: { x: 1, y: 0 } });
  useGame.setState({
    battle: { combatants: [attacker, target], log: [] } as never,
    pendingAttack: {
      attackerId: 'A', targetId: 'B', location: null,
      result: {
        hit: false, attackerRoll: 88, netSL: -4, critical: false, advantageTo: 'defender',
        defenderDefeated: false, log: 'raté',
        attackerDetail: { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 88, success: false, sl: -4 },
      } as never,
    },
  });
  useGame.getState().attackForceSuccess();
}

beforeEach(() => {
  useGame.setState({ pendingAttack: null, battle: null });
});

describe('attackSetForcedRoll — choisir la valeur du dé d’un succès forcé (RAW LDB 17 l.73)', () => {
  it('choisir un double ≤ cible (44) → Coup Critique (l’exemple Salundra)', () => {
    setupForcedAttack();
    useGame.getState().attackSetForcedRoll(44);
    const res = useGame.getState().pendingAttack!.result!;
    expect(res.hit).toBe(true);
    expect(res.attackerRoll).toBe(44);
    expect(res.critical).toBe(true);
  });

  it('choisir 01 → réussite simple au DR maximal, pas de Critique', () => {
    setupForcedAttack();
    useGame.getState().attackSetForcedRoll(1);
    const res = useGame.getState().pendingAttack!.result!;
    expect(res.hit).toBe(true);
    expect(res.attackerRoll).toBe(1);
    expect(res.critical).toBe(false);
    expect(res.attackerDetail!.sl).toBe(4); // dizaine(45) − dizaine(01)
  });

  it('valeur > cible refusée (le choix doit rester une réussite)', () => {
    setupForcedAttack();
    useGame.getState().attackSetForcedRoll(77);
    expect(useGame.getState().pendingAttack!.result!.attackerRoll).toBe(88); // inchangé (jet du force initial)
  });

  it('ne dépense PAS de Résilience supplémentaire (même Test)', () => {
    setupForcedAttack();
    const before = useGame.getState().battle!.combatants.find((c) => c.id === 'A')!.resilience;
    useGame.getState().attackSetForcedRoll(44);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'A')!.resilience).toBe(before);
  });

  it('attaque non forcée → no-op', () => {
    seedBattleRng(7);
    useGame.setState({
      battle: { combatants: [C({ id: 'A', resilience: 2 }), C({ id: 'B', kind: 'enemy' })], log: [] } as never,
      pendingAttack: {
        attackerId: 'A', targetId: 'B', location: null,
        result: { hit: true, attackerRoll: 22, netSL: 2, critical: true, advantageTo: 'attacker', defenderDefeated: false, log: '', attackerDetail: { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 22, success: true, sl: 2 } } as never,
      },
    });
    useGame.getState().attackSetForcedRoll(44);
    expect(useGame.getState().pendingAttack!.result!.attackerRoll).toBe(22);
  });
});

describe('castSetForcedRoll — même choix sur une INCANTATION forcée (parité des modales)', () => {
  function setupForcedCast() {
    seedBattleRng(7);
    const caster = C({ id: 'A', name: 'Mage', resilience: 2 });
    const target = C({ id: 'B', name: 'Cible', kind: 'enemy', pos: { x: 1, y: 0 } });
    useGame.setState({
      battle: { combatants: [caster, target], log: [] } as never,
      pendingCast: {
        casterId: 'A', targetId: 'A', spellId: 'drain', missile: false, focused: false,
        result: { cast: false, roll: 88, target: 45, sl: -4, isCritical: false, isFumble: false, log: 'raté' },
      } as never,
    });
    useGame.getState().castForceSuccess();
  }

  it('11 (le plus bas double réussi) → Incantation Critique', () => {
    setupForcedCast();
    expect(useGame.getState().pendingCast!.forced).toBe(true);
    useGame.getState().castSetForcedRoll(11);
    const res = useGame.getState().pendingCast!.result!;
    expect(res.roll).toBe(11);
    expect(res.cast).toBe(true);
    expect(res.isCritical).toBe(true);
  });

  it('01 → DR maximal (Surincantation), pas de Critique ; valeur > cible refusée', () => {
    setupForcedCast();
    useGame.getState().castSetForcedRoll(1);
    const res = useGame.getState().pendingCast!.result!;
    expect(res.roll).toBe(1);
    expect(res.isCritical).toBe(false);
    expect(res.sl).toBe(4); // dizaine(45) − dizaine(01)
    useGame.getState().castSetForcedRoll(77);
    expect(useGame.getState().pendingCast!.result!.roll).toBe(1); // inchangé
  });
});

describe('defenseSetForcedRoll — même choix sur une DÉFENSE forcée', () => {
  function setupForcedDefense() {
    seedBattleRng(7);
    const attacker = C({ id: 'E', name: 'Orque', kind: 'enemy' });
    const defender = C({ id: 'H', name: 'Héros', resilience: 2, pos: { x: 1, y: 0 } });
    const atk = { roll: 30, target: 40, success: true, sl: 1, isDouble: false };
    useGame.setState({
      battle: { combatants: [attacker, defender], log: [] } as never,
      pendingDefense: {
        attackerId: 'E', defenderId: 'H', weapon: { name: 'Gourdin', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] },
        location: null, atk, mode: 'esquive',
        def: { roll: 95, target: 50, success: false, sl: -4, isDouble: false },
        result: {
          hit: true, attackerRoll: 30, netSL: 5, critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
          attackerDetail: { label: 'Corps à corps', base: 40, modifier: 0, target: 40, roll: 30, success: true, sl: 1 },
          defenderDetail: { label: 'Esquive', base: 50, modifier: 0, target: 50, roll: 95, success: false, sl: -4 },
        },
      } as never,
    });
    useGame.getState().defenseForceSuccess();
  }

  it('le force pose `forced`, puis le défenseur choisit son dé (11 = double)', () => {
    setupForcedDefense();
    const pd = useGame.getState().pendingDefense!;
    expect(pd.forced).toBe(true);
    expect(pd.result!.hit).toBe(false); // « vous l'emportez avec au moins DR +1 »
    useGame.getState().defenseSetForcedRoll(11);
    const after = useGame.getState().pendingDefense!;
    expect(after.def!.roll).toBe(11);
    expect(after.def!.isDouble).toBe(true);
    expect(after.result!.hit).toBe(false); // l'emporte toujours
    useGame.getState().defenseSetForcedRoll(88); // > cible (50) : refusé
    expect(useGame.getState().pendingDefense!.def!.roll).toBe(11);
  });
});

describe('trampleSetForcedRoll — même choix sur un PIÉTINEMENT forcé (fabrique rollFlow)', () => {
  it('11 → Coup Critique ; valeur > cible refusée', () => {
    seedBattleRng(7);
    const attacker = C({ id: 'A', name: 'Ogre', resilience: 2 });
    const target = C({ id: 'B', name: 'Gnoblar', kind: 'enemy', pos: { x: 1, y: 0 } });
    useGame.setState({
      battle: { combatants: [attacker, target], log: [] } as never,
      pendingTrample: {
        attackerId: 'A', targetId: 'B',
        result: {
          hit: false, attackerRoll: 90, netSL: -5, critical: false, advantageTo: 'defender', defenderDefeated: false, log: 'raté',
          attackerDetail: { label: 'Bagarre', base: 45, modifier: 0, target: 45, roll: 90, success: false, sl: -5 },
        },
      } as never,
    });
    useGame.getState().trampleForceSuccess();
    expect(useGame.getState().pendingTrample!.forced).toBe(true);
    useGame.getState().trampleSetForcedRoll(11);
    const res = useGame.getState().pendingTrample!.result!;
    expect(res.attackerRoll).toBe(11);
    expect(res.critical).toBe(true);
    useGame.getState().trampleSetForcedRoll(66); // > cible (45) : refusé
    expect(useGame.getState().pendingTrample!.result!.attackerRoll).toBe(11);
  });
});
