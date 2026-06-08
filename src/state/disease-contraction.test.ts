import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { finalizeBattle, applyEffects } from './combatFlow';
import { contractDisease } from '../engine/disease';
import { seedBattleRng, battleRng } from './battleRng';
import type { Combatant } from '../engine/types';

const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'a', name: 'A', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

function setBattle(combatants: Combatant[]) {
  useGame.setState({ battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, log: [], over: null } as any });
}

describe('finalizeBattle — infection post-critique (LDB 20 l.72) & persistance des maladies', () => {
  beforeEach(() => { seedBattleRng(1); useGame.setState({ mode: 'exploration', journal: [] }); });

  it('héros ayant subi un critique : Test de Résistance Très Facile (+60) — E 40 réussit → pas de maladie, flag consommé', () => {
    const combatant = hero({ id: 'a', tookCriticalThisFight: true }); // E 40 → cible ≥ 100 → réussite garantie
    setBattle([combatant]);
    useGame.setState({ party: [hero({ id: 'a' })] });
    finalizeBattle(useGame.getState, useGame.setState);
    expect(useGame.getState().party[0].diseases ?? []).toHaveLength(0);
    expect(combatant.tookCriticalThisFight).toBe(false); // consommé (idempotent)
  });

  it('héros E 30 ayant subi un critique : Test +60 raté → contracte une Infection Mineure (l.72)', () => {
    seedBattleRng(4); // 1er d100 = 93 > cible 90 (E 30 + 60) → échec garanti
    const combatant = hero({ id: 'a', characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 }, tookCriticalThisFight: true });
    setBattle([combatant]);
    useGame.setState({ party: [hero({ id: 'a' })] });
    finalizeBattle(useGame.getState, useGame.setState);
    expect(useGame.getState().party[0].diseases?.some((d) => d.name === 'Infection Mineure')).toBe(true);
  });

  it('blessure PANSÉE pendant le combat (Guérison/bandage) → pas d’Infection post-critique (LDB 18 l.382)', () => {
    seedBattleRng(4); // ce seed ferait ÉCHOUER le Test +60 (E 30) sans pansement
    const combatant = hero({ id: 'a', characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 }, tookCriticalThisFight: true, woundDressed: true });
    setBattle([combatant]);
    useGame.setState({ party: [hero({ id: 'a' })] });
    finalizeBattle(useGame.getState, useGame.setState);
    expect(useGame.getState().party[0].diseases ?? []).toHaveLength(0); // pansé → aucune infection
  });

  it('une maladie déjà contractée survit à la fin du combat (carryOverState)', () => {
    const combatant = hero({ id: 'a', diseases: [contractDisease('Infection Mineure', battleRng(), { incubation: 2, duration: 5 })!] });
    setBattle([combatant]);
    useGame.setState({ party: [hero({ id: 'a' })] });
    finalizeBattle(useGame.getState, useGame.setState);
    expect(useGame.getState().party[0].diseases?.map((d) => d.name)).toEqual(['Infection Mineure']);
  });
});

describe('Effet d’éditeur inflictDisease (LDB 20)', () => {
  beforeEach(() => { seedBattleRng(1); useGame.setState({ battle: null, mode: 'exploration', journal: [] }); });

  it('contracte la maladie nommée sur le premier héros', () => {
    useGame.setState({ party: [hero({ id: 'a' })] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictDisease', disease: 'Blessure Purulente' }]);
    expect(useGame.getState().party[0].diseases?.map((d) => d.name)).toEqual(['Blessure Purulente']);
  });

  it('dédoublonne : pas deux fois la même maladie', () => {
    const a = hero({ id: 'a', diseases: [contractDisease('Blessure Purulente', battleRng(), { incubation: 1, duration: 5 })!] });
    useGame.setState({ party: [a] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictDisease', disease: 'Blessure Purulente' }]);
    expect(useGame.getState().party[0].diseases).toHaveLength(1);
  });
});
