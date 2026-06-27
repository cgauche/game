/** Rendu d'une fiche du Codex (détail) : en-tête + faits + prose + SECTIONS riches (statbloc,
 *  niveaux de carrière, bénédictions…) dont les entités citées sont des liens `CodexRef`. */
import type { CodexItem, CodexRow, CodexSection } from './registry';
import { EntityRef, ChoiceChips } from '../EntityChip';
import { CodexRef } from './CodexRef';
import { CreaturePreview } from './CreaturePreview';
import { TabbedEntry, type EntryTab } from '../TabbedEntry';
import { Prose } from '../Prose';

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
          <span className="ck-k">{row.kref ? <CodexRef category={row.kref.category} label={row.kref.label}>{row.k}</CodexRef> : row.k}</span>
          <span className="ck-v">{row.v}</span>
        </div>
      );
    case 'text':
      return <div className="codex-rowtext"><Prose md={row.text} /></div>;
    case 'ref':
      return <EntityRef category={row.category} label={row.label} show={row.show} instance={row.show} badge={row.badge} />;
    case 'choice':
      // « A ou B » : rendu via la brique PARTAGÉE (identique partout — Codex et écrans).
      return <ChoiceChips category={row.category} options={row.options} />;
  }
}

function CodexSectionView({ section }: { section: CodexSection }) {
  return (
    <section className="codex-sec">
      <h3 className="codex-sec-title">{section.title}</h3>
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
  void category; // conservé pour la compat des appelants ; l'aperçu est piloté par `item.appearance`.

  // ONGLETS data-driven : CHAQUE section de la fiche (statbloc, compétences, niveaux de carrière,
  // bénédictions…) devient un onglet → les onglets reflètent les données PROPRES de l'entité (une
  // créature, un sort et une race n'exposent pas les mêmes). La CHARTE (figurine + onglets) est, elle,
  // partagée avec le créateur via `TabbedEntry` — on ne se perd pas d'une fiche à l'autre.
  const tabs: EntryTab[] = item.tabs
    ? // Regroupement EXPLICITE (ex. race : Profil bundle carac+compétences+talents) → sections avec titre.
      item.tabs.map((t, i) => ({
        id: `tab-${i}`,
        label: t.title,
        content: (
          <div className="codex-tabpane">
            <CodexSections sections={t.sections} />
          </div>
        ),
      }))
    : // Sinon : UN onglet par section (corps seul, le libellé d'onglet porte déjà le titre).
      (item.sections ?? []).map((sec, i) => ({
        id: `sec-${i}`,
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
        <div className="codex-tabpane codex-body"><Prose md={item.desc} selfLabel={item.label} /></div>
      ),
    });
  }

  // Faits-clés : TOUJOURS visibles dans l'en-tête (jamais cachés derrière un onglet).
  const meta =
    item.meta && item.meta.length > 0 ? (
      <div className="row-flex codex-meta">
        {item.meta.map((m) => (
          <span key={m.label} className="stat-chip codex-fact">
            <span className="sc-label">{m.label}</span>
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
      <TabbedEntry
        key={item.label}
        figure={item.appearance ? <CreaturePreview name={item.previewRef ?? item.label} appearance={item.appearance} /> : undefined}
        title={item.label}
        aside={item.source ? <CodexSourceBadge source={item.source} /> : undefined}
        blurb={item.sub}
        meta={meta}
        tabs={tabs}
      />
    </article>
  );
}
