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
import { CODEX, CODEX_GROUPS, categoriesIn, categoryByKey, clustersIn, codexItemKey, codexLookup, useCodexVersion, type CodexCategory, type CodexGroup, type CodexItem } from './registry';
import { filterItems, facetValues, type FacetSelection } from './search';
import { CodexEntry } from './CodexEntry';
import { CodexEdit, isEditableCategory } from './CodexEdit';
import { useAtelierMode, setAtelierMode } from './atelierMode';
import { Icon } from '../Icon';
import { MasterDetail } from '../MasterDetail';
import { OptionChooser, type RollOption } from '../OptionChooser';

export interface CodexFocus { category: string; label: string; instance?: string }

/** Clé de navigation d'un `CodexFocus` (venu du store, encore label-only — LOT B) : résout l'id
 *  RÉEL de la cible via `codexLookup` (repli de compat), puis compose `codexItemKey`. */
const focusItemKey = (focus: CodexFocus | null | undefined): string | null => {
  if (!focus) return null;
  const id = codexLookup(focus.category, focus.label)?.id;
  return id != null ? codexItemKey(focus.category, id) : null;
};

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
  const [picked, setPicked] = useState<string | null>(focusItemKey(focus));
  const [q, setQ] = useState('');
  const [facetSel, setFacetSel] = useState<FacetSelection>({});
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  // Mode ATELIER (édition des fiches) : bascule persistante et découvrable — l'éditabilité est un pilier
  // produit, jamais derrière un flag de build. OFF par défaut : la vue joueur n'expose aucune affordance DEV.
  const atelier = useAtelierMode();

  // Un clic de cross-référence (ou une ouverture externe) change `compendiumFocus` alors que
  // l'écran est DÉJÀ monté → on s'y déplace (les initialiseurs useState ne re-lisent pas le focus).
  useEffect(() => {
    if (!focus) return;
    const fc = categoryByKey(focus.category);
    if (!fc) return;
    setGroup(fc.group);
    setCatKey(fc.key);
    setPicked(focusItemKey(focus));
    setQ('');
    setFacetSel({}); // une facette cochée pourrait masquer l'entrée ciblée
  }, [focus]);

  // Fraîcheur : re-rend (et invalide les memos sur `cat.items`) après un persist de `CodexEdit`
  // (`invalidateCodexLookup` → les getters `items`/`facets` re-projettent la donnée persistée).
  const version = useCodexVersion();
  const cats = useMemo(() => categoriesIn(group), [group]);
  // Barre de catégories : pastilles À PLAT + sous-groupes repliables (`cluster`) — anti-avalanche
  // des familles touffues (Effets/Tables). Ordre de déclaration préservé (`clustersIn`).
  const { flat: flatCats, clusters } = useMemo(() => clustersIn(group), [group]);
  const cat = categoryByKey(catKey) ?? cats[0];
  // Clé de navigation d'une entrée = identité qualifiée `category+id` (`codexItemKey`), jamais le label nu.
  const itemKey = (it: CodexItem): string => codexItemKey(cat?.key ?? '', it.id);
  const focusKey = focusItemKey(focus);
  // Repli par cluster : fermé par défaut ; s'ouvre si la catégorie active y vit (arrivée par cross-réf),
  // ou selon le dernier toggle utilisateur (mémorisé par nom, tant que l'écran est monté).
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
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
  const selected = list.find((it) => itemKey(it) === picked) ?? list[0] ?? null;
  // Instance paramétrée du lien d'ouverture (« 8 Tentacules +8 ») — seulement sur l'entrée ciblée.
  const instance = selected && focus?.instance && itemKey(selected) === focusKey ? focus.instance : undefined;
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

  const renderChip = (c: CodexCategory) => (
    <button key={c.key} className={`chip codex-cat${c.key === catKey ? ' on' : ''}`} onClick={() => pickCat(c.key)}>
      {c.label}
      <span className="count">{c.items.length}</span>
    </button>
  );

  const renderRow = (it: CodexItem, key: string) => (
    <button
      key={key}
      className={`listrow codex-row${selected && itemKey(selected) === itemKey(it) ? ' on' : ''}`}
      onClick={() => setPicked(itemKey(it))}
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
        <h1 className="codex-h1"><Icon id="nav/compendium" size="sm" /> Compendium</h1>
        <div className="codex-groups">
          <OptionChooser
            layout="seg"
            options={CODEX_GROUPS.map((g): RollOption => ({ key: g, label: g, selected: g === group, onSelect: () => pickGroup(g) }))}
          />
        </div>
        {/* Bascule ATELIER (édition des fiches) — composée sur la primitive `.btn` (état ON = `.btn-primary`,
            `aria-pressed`). Découvrable, sobre ; désactiver ferme toute édition en cours. */}
        <button
          className={`btn small${atelier ? ' btn-primary' : ''}`}
          aria-pressed={atelier}
          onClick={() => { if (atelier) { setEditing(false); setCreating(false); } setAtelierMode(!atelier); }}
          title="Mode atelier : éditer les fiches du Compendium"
        >
          <Icon id="ui/edit" size="sm" /> Atelier
        </button>
        {/* En modale : fermeture à droite, dans le même langage de bouton que le reste (.btn small). */}
        {onClose && <button className="btn small" onClick={close} aria-label="Fermer le Compendium" title="Fermer">✕</button>}
      </header>

      <div className="row-flex codex-cats">
        {flatCats.map(renderChip)}
        {clusters.map((cl) => {
          const hasActive = cl.cats.some((c) => c.key === catKey);
          const open = manualOpen[cl.name] ?? hasActive;
          return (
            <details
              key={cl.name}
              className="fold"
              style={{ flexBasis: '100%' }}
              open={open}
              onToggle={(e) => setManualOpen((m) => ({ ...m, [cl.name]: e.currentTarget.open }))}
            >
              <summary>
                <span className="fold-title">{cl.name}</span>
                <span className="count">{cl.cats.length}</span>
              </summary>
              <div className="fold-body row-flex codex-cats">{cl.cats.map(renderChip)}</div>
            </details>
          );
        })}
      </div>

      <MasterDetail
        className="codex-md"
        listLabel="Entrées du Codex"
        list={
          <div className="codex-aside panel flush">
            {/* Réf de source de la CATÉGORIE (table entière) — hors du libellé JOUEUR, en chip discret. */}
            {cat?.sourceRef && (
              <div className="codex-facets">
                <span className="codex-facet-label section-label">Source</span>
                <span className="codex-src">{cat.sourceRef}</span>
              </div>
            )}
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
          </div>
        }
        detail={
          <section className="codex-detail panel">
            {atelier && cat && isEditableCategory(cat.key) && !creating && (
              <div className="codex-detail-actions">
                {selected && (
                  <button className="btn small" onClick={() => setEditing((v) => !v)}>
                    {editing ? '↩︎ Voir la fiche' : <><Icon id="ui/edit" size="sm" /> Éditer</>}
                  </button>
                )}
                <button className="btn small" onClick={() => { setEditing(false); setCreating(true); }}><Icon id="ui/add" size="sm" /> Nouveau</button>
              </div>
            )}
            {creating && atelier && cat && isEditableCategory(cat.key)
              ? <CodexEdit categoryKey={cat.key} label="" isNew onClose={() => setCreating(false)} />
              : selected && editing && atelier && cat && isEditableCategory(cat.key)
                ? <CodexEdit categoryKey={cat.key} label={selected.label} onClose={() => setEditing(false)} />
                : selected && <CodexEntry item={selected} instance={instance} category={cat?.key} />}
          </section>
        }
      />
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
