import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';

// File de révélation témoin (LDB — montrer le dé des jets subis/sur table).
describe('File de révélation (pendingReveals)', () => {
  beforeEach(() => useGame.setState({ pendingReveals: [] }));

  it('dismissReveal dépile la tête, no-op sur file vide', () => {
    useGame.setState({
      pendingReveals: [
        { kind: 'miscast', title: 'A', dice: 11, lines: ['x'] },
        { kind: 'critical', title: 'B', lines: ['y'] },
      ],
    });
    useGame.getState().dismissReveal();
    expect(useGame.getState().pendingReveals.map((r) => r.title)).toEqual(['B']);
    useGame.getState().dismissReveal();
    expect(useGame.getState().pendingReveals).toEqual([]);
    useGame.getState().dismissReveal();
    expect(useGame.getState().pendingReveals).toEqual([]);
  });
});
