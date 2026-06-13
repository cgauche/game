/** Rendu uniforme d'une fiche du Codex (détail). Composé des primitives `.stat-chip`/`.chip`. */
import type { CodexItem } from './registry';

export function CodexSourceBadge({ source }: { source: CodexItem['source'] }) {
  if (!source) return null;
  return (
    <span className="codex-src" title={`${source.book} page ${source.page}`}>
      {source.book} p.{source.page}
    </span>
  );
}

export function CodexEntry({ item }: { item: CodexItem }) {
  return (
    <article className="codex-entry">
      <header className="codex-entry-head">
        <h2 className="codex-entry-title">{item.label}</h2>
        <CodexSourceBadge source={item.source} />
        {item.sub && <div className="codex-entry-sub">{item.sub}</div>}
      </header>

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

      {item.tags && item.tags.length > 0 && (
        <div className="row-flex codex-tags">
          {item.tags.map((t, i) => (
            <span key={`${t}-${i}`} className="chip">{t}</span>
          ))}
        </div>
      )}

      {item.desc ? (
        item.html ? (
          <div className="codex-body" dangerouslySetInnerHTML={{ __html: item.desc }} />
        ) : (
          <p className="codex-body">{item.desc}</p>
        )
      ) : (
        <p className="codex-body codex-empty-desc">—</p>
      )}
    </article>
  );
}
