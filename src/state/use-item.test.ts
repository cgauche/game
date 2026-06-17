import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import type { Combatant, ItemInstance } from '../engine/types';

function item(over: Partial<ItemInstance>): ItemInstance {
  return { uid: 'i1', name: 'X', kind: 'misc', qualities: [], enc: 0, equipped: false, ...over } as ItemInstance;
}

function hero(p: Partial<Combatant>): Combatant {
  return {
    id: 'h1', name: 'Blessé', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 35, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 6, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], fortune: 0, resilience: 0, items: [], pos: { x: 1, y: 1 }, ...p,
  } as Combatant;
}

// Descriptions VERBATIM du Livre de base p.307 (cf. consumables.test.ts).
const BANDAGE = item({ uid: 'b1', name: 'Bandages', desc: 'Un Test de Guérison ou de Dextérité réussi retire +1 État Hémorragique supplémentaire.' });
const POTION = item({ uid: 'p1', name: 'Potion de guérison', desc: "Si vous avez plus de 0 Blessure, récupérez immédiatement un nombre de Points de Blessure égal à votre Bonus d'Endurance. Dose: 1 par rencontre." });

describe('usePartyItem — consommables hors combat (fiche)', () => {
  beforeEach(() => {
    useGame.setState({ mode: 'exploration', battle: null, journal: [] });
  });

  it('bandages : retire 1 pion Hémorragique et consomme l’objet', () => {
    const h = hero({ conditions: [{ name: 'hemorragique', value: 3 }], items: [BANDAGE] });
    useGame.setState({ party: [h] });
    useGame.getState().usePartyItem('h1', 'b1');
    const p = useGame.getState().party.find((c) => c.id === 'h1')!;
    expect(p.conditions.find((c) => c.name === 'hemorragique')?.value).toBe(2); // 3 − 1
    expect(p.items!.find((i) => i.uid === 'b1')).toBeUndefined(); // consommé
  });

  it('potion de guérison : soigne du Bonus d’Endurance et se consomme', () => {
    const h = hero({ wounds: { current: 6, max: 12 }, items: [POTION] });
    useGame.setState({ party: [h] });
    useGame.getState().usePartyItem('h1', 'p1');
    const p = useGame.getState().party.find((c) => c.id === 'h1')!;
    expect(p.wounds.current).toBe(6 + 3); // BE(35) = 3
    expect(p.items!.length).toBe(0);
  });

  it('refus en combat : usePartyItem ne fait rien (passer par la barre d’action)', () => {
    const h = hero({ conditions: [{ name: 'hemorragique', value: 3 }], items: [BANDAGE] });
    useGame.setState({ party: [h], battle: { over: null } as never });
    useGame.getState().usePartyItem('h1', 'b1');
    const p = useGame.getState().party.find((c) => c.id === 'h1')!;
    expect(p.conditions.find((c) => c.name === 'hemorragique')?.value).toBe(3); // inchangé
    expect(p.items!.length).toBe(1); // non consommé
  });
});
