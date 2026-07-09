/**
 * Bandeau d'objectif courant (#238) : rendu statique pour 0 / 1 / N objectifs — le HUD affiche le plus
 * RÉCENT (dernier de la pile) et compte les autres (dépliables).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ObjectiveBanner } from './ObjectiveBanner';

describe('ObjectiveBanner', () => {
  it('pile vide → aucun rendu', () => {
    expect(renderToStaticMarkup(<ObjectiveBanner objectives={[]} />)).toBe('');
  });

  it('un objectif → son texte, sans compteur', () => {
    const html = renderToStaticMarkup(<ObjectiveBanner objectives={[{ id: 'a', text: 'Trouver Gustav' }]} />);
    expect(html).toContain('Trouver Gustav');
    expect(html).not.toContain('objective-count');
  });

  it('plusieurs → le plus récent affiché + compteur du reste', () => {
    const html = renderToStaticMarkup(
      <ObjectiveBanner objectives={[{ id: 'a', text: 'Ancien' }, { id: 'b', text: 'Récent' }]} />,
    );
    expect(html).toContain('Récent');
    expect(html).not.toContain('Ancien'); // replié par défaut
    expect(html).toContain('+1');
  });
});
