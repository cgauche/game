/** Rendu d'une fiche du Codex (détail) : en-tête + faits + prose + SECTIONS riches (statbloc,
 *  niveaux de carrière, bénédictions…) dont les entités citées sont des liens `CodexRef`. */
import type { CodexItem, CodexRow, CodexSection } from './registry';
import { CodexRef } from './CodexRef';
import { CreaturePreview } from './CreaturePreview';
import { findCreature } from '../../data';

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
          <span className="ck-k">{row.k}</span>
          <span className="ck-v">{row.v}</span>
        </div>
      );
    case 'text':
      return row.html ? (
        <div className="codex-rowtext" dangerouslySetInnerHTML={{ __html: row.text }} />
      ) : (
        <p className="codex-rowtext">{row.text}</p>
      );
    case 'ref':
      return (
        <CodexRef category={row.category} label={row.label} instance={row.show} className="codex-chip">
          {row.show}
        </CodexRef>
      );
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
  const hasBody = !!item.desc || !!item.meta?.length || !!item.sections?.length;
  const creature = category === 'creatures' ? findCreature(item.label) : undefined;
  return (
    <article className="codex-entry">
      <header className="codex-entry-head">
        <h2 className="codex-entry-title">{item.label}</h2>
        <CodexSourceBadge source={item.source} />
        {item.sub && <div className="codex-entry-sub">{item.sub}</div>}
      </header>

      {creature && <CreaturePreview name={item.label} appearance={creature.appearance} />}

      {instance && instance !== item.label && (
        <div className="codex-instance">
          Cette occurrence : <b>{instance}</b>
        </div>
      )}

      {item.meta && item.meta.length > 0 && (
        <div className="row-flex codex-meta">
          {item.meta.map((m) => (
            <span key={m.label} className="stat-chip codex-fact">
              <span className="sc-label">{m.label}</span>
              <span className="sc-value">{m.value}</span>
            </span>
          ))}
        </div>
      )}

      {item.desc &&
        (item.html ? (
          <div className="codex-body" dangerouslySetInnerHTML={{ __html: item.desc }} />
        ) : (
          <p className="codex-body">{item.desc}</p>
        ))}

      {item.sections && <CodexSections sections={item.sections} />}

      {!hasBody && <p className="codex-body codex-empty-desc">—</p>}
    </article>
  );
}
