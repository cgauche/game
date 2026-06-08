import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MerchantPanelView } from './MerchantPanel';
import type { Combatant } from '../engine/types';

describe('MerchantPanel (#2)', () => {
  it('affiche le stock + la Bourse + boutons Acheter/Vendre', () => {
    const party = [{ id: 'h', name: 'H', items: [{ uid: 'x', name: 'Dague', kind: 'melee', qualities: [], enc: 0, equipped: false }] } as unknown as Combatant];
    const html = renderToStaticMarkup(
      <MerchantPanelView
        merchant={{ entityId: 'p', archetype: 'armurier', settlement: 'ville', resaleRate: 0.1, stock: [{ label: 'Hallebarde', qty: 2 }] }}
        party={party}
        money={{ gold: 1, silver: 0, brass: 0 }}
        onBuy={() => {}}
        onSell={() => {}}
        onRepair={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html).toContain('Hallebarde');
    expect(html).toMatch(/Acheter/);
    expect(html).toMatch(/Vendre/);
    expect(html).toContain('Dague'); // vendable depuis les items du héros
    expect(html).toContain('Bourse'); // affiche la bourse (formatMoney)
  });

  it('liste une armure endommagée dans la section Réparer (#2d)', () => {
    const party = [{ id: 'h', name: 'H', items: [{ uid: 'a', name: 'Chemise de mailles', kind: 'armor', pa: 3, damageTaken: 2, qualities: [], enc: 1, equipped: true }] } as unknown as Combatant];
    const html = renderToStaticMarkup(
      <MerchantPanelView
        merchant={{ entityId: 'p', archetype: 'armurier', settlement: 'ville', resaleRate: 0.1, stock: [] }}
        party={party}
        money={{ gold: 1, silver: 0, brass: 0 }}
        onBuy={() => {}}
        onSell={() => {}}
        onRepair={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html).toMatch(/Réparer/);
    expect(html).toContain('Chemise de mailles');
  });
});
