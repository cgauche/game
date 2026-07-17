import type { ReactNode } from 'react';

/**
 * Action GATÉE — bouton d'engagement dont l'indisponibilité porte sa RAISON en texte VISIBLE sous le
 * bouton (un `title` seul reste invisible à l'arbre a11y, recette 2026-07-12), liée par
 * `aria-describedby`. Primitive PARTAGÉE (hub de ville « Entrer au port/chantier », écran d'équipe
 * « Commencer », panneau Sorts de la fiche « Lancer » — #371/#516) : tout bouton principal désactivé
 * pour une raison intelligible la COMPOSE au lieu d'un `<button disabled title=…>` muet. Pose
 * `.gated-action` (components.css).
 */
export function GatedAction({
  id,
  label,
  enabled,
  reason,
  onClick,
  primary = true,
  className,
  btnClassName,
}: {
  id: string;
  label: ReactNode;
  enabled: boolean;
  /** Raison d'indisponibilité — rendue sous le bouton quand `enabled=false` (info de DÉCISION). */
  reason: string;
  onClick: () => void;
  /** Style primaire (dégradé sang) — défaut. `false` = bouton neutre (action rétrogradée). */
  primary?: boolean;
  className?: string;
  /** Classes SUPPLÉMENTAIRES du `<button>` (ex. `small` dans une rangée compacte) — la taille reste
   *  au bouton, `className` reste réservé au conteneur `.gated-action`. */
  btnClassName?: string;
}) {
  const reasonId = `${id}-reason`;
  return (
    <div className={`gated-action${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className={`btn ${primary ? 'btn-primary' : ''}${btnClassName ? ` ${btnClassName}` : ''}`}
        disabled={!enabled}
        aria-describedby={enabled ? undefined : reasonId}
        onClick={onClick}
      >
        {label}
      </button>
      {!enabled && <p className="gated-action-reason" id={reasonId}>{reason}</p>}
    </div>
  );
}
