/** Recherche du Codex — filtre substring insensible à la casse ET aux accents, + FACETTES
 *  (chips multi-sélection par catégorie : livre source, classe/famille/dossier…). Pur, testé. */
import type { CodexItem, CodexFacet } from './registry';

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

/** Sélection de facettes : clé de facette → valeurs cochées (vide/absente = facette inactive). */
export type FacetSelection = Record<string, string[]>;

/** Vrai si l'item passe TOUTES les facettes actives (multi-sélection = OU à l'intérieur d'une
 *  facette, ET entre facettes). Un item SANS valeur est écarté par une facette active. */
export function facetMatch(item: CodexItem, facets: CodexFacet[], sel: FacetSelection): boolean {
  for (const f of facets) {
    const picked = sel[f.key];
    if (!picked?.length) continue;
    const v = f.valueOf(item);
    if (!v || !picked.includes(v)) return false;
  }
  return true;
}

/** Valeurs d'une facette DÉRIVÉES des items (jamais une liste en dur), avec compte, triées FR. */
export function facetValues(items: CodexItem[], facet: CodexFacet): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const v = facet.valueOf(it);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, 'fr'));
}

export const filterItems = (items: CodexItem[], term: string, facets: CodexFacet[] = [], sel: FacetSelection = {}): CodexItem[] =>
  items.filter((it) => codexMatch(it, term) && facetMatch(it, facets, sel));
