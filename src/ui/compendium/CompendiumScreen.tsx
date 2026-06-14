/**
 * Écran Codex — référentiel browsable des règles/lore (pièce maîtresse).
 * Master-détail : familles (onglets `.seg`) → catégories (pastilles `.chip` + `.count`) →
 * liste (groupée si hiérarchie : Classe→Carrières, famille→Races, dossier→Créatures…) → fiche
 * RICHE (`CodexEntry` : sections + liens cross-réf). Ouverture ciblée via `store.openCodex(...)`,
 * qui porte aussi l'« instance » paramétrée (« 8 Tentacules +8 ») montrée en tête de fiche.
 */
import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../state/store';
import { CODEX, CODEX_GROUPS, categoriesIn, categoryByKey, type CodexGroup, type CodexItem } from './registry';
import { filterItems } from './search';
import { CodexEntry } from './CodexEntry';
import { CodexEdit, editableDataset } from './CodexEdit';

export function CompendiumScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const focus = useGame((s) => s.compendiumFocus);
  const back = useGame((s) => s.compendiumReturn);

  // État initial : si on a été ouvert sur une entrée précise, s'y poser ; sinon 1re catégorie.
  const initialCat = (focus && categoryByKey(focus.category)) || CODEX[0];
  const [group, setGroup] = useState<CodexGroup>(initialCat.group);
  const [catKey, setCatKey] = useState<string>(initialCat.key);
  const [picked, setPicked] = useState<string | null>(focus?.label ?? null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(false);

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
  }, [focus]);

  const cats = useMemo(() => categoriesIn(group), [group]);
  const cat = categoryByKey(catKey) ?? cats[0];
  const list = useMemo(() => filterItems(cat?.items ?? [], q), [cat, q]);
  // Jamais d'état vide : à défaut de sélection valide dans la liste filtrée, on montre la 1re.
  const selected = list.find((it) => it.label === picked) ?? list[0] ?? null;
  // Instance paramétrée du lien d'ouverture (« 8 Tentacules +8 ») — seulement sur l'entrée ciblée.
  const instance = selected && focus?.instance && selected.label === focus.label ? focus.instance : undefined;
  // Revenir en mode lecture dès qu'on change d'entrée ou de catégorie (édition DEV ponctuelle).
  useEffect(() => setEditing(false), [selected?.label, cat?.key]);

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
  };
  const pickCat = (key: string) => {
    setCatKey(key);
    setPicked(null);
    setQ('');
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
        <button className="btn small" onClick={() => setScreen(back)}>← Retour</button>
        <h1 className="codex-h1">📖 Compendium</h1>
        <div className="seg codex-groups">
          {CODEX_GROUPS.map((g) => (
            <button key={g} className={g === group ? 'on' : ''} onClick={() => pickGroup(g)}>{g}</button>
          ))}
        </div>
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
          {selected && import.meta.env.DEV && cat && editableDataset(cat.key) && (
            <div className="codex-detail-actions">
              <button className="btn small" onClick={() => setEditing((v) => !v)}>
                {editing ? '↩︎ Voir la fiche' : '✏️ Éditer (DEV)'}
              </button>
            </div>
          )}
          {selected && editing && import.meta.env.DEV && cat && editableDataset(cat.key)
            ? <CodexEdit categoryKey={cat.key} label={selected.label} onClose={() => setEditing(false)} />
            : selected && <CodexEntry item={selected} instance={instance} category={cat?.key} />}
        </section>
      </div>
    </div>
  );
}
