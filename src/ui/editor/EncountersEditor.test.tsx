import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EncountersEditor } from './EncountersEditor';
import type { EncounterDef } from '../../state/scene';

describe('EncountersEditor — récompenses de victoire (onVictory)', () => {
  it('affiche le constructeur d’effets « À la victoire » et l’effet giveXp existant', () => {
    const encounters: EncounterDef[] = [{ id: 'e1', enemies: [], onVictory: [{ type: 'giveXp', amount: 20 }] }];
    const html = renderToStaticMarkup(
      <EncountersEditor encounters={encounters} creatures={[]} dialogues={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    );
    expect(html).toContain('À la victoire'); // la nouvelle section de récompenses
    expect(html).toContain('Donner des PX'); // l'option giveXp du constructeur d'effets
    expect(html).toContain('value="20"'); // le montant de PX câblé à onVictory
  });
});
