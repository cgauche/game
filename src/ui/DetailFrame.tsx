import type { ReactNode } from 'react';
import { Prose } from './Prose';

/**
 * DetailFrame — cadre de détail de l'élue (en-tête nom + chips méta + rubriques de plein rang +
 * prose sombre à scroll interne), motif `.c-frame`/`.c-meta`/`.c-ink-prose` du kit ratifié
 * « Atelier du scribe » (#412). Aucun slot d'actions — « Suivant » fait déjà ça (le pied de l'étape
 * porte la progression, jamais dupliquée ici).
 */
export function DetailFrame({ topper, label, sub, meta, sections, prose, proseSelfLabel, proseSelfCategory }: {
  /** Rangée d'en-tête AVANT le nom (ex. chips de variante/lignée) — le cadre en devient le seul
   *  porteur visuel, plus de bloc sibling posé à côté (#393 P3, correction structurelle Race). */
  topper?: ReactNode;
  /** Absent = pas de bande nom/sous-titre par défaut — le `topper` porte alors l'identité en entier
   *  (bande figurine+identité+rose, #417 correction de cap 2026-07-14). */
  label?: ReactNode;
  /** Tagline SOURCÉE affichée à côté du nom (ex. « Livre de base p. 25 ») — jamais de flavor inventé,
   *  toujours dérivée d'un `source.book`/`source.page` de donnée (#393 P4). */
  sub?: ReactNode;
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
      {topper}
      {label != null && (
        <div className="detail-frame-head row-flex">
          <h3 className="detail-frame-name">{label}</h3>
          {sub && <span className="detail-frame-sub">{sub}</span>}
        </div>
      )}
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
