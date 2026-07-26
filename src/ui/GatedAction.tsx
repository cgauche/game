import type { ReactNode } from 'react';

/**
 * Action GATÉE — bouton d'engagement dont l'indisponibilité porte sa RAISON en texte VISIBLE sous le
 * bouton (un `title` seul reste invisible à l'arbre a11y, recette 2026-07-12), liée par
 * `aria-describedby`. Primitive PARTAGÉE (hub de ville « Entrer au port/chantier », écran d'équipe
 * « Commencer », panneau Sorts de la fiche « Lancer » — #371/#516) : tout bouton principal désactivé
 * pour une raison intelligible la COMPOSE au lieu d'un `<button disabled title=…>` muet. Pose
 * `.gated-action` (components.css).
 *
 * DEUX formes, selon QUI porte la raison :
 *  - `reason` : la raison est rendue ICI, sous le bouton, dans le conteneur `.gated-action` — forme
 *    d'une action isolée, dont la cause d'indisponibilité lui est propre ;
 *  - `reasonId` : la raison est déjà rendue UNE fois par l'appelant (N actions gatées par la MÊME
 *    cause : les rangées d'un registre sous un même verrou) — l'action s'y LIE sans dupliquer le
 *    texte, et se rend alors SANS conteneur, donc composable dans un contexte inline.
 */
export function GatedAction({
  id,
  label,
  ariaLabel,
  enabled,
  reason,
  reasonId,
  onClick,
  primary = true,
  className,
  btnClassName,
}: {
  id: string;
  label: ReactNode;
  /** Nom ACCESSIBLE du bouton, obligatoire dès que `label` n'est pas du texte lisible (glyphe `↺`,
   *  icône) : posé en `aria-label` ET en `title`. Absent = le nom vient du contenu du bouton. */
  ariaLabel?: string;
  enabled: boolean;
  onClick: () => void;
  /** Style primaire (dégradé sang) — défaut. `false` = bouton neutre (action rétrogradée). */
  primary?: boolean;
  /** Classes SUPPLÉMENTAIRES du `<button>` (ex. `small` dans une rangée compacte) — la taille reste
   *  au bouton, `className` reste réservé au conteneur `.gated-action`. */
  btnClassName?: string;
} & (
  | {
      /** Raison d'indisponibilité — rendue sous le bouton quand `enabled=false` (info de DÉCISION). */
      reason: string;
      reasonId?: never;
      className?: string;
    }
  | {
      /** Id de la raison DÉJÀ rendue par l'appelant : l'action s'y lie, sans conteneur ni doublon. */
      reasonId: string;
      reason?: never;
      className?: never;
    }
)) {
  const describedBy = enabled ? undefined : (reasonId ?? `${id}-reason`);
  const button = (
    <button
      type="button"
      className={`btn ${primary ? 'btn-primary' : ''}${btnClassName ? ` ${btnClassName}` : ''}`}
      disabled={!enabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      aria-describedby={describedBy}
      onClick={onClick}
    >
      {label}
    </button>
  );
  if (reasonId) return button;
  return (
    <div className={`gated-action${className ? ` ${className}` : ''}`}>
      {button}
      {!enabled && <p className="gated-action-reason" id={`${id}-reason`}>{reason}</p>}
    </div>
  );
}
