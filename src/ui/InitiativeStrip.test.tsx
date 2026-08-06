import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InitiativeStrip, initiativePhase } from './InitiativeStrip';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';

function fixtures() {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', rng: makeRNG(3) });
  h.id = 'h1';
  h.initiative = 42;
  const foe = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brigand', rng: makeRNG(5) }), id: 'e1', kind: 'enemy' as Combatant['kind'], initiative: 31 };
  return { h, foe };
}
const noop = () => {};

describe('InitiativeStrip', () => {
  it('rend les tuiles dans l’ordre de battle.order et marque l’actif', () => {
    const { h, foe } = fixtures();
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={1} round={3} combatants={[h, foe]} over={false}
        canFirstIds={[]} onActivate={noop} onPromote={noop} />,
    );
    expect(html.indexOf('Brigand')).toBeGreaterThan(-1);
    expect(html.indexOf('Brigand')).toBeLessThan(html.indexOf('Gunnar'));
    expect(html).toContain('Round 3');
    expect(html.match(/aria-current="step"/g)?.length).toBe(1);
    expect(html.match(/▼/g)?.length).toBe(1);
  });

  it.each([
    { index: 0, turn: 1, over: false, want: 'past' },
    { index: 1, turn: 1, over: false, want: 'current' },
    { index: 2, turn: 1, over: false, want: 'future' },
    { index: 0, turn: -1, over: false, want: 'future' },
    { index: 1, turn: 1, over: true, want: 'future' },
  ] as const)('classe la position $index comme $want', ({ index, turn, over, want }) => {
    expect(initiativePhase(index, turn, over)).toBe(want);
  });

  it('classe un renfort ajouté après l’index courant comme futur', () => {
    const { h, foe } = fixtures();
    const reinforcement = { ...foe, id: 'e2', label: 'Renfort' };
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1', 'e2']} turn={1} round={2} combatants={[h, foe, reinforcement]} over={false}
        canFirstIds={[]} onActivate={noop} onPromote={noop} />,
    );
    expect(html).toMatch(/data-phase="future"[^>]*>.*Renfort/s);
  });

  it('badge de score d’Initiative rendu pour héros ET ennemis', () => {
    const { h, foe } = fixtures();
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={-1} round={1} combatants={[h, foe]} over={false}
        canFirstIds={[]} onActivate={noop} onPromote={noop} />,
    );
    expect(html).toContain('is-score');
    expect(html).toContain('42');
    expect(html).toContain('31');
  });

  it('badge de score d’Initiative absent une fois le combat engagé (#205)', () => {
    const { h, foe } = fixtures();
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={1} round={1} combatants={[h, foe]} over={false}
        canFirstIds={[]} onActivate={noop} onPromote={noop} />,
    );
    expect(html).not.toContain('is-score');
  });

  it('pause de début de Round : badge de pré-emption (is-first) sur les héros éligibles', () => {
    const { h, foe } = fixtures();
    h.fortune = 2;
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={0} round={1} combatants={[h, foe]} over={false}
        canFirstIds={['h1']} onActivate={noop} onPromote={noop} />,
    );
    expect(html).toContain('is-first');
    expect(html).not.toContain('is-first free');
  });

  it('badge gratuit (arme Rapide) : variante .free, sans coût en Chance affiché', () => {
    const { h, foe } = fixtures();
    h.fortune = 2;
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={0} round={1} combatants={[h, foe]} over={false}
        canFirstIds={['h1']} freeFirstIds={['h1']} onActivate={noop} onPromote={noop} />,
    );
    expect(html).toContain('is-first free');
  });
});
