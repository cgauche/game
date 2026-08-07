import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CombatBanner } from './CombatBanner';

const mocks = vi.hoisted(() => ({
  state: { battle: null as unknown, actorAim: null as unknown },
  feed: [] as Array<{
    raw: string;
    tone: string;
    icon: string;
    segments: Array<{ text: string; team?: 'ally' | 'enemy' }>;
  }>,
}));

vi.mock('../state/store', () => ({
  useGame: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
}));

vi.mock('../gameIso/combatNarration', () => ({
  combatFeed: () => mocks.feed,
  narrateIntent: () => mocks.feed[0],
}));

describe('CombatBanner', () => {
  beforeEach(() => {
    mocks.state.battle = { over: null, log: [], combatants: [] };
    mocks.state.actorAim = null;
    mocks.feed = [];
  });

  it('garde une région live vide pendant un combat sans annonce', () => {
    const html = renderToStaticMarkup(<CombatBanner />);
    expect(html).toBe('<div class="combat-feed" role="status" aria-live="polite" aria-atomic="true"></div>');
  });

  it('rend au plus une annonce dans la région live', () => {
    mocks.feed = [
      { raw: 'Gunnar frappe', tone: 'hit', icon: 'action/attack', segments: [{ text: 'Gunnar', team: 'ally' }, { text: ' frappe' }] },
      { raw: 'Ancienne ligne', tone: 'plain', icon: 'journal/info', segments: [{ text: 'Ancienne ligne' }] },
    ];
    const html = renderToStaticMarkup(<CombatBanner />);
    expect(html).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(html.match(/class="cb-ev /g)?.length).toBe(1);
    expect(html).toContain('Gunnar');
    expect(html).not.toContain('Ancienne ligne');
  });

  it('n’annonce ni le round ni l’ordre d’initiative — ils appartiennent à la frise', () => {
    mocks.feed = [
      { raw: 'Gunnar frappe', tone: 'hit', icon: 'action/attack', segments: [{ text: 'Gunnar', team: 'ally' }, { text: ' frappe' }] },
    ];
    const html = renderToStaticMarkup(<CombatBanner />);
    expect(html).not.toContain('Round');
    expect(html).not.toContain('is-round');
    expect(html).not.toContain('initiative-strip');
    expect(html).not.toContain('is-cell');
  });
});
