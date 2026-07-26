import type { ReactNode } from 'react';

/**
 * RANGÉE DE LISTE SÉLECTIONNABLE — définition UNIQUE du motif « nom à gauche, puces de méta à
 * droite, la rangée entière cliquable ». Il était recopié à la main sur une vingtaine de sites, avec
 * TROIS classes d'état sélectionné concurrentes (`active`, `on`, `is-selected`) — dont une,
 * `is-selected`, qui n'est stylée nulle part : la sélection y était invisible. La primitive tranche :
 * l'appelant déclare `selected`, elle pose la classe que la CSS de sa famille sait peindre.
 *
 * `variant` = la famille de style : `insp` (panneaux de l'ÉDITEUR, `button.insp-row`) ou `codex`
 * (écrans de consultation du JEU, `.codex-row`). Les puces se passent en `children`
 * (`<span className="chip">`) — la rangée décide de leur PLACE, jamais de leur contenu.
 */
export function ListRow({
  onClick,
  label,
  title,
  selected,
  variant = 'insp',
  children,
}: {
  onClick: () => void;
  /** Colonne gauche : icône + libellé. */
  label: ReactNode;
  title?: string;
  /** Sélection SIMPLE : la rangée élue est l'item COURANT de son ensemble (`aria-current`), pas un
   *  interrupteur — les rangées non élues n'annoncent donc rien. Absent = la liste ne porte AUCUNE
   *  sémantique de sélection (rangée de navigation) : ni classe d'état, ni attribut d'état. */
  selected?: boolean;
  variant?: 'insp' | 'codex';
  /** Puces de méta, alignées à droite. */
  children?: ReactNode;
}) {
  const family = variant === 'codex' ? 'codex-row' : 'insp-row';
  const on = selected ? (variant === 'codex' ? ' on' : ' active') : '';
  return (
    <button
      type="button"
      className={`listrow ${family}${on}`}
      title={title}
      aria-current={selected ? 'true' : undefined}
      onClick={onClick}
    >
      <span className="lr-name">{label}</span>
      {children}
    </button>
  );
}
