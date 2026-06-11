import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../state/store';
import { tome1Route } from './tome1-route';
import type { Combatant } from '../engine/types';

const hero = (): Combatant =>
  ({
    id: 'a',
    name: 'A',
    kind: 'hero',
    xp: 0,
    items: [],
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
  }) as unknown as Combatant;

describe('Tome 1 — Chapitre 2 « Du Sang sur la Route »', () => {
  beforeEach(() => {
    vi.useFakeTimers(); // startCombat arme un timer d'IA
    useGame.setState({ party: [hero()], flags: {}, battle: null, mode: 'exploration', document: null, money: { gold: 0, silver: 0, brass: 0 } });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('le virage déclenche le combat contre Rolf Hurtsis (profil canon : B 8)', () => {
    useGame.getState().startScene(tome1Route);
    useGame.getState().moveParty({ x: 5, y: 6 }); // entre dans la zone de Rolf
    const st = useGame.getState();
    expect(st.mode).toBe('battle');
    const rolf = st.battle!.combatants.find((c) => c.kind === 'enemy');
    expect(rolf!.name).toBe('Rolf Hurtsis');
    expect(rolf!.wounds.max).toBe(8);
  });

  it('la rencontre de la bande exige d’avoir vaincu Rolf (condition rolf_vaincu)', () => {
    useGame.getState().startScene(tome1Route);
    useGame.getState().moveParty({ x: 16, y: 6 }); // zone de la bande, mais rolf_vaincu non posé
    expect(useGame.getState().mode).toBe('exploration'); // pas de combat tant que Rolf n'est pas vaincu
  });

  it('fouiller le corps de Lieberung donne les lettres + 10 PX de découverte', () => {
    useGame.getState().startScene(tome1Route);
    useGame.setState({ partyPos: { x: 24, y: 6 } }); // adjacent au cadavre (24,5)
    useGame.getState().interactEntity('corps-lieberung');
    const st = useGame.getState();
    expect(st.flags.heritage_trouve).toBe(true);
    expect(st.party[0].xp).toBe(10); // « 10 points pour avoir découvert la lettre d'héritage »
    expect(st.document).not.toBeNull(); // un handout s'ouvre
    expect((st.party[0].items ?? []).map((i) => i.name)).toEqual(expect.arrayContaining(['Lettre d\'héritage de Kastor Lieberung']));
  });

  it('fouiller le cocher remet une VRAIE Chemise de mailles (objet à stats, PA Corps)', () => {
    useGame.getState().startScene(tome1Route);
    useGame.setState({ partyPos: { x: 8, y: 7 } }); // adjacent au corps (8,8)
    useGame.getState().interactEntity('corps-cocher1');
    const mail = (useGame.getState().party[0].items ?? []).find((i) => i.name === 'Chemise de mailles');
    expect(mail).toBeTruthy();
    expect(mail!.kind).toBe('armor');
  });

  it('une seconde fouille du même corps ne re-donne rien (marqué fouillé)', () => {
    useGame.getState().startScene(tome1Route);
    useGame.setState({ partyPos: { x: 8, y: 7 } });
    useGame.getState().interactEntity('corps-cocher1');
    useGame.getState().interactEntity('corps-cocher1');
    const mails = (useGame.getState().party[0].items ?? []).filter((i) => i.name === 'Chemise de mailles');
    expect(mails).toHaveLength(1); // une seule, pas deux
  });
});
