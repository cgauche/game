/**
 * Écran Codex — référentiel browsable des règles/lore (pièce maîtresse).
 * Master-détail : familles (onglets `.seg`) → catégories (pastilles `.chip` + `.count`) →
 * liste filtrée (`.listrow`) → fiche (`CodexEntry`). Responsive via `.layout-sidebar`.
 * Ouverture ciblée depuis n'importe quel écran via `store.openCodex({category,label})`.
 */
import { useMemo, useState } from 'react';
import { useGame } from '../../state/store';
import { CODEX, CODEX_GROUPS, categoriesIn, categoryByKey, type CodexGroup } from './registry';
import { filterItems } from './search';
import { CodexEntry } from './CodexEntry';

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

  const cats = useMemo(() => categoriesIn(group), [group]);
  const cat = categoryByKey(catKey) ?? cats[0];
  const list = useMemo(() => filterItems(cat?.items ?? [], q), [cat, q]);
  // Jamais d'état vide : à défaut de sélection valide dans la liste filtrée, on montre la 1re.
  const selected = list.find((it) => it.label === picked) ?? list[0] ?? null;

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
            {list.map((it, i) => (
              <button
                key={`${it.label}__${i}`}
                className={`listrow codex-row${selected?.label === it.label ? ' on' : ''}`}
                onClick={() => setPicked(it.label)}
              >
                <span className="lr-name">{it.label}</span>
                {it.source && <span className="codex-row-src">{it.source.book}</span>}
              </button>
            ))}
            {list.length === 0 && <div className="codex-noresult">Aucun résultat</div>}
          </div>
        </aside>

        <section className="codex-detail panel">
          {selected && <CodexEntry item={selected} />}
        </section>
      </div>
    </div>
  );
}
