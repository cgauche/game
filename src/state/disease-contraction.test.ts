import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { openCombatEndCascade, finishCombatEnd, applyEffects } from './combatFlow';
import { contractDisease } from '../engine/disease';
import { seedBattleRng, battleRng } from './battleRng';
import { setRule, resetRule } from '../engine/policy';
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

/** Tests de fin de combat (maladie/Corruption) en flux cadence-aware : `openCombatEndCascade` collecte les
 *  étapes INFLUENÇABLES pour les héros conscients (cadence manuelle). On lance chaque étape puis on valide,
 *  jusqu'à fermeture (les conséquences mutent `c.diseases`/`c.corruption`). `finishCombatEnd` n'est pas
 *  requis hors victoire ; le writeback `party` n'est PAS testé ici (on lit les combattants du `battle`). */
function resolveCombatEnd(): void {
  openCombatEndCascade(useGame.getState, useGame.setState);
  for (let guard = 0; guard < 30; guard++) {
    const p = useGame.getState().pendingCascade;
    if (!p?.combatEndBoundary) break;
    const cur = p.participants[p.cursor];
    if (cur?.target != null && !cur.result) useGame.getState().cascadeRoll(cur.id);
    useGame.getState().cascadeNext();
  }
}

describe('Fin de combat — infection post-critique (LDB 20 l.72) & persistance des maladies', () => {
  beforeEach(() => { seedBattleRng(1); useGame.setState({ mode: 'exploration', journal: [], pendingCascade: null }); });

  it('héros ayant subi un critique : Test de Résistance Très Facile (+60) — E 40 réussit → pas de maladie, flag consommé', () => {
    const combatant = hero({ id: 'a', tookCriticalThisFight: true }); // E 40 → cible ≥ 100 → réussite garantie
    setBattle([combatant]);
    useGame.setState({ party: [hero({ id: 'a' })] });
    resolveCombatEnd();
    expect(combatant.diseases ?? []).toHaveLength(0);
    expect(combatant.tookCriticalThisFight).toBe(false); // consommé (idempotent)
  });

  it('héros E 30 ayant subi un critique : Test +60 raté → contracte une Infection Mineure (l.72)', () => {
    seedBattleRng(4); // 1er d100 = 93 > cible 90 (E 30 + 60) → échec garanti
    const combatant = hero({ id: 'a', characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 }, tookCriticalThisFight: true });
    setBattle([combatant]);
    useGame.setState({ party: [hero({ id: 'a' })] });
    resolveCombatEnd();
    expect(combatant.diseases?.some((d) => d.name === 'infection-mineure')).toBe(true);
  });

  it('blessure PANSÉE pendant le combat (Guérison/bandage) → pas d’Infection post-critique (LDB 18 l.382)', () => {
    seedBattleRng(4); // ce seed ferait ÉCHOUER le Test +60 (E 30) sans pansement
    const combatant = hero({ id: 'a', characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 }, tookCriticalThisFight: true, woundDressed: true });
    setBattle([combatant]);
    useGame.setState({ party: [hero({ id: 'a' })] });
    resolveCombatEnd();
    expect(combatant.diseases ?? []).toHaveLength(0); // pansé → aucune infection, aucune étape posée
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('une maladie déjà contractée survit à la fin du combat (aucun nouveau Test)', () => {
    const combatant = hero({ id: 'a', diseases: [contractDisease('infection-mineure', battleRng(), { incubation: 2, duration: 5 })!] });
    setBattle([combatant]);
    useGame.setState({ party: [hero({ id: 'a' })] });
    resolveCombatEnd();
    expect(combatant.diseases?.map((d) => d.name)).toEqual(['infection-mineure']);
  });
});

describe('Fin de combat — règle « Utilisation des Maladies » (disease-mode, LDB 20 l.36)', () => {
  beforeEach(() => { seedBattleRng(4); useGame.setState({ mode: 'exploration', journal: [], pendingCascade: null }); });
  afterEach(() => resetRule('disease-mode'));
  const e30 = { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 };

  it("'off' : pas d'Infection Mineure post-critique, flag tookCriticalThisFight consommé", () => {
    setRule('disease-mode', 'off');
    const c = hero({ id: 'a', characteristics: e30, tookCriticalThisFight: true });
    setBattle([c]); useGame.setState({ party: [hero({ id: 'a', characteristics: e30 })] });
    resolveCombatEnd();
    expect(c.diseases ?? []).toHaveLength(0);
    expect(c.tookCriticalThisFight).toBe(false);
  });

  it("'situational' : pas d'Infection Mineure post-critique (sautée comme en 'off')", () => {
    setRule('disease-mode', 'situational');
    const c = hero({ id: 'a', characteristics: e30, tookCriticalThisFight: true });
    setBattle([c]); useGame.setState({ party: [hero({ id: 'a', characteristics: e30 })] });
    resolveCombatEnd();
    expect(c.diseases ?? []).toHaveLength(0);
  });

  it("'situational' : GARDE la Blessure Purulente d'un Trait Infecté (Skavens/Nurgle)", () => {
    setRule('disease-mode', 'situational');
    // Exposition unifiée (op exposeDisease) : Infecté → 'blessure-purulente' dans diseaseExposure.
    const c = hero({ id: 'a', characteristics: e30, diseaseExposure: ['blessure-purulente'] });
    setBattle([c]); useGame.setState({ party: [hero({ id: 'a', characteristics: e30 })] });
    resolveCombatEnd();
    expect(c.diseases?.some((d) => d.name === 'blessure-purulente')).toBe(true);
  });

  it("'off' : pas de Blessure Purulente + exposition purgée", () => {
    setRule('disease-mode', 'off');
    const c = hero({ id: 'a', characteristics: e30, diseaseExposure: ['blessure-purulente'] });
    setBattle([c]); useGame.setState({ party: [hero({ id: 'a', characteristics: e30 })] });
    resolveCombatEnd();
    expect(c.diseases ?? []).toHaveLength(0);
    expect(c.diseaseExposure).toBeUndefined();
  });
});

describe('Effet d’éditeur inflictDisease (LDB 20)', () => {
  beforeEach(() => { seedBattleRng(1); useGame.setState({ battle: null, mode: 'exploration', journal: [] }); });

  it('contracte la maladie nommée sur le premier héros', () => {
    useGame.setState({ party: [hero({ id: 'a' })] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictDisease', disease: 'blessure-purulente' }]);
    expect(useGame.getState().party[0].diseases?.map((d) => d.name)).toEqual(['blessure-purulente']);
  });

  it('dédoublonne : pas deux fois la même maladie', () => {
    const a = hero({ id: 'a', diseases: [contractDisease('blessure-purulente', battleRng(), { incubation: 1, duration: 5 })!] });
    useGame.setState({ party: [a] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictDisease', disease: 'blessure-purulente' }]);
    expect(useGame.getState().party[0].diseases).toHaveLength(1);
  });
});
