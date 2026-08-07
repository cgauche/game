/**
 * Bandeau d'objectif courant (#238) : rendu statique pour 0 / 1 / N objectifs — le HUD affiche le plus
 * RÉCENT (dernier de la pile) et compte les autres (dépliables).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ObjectiveBanner } from './ObjectiveBanner';

describe('ObjectiveBanner', () => {
  it('pile vide → aucun rendu', () => {
    expect(renderToStaticMarkup(<ObjectiveBanner objectives={[]} now={0} />)).toBe('');
  });

  it('un objectif → son texte, sans compteur', () => {
    const html = renderToStaticMarkup(<ObjectiveBanner objectives={[{ id: 'a', text: 'Trouver Gustav' }]} now={0} />);
    expect(html).toContain('Trouver Gustav');
    expect(html).not.toContain('objective-count');
  });

  it('plusieurs → le plus récent affiché + compteur du reste', () => {
    const html = renderToStaticMarkup(
      <ObjectiveBanner objectives={[{ id: 'a', text: 'Ancien' }, { id: 'b', text: 'Récent' }]} now={0} />,
    );
    expect(html).toContain('Récent');
    expect(html).not.toContain('Ancien'); // replié par défaut
    expect(html).toContain('+1');
  });

  it('plusieurs → l’en-tête reste un bouton dépliable annoncé', () => {
    const html = renderToStaticMarkup(
      <ObjectiveBanner objectives={[{ id: 'a', text: 'Ancien' }, { id: 'b', text: 'Récent' }]} now={0} />,
    );
    expect(html).toMatch(/<button[^>]*class="objective-head"/);
    expect(html).toContain('aria-expanded="false"');
  });

  it('un seul objectif → la tête n’est PAS un contrôle (aucun bouton, aucun dépliage annoncé)', () => {
    const html = renderToStaticMarkup(<ObjectiveBanner objectives={[{ id: 'a', text: 'Seul' }]} now={0} />);
    expect(html).not.toContain('<button');
    expect(html).not.toContain('aria-expanded');
    expect(html).toContain('class="objective-head"'); // la tête reste rendue, en surface inerte
  });

  it('deadline posée → puce de compte à rebours', () => {
    const html = renderToStaticMarkup(
      <ObjectiveBanner objectives={[{ id: 'a', text: 'Empêcher le rituel', deadline: 2800 }]} now={800} />,
    );
    expect(html).toContain('objective-deadline');
    expect(html).toContain('J-2'); // 2000 min restantes → ceil(2000/1440) = 2
  });

  it('deadline dépassée → « échéance atteinte »', () => {
    const html = renderToStaticMarkup(
      <ObjectiveBanner objectives={[{ id: 'a', text: 'Empêcher le rituel', deadline: 100 }]} now={800} />,
    );
    expect(html).toContain('échéance atteinte');
  });
});
