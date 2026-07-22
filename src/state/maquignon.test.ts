import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { emptyScene } from './scene';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { setRule, resetRule } from '../engine/policy';
import { toBrass } from '../engine/money';
import type { Combatant } from '../engine/types';

/**
 * #619 Lot A — le maquignon vend des MONTURES/VÉHICULES (`unitIds`, `computeFreshStockLines`) : acheter
 * une unité crée une POSSESSION (`addPossession`) au lieu d'un objet de sac, la bourse paie le prix
 * `purchase` de `creatures.json` (pas le barème trapping).
 */
const hero = (): Combatant =>
  ({ id: 'h', name: 'H', items: [], characteristics: { sociabilite: 35 }, skills: [], wounds: { current: 10, max: 10 }, conditions: [], weapons: [], armour: {} } as unknown as Combatant);

const maquignonScene = () => {
  const sc = emptyScene(4, 4); sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', pos: { x: 0, y: 0 }, merchant: { archetype: 'maquignon' } } as never);
  return sc;
};

describe('#619 Lot A — maquignon : achat d\'unité → possession', () => {
  beforeEach(() => {
    useGame.setState({ party: [], scene: null, merchant: null, merchantStocks: {}, possessions: [], journal: [] });
    setRule('market-mode', 'sans-disponibilite'); // déterministe : toute Dispo Commune/Limitée/Rare en stock (LDB 59 l.15)
  });
  afterEach(() => resetRule('market-mode'));

  it('le stock liste la mule avec sa Disponibilité, échoue sans le maquignon (garde de câblage)', () => {
    useGame.setState({ party: [hero()], scene: maquignonScene() });
    useGame.getState().openMerchant('pnj');
    const line = useGame.getState().merchant!.stock.find((l) => l.id === 'mule');
    expect(line).toBeDefined();
    expect(line!.qty).toBeGreaterThan(0);
  });

  it('acheter une mule (panier) crée une possession bete/mule avec-le-groupe, ownerId = acheteur, bourse débitée', () => {
    useGame.setState({ party: [hero()], scene: maquignonScene() });
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, { gold: 50, silver: 0, brass: 0 });
    useGame.getState().openMerchant('pnj');
    const before = toBrass(partyMoneyTotal(useGame.getState));
    useGame.getState().addToCart('mule');
    useGame.getState().payCart();
    const st = useGame.getState();
    const pos = st.possessions.find((p) => p.nature === 'bete' && 'creatureId' in p.ref && p.ref.creatureId === 'mule');
    expect(pos).toBeDefined();
    expect(pos!.ownerId).toBe('h');
    expect(pos!.location).toEqual({ kind: 'avec-le-groupe' });
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBeLessThan(before); // bourse débitée du prix `purchase` (5 or)
    expect((st.party[0].items ?? []).some((i) => i.trappingId === 'mule')).toBe(false); // jamais un objet de sac (parité `giveTrapping` évitée)
    expect(st.merchant!.pendingDistribution).toBeFalsy(); // panier 100% unités → pas d'écran de répartition vide
  });

  it('acheter un trapping ordinaire (harnachement) chez le maquignon reste inchangé (aucune casse)', () => {
    useGame.setState({ party: [hero()], scene: maquignonScene() });
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, { gold: 50, silver: 0, brass: 0 });
    useGame.getState().openMerchant('pnj');
    const line = useGame.getState().merchant!.stock.find((l) => l.id === 'selle-et-harnais');
    expect(line).toBeDefined();
    useGame.getState().addToCart('selle-et-harnais');
    useGame.getState().payCart();
    const st = useGame.getState();
    expect(st.merchant!.pendingDistribution).toBeTruthy(); // panier avec objet de sac → écran de répartition renseigné
    expect(st.merchant!.pendingDistribution!.some((d) => d.item.trappingId === 'selle-et-harnais')).toBe(true);
    useGame.getState().confirmDistribution();
    expect(useGame.getState().party[0].items!.some((i) => i.trappingId === 'selle-et-harnais')).toBe(true);
  });
});
