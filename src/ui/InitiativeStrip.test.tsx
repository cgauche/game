import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InitiativeStrip } from './InitiativeStrip';
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
      <InitiativeStrip order={['e1', 'h1']} turn={1} combatants={[h, foe]} over={false}
        canFirstIds={[]} inspectEnabled={false} onToggleInspect={noop} onActivate={noop} onPromote={noop} />,
    );
    expect(html.indexOf('Brigand')).toBeGreaterThan(-1);
    expect(html.indexOf('Brigand')).toBeLessThan(html.indexOf('Gunnar')); // ordre = order[]
    expect(html.match(/▼/g)?.length).toBe(1); // un seul actif (turn=1)
  });

  it('badge de score d’Initiative rendu pour héros ET ennemis', () => {
    const { h, foe } = fixtures();
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={-1} combatants={[h, foe]} over={false}
        canFirstIds={[]} inspectEnabled={false} onToggleInspect={noop} onActivate={noop} onPromote={noop} />,
    );
    expect(html).toContain('is-score');
    expect(html).toContain('42'); // initiative du héros
    expect(html).toContain('31'); // initiative de l'ennemi
  });

  it('badge de score d’Initiative absent une fois le combat engagé (#205)', () => {
    const { h, foe } = fixtures();
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={1} combatants={[h, foe]} over={false}
        canFirstIds={[]} inspectEnabled={false} onToggleInspect={noop} onActivate={noop} onPromote={noop} />,
    );
    expect(html).not.toContain('is-score');
  });

  it('pause de début de Round : badge de pré-emption (is-first) sur les héros éligibles', () => {
    const { h, foe } = fixtures();
    h.fortune = 2;
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={0} combatants={[h, foe]} over={false}
        canFirstIds={['h1']} inspectEnabled={false} onToggleInspect={noop} onActivate={noop} onPromote={noop} />,
    );
    expect(html).toContain('is-first'); // badge de pré-emption sur le héros éligible
    expect(html).not.toContain('is-first free'); // payant (pas d'arme Rapide) → pas la variante gratuite
  });

  it('badge gratuit (arme Rapide) : variante .free, sans coût en Chance affiché', () => {
    const { h, foe } = fixtures();
    h.fortune = 2;
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={0} combatants={[h, foe]} over={false}
        canFirstIds={['h1']} freeFirstIds={['h1']} inspectEnabled={false} onToggleInspect={noop} onActivate={noop} onPromote={noop} />,
    );
    expect(html).toContain('is-first free');
  });

  it('toggle d’inspection présent (On si inspection activée)', () => {
    const { h, foe } = fixtures();
    const off = renderToStaticMarkup(
      <InitiativeStrip order={['h1']} turn={0} combatants={[h, foe]} over={false}
        canFirstIds={[]} inspectEnabled={false} onToggleInspect={noop} onActivate={noop} onPromote={noop} />,
    );
    expect(off).toContain('inspect-toggle');
    const on = renderToStaticMarkup(
      <InitiativeStrip order={['h1']} turn={0} combatants={[h, foe]} over={false}
        canFirstIds={[]} inspectEnabled={true} onToggleInspect={noop} onActivate={noop} onPromote={noop} />,
    );
    expect(on).toContain('On');
  });
});
