import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InitiativeStrip } from './InitiativeStrip';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';

function fixtures() {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'Gunnar', rng: makeRNG(3) });
  h.id = 'h1';
  const foe = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'Brigand', rng: makeRNG(5) }), id: 'e1', kind: 'enemy' as Combatant['kind'] };
  return { h, foe };
}
const noop = () => {};

describe('InitiativeStrip', () => {
  it('rend les tuiles dans l’ordre de battle.order et marque l’actif', () => {
    const { h, foe } = fixtures();
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={1} round={2} combatants={[h, foe]} over={false}
        pendingRound={null} canFirstIds={[]} inspectEnabled={false} onToggleInspect={noop} onPromote={noop} />,
    );
    expect(html.indexOf('Brigand')).toBeGreaterThan(-1);
    expect(html.indexOf('Brigand')).toBeLessThan(html.indexOf('Gunnar')); // ordre = order[]
    expect(html.match(/▼/g)?.length).toBe(1); // un seul actif (turn=1)
  });

  it('pause de début de Round : badge ⏫ sur les héros éligibles', () => {
    const { h, foe } = fixtures();
    h.fortune = 2;
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={0} round={3} combatants={[h, foe]} over={false}
        pendingRound={3} canFirstIds={['h1']} inspectEnabled={false} onToggleInspect={noop} onPromote={noop} />,
    );
    expect(html).toContain('⏫'); // badge de pré-emption sur le héros éligible
  });

  it('toggle 🔍 présent (On si inspection activée)', () => {
    const { h, foe } = fixtures();
    const off = renderToStaticMarkup(
      <InitiativeStrip order={['h1']} turn={0} round={1} combatants={[h, foe]} over={false}
        pendingRound={null} canFirstIds={[]} inspectEnabled={false} onToggleInspect={noop} onPromote={noop} />,
    );
    expect(off).toContain('🔍');
    const on = renderToStaticMarkup(
      <InitiativeStrip order={['h1']} turn={0} round={1} combatants={[h, foe]} over={false}
        pendingRound={null} canFirstIds={[]} inspectEnabled={true} onToggleInspect={noop} onPromote={noop} />,
    );
    expect(on).toContain('On');
  });
});
