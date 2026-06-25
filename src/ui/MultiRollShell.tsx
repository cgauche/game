import type { ReactNode } from 'react';
import { Modal } from './Modal';

/**
 * Coquille PARTAGÉE et UNIQUE des modales de jet MULTI (N contributeurs en `ParticipantRow`) — pendant de
 * `RollFlowShell` pour le mono. Centralise l'enveloppe `Modal`, le sous-titre, la zone de rangées (`cs-rows`),
 * le bandeau d'ISSUE et la barre d'actions (Annuler · primaire). La modale concrète ne fournit QUE ses
 * `ParticipantRow` (métier) en `children` + son issue (`summary`) ; tout le reste (style/structure/Échap) vit ICI,
 * donc restyler ou changer le comportement des modales multi se fait à UN endroit. Réutilisée par « Enfoncer la
 * porte », « Manœuvre » (Test d'équipage), etc.
 */
export function MultiRollShell({
  title,
  variant = 'roll',
  subtitle,
  instruction,
  extra,
  children,
  summary,
  onCancel,
  cancelLabel = 'Annuler',
  onConfirm,
  confirmLabel = 'Appliquer',
  confirmDisabled = false,
  disableEscClose = false,
}: {
  title: ReactNode;
  /** Famille de classes (cf. `RollFlowShell`) : 'roll' (rm-vs) / 'test' (test-actor). */
  variant?: 'roll' | 'test';
  subtitle?: ReactNode;
  /** Ligne d'instruction sous le sous-titre (`mini-title`). */
  instruction?: ReactNode;
  /** Contenu PRÉ-rangées (ex. choix du virage de la manœuvre). */
  extra?: ReactNode;
  /** Les `ParticipantRow` (métier de la modale). */
  children: ReactNode;
  /** Bandeau d'ISSUE sous les rangées (total, succès…) — encapsulé en `rm-vs`. */
  summary?: ReactNode;
  onCancel: () => void;
  cancelLabel?: string;
  onConfirm: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  disableEscClose?: boolean;
}) {
  return (
    <Modal title={title} variant={variant} onClose={disableEscClose ? undefined : onCancel}>
      {subtitle != null && <p className={variant === 'test' ? 'test-actor' : 'rm-vs'}>{subtitle}</p>}
      {instruction != null && <div className="mini-title">{instruction}</div>}
      {extra}
      <div className="cs-rows">{children}</div>
      {summary != null && <p className="rm-vs">{summary}</p>}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
        {/* () => onConfirm() : ne PAS passer l'événement React (coop : l'invité sérialise les intents en JSON). */}
        <button className="btn btn-primary" disabled={confirmDisabled} onClick={() => onConfirm()}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
