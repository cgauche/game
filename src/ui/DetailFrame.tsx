import type { ReactNode } from 'react';
import { Prose } from './Prose';

/**
 * DetailFrame — cadre de détail de l'élue (en-tête nom + chips méta + rubriques de plein rang +
 * prose sombre à scroll interne), motif `.c-frame`/`.c-meta`/`.c-ink-prose` du kit ratifié
 * « Atelier du scribe » (#412). Aucun slot d'actions — « Suivant » fait déjà ça (le pied de l'étape
 * porte la progression, jamais dupliquée ici).
 */
export function DetailFrame({ name, meta, sections, prose, proseSelfLabel, proseSelfCategory }: {
  name: ReactNode;
  /** Chips méta (statut, famille, classe…) — rendues sous le nom. */
  meta?: ReactNode;
  /** Rubriques de plein rang (compétences, talents, possessions…). */
  sections?: ReactNode;
  /** Description sourcée (Markdown verbatim) — rendue via `Prose`, scroll interne. */
  prose?: string;
  proseSelfLabel?: string;
  proseSelfCategory?: string;
}) {
  return (
    <div className="detail-frame">
      <h3 className="detail-frame-name">{name}</h3>
      {meta && <div className="detail-frame-meta row-flex">{meta}</div>}
      {sections}
      {prose != null && (
        <div className="detail-frame-prose">
          <Prose md={prose} selfLabel={proseSelfLabel} selfCategory={proseSelfCategory} />
        </div>
      )}
    </div>
  );
}
