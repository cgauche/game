/**
 * Primitive `<Prose>` : rend le Markdown des descriptions (règle 5), neutralise le HTML brut, et
 * auto-lie le vocabulaire de règles en `CodexRef`. `mdToText` en extrait un texte brut (tooltips).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Prose, mdToText } from './Prose';

describe('Prose — rendu Markdown', () => {
  it('rend gras / italique', () => {
    const html = renderToStaticMarkup(<Prose md="**gras** et *ital*." />);
    expect(html).toContain('<strong>gras</strong>');
    expect(html).toContain('<em>ital</em>');
  });

  it('sépare les paragraphes (`\\n\\n`)', () => {
    const html = renderToStaticMarkup(<Prose md={'Premier.\n\nSecond.'} />);
    expect(html.match(/<p>/g)?.length).toBe(2);
  });

  it('NEUTRALISE le HTML brut (pas de dangerouslySetInnerHTML)', () => {
    const html = renderToStaticMarkup(<Prose md={'<script>alert(1)</script> texte'} />);
    expect(html).not.toContain('<script>');
    expect(html).toContain('texte');
  });

  it('auto-lie le vocabulaire de règles en CodexRef', () => {
    const html = renderToStaticMarkup(<Prose md="Un test d'Esquive en combat." />);
    expect(html).toContain('codex-ref');
    expect(html).toContain('Esquive');
  });

  it("n'auto-lie pas vers soi (selfLabel)", () => {
    const html = renderToStaticMarkup(<Prose md="La compétence Esquive." selfLabel="Esquive" />);
    expect(html).not.toContain('codex-ref');
  });
});

describe('mdToText — Markdown → texte brut', () => {
  it('retire les marqueurs d\'emphase et normalise les espaces', () => {
    expect(mdToText('**a** *b*\n\nc')).toBe('a b c');
  });
  it('réduit un lien à son texte', () => {
    expect(mdToText('voir [la règle](http://x) ici')).toBe('voir la règle ici');
  });
});
