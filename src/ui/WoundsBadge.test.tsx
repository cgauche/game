import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WoundsBadge } from './WoundsBadge';

describe('WoundsBadge — rendu unique des Blessures', () => {
  it('affiche TOUJOURS courant/max (jamais le max seul)', () => {
    const html = renderToStaticMarkup(<WoundsBadge wounds={{ current: 8, max: 12 }} />);
    expect(html).toContain('8/12');
    expect(html).toContain('wounds-badge');
    expect(html).toContain('<svg'); // icône resource/wounds du registre
  });

  it('à pleine santé aussi : courant/max (l’unité est le composant)', () => {
    const html = renderToStaticMarkup(<WoundsBadge wounds={{ current: 12, max: 12 }} />);
    expect(html).toContain('12/12');
  });
});
