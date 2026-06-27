import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CHAR_KEYS } from '../engine/types';
import { CharStatsGrid } from './CharStatsGrid';

/** Nombre d'éléments `class="stat"` EXACT (le parent), sans capter `stat-label`/`stat-val`. */
const countStatParents = (html: string) => (html.match(/class="stat"/g) ?? []).length;
const countCodexRefs = (html: string) => (html.match(/class="codex-ref/g) ?? []).length;

describe('CharStatsGrid (rendu — markup unifié .char-stats)', () => {
  it('rend exactement CHAR_KEYS.length rangées .stat, chacune avec un libellé CodexRef', () => {
    const html = renderToStaticMarkup(<CharStatsGrid value={(k) => k} />);
    expect(countStatParents(html)).toBe(CHAR_KEYS.length);
    // Chaque rangée : un .stat-label qui DÉLÈGUE au popover Codex de la caractéristique.
    expect(html).toContain('class="stat-label"');
    expect(countCodexRefs(html)).toBe(CHAR_KEYS.length);
    // Le texte de chaque clé (CC, CT, …) est rendu par le CodexRef.
    for (const k of CHAR_KEYS) expect(html).toContain(`>${k}</span>`);
  });

  it('value(k) apparaît dans .stat-val', () => {
    const html = renderToStaticMarkup(<CharStatsGrid value={(k) => `VAL_${k}`} />);
    for (const k of CHAR_KEYS) expect(html).toMatch(new RegExp(`<span class="stat-val"[^>]*>VAL_${k}</span>`));
  });

  it("valClass renvoie 'boost' → la classe est sur .stat-val", () => {
    const html = renderToStaticMarkup(<CharStatsGrid value={() => 42} valClass={() => 'boost'} />);
    expect(html).toContain('class="stat-val boost"');
    // jamais sur le libellé.
    expect(html).not.toContain('class="stat-label boost"');
  });

  it('note(k) est le title= de .stat-val, JAMAIS du .stat parent (anti double-tooltip)', () => {
    const html = renderToStaticMarkup(<CharStatsGrid value={(k) => k} note={(k) => `NOTE_${k}`} />);
    for (const k of CHAR_KEYS) expect(html).toMatch(new RegExp(`<span class="stat-val" title="NOTE_${k}">`));
    // Le .stat parent ne porte AUCUN title (ni l'ancien tooltip de rangée).
    expect(html).not.toMatch(/<div class="stat" title=/);
  });

  it('sans valClass ni note : .stat-val nu et .stat sans title', () => {
    const html = renderToStaticMarkup(<CharStatsGrid value={(k) => k} />);
    expect(html).toContain('class="stat-val"');
    expect(html).not.toMatch(/<div class="stat" title=/);
    expect(html).not.toMatch(/class="stat-val"[^>]*title=/);
  });

  it('className est ajoutée au conteneur .char-stats (parité sheet-stats)', () => {
    const html = renderToStaticMarkup(<CharStatsGrid className="sheet-stats" value={(k) => k} />);
    expect(html).toContain('class="char-stats sheet-stats"');
  });
});
