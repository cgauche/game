import { useEffect, useRef, type ReactNode } from 'react';
import { ModalSubject } from './ModalSubject';
import type { Combatant } from '../engine/types';

/**
 * CADRE PARTAGÉ de toutes les modales du jeu — source unique du squelette (voile plein écran + boîte +
 * titre + bandeau « sujet » optionnel). Uniformise l'aspect ET la qualité : chaque modale ne fournit
 * que son contenu propre (résultat, actions). Le bandeau `subject` (portrait + nom du combattant
 * concerné, via `ModalSubject`) garantit qu'on sait TOUJOURS à qui la modale s'applique.
 *
 * `variant` choisit la famille de classes ('roll' = roll-modal, 'test' = test-modal) ; `className`
 * ajoute une classe spécifique (ex. inspection). Le contenu spécifique passe en `children`.
 */
const FOCUSABLE = 'button, [href], input, select, textarea';

export function Modal({
  title,
  subject,
  subjectPv = false,
  variant = 'roll',
  className,
  onClose,
  children,
}: {
  title: ReactNode;
  /** Combattant concerné → portrait + nom en bandeau (omis si absent). */
  subject?: Combatant | null;
  subjectPv?: boolean;
  variant?: 'roll' | 'test';
  className?: string;
  /** Échap = ce callback (l'équivalent du bouton Fermer/Annuler visible). Absent → modale
   *  NON annulable (un jet posé doit être résolu — invariant « un jet = une modale »). */
  onClose?: () => void;
  children: ReactNode;
}) {
  // Accessibilité (Jalon 8) : dialogue sémantique + focus déplacé DANS la modale à l'ouverture
  // (lecteurs d'écran + navigation clavier — le premier bouton/champ devient atteignable au Tab).
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = boxRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  }, []);
  // Échap + piège de focus (pattern dialogue WAI-ARIA). Écouteur DOCUMENT : rattrape un focus sorti
  // de la boîte (clic sur le voile) ; seule la modale du DESSUS (dernier [role=dialog]) réagit.
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
      const els = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('disabled'));
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
  }, []);
  return (
    <div className="modal-overlay">
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        className={`modal ${variant === 'test' ? 'test-modal' : 'roll-modal'}${className ? ` ${className}` : ''}`}
      >
        <h3>{title}</h3>
        {subject && <ModalSubject c={subject} pv={subjectPv} />}
        {children}
      </div>
    </div>
  );
}
