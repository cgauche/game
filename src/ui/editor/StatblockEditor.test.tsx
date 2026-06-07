import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatblockEditor } from './StatblockEditor';
import type { CustomStatblock } from '../../state/scene';

describe('StatblockEditor — exposition Psychologie (P4)', () => {
  it('affiche le champ Groupes (extras) avec la valeur courante', () => {
    const stat: CustomStatblock = { name: 'X', char: { M: 4 }, groups: ['Sigmarite', 'Cultiste'] };
    const html = renderToStaticMarkup(<StatblockEditor stat={stat} onChange={() => {}} />);
    expect(html).toContain('Groupes');
    expect(html).toContain('Sigmarite, Cultiste');
  });

  it('documente la syntaxe des Traits psy (Peur/Terreur/Animosité)', () => {
    const stat: CustomStatblock = { name: 'X', char: { M: 4 } };
    const html = renderToStaticMarkup(<StatblockEditor stat={stat} onChange={() => {}} />);
    expect(html).toMatch(/Peur/);
    expect(html).toMatch(/Animosit/);
  });
});
