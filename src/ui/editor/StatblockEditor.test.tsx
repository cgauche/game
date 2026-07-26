// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatblockEditor } from './StatblockEditor';
import type { CustomStatblock } from '../../state/scene';
import { creatures } from '../../data';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('StatblockEditor — exposition Psychologie (P4)', () => {
  it('affiche le champ Groupes (extras) avec la valeur courante', () => {
    const stat: CustomStatblock = { label: 'X', char: { M: 4 }, groups: ['Sigmarite', 'Cultiste'] };
    const html = renderToStaticMarkup(<StatblockEditor stat={stat} onChange={() => {}} />);
    expect(html).toContain('Groupes');
    expect(html).toContain('Sigmarite, Cultiste');
  });

  it('documente la syntaxe des Traits psy (Peur/Terreur/Animosité)', () => {
    const stat: CustomStatblock = { label: 'X', char: { M: 4 } };
    const html = renderToStaticMarkup(<StatblockEditor stat={stat} onChange={() => {}} />);
    expect(html).toMatch(/Peur/);
    expect(html).toMatch(/Animosit/);
  });
});

describe('StatblockEditor — cloner une créature de base ne décide JAMAIS par comparaison de texte (#142)', () => {
  it('un profil réellement nommé « Profil personnalisé » n’est PAS écrasé par le clone', () => {
    const stat: CustomStatblock = { label: 'Profil personnalisé', char: { M: 4 } };
    let latest: CustomStatblock = stat;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<StatblockEditor stat={stat} onChange={(s) => { latest = s; }} />);
    });
    const select = container.querySelector('select') as HTMLSelectElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(select, creatures[0].id);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(latest.label).toBe('Profil personnalisé');
    act(() => { root.unmount(); });
    container.remove();
  });
});
