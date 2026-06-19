import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { contractDisease } from '../engine/disease';
import { traumaFromKind } from '../engine/trauma';
import { MINUTES_PER_DAY } from '../engine/clock';
import { applyOps, COMBAT_PERSIST } from '../engine/ops';
import type { Combatant } from '../engine/types';

/**
 * #T3 — Cascade RAW d'horloge (`state/upkeep.ts`) : ce que le passage du temps déclenche sur les
 * franchissements de jour, QUEL QUE SOIT le chemin (advanceTime, repos, voyage) :
 *  - maladies (LDB 20) : incubation/durée en jours CALENDAIRES — progressent SANS repos ;
 *  - convalescence des Blessures critiques (LDB 18 l.317 : « un nombre de JOURS égal à 30 − BE ») ;
 *  - purge des contrecoups d'incantation à durée d'horloge (LDB 46/40) sur TOUS les chemins ;
 *  - anti-double-comptage : une journée n'est jamais décomptée deux fois (repos compris).
 */
const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'h', name: 'H', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 35, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: ['r1', 'r2', 'r3'].map((uid) => ({ uid, name: 'Ration', isRations: true, kind: 'misc' as const, qualities: [], enc: 0, equipped: false })),
    ...p,
  } as Combatant);

describe('#T3 — cascade d’horloge (maladies/convalescence/purge sur franchissement de jour)', () => {
  beforeEach(() => {
    seedBattleRng(1);
    useGame.setState({ battle: null, mode: 'exploration', journal: [], travelPlan: null });
  });

  it('une maladie en incubation progresse quand le temps passe SANS repos (advanceTime)', () => {
    const c = hero({ diseases: [contractDisease('infection-mineure', { int: () => 1 }, { incubation: 2, duration: 5 })!] });
    useGame.setState({ party: [c], gameTime: 0, lastUpkeepDay: 0 });
    useGame.getState().advanceTime(2 * MINUTES_PER_DAY); // 2 jours d'aventure, personne ne dort
    const dz = useGame.getState().party[0].diseases![0];
    expect(dz.phase).toBe('active'); // l'incubation (2 j) s'est écoulée — calendaire, pas « au repos »
  });

  it('le bilan d’entretien d’advanceTime est VISIBLE : révélation « Entretien quotidien » (pas que le journal)', () => {
    const c = hero({ items: [] }); // sans rations → lignes de faim garanties
    useGame.setState({ party: [c], gameTime: 0, lastUpkeepDay: 0, pendingReveals: [] });
    useGame.getState().advanceTime(2 * MINUTES_PER_DAY);
    const reveal = useGame.getState().pendingReveals.find((r) => r.title === 'Entretien quotidien');
    expect(reveal).toBeTruthy();
    expect(reveal!.lines.length).toBeGreaterThan(0);
    useGame.setState({ pendingReveals: [] }); // ne pas geler l'IA des tests suivants (piège connu)
  });

  it('la convalescence d’un trauma décompte les jours CALENDAIRES (LDB 18 l.317), repos ou pas', () => {
    const c = hero({ traumas: [traumaFromKind('dechirure', 'mineur', 'jambeD', { be: 28 })] }); // 30−28 = 2 jours
    useGame.setState({ party: [c], gameTime: 0, lastUpkeepDay: 0 });
    useGame.getState().advanceTime(2 * MINUTES_PER_DAY);
    expect(useGame.getState().party[0].traumas!.length).toBe(0); // guéri sans avoir « dormi »
  });

  it('anti-double-comptage : une nuit de repos = UN seul jour de maladie décompté', () => {
    const c = hero({ diseases: [contractDisease('infection-mineure', { int: () => 1 }, { incubation: 0, duration: 6 })!] });
    useGame.setState({ party: [c], gameTime: 12 * 60, lastUpkeepDay: 0 });
    useGame.getState().restParty(); // dort jusqu'à l'aube → 1 franchissement de jour
    expect(useGame.getState().party[0].diseases![0].daysLeft).toBe(5); // 6 − 1, PAS − 2
  });

  it('un contrecoup d’incantation à durée d’horloge expiré est purgé par le REPOS (bug A1)', () => {
    const t0 = 12 * 60;
    const c = hero({ castPenalties: [{ label: 'Pensez à vos actes', skill: 'Prière', maxZeroDR: true, untilTime: t0 + 60 }] });
    useGame.setState({ party: [c], gameTime: t0, lastUpkeepDay: 0 });
    useGame.getState().restParty(); // le repos pose gameTime directement (pas advanceTime)
    expect(useGame.getState().party[0].castPenalties ?? []).toHaveLength(0);
    expect(useGame.getState().journal.join(' ')).toMatch(/Pensez à vos actes se dissipe/);
  });

  it('un buff de sort à durée d’HORLOGE (« 1 heure ») expire à son échéance, pas à 9999 Rounds (A4)', () => {
    const t0 = 12 * 60;
    const c = hero({});
    // Buff posé comme le ferait applyCast pour une durée « 1 heure » : COMBAT_PERSIST + untilTime.
    applyOps(c, [{ op: 'charMod', char: 'F', mod: 10 }], {
      label: 'Tour de force', defaultDurationRounds: COMBAT_PERSIST, defaultUntilTime: t0 + 60,
    });
    useGame.setState({ party: [c], gameTime: t0, lastUpkeepDay: 0 });
    useGame.getState().advanceTime(30); // 30 min : toujours actif
    expect(useGame.getState().party[0].activeEffects).toHaveLength(1);
    useGame.getState().advanceTime(31); // 61 min : échéance dépassée → dissipé
    expect(useGame.getState().party[0].activeEffects ?? []).toHaveLength(0);
    expect(useGame.getState().journal.join(' ')).toMatch(/Tour de force se dissipe/);
  });
});
