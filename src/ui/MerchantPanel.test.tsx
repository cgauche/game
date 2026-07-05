import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MerchantPanelView } from './MerchantPanel';
import type { Combatant, ItemInstance } from '../engine/types';

const noop = {
  onAddToCart: () => {}, onDecCart: () => {}, onRemoveCart: () => {}, onClearCart: () => {}, onRefuse: () => {}, onPay: () => {},
  onAssignDist: () => {}, onConfirmDist: () => {}, onRepair: () => {}, onBargain: () => {},
  onAppraise: () => {}, onClose: () => {},
  onAddToSellCart: () => {}, onRemoveSellCart: () => {}, onClearSellCart: () => {}, onConfirmSell: () => {},
};
const base = { entityId: 'p', archetype: 'armurier', settlement: 'ville' as const, resaleRate: 0.5, stock: [] as { id: string; qty: number }[], cart: [] as { id: string; qty: number }[], bargainLocked: false };

/** Stub RIGGABLE : le marchand rend des tuiles-portraits (CharFrame/TeamPortrait) — le rig a
 *  besoin d'armour/wounds/conditions/characteristics pour dessiner le héros. */
const stubHero = (id: string, name: string, items: ItemInstance[] = []) =>
  ({
    id, name, kind: 'hero', wounds: { current: 10, max: 12 }, conditions: [], advantage: 0,
    weapons: [], skills: [], items, movement: 4,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
  }) as unknown as Combatant;

