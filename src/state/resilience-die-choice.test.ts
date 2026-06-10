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
    weapons: [{ name: 'Épée', type: 'melee', damage: '+4', qualities: [] }],
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
