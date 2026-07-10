import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatFlow';
import { restoreFortune } from '../engine/fortune';
import type { Combatant } from '../engine/types';

const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'h', name: 'H', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    fate: 3, fortune: 0, ...p,
  } as Combatant);

describe('Effet restoreFortune — Chance regagnée en début de session (LDB 17 l.47)', () => {
  beforeEach(() => { useGame.setState({ battle: null, mode: 'exploration' }); });

  it('chaque héros regagne sa Chance jusqu’au maximum = Destin actuel', () => {
    const a = hero({ id: 'a', fate: 3, fortune: 0 });
    const b = hero({ id: 'b', fate: 2, fortune: 1 });
    useGame.setState({ party: [a, b] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'restoreFortune' }]);
    const p = useGame.getState().party;
    expect(p.find((h) => h.id === 'a')!.fortune).toBe(3); // 0 → Destin 3
    expect(p.find((h) => h.id === 'b')!.fortune).toBe(2); // 1 → Destin 2
  });

  it('n’affecte pas un combattant sans Destin (ennemi)', () => {
    const enemy = hero({ id: 'e', kind: 'enemy', fate: undefined, fortune: 0 });
    useGame.setState({ party: [enemy] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'restoreFortune' }]);
    expect(useGame.getState().party[0].fortune).toBe(0); // inchangé
  });
});

describe('engine/fortune.restoreFortune — helper PUR partagé (LDB 17 l.47)', () => {
  it('ramène la Chance d’un héros à son Destin, laisse les autres inchangés', () => {
    const a = hero({ id: 'a', fate: 3, fortune: 0 });
    const b = hero({ id: 'b', fate: 2, fortune: 1 });
    const enemy = hero({ id: 'e', kind: 'enemy', fate: undefined, fortune: 0 });
    const out = restoreFortune([a, b, enemy]);
    expect(out.find((h) => h.id === 'a')!.fortune).toBe(3);
    expect(out.find((h) => h.id === 'b')!.fortune).toBe(2);
    expect(out.find((h) => h.id === 'e')!.fortune).toBe(0); // pas de Destin → inchangé
  });

  it('logique IDENTIQUE au case Effet `restoreFortune` (pas de duplication)', () => {
    const party = [hero({ id: 'a', fate: 4, fortune: 1 }), hero({ id: 'b', fate: 2, fortune: 0 })];
    // Référence : l'Effet de scène (applyEffects → case restoreFortune).
    useGame.setState({ party: party.map((h) => ({ ...h })) });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'restoreFortune' }]);
    const viaEffect = useGame.getState().party.map((h) => h.fortune);
    // Le helper pur doit produire EXACTEMENT le même résultat.
    const viaHelper = restoreFortune(party.map((h) => ({ ...h }))).map((h) => h.fortune);
    expect(viaHelper).toEqual(viaEffect);
  });
});

describe('store.restoreFortuneNow — règle « Longues Séances de Jeu » mode manual (LDB 17 l.52)', () => {
  beforeEach(() => { useGame.setState({ battle: null, mode: 'exploration' }); });

  it('un héros fortune < fate voit sa Chance remise à fate', () => {
    const a = hero({ id: 'a', fate: 3, fortune: 1 });
    const b = hero({ id: 'b', fate: 2, fortune: 0 });
    useGame.setState({ party: [a, b] });
    useGame.getState().restoreFortuneNow();
    const p = useGame.getState().party;
    expect(p.find((h) => h.id === 'a')!.fortune).toBe(3);
    expect(p.find((h) => h.id === 'b')!.fortune).toBe(2);
  });

  it('produit le MÊME état que l’Effet `restoreFortune` (réutilise la même logique)', () => {
    const mk = () => [hero({ id: 'a', fate: 5, fortune: 2 }), hero({ id: 'b', fate: 3, fortune: 3 })];
    // Via l'action de store.
    useGame.setState({ party: mk() });
    useGame.getState().restoreFortuneNow();
    const viaAction = useGame.getState().party.map((h) => h.fortune);
    // Via l'Effet de scène.
    useGame.setState({ party: mk() });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'restoreFortune' }]);
    const viaEffect = useGame.getState().party.map((h) => h.fortune);
    expect(viaAction).toEqual(viaEffect);
  });
});
