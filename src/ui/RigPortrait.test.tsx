import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RigPortrait } from './RigPortrait';
import type { Combatant } from '../engine/types';

const hero = { id: 'h1', kind: 'hero', name: 'Soldat', career: 'Soldat', appearance: { species: 'Humain', sex: 'M', build: 0.5, seed: 3 } } as unknown as Combatant;

describe('RigPortrait', () => {
  it('rend un svg avec viewBox cadré + le visage (tête) du rig', () => {
    const html = renderToStaticMarkup(<RigPortrait combatant={hero} ring="#4f8fe0" />);
    expect(html).toContain('class="rig-portrait"');
    expect(html).toContain('viewBox="');
    expect(html).toContain('data-bone="tete"');
  });
});
