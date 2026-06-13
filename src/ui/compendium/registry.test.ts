import { describe, it, expect } from 'vitest';
import { CODEX, CODEX_GROUPS, categoriesIn, categoryByKey, codexLookup } from './registry';
import { codexMatch, deburr } from './search';

describe('Codex registry', () => {
  it('a des catégories, toutes peuplées, à clés uniques', () => {
    expect(CODEX.length).toBeGreaterThan(0);
    const keys = CODEX.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of CODEX) expect(c.items.length).toBeGreaterThan(0);
  });

  it('chaque catégorie appartient à un groupe connu', () => {
    for (const c of CODEX) expect(CODEX_GROUPS).toContain(c.group);
  });

  it('categoriesIn / categoryByKey cohérents', () => {
    for (const g of CODEX_GROUPS) {
      for (const c of categoriesIn(g)) {
        expect(c.group).toBe(g);
        expect(categoryByKey(c.key)).toBe(c);
      }
    }
    expect(categoryByKey('inexistant')).toBeUndefined();
  });

  it('les entrées portent un libellé et, le plus souvent, une source', () => {
    for (const c of CODEX) for (const it of c.items) expect(it.label).toBeTruthy();
    const races = categoryByKey('races')!;
    expect(races.items.every((i) => i.source?.book)).toBe(true);
  });

  it('codexLookup résout exact + casse ignorée, undefined sinon', () => {
    const first = categoryByKey('etats')!.items[0];
    expect(codexLookup('etats', first.label)).toBe(first);
    expect(codexLookup('etats', first.label.toUpperCase())).toBe(first);
    expect(codexLookup('etats', 'libellé inexistant')).toBeUndefined();
    expect(codexLookup('categorie-inexistante', first.label)).toBeUndefined();
  });
});

describe('Codex search', () => {
  it('deburr retire accents + casse', () => {
    expect(deburr('Bénédiction')).toBe('benediction');
    expect(deburr('À Terre')).toBe('a terre');
  });

  it('terme vide = tout passe', () => {
    expect(codexMatch({ label: 'X' }, '')).toBe(true);
    expect(codexMatch({ label: 'X' }, '   ')).toBe(true);
  });

  it('match insensible casse/accents sur label, sub et desc', () => {
    const it = { label: 'Bénédiction de Chance', sub: 'Béni', desc: 'relancer un Test' };
    expect(codexMatch(it, 'benediction')).toBe(true);
    expect(codexMatch(it, 'CHANCE')).toBe(true);
    expect(codexMatch(it, 'beni')).toBe(true);
    expect(codexMatch(it, 'relancer')).toBe(true);
    expect(codexMatch(it, 'dragon')).toBe(false);
  });
});
