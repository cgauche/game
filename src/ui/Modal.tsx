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

/** Focusables VISIBLES d'un conteneur (non `disabled`, effectivement rendus) — source UNIQUE du
 *  calcul partagé par le piège Tab et tout consommateur clavier. */
export function visibleFocusables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)]
    .filter((el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0);
}

/** Comportement a11y des dialogues (pattern WAI-ARIA) : focus déplacé dans la boîte à l'ouverture,
 *  piège de focus (Tab/Shift+Tab bouclent), Échap = `onClose` quand il existe — seule la modale du
 *  DESSUS (dernier [role=dialog] du document) réagit. Pour les dialogues au markup spécifique
 *  (Fiche, Inspection…) qui ne passent pas par <Modal> : poser role="dialog" + appeler ce hook. */
/** Options d'un GROUPE DE CHOIX de la modale (segmented `.seg`, grille `.rm-loc-grid`) — `<button>` qui
 *  vivent HORS `.modal-actions`. Le clavier doit pouvoir les COCHER, sinon une étape « choix » (déviation
 *  de Critique, Parade/Esquive…) est un cul-de-sac : son bouton de validation reste garrotté. */
function choiceOptions(box: HTMLElement): HTMLButtonElement[] {
  return [...box.querySelectorAll<HTMLButtonElement>('.seg button, .rm-loc-grid button')]
    .filter((el) => !el.disabled && el.getClientRects().length > 0);
}

export function useModalA11y(boxRef: RefObject<HTMLDivElement>, onClose?: () => void) {
  // Focus initial UTILE : une option de choix NON tranchée d'abord (le 1er Entrée la coche, au lieu de
  // taper un bouton de validation inerte) ; sinon le bouton primaire (jet : Lancer/Appliquer) ; sinon le
  // 1er focusable. Évite que le focus atterrisse sur un bouton sans intérêt (« rien ne répond »).
  // RESTORE : à la fermeture, le focus revient à l'élément qui l'avait AVANT l'ouverture (déclencheur du
  // bouton/carte) — sinon un joueur clavier perd son point de navigation à chaque modale fermée.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const opts = choiceOptions(box);
    const selected = opts.find((b) => b.classList.contains('on') || b.classList.contains('btn-primary'));
    const primary = box.querySelector<HTMLElement>('.modal-actions .btn-primary:not([disabled])');
    const target = (opts.length && !selected ? opts[0] : null) ?? (primary?.getClientRects().length ? primary : null) ?? visibleFocusables(box)[0] ?? null;
    target?.focus();
    return () => {
      if (previouslyFocused && document.body.contains(previouslyFocused)) previouslyFocused.focus();
    };
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
      const els = visibleFocusables(box);
      if (e.key === 'Enter') {
        // Un bouton de la boîte est focalisé → on laisse son activation NATIVE (cocher une option de choix,
        // cliquer Lancer/Terminer…). Sinon (focus sur la boîte/aucun) → repli sur le bouton primaire.
        const ae = document.activeElement;
        if (ae instanceof HTMLButtonElement && box.contains(ae) && !ae.disabled) return;
        const primary = box.querySelector<HTMLElement>('.modal-actions .btn-primary:not([disabled])');
        if (primary && primary.getClientRects().length) { e.preventDefault(); primary.click(); }
        return;
      }
      // Flèches = navigation de focus (roving) sur TOUS les contrôles visibles → options de choix, toggles
      // segmentés (Parade/Esquive) et boutons d'action navigables au clavier seul, sans chasser le Tab.
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        // NE PAS voler les flèches d'un champ de formulaire (select/number/texte) → édition native préservée.
        const ae = document.activeElement;
        if (ae && /^(SELECT|INPUT|TEXTAREA)$/.test(ae.tagName)) return;
        if (!els.length) return;
        e.preventDefault();
        const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
        const i = els.indexOf(document.activeElement as HTMLElement);
        els[i < 0 ? (dir === 1 ? 0 : els.length - 1) : (i + dir + els.length) % els.length].focus();
        return;
      }
      if (e.key !== 'Tab') return;
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
  variant = 'roll',
  className,
  onClose,
  backdropClose = false,
  children,
}: {
  title: ReactNode;
  /** Combattant concerné → tuile-portrait en bandeau (omis si absent). */
  subject?: Combatant | null;
  variant?: 'roll' | 'test' | 'plain';
  className?: string;
  /** Échap = ce callback (l'équivalent du bouton Fermer/Annuler visible). Absent → modale
   *  NON annulable (un jet posé doit être résolu). */
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
        {subject && <ModalSubject c={subject} />}
        {children}
      </div>
    </div>
  );
}