describe('MerchantPanel (#2 — panier)', () => {
  it('Parcourir : tableau par famille + bouton « Ajouter » + barre panier', () => {
    const party = [{ id: 'h', name: 'H', items: [] } as unknown as Combatant];
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={{ ...base, stock: [{ id: 'hallebarde', qty: 2 }] }} party={party} money={{ gold: 5, silver: 0, brass: 0 }} {...noop} />,
    );
    expect(html).toContain('Armes de mêlée');
    expect(html).toContain('Hallebarde');
    expect(html).toContain('2 CO'); // prix canon
    expect(html).toMatch(/Ajouter/); // ajoute au panier (plus de « Acheter » direct)
    expect(html).toContain('Panier vide');
    expect(html).toContain('Bourse');
  });

  it('grise « Ajouter » si on ne peut pas payer une seule unité', () => {
    const party = [{ id: 'h', name: 'H', items: [] } as unknown as Combatant];
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={{ ...base, stock: [{ id: 'hallebarde', qty: 1 }] }} party={party} money={{ gold: 1, silver: 0, brass: 0 }} {...noop} />,
    );
    expect(html).toContain('unaffordable');
    expect(html).toMatch(/disabled/);
  });

  it('fiche de détail (clic sur le nom) : stats + Atouts/Défauts, sans bouton d’équipement', () => {
    const party = [stubHero('h', 'Hans')];
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={{ ...base, stock: [{ id: 'hallebarde', qty: 1 }] }} party={party} money={{ gold: 5, silver: 0, brass: 0 }} {...noop} initialDetails="hallebarde" />,
    );
    expect(html).toContain('merch-compare');
    expect(html).toContain('Dégâts'); // colonne / comparaison
    expect(html).toContain('Empaleuse'); // Atout listé
    expect(html).toMatch(/Critique/); // … avec sa description canon
    expect(html).toContain('Fermer');
    expect(html).not.toMatch(/Équiper/); // plus d'équipement depuis le marchand
  });

  it('Panier : lignes, total marchandable, bouton Payer', () => {
    const party = [{ id: 'h', name: 'H', items: [] } as unknown as Combatant];
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={{ ...base, stock: [{ id: 'hallebarde', qty: 3 }], cart: [{ id: 'hallebarde', qty: 2 }] }} party={party} money={{ gold: 9, silver: 0, brass: 0 }} {...noop} initialBuyView="cart" />,
    );
    expect(html).toContain('Hallebarde');
    expect(html).toMatch(/Marchander le panier/); // négociation claire sur le panier
    expect(html).toContain('Total'); // total affiché
    expect(html).toContain('4 CO'); // 2 × Hallebarde (2 CO)
    expect(html).toMatch(/Payer/);
  });

  it('Répartition (après paiement) : un menu héros par objet + Confirmer', () => {
    const party = [stubHero('h1', 'Anna'), stubHero('h2', 'Bruno')];
    const bought = { uid: 'b1', name: 'Hallebarde', kind: 'melee', qualities: [], enc: 3, equipped: false } as ItemInstance;
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={{ ...base, pendingDistribution: [{ item: bought, heroId: 'h1' }] }} party={party} money={{ gold: 5, silver: 0, brass: 0 }} {...noop} />,
    );
    expect(html).toContain('Répartition');
    expect(html).toContain('qui récupère quoi');
    expect(html).toContain('Anna');
    expect(html).toContain('Bruno'); // tuile de l'autre héros (nom en title/aria-label)
    expect(html).toMatch(/Confirmer la répartition/);
  });

  it('panier négocié : retirer OK, plus ajouter/renégocier, « Refuser le marché » remplace Vider, « Continuer » désactivé', () => {
    const party = [{ id: 'h', name: 'H', items: [] } as unknown as Combatant];
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={{ ...base, stock: [{ id: 'hallebarde', qty: 3 }], cart: [{ id: 'hallebarde', qty: 1 }], bargainBuy: { won: true, drNet: 2, negotiator: false } }} party={party} money={{ gold: 9, silver: 0, brass: 0 }} {...noop} initialBuyView="cart" />,
    );
    expect(html).toContain('Prix arrêté'); // note de marché scellé (texte condensé, détail en title)
    expect(html).not.toMatch(/Marchander le panier/); // plus de renégociation
    expect(html).toContain('Refuser le marché'); // remplace « Vider »
    expect(html).not.toContain('Vider le panier');
    expect(html).toContain('Marché négocié : réglez ou refusez le marché'); // titre du « Continuer les achats » désactivé
  });

  it('Marchandage verrouillé jusqu’au réassort (négocié puis quitté sans payer)', () => {
    const party = [{ id: 'h', name: 'H', items: [] } as unknown as Combatant];
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={{ ...base, stock: [{ id: 'hallebarde', qty: 1 }], cart: [{ id: 'hallebarde', qty: 1 }], bargainLocked: true }} party={party} money={{ gold: 9, silver: 0, brass: 0 }} {...noop} initialBuyView="cart" />,
    );
    expect(html).toContain('Marchandage indisponible');
    expect(html).not.toMatch(/Marchander le panier/);
  });

  it('onglet Vendre / Réparer + Marchandage par onglet (#2c/#2d)', () => {
    const party = [stubHero('h', 'H', [
      { uid: 'x', trappingId: 'dague', name: 'Dague', kind: 'melee', qualities: [], enc: 0, equipped: false },
      { uid: 'a', trappingId: 'chemise-de-mailles', name: 'Chemise de mailles', kind: 'armor', pa: 3, damageTaken: 2, qualities: [], enc: 1, equipped: true },
    ] as ItemInstance[])];
    const sell = renderToStaticMarkup(<MerchantPanelView merchant={base} party={party} money={{ gold: 1, silver: 0, brass: 0 }} {...noop} initialTab="sell" />);
    expect(sell).toContain('Dague');
    expect(sell).toMatch(/Marchander la vente/);
    const repair = renderToStaticMarkup(<MerchantPanelView merchant={base} party={party} money={{ gold: 1, silver: 0, brass: 0 }} {...noop} initialTab="repair" />);
    expect(repair).toContain('Chemise de mailles');
    expect(repair).toMatch(/Réparer/);
    // marchand méfiant : plus de marchandage dans le panier
    const soured = renderToStaticMarkup(<MerchantPanelView merchant={{ ...base, soured: true, cart: [{ id: 'hallebarde', qty: 1 }] }} party={party} money={{ gold: 5, silver: 0, brass: 0 }} {...noop} initialBuyView="cart" />);
    expect(soured).toContain('méfiant');
  });
});
