import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * Garde-fou « export unique `difficultyFromModifier` » (#302). Une seule implémentation autorisée
 * (`src/engine/tests.ts`) — toute 2ᵉ `export function difficultyFromModifier`/`export const
 * difficultyFromModifier` ailleurs est une DUPLICATION du foyer (deux implémentations pouvant diverger
 * silencieusement). Compte d'EXPORTS, pas d'appels.
 */

const EXPORT_RX = /export\s+(?:function|const)\s+difficultyFromModifier\b/;

describe('garde-fou « difficultyFromModifier » — export unique (cliquet, #302)', () => {
  it('exactement 1 export de `difficultyFromModifier` dans tout src/', () => {
    const hits: string[] = [];
    for (const { rel, text } of readCorpus(['src'])) {
      if (EXPORT_RX.test(text)) hits.push(rel);
    }
    expect(hits, `Attendu 1 export (src/engine/tests.ts), trouvé :\n${hits.join('\n')}`).toEqual(['src/engine/tests.ts']);
  });
});
