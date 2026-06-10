import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoadoutSection } from './LoadoutSection';
import type { Combatant } from '../engine/types';

const noop = () => {};
const hero = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h', name: 'H', kind: 'hero',
    items: [
      { uid: 'e', name: 'Épée', kind: 'melee', qualities: [], enc: 1, equipped: true, hands: 1 },
      { uid: 'b', name: 'Bouclier', kind: 'melee', qualities: ['Défensive'], enc: 1, equipped: true, hands: 1 },
      { uid: 'h2', name: 'Hallebarde', kind: 'melee', qualities: [], enc: 3, equipped: false, hands: 2 },
    ],
    loadouts: [{ id: 'l1', name: 'Mêlée', main: 'e', off: 'b' }],
    activeLoadoutId: 'l1',
    ...over,
  } as unknown as Combatant);

const render = (h: Combatant) =>
  renderToStaticMarkup(
    <LoadoutSection hero={h} onCreate={noop} onRename={noop} onDelete={noop} onSetActive={noop} onSetSlot={noop} />,
  );

describe('LoadoutSection', () => {
  it('rend le loadout (nom, 2 slots), les armes en options, et le bouton créer', () => {
    const html = render(hero());
    expect(html).toContain('Mêlée'); // nom (input value)
    expect(html).toContain('Nouveau loadout');
    expect(html.match(/<select/g)?.length).toBeGreaterThanOrEqual(2); // main + secondaire
    expect(html).toContain('Épée');
    expect(html).toContain('Hallebarde (2M)'); // marqueur 2 mains dans l'option
    expect(html).toContain('● Actif'); // loadout actif marqué
  });

  it('arme 2 mains en principale → slot secondaire désactivé', () => {
    const html = render(hero({ loadouts: [{ id: 'l1', name: 'Hampe', main: 'h2' }], activeLoadoutId: 'l1' }));
    expect(html).toContain('disabled'); // le select secondaire est grisé
    expect(html).toContain('(2 mains)');
  });

  it('aucun loadout → invite à en créer', () => {
    const html = render(hero({ loadouts: [], activeLoadoutId: undefined }));
    expect(html).toContain('Aucun set');
  });
});
