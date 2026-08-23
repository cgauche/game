import type { ReactNode, Ref } from 'react';
import { CodexRef, nodeText } from './compendium/CodexRef';

/**
 * Action GATÉE — bouton d'engagement dont l'indisponibilité porte sa RAISON, lue AU SURVOL et AU FOCUS
 * (souris, clavier, manette) dans l'unique infobulle du jeu (`CodexRef refus`), et liée par
 * `aria-describedby` à sa copie accessible hors écran (un `title` seul reste invisible à l'arbre a11y,
 * recette 2026-07-12 ; un texte permanent sous le libellé est REFUSÉ — arbitrage user 2026-08-24 :
 * « Je n'ai jamais validé ces "textes" impossible a lire sous le nom des capacités, même Rogue Trader
 * qui est notre interface de départ n'a pas un tel comportement. »). Primitive PARTAGÉE (hub de ville « Entrer au port/chantier », écran d'équipe
 * « Commencer », panneau Sorts de la fiche « Lancer » — #371/#516) : tout bouton principal désactivé
 * pour une raison intelligible la COMPOSE au lieu d'un `<button disabled title=…>` muet. Pose
 * `.gated-action` (components.css).
 *
 * DEUX formes, selon QUI porte la raison :
 *  - `reason` : la raison est portée ICI — infobulle au survol/focus du bouton, plus copie accessible
 *    hors écran dans le conteneur `.gated-action` — forme d'une action isolée, dont la cause
 *    d'indisponibilité lui est propre ;
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
  raisonInline = false,
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
   *  (pied de la frise d'initiative) — texte enroulé, graduation réduite du bouton. Même règle que
   *  `bare` : la densité vit chez la primitive, jamais chez l'appelant. Porte
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
  /** RAISON RENDUE EN CLAIR sous le bouton, au lieu de l'infobulle de survol/focus — OPT-IN, réservé
   *  au refus qui est le SEUL signal d'un écran : l'attente d'un invité en coop (écran d'équipe), le
   *  diagnostic d'authoring d'un outil d'éditeur, l'entrée refusée d'une activité. Ailleurs, une case
   *  fermée reste PROPRE et dit pourquoi au survol (arbitrage user 2026-08-24). Le contrôle garde alors
   *  son `disabled` HTML : sa raison étant déjà à l'écran, rien n'a besoin de l'atteindre. */
  raisonInline?: boolean;
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
  // La raison vit-elle dans l'INFOBULLE (défaut) plutôt qu'en clair sous le bouton ?
  const bulle = !enabled && !!reason && !raisonInline;
  // Un contrôle dont la raison est à ATTEINDRE ne peut PAS porter `disabled` : l'attribut HTML le
  // retire de l'ordre de tabulation, rend `.focus()` inopérant, l'exclut du filtre de la manette
  // (`visibleFocusables`) et lui coupe tout événement de pointeur — la raison ne serait alors lisible
  // qu'à la souris. Patron ARIA canon : `aria-disabled` + clic INERTE. Le bouton reste focalisable de
  // nature, donc atteignable au clavier, à la manette, et au doigt (le tap ouvre l'infobulle).
  const arret = arretePointeur ? (e: { stopPropagation: () => void }) => e.stopPropagation() : undefined;
  const button = (
    <button
      type="button"
      ref={btnRef}
      className={`btn ${primary ? 'btn-primary' : ''}${bare ? ' btn-nu' : ''}${tactile ? ' btn-tactile' : ''}${btnClassName ? ` ${btnClassName}` : ''}`}
      disabled={!enabled && !bulle}
      aria-disabled={bulle || undefined}
      aria-label={ariaLabel}
      title={ariaLabel}
      aria-describedby={describedBy}
      onPointerDown={arret}
      onPointerUp={arret}
      onClick={(e) => { arret?.(e); if (bulle) return; onClick(); }}
    >
      {label}
    </button>
  );
  if (reasonId) return button;
  return (
    <div className={`gated-action${dense ? ' dense' : ''}${className ? ` ${className}` : ''}`}>
      {bulle
        ? <CodexRef label={ariaLabel ?? nodeText(label)} refus={reason} wrap>{button}</CodexRef>
        : button}
      {/* La raison : EN CLAIR sous le bouton quand l'écran la réclame (`raisonInline`), sinon sa copie
          HORS ÉCRAN — jamais supprimée, un lecteur d'écran la lit par `aria-describedby` sans survol. */}
      {!enabled && <p className={raisonInline ? 'gated-action-reason' : 'hors-ecran'} id={`${id}-reason`}>{reason}</p>}
    </div>
  );
}
