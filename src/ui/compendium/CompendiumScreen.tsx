/**
 * Écran Codex — référentiel browsable des règles/lore (pièce maîtresse).
 * Master-détail : familles (onglets `.seg`) → catégories (pastilles `.chip` + `.count`) →
 * liste (groupée si hiérarchie : Classe→Carrières, famille→Races, dossier→Créatures…) → fiche
 * RICHE (`CodexEntry` : sections + liens cross-réf). Ouverture ciblée via `store.openCodex(...)`,
 * qui porte aussi l'« instance » paramétrée (« 8 Tentacules +8 ») montrée en tête de fiche.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../state/store';
import { useModalA11y } from '../Modal';
import { CODEX, CODEX_GROUPS, categoriesIn, categoryByKey, useCodexVersion, type CodexGroup, type CodexItem } from './registry';
import { filterItems, facetValues, type FacetSelection } from './search';
import { CodexEntry } from './CodexEntry';
import { CodexEdit, isEditableCategory } from './CodexEdit';

export interface CodexFocus { category: string; label: string; instance?: string }

export function CompendiumScreen({ focus: focusProp, onClose }: { focus?: CodexFocus | null; onClose?: () => void } = {}) {
  const setScreen = useGame((s) => s.setScreen);
  const focusStore = useGame((s) => s.compendiumFocus);
  const back = useGame((s) => s.compendiumReturn);
  // En MODALE (drill-in : `focusProp`/`onClose` fournis) le focus et la fermeture viennent des props ;
  // en ÉCRAN plein (depuis le menu) ils viennent du store.
  const focus = focusProp !== undefined ? focusProp : focusStore;
  const close = onClose ?? (() => setScreen(back));

  // État initial : si on a été ouvert sur une entrée précise, s'y poser ; sinon 1re catégorie.
  const initialCat = (focus && categoryByKey(focus.category)) || CODEX[0];
  const [group, setGroup] = useState<CodexGroup>(initialCat.group);
  const [catKey, setCatKey] = useState<string>(initialCat.key);
  const [picked, setPicked] = useState<string | null>(focus?.label ?? null);
  const [q, setQ] = useState('');
  const [facetSel, setFacetSel] = useState<FacetSelection>({});
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);

  // Un clic de cross-référence (ou une ouverture externe) change `compendiumFocus` alors que
  // l'écran est DÉJÀ monté → on s'y déplace (les initialiseurs useState ne re-lisent pas le focus).
  useEffect(() => {
    if (!focus) return;
    const fc = categoryByKey(focus.category);
    if (!fc) return;
    setGroup(fc.group);
    setCatKey(fc.key);
    setPicked(focus.label);
    setQ('');
    setFacetSel({}); // une facette cochée pourrait masquer l'entrée ciblée
  }, [focus]);

  // Fraîcheur : re-rend (et invalide les memos sur `cat.items`) après un persist de `CodexEdit`
  // (`invalidateCodexLookup` → les getters `items`/`facets` re-projettent la donnée persistée).
  const version = useCodexVersion();
  const cats = useMemo(() => categoriesIn(group), [group]);
  const cat = categoryByKey(catKey) ?? cats[0];
  const list = useMemo(() => filterItems(cat?.items ?? [], q, cat?.facets ?? [], facetSel), [cat, q, facetSel, version]);
  // Facettes de la catégorie : valeurs dérivées des items, avec COMPTEUR LIVE — chaque compte est
  // calculé sous la recherche + les AUTRES facettes (faceting standard) ; une facette à valeur
  // unique n'apporte rien → masquée.
  const facetRows = useMemo(
    () =>
      (cat?.facets ?? [])
        .map((facet) => ({
          facet,
          values: facetValues(filterItems(cat!.items, q, cat!.facets ?? [], { ...facetSel, [facet.key]: [] }), facet),
        }))
        .filter((r) => r.values.length > 1),
    [cat, q, facetSel, version],
  );
  const toggleFacet = (key: string, value: string) =>
    setFacetSel((s) => {
      const cur = s[key] ?? [];
      return { ...s, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
  // Jamais d'état vide : à défaut de sélection valide dans la liste filtrée, on montre la 1re.
  const selected = list.find((it) => it.label === picked) ?? list[0] ?? null;
  // Instance paramétrée du lien d'ouverture (« 8 Tentacules +8 ») — seulement sur l'entrée ciblée.
  const instance = selected && focus?.instance && selected.label === focus.label ? focus.instance : undefined;
  // Revenir en mode lecture dès qu'on change d'entrée ou de catégorie (édition DEV ponctuelle).
  useEffect(() => setEditing(false), [selected?.label, cat?.key]);
  useEffect(() => setCreating(false), [cat?.key]); // abandonner la création en changeant de catégorie

  // Hiérarchie (Axe 3) : groupe les entrées si la catégorie en porte (famille/classe/dossier/parent).
  const grouped = useMemo(() => {
    if (!list.some((it) => it.group)) return null;
    const map = new Map<string, CodexItem[]>();
    for (const it of list) {
      const g = it.group ?? '—';
      const arr = map.get(g) ?? [];
      arr.push(it);
      map.set(g, arr);
    }
    return [...map.entries()];
  }, [list]);

  const pickGroup = (g: CodexGroup) => {
    setGroup(g);
    setCatKey(categoriesIn(g)[0]?.key);
    setPicked(null);
    setQ('');
    setFacetSel({});
  };
  const pickCat = (key: string) => {
    setCatKey(key);
    setPicked(null);
    setQ('');
    setFacetSel({});
  };

  const renderRow = (it: CodexItem, key: string) => (
    <button
      key={key}
      className={`listrow codex-row${selected?.label === it.label ? ' on' : ''}`}
      onClick={() => setPicked(it.label)}
    >
      <span className="lr-name">{it.label}</span>
      {it.source && <span className="codex-row-src">{it.source.book}</span>}
    </button>
  );

  return (
    <div className="screen codex">
      <header className="codex-top">
        {/* Plein écran : « ← Retour » (navigation). En modale, la fermeture est le ✕ en haut à droite. */}
        {!onClose && <button className="btn small" onClick={close}>← Retour</button>}
        <h1 className="codex-h1">📖 Compendium</h1>
        <div className="seg codex-groups">
          {CODEX_GROUPS.map((g) => (
            <button key={g} className={g === group ? 'on' : ''} onClick={() => pickGroup(g)}>{g}</button>
          ))}
        </div>
        {/* En modale : fermeture à droite, dans le même langage de bouton que le reste (.btn small). */}
        {onClose && <button className="btn small" onClick={close} aria-label="Fermer le Compendium" title="Fermer">✕</button>}
      </header>

      <div className="row-flex codex-cats">
        {cats.map((c) => (
          <button key={c.key} className={`chip codex-cat${c.key === catKey ? ' on' : ''}`} onClick={() => pickCat(c.key)}>
            {c.label}
            <span className="count">{c.items.length}</span>
          </button>
        ))}
      </div>

      <div className="codex-grid">
        <aside className="codex-aside panel flush">
          {facetRows.map(({ facet, values }) => (
            <div className="codex-facets" key={facet.key}>
              <span className="codex-facet-label section-label">{facet.label}</span>
              {values.map(({ value, count }) => {
                const on = (facetSel[facet.key] ?? []).includes(value);
                return (
                  <button key={value} className={`chip codex-facet${on ? ' on' : ''}`} onClick={() => toggleFacet(facet.key, value)}>
                    {value}
                    <span className="count">{count}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <input
            className="codex-search"
            type="search"
            placeholder={`Rechercher dans ${cat?.label ?? ''}…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Rechercher dans le Codex"
          />
          <div className="codex-rows">
            {/* Liste TOUJOURS plate (aspect cohérent entre catégories) ; les hiérarchies n'ajoutent
                qu'un séparateur léger par groupe (muet, collant), pas une structure différente. */}
            {grouped
              ? grouped.flatMap(([g, items]) => [
                  <div key={`grp-${g}`} className="codex-grouplbl">
                    <span>{g}</span>
                    <span className="count">{items.length}</span>
                  </div>,
                  ...items.map((it, i) => renderRow(it, `${g}-${it.label}-${i}`)),
                ])
              : list.map((it, i) => renderRow(it, `${it.label}__${i}`))}
            {list.length === 0 && <div className="codex-noresult">Aucun résultat</div>}
          </div>
        </aside>

        <section className="codex-detail panel">
          {import.meta.env.DEV && cat && isEditableCategory(cat.key) && !creating && (
            <div className="codex-detail-actions">
              {selected && (
                <button className="btn small" onClick={() => setEditing((v) => !v)}>
                  {editing ? '↩︎ Voir la fiche' : '✏️ Éditer (DEV)'}
                </button>
              )}
              <button className="btn small" onClick={() => { setEditing(false); setCreating(true); }}>➕ Nouveau (DEV)</button>
            </div>
          )}
          {creating && import.meta.env.DEV && cat && isEditableCategory(cat.key)
            ? <CodexEdit categoryKey={cat.key} label="" isNew onClose={() => setCreating(false)} />
            : selected && editing && import.meta.env.DEV && cat && isEditableCategory(cat.key)
              ? <CodexEdit categoryKey={cat.key} label={selected.label} onClose={() => setEditing(false)} />
              : selected && <CodexEntry item={selected} instance={instance} category={cat?.key} />}
        </section>
      </div>
    </div>
  );
}

/** Drill-in d'une réf Codex EN JEU : la fiche s'ouvre en MODALE par-dessus la partie — l'écran,
 *  la musique et la fiche perso restent intacts derrière (cf. `openCodex`). Réutilise le voile
 *  `.modal-overlay` et l'a11y partagée `useModalA11y` (Échap ferme la modale du dessus, piège de
 *  focus) ; le contenu est le MÊME `CompendiumScreen` (zéro renderer dupliqué), paramétré par
 *  `focus`/`onClose`. */
export function CodexOverlay() {
  const focus = useGame((s) => s.codexOverlay);
  const close = useGame((s) => s.closeCodexOverlay);
  const boxRef = useRef<HTMLDivElement>(null);
  useModalA11y(boxRef, close);
  if (!focus) return null;
  return (
    <div className="modal-overlay" onClick={close}>
      <div ref={boxRef} role="dialog" aria-modal="true" className="modal codex-modal" onClick={(e) => e.stopPropagation()}>
        <CompendiumScreen focus={focus} onClose={close} />
      </div>
    </div>
  );
}
