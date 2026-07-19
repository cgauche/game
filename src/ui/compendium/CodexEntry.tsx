/** Rendu d'une fiche du Codex (détail) : en-tête + faits + prose + SECTIONS riches (statbloc,
 *  niveaux de carrière, bénédictions…) dont les entités citées sont des liens `CodexRef`. */
import type { CodexItem, CodexRow, CodexSection } from './registry';
import { EntityRef, ChoiceChips } from '../EntityChip';
import { CodexRef } from './CodexRef';
import { CreaturePreview } from './CreaturePreview';
import { TabbedEntry, type EntryTab } from '../TabbedEntry';
import { OrnateFrame } from '../Ornaments';
import { ParchmentCard } from '../ParchmentCard';
import { Prose } from '../Prose';
import { uniqueSlugId } from '../../data/slug';

export function CodexSourceBadge({ source }: { source: CodexItem['source'] }) {
  if (!source) return null;
  return (
    <span className="codex-src" title={`${source.book} page ${source.page}`}>
      {source.book} p.{source.page}
    </span>
  );
}

function CodexRowView({ row }: { row: CodexRow }) {
  switch (row.t) {
    case 'sub':
      return <div className="codex-rowsub">{row.label}</div>;
    case 'kv':
      return (
        <div className="codex-kv">
          <span className="ck-k">{row.kref ? <CodexRef category={row.kref.category} id={row.kref.id} label={row.kref.label}>{row.k}</CodexRef> : row.k}</span>
          <span className="ck-v">{row.v}</span>
        </div>
      );
    case 'text':
      return <div className="codex-rowtext"><Prose md={row.text} /></div>;
    case 'ref':
      return <EntityRef category={row.category} id={row.id} label={row.label} show={row.show} instance={row.show} badge={row.badge} />;
    case 'choice':
      // « A ou B » : rendu via la brique PARTAGÉE (identique partout — Codex et écrans).
      return <ChoiceChips category={row.category} options={row.options} />;
    case 'fold':
      // Dépliable CANONIQUE (`.fold`, cf. components.css) : forme technique d'atelier sous la phrase humaine.
      return (
        <details className="fold codex-fold">
          <summary><span className="fold-title">{row.summary}</span></summary>
          <div className="fold-body"><Prose md={row.text} /></div>
        </details>
      );
    case 'nb':
      return <em className="nb">{row.text}</em>;
  }
}

function CodexSectionView({ section }: { section: CodexSection }) {
  return (
    <section className="codex-sec">
      <h3 className="codex-sec-title section-label">{section.title}</h3>
      <div className={`codex-sec-body codex-${section.layout ?? 'list'}`}>
        {section.rows.map((row, i) => (
          <CodexRowView key={i} row={row} />
        ))}
      </div>
    </section>
  );
}

/** Rendu PARTAGÉ d'une liste de sections (fiche Codex ET statbloc d'inspection en combat). */
export function CodexSections({ sections }: { sections: CodexSection[] }) {
  return (
    <>
      {sections.map((sec, i) => (
        <CodexSectionView key={i} section={sec} />
      ))}
    </>
  );
}

export function CodexEntry({ item, instance, category }: { item: CodexItem; instance?: string; category?: string }) {
  // ONGLETS data-driven : CHAQUE section de la fiche (statbloc, compétences, niveaux de carrière,
  // bénédictions…) devient un onglet → les onglets reflètent les données PROPRES de l'entité (une
  // créature, un sort et une race n'exposent pas les mêmes). La CHARTE (figurine + onglets) est, elle,
  // partagée avec le créateur via `TabbedEntry` — on ne se perd pas d'une fiche à l'autre.
  // `id` d'onglet STABLE = slug du titre (identité sémantique invariante d'une fiche à l'autre) : le
  // même onglet reste ouvert en feuilletant (« Caractéristiques »), par simple égalité d'id côté TabbedEntry.
  const tabIds = new Set<string>();
  const tabs: EntryTab[] = item.tabs
    ? // Regroupement EXPLICITE (ex. race : Profil bundle carac+compétences+talents) → sections avec titre.
      item.tabs.map((t) => ({
        id: uniqueSlugId(t.title, tabIds),
        label: t.title,
        content: (
          <div className="codex-tabpane">
            <CodexSections sections={t.sections} />
          </div>
        ),
      }))
    : // Sinon : UN onglet par section (corps seul, le libellé d'onglet porte déjà le titre).
      (item.sections ?? []).map((sec) => ({
        id: uniqueSlugId(sec.title, tabIds),
        label: sec.title,
        content: (
          <div className={`codex-tabpane codex-sec-body codex-${sec.layout ?? 'list'}`}>
            {sec.rows.map((row, j) => (
              <CodexRowView key={j} row={row} />
            ))}
          </div>
        ),
      }));
  if (item.desc) {
    tabs.push({
      id: 'desc',
      label: 'Description',
      content: (
        <div className="codex-tabpane codex-body"><Prose md={item.desc} selfLabel={item.label} selfId={item.id} selfCategory={category} /></div>
      ),
    });
  }

  // Faits-clés : TOUJOURS visibles dans l'en-tête (jamais cachés derrière un onglet).
  const meta =
    item.meta && item.meta.length > 0 ? (
      <div className="row-flex codex-meta">
        {item.meta.map((m) => (
          <span key={m.label} className="stat-chip codex-fact">
            <span className="sc-label" title={m.label}>{m.label}</span>
            <span className="sc-value">{m.value}</span>
          </span>
        ))}
      </div>
    ) : undefined;

  return (
    <article className="codex-entry">
      {instance && instance !== item.label && (
        <div className="codex-instance">
          Cette occurrence : <b>{instance}</b>
        </div>
      )}
      {/* PAS de `key={item.label}` : TabbedEntry conserve l'onglet actif (par nom) au changement de fiche. */}
      <TabbedEntry
        figure={item.appearance ? <OrnateFrame className="codex-figure"><CreaturePreview label={item.previewRef ?? item.label} appearance={item.appearance} /></OrnateFrame> : undefined}
        title={item.label}
        aside={item.source ? <CodexSourceBadge source={item.source} /> : undefined}
        blurb={item.sub}
        meta={meta}
        tabs={tabs}
        band={item.exergue ? (
          // Exergue en tête de fiche (bande parchemin) : la citation/tract qui « vend » l'entité, mise
          // en avant plutôt que noyée dans la prose. Réutilise la primitive `ParchmentCard`.
          <ParchmentCard><Prose md={item.exergue} /></ParchmentCard>
        ) : item.statblock && (
          <div className="codex-statblock tx-parchment">
            <table className="codex-statblock-profile">
              <thead>
                <tr>
                  {item.statblock.profile.map((f) => (
                    <th key={f.label}>{f.kref ? <CodexRef category={f.kref.category} id={f.kref.id} label={f.kref.label}>{f.label}</CodexRef> : f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody><tr>{item.statblock.profile.map((f) => <td key={f.label}>{f.value}</td>)}</tr></tbody>
            </table>
            {item.statblock.traits.length > 0 && (
              <div className="codex-sec-body codex-chips">
                {item.statblock.traits.map((row, i) => <CodexRowView key={i} row={row} />)}
              </div>
            )}
          </div>
        )}
      />
    </article>
  );
}
