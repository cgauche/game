import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { ModalSubject } from './ModalSubject';
import type { Combatant } from '../engine/types';

/**
 * CADRE PARTAGÉ de toutes les modales du jeu — source unique du squelette (voile plein écran + boîte +
 * titre + bandeau « sujet » optionnel). Uniformise l'aspect ET la qualité : chaque modale ne fournit
 * que son contenu propre (résultat, actions). Le bandeau `subject` (portrait + nom du combattant
 * concerné, via `ModalSubject`) garantit qu'on sait TOUJOURS à qui la modale s'applique.
 *
 * `variant` choisit la famille de classes ('roll' = roll-modal, 'test' = test-modal, 'plain' = boîte
 * nue stylée par `className`) ; `className` ajoute une classe spécifique (ex. inspection). Le contenu
 * spécifique passe en `children`.
 */
const FOCUSABLE = 'button, [href], input, select, textarea';

/** Comportement a11y des dialogues (pattern WAI-ARIA) : focus déplacé dans la boîte à l'ouverture,
 *  piège de focus (Tab/Shift+Tab bouclent), Échap = `onClose` quand il existe — seule la modale du
 *  DESSUS (dernier [role=dialog] du document) réagit. Pour les dialogues au markup spécifique
 *  (Fiche, Inspection…) qui ne passent pas par <Modal> : poser role="dialog" + appeler ce hook. */
export function useModalA11y(boxRef: RefObject<HTMLDivElement>, onClose?: () => void) {
  useEffect(() => {
    const first = boxRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  }, [boxRef]);
  const closeRef = useRef(onClose);
  closeRef.current = onClose; // Échap suit la visibilité COURANTE du bouton Annuler (pré/post-jet)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const box = boxRef.current;
      if (!box) return;
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== box) return;
      if (e.key === 'Escape') {
        if (closeRef.current) {
          e.preventDefault();
          closeRef.current();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const els = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter((el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0); // focusables VISIBLES seulement
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !box.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !box.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [boxRef]);
}

const VARIANT_CLASS = { roll: ' roll-modal', test: ' test-modal', plain: '' } as const;

export function Modal({
  title,
  subject,
  subjectPv = false,
  variant = 'roll',
  className,
  onClose,
  backdropClose = false,
  children,
}: {
  title: ReactNode;
  /** Combattant concerné → portrait + nom en bandeau (omis si absent). */
  subject?: Combatant | null;
  subjectPv?: boolean;
  variant?: 'roll' | 'test' | 'plain';
  className?: string;
  /** Échap = ce callback (l'équivalent du bouton Fermer/Annuler visible). Absent → modale
   *  NON annulable (un jet posé doit être résolu — invariant « un jet = une modale »). */
  onClose?: () => void;
  /** Cliquer le voile ferme aussi (lecteurs passifs : document, fiche…) — jamais par défaut. */
  backdropClose?: boolean;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  useModalA11y(boxRef, onClose);
  return (
    <div className="modal-overlay" onClick={backdropClose && onClose ? onClose : undefined}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        className={`modal${VARIANT_CLASS[variant]}${className ? ` ${className}` : ''}`}
        onClick={backdropClose ? (e) => e.stopPropagation() : undefined}
      >
        <h3>{title}</h3>
        {subject && <ModalSubject c={subject} pv={subjectPv} />}
        {children}
      </div>
    </div>
  );
}
