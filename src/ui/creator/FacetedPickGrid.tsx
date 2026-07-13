/**
 * Grille de sélection FACETTÉE du créateur (arbitrage 2026-07-13) — remplace le rail-ascenseur des
 * étapes Race/Carrière (Zone A) : facettes en `<Tabs>` (famille de race, classe sociale — dérivées de
 * la donnée) + grille de cartes qui tient SANS scroll ; `SearchFilterField` optionnelle court-circuite
 * les facettes (grille de tous les résultats). Un tirage/choix qui pose une sélection dans une AUTRE
 * facette bascule la facette active — la carte tirée redevient visible et active (d100 → sélection).
 *
 * Widget listbox mono-sélection : roving tabindex (flèches/Home/End, selection-follows-focus, patron
 * `<Tabs>`), `role="option"` + `aria-selected`. Composé des primitives Tabs/SearchFilterField.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Tabs } from '../Tabs';
import { SearchFilterField, filterByLabel } from '../SearchFilterField';

export interface PickCard {
  id: string;
  /** Facette d'appartenance (id de famille / de classe). */
  group: string;
  /** Texte de recherche/nom accessible complet (jamais tronqué). */
  label: string;
  /** Titre affiché (tronqué par CSS si trop long — le nom complet vit dans `label`/le détail). */
  title: ReactNode;
  /** Trait d'identité court (mouvement, statut…). */
  sub?: ReactNode;
}

export function FacetedPickGrid({
  cards,
  groups,
  selectedId,
  onSelect,
  label,
  searchable = false,
  searchPlaceholder,
}: {
  cards: PickCard[];
  /** Facettes ORDONNÉES (première = active par défaut hors sélection). */
  groups: { id: string; label: ReactNode }[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** `aria-label` du listbox et des onglets de facette. */
  label: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [search, setSearch] = useState('');
  const selGroup = cards.find((c) => c.id === selectedId)?.group;
  const [facet, setFacet] = useState<string>(selGroup ?? groups[0]?.id ?? '');
  // Sélection posée dans une autre facette (d100, choix libre) → on suit. Ne se déclenche QUE sur
  // changement de sélection : changer manuellement de facette (sans re-sélectionner) n'est pas annulé.
  useEffect(() => {
    if (selGroup) setFacet(selGroup);
  }, [selGroup]);

  const q = search.trim();
  const searching = searchable && q.length > 0;
  const visible = searching ? filterByLabel(cards, (c) => c.label, q) : cards.filter((c) => c.group === facet);

  const activeIdx = visible.findIndex((c) => c.id === selectedId);
  const rovingIdx = activeIdx >= 0 ? activeIdx : 0;
  const gridRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    if (!visible.length) return;
    e.preventDefault();
    const delta = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? visible.length - 1 : (rovingIdx + delta + visible.length) % visible.length;
    onSelect(visible[next].id); // selection-follows-focus (patron Tabs)
    gridRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[next]?.focus();
  };

  return (
    <div className="pick-facets">
      {searchable && (
        <SearchFilterField value={search} onChange={setSearch} icon placeholder={searchPlaceholder} ariaLabel={searchPlaceholder ?? label} />
      )}
      {!searching && groups.length > 1 && (
        <Tabs variant="sub" tabs={groups.map((g) => ({ key: g.id, label: g.label }))} active={facet} onChange={setFacet} label={label} />
      )}
      <div ref={gridRef} role="listbox" aria-label={label} className="pick-grid" onKeyDown={onKeyDown}>
        {visible.map((c, i) => (
          <div
            key={c.id}
            role="option"
            aria-selected={c.id === selectedId}
            aria-label={c.label}
            tabIndex={i === rovingIdx ? 0 : -1}
            title={c.label}
            className={`pick-card${c.id === selectedId ? ' selected' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <span className="pick-card-body">
              <strong>{c.title}</strong>
              {c.sub != null && <em>{c.sub}</em>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
