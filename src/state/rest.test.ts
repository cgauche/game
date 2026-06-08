import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { restRecovery } from '../engine/rest';
import { hasCondition, stacks } from '../engine/conditions';
import { seedBattleRng } from './battleRng';
import { dayPhase } from '../engine/clock';
import type { RNG } from '../engine/dice';
import type { Combatant } from '../engine/types';

const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'h', name: 'H', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 35, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

describe('restRecovery — repos d’une nuit (LDB 16 l.91 / 18 l.380 / 21 l.92)', () => {
  it('retire TOUS les États Exténué (cadence « nuit complète »)', () => {
    const c = hero({ conditions: [{ name: 'Exténué', value: 2 }] });
    restRecovery(c, { int: () => 1 });
    expect(hasCondition(c, 'Exténué')).toBe(false);
  });

  it('soigne des Blessures sur un Test de Résistance +20 réussi : DR + BE PB', () => {
    const c = hero({ wounds: { current: 4, max: 12 } }); // E 40 → BE 4
    // Résistance Accessible (+20) : cible 40+20=60 ; jet 30 ≤ 60 → réussite, DR=3 ; soin = 3 + BE(4) = 7.
    restRecovery(c, { int: () => 30 });
    expect(c.wounds.current).toBe(11); // 4 + 7
  });

  it('Résistance ratée → aucune Blessure soignée', () => {
    const c = hero({ wounds: { current: 4, max: 12 } });
    restRecovery(c, { int: () => 95 }); // 95 > 60 → échec
    expect(c.wounds.current).toBe(4);
  });

  it('cauchemars : un héros marqué qui échoue regagne l’Exténué malgré le repos (l’ironie du trauma)', () => {
    const c = hero({ nightmares: true, conditions: [{ name: 'Exténué', value: 1 }] });
    const fail: RNG = { int: () => 90 }; // Calme +40 : cible 75 ; 90 > 75 → échec
    restRecovery(c, fail);
    expect(stacks(c, 'Exténué')).toBe(1); // l’ancien dissipé, un nouveau gagné
  });

  it('un héros Inconscient soigné > 0 PB reprend connaissance (LDB 18 l.28)', () => {
    const c = hero({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], roundsAtZero: 3 });
    restRecovery(c, { int: () => 30 }); // Résistance réussie → soigne 7 PB (>0)
    expect(c.wounds.current).toBeGreaterThan(0);
    expect(hasCondition(c, 'Inconscient')).toBe(false);
    expect(c.roundsAtZero).toBe(0);
  });

  it('un héros Hémorragique ne trouve pas le repos (LDB 16 l.105) — pas de récup, pas de mort', () => {
    const c = hero({ conditions: [{ name: 'Hémorragique', value: 1 }, { name: 'Exténué', value: 1 }], fate: 0 });
    const log = restRecovery(c, { int: () => 1 });
    expect(log.join(' ')).toMatch(/ne trouve pas le repos/);
    expect(hasCondition(c, 'Exténué')).toBe(true); // pas dissipé (repos refusé)
    expect(c.dead).not.toBe(true); // restRecovery ne tue pas
  });

  it('un héros À Terre soigné au réveil se relève (≥1 PB)', () => {
    const c = hero({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'À Terre', value: 1 }] });
    restRecovery(c, { int: () => 30 }); // Résistance réussie → soigne, >0 PB
    expect(c.wounds.current).toBeGreaterThan(0);
    expect(hasCondition(c, 'À Terre')).toBe(false);
  });

  it('un mort ne se repose pas', () => {
    const c = hero({ dead: true, conditions: [{ name: 'Exténué', value: 1 }] });
    restRecovery(c, { int: () => 1 });
    expect(hasCondition(c, 'Exténué')).toBe(true);
  });
});

describe('restParty (store) — « Dormir jusqu’à l’aube »', () => {
  beforeEach(() => { seedBattleRng(1); useGame.setState({ battle: null, mode: 'exploration', journal: [] }); });

  it('avance jusqu’à l’aube et applique la récupération', () => {
    const c = hero({ id: 'a', conditions: [{ name: 'Exténué', value: 1 }] });
    useGame.setState({ party: [c], gameTime: 12 * 60 }); // midi
    useGame.getState().restParty();
    const after = useGame.getState();
    expect(dayPhase(after.gameTime).key).toBe('aube'); // réveil à l’aube
    expect(hasCondition(after.party[0], 'Exténué')).toBe(false);
    expect(after.journal.some((l) => /dort jusqu|aube/i.test(l))).toBe(true);
  });

  it('un héros Hémorragique sans Destin SURVIT à la nuit (pas de spirale d’entretien — régression du bloquant)', () => {
    const c = hero({ id: 'a', wounds: { current: 12, max: 12 }, conditions: [{ name: 'Hémorragique', value: 1 }], fate: 0 });
    useGame.setState({ party: [c], gameTime: 12 * 60 });
    useGame.getState().restParty();
    const after = useGame.getState().party[0];
    expect(after.dead).not.toBe(true);
    expect(hasCondition(after, 'Hémorragique')).toBe(true); // toujours à stabiliser (Guérison), pas mort en dormant
  });

  it('ne fait rien en plein combat', () => {
    useGame.setState({ battle: { combatants: [], order: [], turn: 0, round: 1, log: [], over: null } as any, gameTime: 12 * 60 });
    const t0 = useGame.getState().gameTime;
    useGame.getState().restParty();
    expect(useGame.getState().gameTime).toBe(t0); // inchangé
  });
});
