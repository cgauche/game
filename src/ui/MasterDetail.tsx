import type { ReactNode } from 'react';

/**
 * MasterDetail — GABARIT DE COMPOSITION UNIQUE d'un maître-détail (liste à gauche, détail au
 * centre) : deux slots, empilement ≤700px (breakpoints canon), 360px sans scroll horizontal
 * (`components.css`). Réconciliation avec la piste ÉCARTÉE `useMasterDetail` (CLAUDE.md « Pistes
 * évaluées puis écartées ») : le rejet portait sur le HOOK D'ÉTAT PARTAGÉ (marchand ⇄ carte
 * divergent après sélection) — il reste écarté. Cette primitive est un GABARIT DE LAYOUT pur :
 * aucun état de sélection dedans, l'appelant possède `list`/`detail` (boutons a11y natifs ou
 * `role="listbox"`/`role="option"` posés par l'appelant selon son besoin).
 */
export function MasterDetail({
  list,
  detail,
  listLabel,
  className,
}: {
  /** Slot GAUCHE — items de sélection (l'appelant en possède l'état). */
  list: ReactNode;
  /** Slot CENTRE — détail de l'item sélectionné (ou son état vide). */
  detail: ReactNode;
  /** `aria-label` du conteneur de liste. */
  listLabel?: string;
  className?: string;
}) {
  return (
    <div className={`master-detail${className ? ` ${className}` : ''}`}>
      <div className="master-detail-list" aria-label={listLabel}>{list}</div>
      <div className="master-detail-detail">{detail}</div>
    </div>
  );
}
