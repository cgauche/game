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
export function Modal({
  title,
  subject,
  subjectPv = false,
  variant = 'roll',
  className,
  children,
}: {
  title: ReactNode;
  /** Combattant concerné → portrait + nom en bandeau (omis si absent). */
  subject?: Combatant | null;
  subjectPv?: boolean;
  variant?: 'roll' | 'test';
  className?: string;
  children: ReactNode;
}) {
  // Accessibilité (Jalon 8) : dialogue sémantique + focus déplacé DANS la modale à l'ouverture
  // (lecteurs d'écran + navigation clavier — le premier bouton/champ devient atteignable au Tab).
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = boxRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea');
    first?.focus();
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
