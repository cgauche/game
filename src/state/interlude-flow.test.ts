/**
 * Interlude « Entre deux aventures » (LDB 22-23) : ouverture (événements d100, Activités =
 * min(3, semaines)), clôture (« Avec le pouvoir », Argent à gaspiller, Revenus, le temps passe),
 * Effet d'éditeur `interlude`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatFlow';
import { interludeEventFor } from '../data/interludeEvents';
import { toBrass, fromBrass } from '../engine/money';
import { partyMoneyTotal, creditBourse } from './bourseFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import { setRule, resetRule } from '../engine/policy';

describe('Interlude — flux start/end', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(1) });
    const b = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', rng: makeRNG(2) });
    useGame.setState({ party: [a, b], battle: null, interlude: null, bank: [], pendingOrders: [], journal: [] });
    useGame.getState().startScene(testScene);
    vi.clearAllTimers();
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, fromBrass(1000)); // bourse perso de départ (#531)
    useGame.getState().seedRng(11);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('startInterlude : événements tirés par héros, Activités = min(3, semaines), écran dédié', () => {
    useGame.getState().startInterlude(2);
    const itl = useGame.getState().interlude!;
    expect(itl).toBeTruthy();
    expect(useGame.getState().screen).toBe('interlude');
    const states = Object.values(itl.perHero);
    expect(states).toHaveLength(2);
    for (const st of states) {
      expect(st.eventRoll).toBeGreaterThanOrEqual(1);
      expect(st.eventRoll).toBeLessThanOrEqual(100);
      const ev = interludeEventFor(st.eventRoll);
      // Activités : 2 semaines → 2, moins l'éventuelle perte d'événement (cohérence roll↔fx).
      expect(st.left).toBe(Math.max(0, 2 - (ev.fx?.loseActivity ? 1 : 0)));
      // Le journal porte l'événement (verbatim).
      expect(useGame.getState().journal.join('\n')).toContain(ev.label);
    }
  });

  it('startInterlude : 5 semaines → max 3 Activités (« maximum de trois », LDB 23 l.6)', () => {
    useGame.getState().startInterlude(5);
    for (const st of Object.values(useGame.getState().interlude!.perHero)) {
      const ev = interludeEventFor(st.eventRoll);
      expect(st.left).toBe(Math.max(0, 3 - (ev.fx?.loseActivity ? 1 : 0)));
    }
  });

  it('interludeEnd : Argent à gaspiller (bourse → Revenus seuls), retour campagne, le temps passe', () => {
    useGame.getState().startInterlude(1);
    const itl = useGame.getState().interlude!;
    const heroId = Object.keys(itl.perHero)[0];
    itl.perHero[heroId].revenueBrass = 120; // Revenus simulés (l'Activité arrive en P2)
    const t0 = useGame.getState().gameTime;
    useGame.getState().interludeEnd();
    expect(useGame.getState().interlude).toBeNull();
    expect(useGame.getState().screen).toBe('campaign');
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(120); // tout le reste a été gaspillé, seuls les Revenus perso subsistent
    expect(useGame.getState().gameTime).toBeGreaterThan(t0); // 7 jours de repos écoulés
  });

  it('la clôture NOURRIT le groupe (vie en ville payée par le gaspillage) — pas de famine sur 3 semaines', () => {
    useGame.getState().startInterlude(3);
    const before = useGame.getState().party.map((h) => h.wounds.current);
    useGame.getState().interludeEnd(); // 21 jours — sans le couvert, la Faim RAW tuerait le groupe
    const party = useGame.getState().party;
    party.forEach((h, i) => expect(h.wounds.current, h.label).toBeGreaterThanOrEqual(before[i]));
    expect(useGame.getState().journal.join('\n')).not.toMatch(/dépérit|Faim :/);
  });

  it('« Avec le pouvoir » : Niveau 3 sans Revenus → retombe au Niveau 2 (LDB 23 l.30)', () => {
    useGame.getState().startInterlude(1);
    const hero = useGame.getState().party[0];
    hero.careerLevel = 3;
    useGame.getState().interludeEnd();
    expect(useGame.getState().party[0].careerLevel).toBe(2);
    expect(useGame.getState().journal.join('\n')).toMatch(/néglig/);
  });

  it('Effet d’éditeur interlude : applyEffects ouvre l’interlude', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'interlude', weeks: 2 }]);
    expect(useGame.getState().interlude?.weeks).toBe(2);
    expect(useGame.getState().screen).toBe('interlude');
  });

  it('en combat : refusé', () => {
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    useGame.getState().startInterlude(1);
    expect(useGame.getState().interlude).toBeNull();
  });

  it('règle interlude-enabled OFF : l’effet interlude est ignoré silencieusement', () => {
    setRule('interlude-enabled', false);
    applyEffects(useGame.getState, useGame.setState, [{ type: 'interlude', weeks: 2 }]);
    expect(useGame.getState().interlude).toBeNull();
    resetRule('interlude-enabled');
  });

  it('interlude-elf-duty (défaut) : un elfe ≥3 semaines perd 1 Activité (devoir)', () => {
    const elf = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'E', rng: makeRNG(3) });
    elf.species = 'Haut Elfe';
    useGame.setState({ party: [elf], interlude: null });
    useGame.getState().startInterlude(3);
    const st = useGame.getState().interlude!.perHero[elf.id];
    const ev = interludeEventFor(st.eventRoll);
    expect(st.left).toBe(Math.max(0, 3 - (ev.fx?.loseActivity ? 1 : 0) - 1)); // −1 devoir elfique
  });

  it('interlude-elf-duty OFF : l’elfe garde son Activité', () => {
    setRule('interlude-elf-duty', false);
    const elf = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'E', rng: makeRNG(3) });
    elf.species = 'Haut Elfe';
    useGame.setState({ party: [elf], interlude: null });
    useGame.getState().startInterlude(3);
    const st = useGame.getState().interlude!.perHero[elf.id];
    const ev = interludeEventFor(st.eventRoll);
    expect(st.left).toBe(Math.max(0, 3 - (ev.fx?.loseActivity ? 1 : 0))); // pas de devoir
    resetRule('interlude-elf-duty');
  });
});
