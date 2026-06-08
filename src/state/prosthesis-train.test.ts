import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { traumaDodgePenalty } from '../engine/trauma';
import type { Combatant, ItemInstance } from '../engine/types';

const legSequela = { label: 'Membre inférieur amputé (jambeD)', location: 'jambeD' as const, movementHalved: true, dodgePenalty: -20, prosthesis: [{ name: 'Fausse jambe', cancels: 'movement' as const }], note: '' };
const fausseJambe = (over: Partial<ItemInstance> = {}): ItemInstance => ({ uid: 'fj', name: 'Fausse jambe', kind: 'misc', subType: 'Prothèses', qualities: [], enc: 2, equipped: true, ...over } as ItemInstance);

const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'h', name: 'Manchot', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    traumas: [legSequela], items: [fausseJambe()], ...p,
  } as Combatant);

describe('trainProsthesis — rachat PX de l’Esquive (Fausse jambe, LDB 73)', () => {
  beforeEach(() => { useGame.setState({ battle: null, mode: 'exploration' }); });

  it('200 PX : marque la prothèse entraînée et rétablit l’Esquive', () => {
    const h = hero({ id: 'a', xp: 300 });
    useGame.setState({ party: [h] });
    expect(traumaDodgePenalty(useGame.getState().party[0])).toBe(-20); // avant : Esquive pénalisée
    useGame.getState().trainProsthesis('a', 'fj');
    const p = useGame.getState().party[0];
    expect(p.xp).toBe(100); // 300 − 200
    expect(p.items!.find((i) => i.uid === 'fj')!.prosthesisTrained).toBe(true);
    expect(traumaDodgePenalty(p)).toBe(0); // Esquive réapprise
  });

  it('PX insuffisants : aucun changement', () => {
    const h = hero({ id: 'a', xp: 150 });
    useGame.setState({ party: [h] });
    useGame.getState().trainProsthesis('a', 'fj');
    const p = useGame.getState().party[0];
    expect(p.xp).toBe(150);
    expect(p.items!.find((i) => i.uid === 'fj')!.prosthesisTrained).toBeFalsy();
  });

  it('prothèse non portée : refus', () => {
    const h = hero({ id: 'a', xp: 300, items: [fausseJambe({ equipped: false })] });
    useGame.setState({ party: [h] });
    useGame.getState().trainProsthesis('a', 'fj');
    expect(useGame.getState().party[0].xp).toBe(300); // inchangé
  });
});
