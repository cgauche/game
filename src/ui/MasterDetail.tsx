import { useCallback, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

/** Breakpoint canon d'empilement — DOIT rester aligné sur `.master-detail` (`components.css`) ; les
 *  deux se modifient ENSEMBLE. */
export const MASTER_DETAIL_STACK_BREAKPOINT_PX = 700;

/** Un clic dans un champ de recherche/texte de la liste ne doit JAMAIS déclencher le scroll — seule
 *  une activation d'un contrôle de SÉLECTION (bouton, option, lien) compte. */
function isActionableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('button, [role="option"], a[href]') !== null;
}

/**
 * MasterDetail — GABARIT DE COMPOSITION UNIQUE d'un maître-détail (liste à gauche, détail au
 * centre) : deux slots, empilement ≤700px (breakpoints canon), 360px sans scroll horizontal
 * (`components.css`). Réconciliation avec la piste ÉCARTÉE `useMasterDetail` (CLAUDE.md « Pistes
 * évaluées puis écartées ») : le rejet portait sur le HOOK D'ÉTAT PARTAGÉ (marchand ⇄ carte
 * divergent après sélection) — il reste écarté. Cette primitive est un GABARIT DE LAYOUT pur :
 * aucun état de sélection dedans, l'appelant possède `list`/`detail` (boutons a11y natifs ou
 * `role="listbox"`/`role="option"` posés par l'appelant selon son besoin).
 *
 * En mode EMPILÉ (liste puis détail l'un sous l'autre), une liste longue peut placer le détail
 * loin sous le pli : une sélection change bien le détail mais ne se VOIT pas (recette #343). On
 * délègue les clics/activations clavier du slot liste (capture, pas de contrat de sélection à
 * connaître) et on scrolle le slot détail en vue une fois le re-render posé.
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
  const detailRef = useRef<HTMLDivElement>(null);

  const handleListInteraction = useCallback((e: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    if (!isActionableTarget(e.target)) return;
    // rAF : laisser le re-render de l'appelant poser le nouveau détail avant de mesurer sa position.
    requestAnimationFrame(() => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
      if (!window.matchMedia(`(max-width: ${MASTER_DETAIL_STACK_BREAKPOINT_PX}px)`).matches) return;
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  return (
    <div className={`master-detail${className ? ` ${className}` : ''}`}>
      <div
        className="master-detail-list"
        aria-label={listLabel}
        onClickCapture={handleListInteraction}
        onKeyDownCapture={handleListInteraction}
      >
        {list}
      </div>
      <div className="master-detail-detail" ref={detailRef}>{detail}</div>
    </div>
  );
}
