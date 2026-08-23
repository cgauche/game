import type { ReactNode, Ref } from 'react';

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
  bare = false,
  dense = false,
  tactile = false,
  arretePointeur = false,
  btnRef,
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
  /** Variante NUE (`.btn-nu`) : le bouton n'apporte AUCUNE boîte (padding, hauteur mini, rayon,
   *  ombre) — pour une alvéole qui porte déjà sa géométrie (rack d'États de la console). La variante
   *  vit DANS la primitive (`base.css`), jamais en neutralisation de `.btn` depuis un conteneur. */
  bare?: boolean;
  /** Variante DENSE (`.gated-action.dense`, components.css) : l'action tient dans une colonne étroite
   *  (pied de la frise d'initiative) — texte enroulé, graduation réduite pour le bouton comme pour la
   *  raison. Même règle que `bare` : la densité vit chez la primitive, jamais chez l'appelant. Porte
   *  sur le CONTENEUR, donc sans effet dans la forme `reasonId` (rendue sans conteneur). */
  dense?: boolean;
  /** Variante TACTILE (`.btn.btn-tactile`, base.css) : le bouton tient la cible de la charte (≥ 40 px)
   *  à TOUT pointeur, et pas seulement sous `pointer: coarse` — pour un contrôle posé dans le monde,
   *  où rien ne garantit la densité d'un panneau. Comme `bare`/`dense` : la variante vit chez la
   *  primitive, jamais en neutralisation de `.btn` depuis la feuille d'un écran. */
  tactile?: boolean;
  /** Le bouton CONSOMME ses événements de pointeur (`stopPropagation` sur pointerdown/up/click) — pour
   *  un contrôle posé SUR une surface de picking (le SVG du monde, qui écoute tout à sa racine) : sans
   *  cela un clic vaudrait le geste ET le clic-monde qui est dessous. */
  arretePointeur?: boolean;
  /** Référence sur le BOUTON — pour l'ancrer à ce qu'il ouvre (un panneau-paramètre naît de son
   *  déclencheur, jamais du conteneur qui l'entoure). */
  btnRef?: Ref<HTMLButtonElement>;
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
  const arret = arretePointeur ? (e: { stopPropagation: () => void }) => e.stopPropagation() : undefined;
  const button = (
    <button
      type="button"
      ref={btnRef}
      className={`btn ${primary ? 'btn-primary' : ''}${bare ? ' btn-nu' : ''}${tactile ? ' btn-tactile' : ''}${btnClassName ? ` ${btnClassName}` : ''}`}
      disabled={!enabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      aria-describedby={describedBy}
      onPointerDown={arret}
      onPointerUp={arret}
      onClick={(e) => { arret?.(e); onClick(); }}
    >
      {label}
    </button>
  );
  if (reasonId) return button;
  return (
    <div className={`gated-action${dense ? ' dense' : ''}${className ? ` ${className}` : ''}`}>
      {button}
      {!enabled && <p className="gated-action-reason" id={`${id}-reason`}>{reason}</p>}
    </div>
  );
}
