// @vitest-environment jsdom
/**
 * Bandeau de combat — région live du HUD (§14-4). Monté pour de VRAI (patron `createRoot`/`act`) sur
 * le VRAI store (`useGame.setState`) et de VRAIS événements de journal (`ev`, `src/state/combatLog`) :
 * la sélection du message passe par `combatFeed`/`narrateIntent` réels, aucun module n'est mocké
 * (`isolate: false` — cf. `src/vi-mock-isolate-guard.test.ts`).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame, type BattleState } from '../state/store';
import { ev, type CombatEvent } from '../state/combatLog';
import { CombatBanner } from './CombatBanner';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const com = (id: string, label: string, kind: 'hero' | 'enemy') =>
  ({ id, name: label, label, kind, conditions: [], traumas: [], engagedWith: [], advantage: 0 });

const GUNNAR = com('gunnar', 'Gunnar', 'hero');
const RAT = com('rat', 'Rat géant', 'enemy');

let host: HTMLDivElement;
let root: Root;

/** Combat en cours dont le journal porte `log`, puis montage du bandeau. */
function monter(log: CombatEvent[]) {
  useGame.setState({
    battle: { combatants: [GUNNAR, RAT], order: ['gunnar', 'rat'], baseOrder: ['gunnar', 'rat'], turn: 0, round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false,
      log, over: null } as unknown as BattleState,
    actorAim: null,
  });
  act(() => { root.render(<CombatBanner />); });
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ battle: null, actorAim: null });
});

describe('CombatBanner', () => {
  it('garde une région live vide pendant un combat sans annonce', () => {
    monter([]);
    expect(host.innerHTML).toBe('<div class="combat-feed" role="status" aria-live="polite" aria-atomic="true"></div>');
  });

  it('rend au plus une annonce dans la région live', () => {
    monter([
      ev('attack', 'Ancienne ligne', 'gunnar', 'rat'),
      ev('attack', 'Gunnar frappe Rat géant', 'gunnar', 'rat'),
    ]);
    const html = host.innerHTML;
    expect(html).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(html.match(/class="cb-ev /g)?.length).toBe(1);
    expect(html).toContain('Gunnar');
    expect(html).not.toContain('Ancienne ligne');
  });

  it('n’annonce ni le round ni l’ordre d’initiative — ils appartiennent à la frise', () => {
    monter([ev('attack', 'Gunnar frappe Rat géant', 'gunnar', 'rat')]);
    const html = host.innerHTML;
    expect(html).not.toContain('Round');
    expect(html).not.toContain('is-round');
    expect(html).not.toContain('initiative-strip');
    expect(html).not.toContain('is-cell');
  });
});
