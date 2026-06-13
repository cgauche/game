/** Recherche du Codex — filtre substring insensible à la casse ET aux accents. Pur, testé. */
import type { CodexItem } from './registry';

export const deburr = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Vrai si `term` (vide = tout) apparaît dans le libellé, le sous-titre ou le corps. */
export function codexMatch(item: CodexItem, term: string): boolean {
  const t = deburr(term.trim());
  if (!t) return true;
  return (
    deburr(item.label).includes(t) ||
    (item.sub != null && deburr(item.sub).includes(t)) ||
    (item.desc != null && deburr(item.desc).includes(t))
  );
}

export const filterItems = (items: CodexItem[], term: string): CodexItem[] =>
  items.filter((it) => codexMatch(it, term));
