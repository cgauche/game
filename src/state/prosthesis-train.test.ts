import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { traumaDodgePenalty, cannotWieldTwoHanded } from '../engine/trauma';
import type { Combatant, ItemInstance } from '../engine/types';

const legSequela = { label: 'Membre inférieur amputé (jambeD)', location: 'jambeD' as const, ops: [{ op: 'moveScale' as const, num: 1, den: 2 }, { op: 'skillMod' as const, skill: 'esquive', mod: -20 }], prosthesis: [{ trappingId: 'fausse-jambe', cancels: 'movement' as const }] };
const fausseJambe = (over: Partial<ItemInstance> = {}): ItemInstance => ({ uid: 'fj', trappingId: 'fausse-jambe', name: 'Fausse jambe', kind: 'misc', subType: 'Prothèses', qualities: [], enc: 2, equipped: true, ...over } as ItemInstance);

const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'h', name: 'Manchot', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    traumas: [legSequela], items: [fausseJambe()], ...p,
  } as Combatant);

describe('trainProsthesis — rachat PX en 2 paliers de la Fausse jambe (LDB 73 l.23)', () => {
  beforeEach(() => { useGame.setState({ battle: null, mode: 'exploration' }); });

  it('100 PX (1er palier, Mouvement) : marque prosthesisMoveTrained, l’Esquive reste pénalisée', () => {
    const h = hero({ id: 'a', xp: 300 });
    useGame.setState({ party: [h] });
    useGame.getState().trainProsthesis('a', 'fj');
    const p = useGame.getState().party[0];
    expect(p.xp).toBe(200); // 300 − 100
    const it = p.items!.find((i) => i.uid === 'fj')!;
    expect(it.prosthesisMoveTrained).toBe(true);
    expect(it.prosthesisTrained).toBeFalsy();
    expect(traumaDodgePenalty(p)).toBe(-20); // Esquive pas encore réapprise
  });

  it('200 PX (2e palier, Esquive) : une fois le Mouvement déjà entraîné, rétablit AUSSI l’Esquive', () => {
    const h = hero({ id: 'a', xp: 250, items: [fausseJambe({ prosthesisMoveTrained: true })] });
    useGame.setState({ party: [h] });
    useGame.getState().trainProsthesis('a', 'fj');
    const p = useGame.getState().party[0];
    expect(p.xp).toBe(50); // 250 − 200
    expect(p.items!.find((i) => i.uid === 'fj')!.prosthesisTrained).toBe(true);
    expect(traumaDodgePenalty(p)).toBe(0);
  });

  it('achats séquentiels : deux appels (100 PX puis 200 PX) mènent au plein entraînement', () => {
    const h = hero({ id: 'a', xp: 300 });
    useGame.setState({ party: [h] });
    useGame.getState().trainProsthesis('a', 'fj'); // 1er palier : 100 PX
    useGame.getState().trainProsthesis('a', 'fj'); // 2e palier : 200 PX
    const p = useGame.getState().party[0];
    expect(p.xp).toBe(0); // 300 − 100 − 200
    const it = p.items!.find((i) => i.uid === 'fj')!;
    expect(it.prosthesisMoveTrained).toBe(true);
    expect(it.prosthesisTrained).toBe(true);
    expect(traumaDodgePenalty(p)).toBe(0);
  });

  it('PX insuffisants pour le 1er palier (100 PX) : aucun changement', () => {
    const h = hero({ id: 'a', xp: 50 });
    useGame.setState({ party: [h] });
    useGame.getState().trainProsthesis('a', 'fj');
    const p = useGame.getState().party[0];
    expect(p.xp).toBe(50);
    expect(p.items!.find((i) => i.uid === 'fj')!.prosthesisMoveTrained).toBeFalsy();
  });

  it('PX insuffisants pour le 2e palier (200 PX) une fois le Mouvement acquis : aucun changement', () => {
    const h = hero({ id: 'a', xp: 150, items: [fausseJambe({ prosthesisMoveTrained: true })] });
    useGame.setState({ party: [h] });
    useGame.getState().trainProsthesis('a', 'fj');
    const p = useGame.getState().party[0];
    expect(p.xp).toBe(150);
    expect(p.items!.find((i) => i.uid === 'fj')!.prosthesisTrained).toBeFalsy();
  });

  it('déjà pleinement entraînée (200 PX) : nouvel appel ne fait rien', () => {
    const h = hero({ id: 'a', xp: 300, items: [fausseJambe({ prosthesisMoveTrained: true, prosthesisTrained: true })] });
    useGame.setState({ party: [h] });
    useGame.getState().trainProsthesis('a', 'fj');
    expect(useGame.getState().party[0].xp).toBe(300);
  });

  it('prothèse non portée : refus', () => {
    const h = hero({ id: 'a', xp: 300, items: [fausseJambe({ equipped: false })] });
    useGame.setState({ party: [h] });
    useGame.getState().trainProsthesis('a', 'fj');
    expect(useGame.getState().party[0].xp).toBe(300); // inchangé
  });

  it('Crochet entraîné (400 PX) rétablit le port d’armes à deux mains (LDB 73)', () => {
    const crochet: ItemInstance = { uid: 'cr', trappingId: 'crochet', name: 'Crochet', kind: 'misc', subType: 'Prothèses', qualities: [], enc: 1, equipped: true } as ItemInstance;
    const h = hero({ id: 'a', xp: 500, traumas: [{ label: 'Main', location: 'brasD', ops: [{ op: 'maxWeaponHands' as const, hands: 1 }] }], items: [crochet] });
    useGame.setState({ party: [h] });
    expect(cannotWieldTwoHanded(useGame.getState().party[0])).toBe(true); // avant : pas d'arme à 2 mains
    useGame.getState().trainProsthesis('a', 'cr');
    const p = useGame.getState().party[0];
    expect(p.xp).toBe(100); // 500 − 400
    expect(cannotWieldTwoHanded(p)).toBe(false); // crochet maîtrisé → 2 mains de nouveau possibles
  });
});
