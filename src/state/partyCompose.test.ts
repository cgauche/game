/**
 * Composition d'équipe coop (partyAddHero/partyRemoveHero + emplacements `net.slots`) :
 * point d'entrée unique de l'écran d'équipe — quota par siège, doublons, bourse, possession.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { initialNet } from './netFlow';
import { makePregens } from '../data/pregens';
import type { Combatant } from '../engine/types';
import { toBrass } from '../engine/money';

function hero(id: string): Combatant {
  const h: Combatant = JSON.parse(JSON.stringify(makePregens()[0]));
  h.id = id;
  h.name = `Héros ${id}`;
  return h;
}

function reset() {
  useGame.setState({
    party: [],
    money: { gold: 0, silver: 0, brass: 0 },
    journal: [],
    net: initialNet(),
  });
}

describe('composition d’équipe (partyFlow + net.slots)', () => {
  beforeEach(reset);

  it('partyAddHero : ajoute une copie, pose la possession du siège, crédite la bourse', () => {
    useGame.getState().partyAddHero(hero('a'), { gold: 1, silver: 2, brass: 3 });
    const s = useGame.getState();
    expect(s.party.map((h) => h.id)).toEqual(['a']);
    expect(s.net.ownership['a']).toBe(0);
    expect(toBrass(s.money)).toBe(toBrass({ gold: 1, silver: 2, brass: 3 }));
  });

  it('partyAddHero : refuse les doublons d’id et le groupe plein', () => {
    const st = useGame.getState();
    st.partyAddHero(hero('a'));
    st.partyAddHero(hero('a'));
    expect(useGame.getState().party).toHaveLength(1);
    for (const id of ['b', 'c', 'd', 'e']) useGame.getState().partyAddHero(hero(id));
    expect(useGame.getState().party).toHaveLength(4); // 'e' refusé
  });

  it('partyAddHero : respecte le quota d’emplacements du siège (hôte autoritaire)', () => {
    useGame.setState({ net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' }, slots: [0, 0, 0, 1] } });
    const st = useGame.getState();
    st.partyAddHero(hero('g1'), undefined, 1);
    st.partyAddHero(hero('g2'), undefined, 1); // 1 seul slot au siège 1 → refusé
    const s = useGame.getState();
    expect(s.party.map((h) => h.id)).toEqual(['g1']);
    expect(s.net.ownership['g1']).toBe(1);
  });

  it('partyRemoveHero : retire le héros et nettoie sa possession', () => {
    useGame.setState({ net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' }, slots: [0, 1, 0, 0] } });
    useGame.getState().partyAddHero(hero('g1'), undefined, 1);
    useGame.getState().partyRemoveHero('g1');
    const s = useGame.getState();
    expect(s.party).toHaveLength(0);
    expect(s.net.ownership['g1']).toBeUndefined();
  });

  it('netAssignSlot : hôte seul, bornes 0-3', () => {
    useGame.getState().netAssignSlot(1, 1); // mode local → refusé
    expect(useGame.getState().net.slots).toEqual([0, 0, 0, 0]);
    useGame.setState({ net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Inv' } } });
    useGame.getState().netAssignSlot(1, 1);
    useGame.getState().netAssignSlot(7, 1); // hors bornes → ignoré
    expect(useGame.getState().net.slots).toEqual([0, 1, 0, 0]);
  });
});
