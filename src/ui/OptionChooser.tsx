import type { ReactNode } from 'react';
import { GatedAction } from './GatedAction';

/**
 * Une « option de jet » sélectionnable : libellé + (valeur effective) + disponibilité + action.
 * Le calcul de la valeur / des modificateurs / de l'effet reste DANS la modale (schéma « la modale
 * calcule et passe en props ») — `RollOption` ne porte que de quoi rendre et déclencher le choix.
 */
export interface RollOption {
  key: string;
  label: ReactNode;
  /** Valeur effective affichée à côté du libellé (base + mods combinés, cf. `optionValue`). */
  value?: number;
  title?: string;
  disabled?: boolean;
  /** Option masquée (non rendue) — condition de disponibilité fausse. */
  hidden?: boolean;
  /** layout `seg` : option active (classe `on`). */
  selected?: boolean;
  /** layout `grid`/`actions` : bouton mis en avant (classe `btn-primary`). */
  primary?: boolean;
  /** layout `actions` : bouton discret (classe `btn-ghost`, ex. « Renoncer »/« Subir »). */
  ghost?: boolean;
  /** Rendu custom à la place de `label value` (ex. portraits de Cible montée). */
  content?: ReactNode;
  onSelect?: () => void;
}

/**
 * Option qui peut porter sa RAISON DE REFUS. Les deux formes sont celles de `GatedAction` (l'unique
 * porteur d'une raison de refus du jeu), et il n'y en a pas d'autre :
 *  - `refus`   : la cause est PROPRE à l'option — rendue au survol/focus/tap, jamais en texte inline
 *                sous le libellé (arbitrage user 2026-08-24) ;
 *  - `refusId` : N options éteintes par la MÊME cause, que l'appelant a déjà rendue UNE fois à
 *                l'écran (le récapitulatif d'une grille de table) — l'option s'y LIE sans dupliquer.
 * Dans les deux cas le bouton garde `aria-disabled` (jamais `disabled`) et un clic inerte : une
 * option dont la raison est à ATTEINDRE doit rester focalisable au clavier, à la manette et au doigt.
 * Une option simplement `disabled` reste MUETTE ; une option `hidden` disparaît sans rien dire.
 */
export interface RollGridOption extends RollOption {
  refus?: string;
  refusId?: string;
}

/** Option d'une barre d'ACTIONS : MÊME contrat de refus que la grille, parce que c'est le même
 *  bouton — `actions` bâtit le `.btn` que `GatedAction` rend, et les deux layouts passent par la
 *  MÊME composition (`OptionBouton` ci-dessous). */
export type RollActionOption = RollGridOption;

/** Option d'un `seg` : la raison de refus y est REFUSÉE PAR LE TYPE (`never`) plutôt qu'avalée en
 *  silence — le segmenté a sa propre matière (bouton nu d'un `.seg`, aucune `.btn`), donc la prop
 *  n'y aurait aucun porteur à habiller. Une option de `seg` fermée reste muette jusqu'à ce que la
 *  matière du segmenté sache porter un refus. */
export type RollOptionSansRefus = RollOption & { refus?: never; refusId?: never };

/**
 * Composition UNIQUE d'une option-bouton, partagée par `grid` et `actions` : l'option qui porte une
 * raison compose `GatedAction`, l'option muette reste un `<button>`. Une seule fonction pour les deux
 * layouts — la forme du refus ne se décline pas par layout.
 */
function OptionBouton({
  o,
  id,
  primary,
  btnClassName,
  ariaPressed,
  children,
}: {
  o: RollGridOption;
  id: string;
  primary: boolean;
  btnClassName?: string;
  ariaPressed?: boolean;
  children: ReactNode;
}) {
  if (o.refus || o.refusId) {
    return (
      <GatedAction
        id={id}
        label={children}
        enabled={false}
        {...(o.refusId ? { reasonId: o.refusId } : { reason: o.refus! })}
        onClick={() => {}}
        primary={primary}
        btnClassName={btnClassName}
        ariaPressed={ariaPressed}
      />
    );
  }
  return (
    <button
      className={`btn${primary ? ' btn-primary' : ''}${btnClassName ? ` ${btnClassName}` : ''}`}
      aria-pressed={ariaPressed}
      disabled={o.disabled}
      onClick={o.onSelect}
      title={o.title}
    >
      {children}
    </button>
  );
}

/**
 * Sélecteur d'« options de jet » PARTAGÉ — source unique du choix Parade/Esquive (Défense),
 * Sacrifier/Esquiver/Fuir (Désengagement), Calme/Résistance (Résistance). Remplace les `.seg` /
 * `.rm-loc-grid` réécrits à la main dans chaque modale. Le métier reste dans la modale ; ce composant
 * ne fait que rendre les boutons et propager `onSelect`.
 *
 * - `seg`     → segmented control (`.rm-loc-inline` + `.seg`) ; option active = classe `on`, valeur affichée.
 * - `grid`    → grille de boutons (`.rm-loc-grid` de `.btn small`) — menus dans le corps de la modale.
 * - `actions` → barre d'actions (`.modal-actions` de `.btn`) — choix binaires (cf. `<ChoiceButtons>`).
 */
export function OptionChooser({
  options,
  layout,
  groupLabel,
  idPrefix = 'opt',
}: {
  /** Mini-titre du groupe (surtout layout `seg`) — ex. « Réaction ». */
  groupLabel?: ReactNode;
  /** Préfixe des ids que la grille ÉMET (la copie accessible d'une raison de refus) : deux grilles
   *  sur le même document servent souvent les MÊMES clés d'option — sans préfixe propre, elles
   *  collent le même id deux fois. */
  idPrefix?: string;
} & (
  | { layout: 'grid'; options: RollGridOption[] }
  | { layout: 'actions'; options: RollActionOption[] }
  | { layout: 'seg'; options: RollOptionSansRefus[] }
)) {
  const shown = options.filter((o) => !o.hidden);

  if (layout === 'seg') {
    return (
      <div className="rm-loc-inline">
        {groupLabel != null && <span className="mini-title">{groupLabel}</span>}
        <div className="seg">
          {shown.map((o) => (
            <button key={o.key} className={o.selected ? 'on' : ''} aria-pressed={!!o.selected} disabled={o.disabled} onClick={o.onSelect} title={o.title}>
              {o.content ?? (
                <>
                  {o.label}
                  {o.value != null ? <> {o.value}</> : null}
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (layout === 'grid') {
    return (
      <div className="rm-loc-grid">
        {(shown as RollGridOption[]).map((o) => (
          <OptionBouton
            key={o.key}
            o={o}
            id={`${idPrefix}-${o.key}`}
            /* `selected` = l'option RETENUE (état, `aria-pressed` + classe `on` — même sémantique
               qu'en `seg`) ; `primary` reste la mise en avant VISUELLE. Une grille qui n'exprime que
               `primary` ne ferre rien : le choix posé ne se distingue pas d'un bouton d'action. */
            primary={!!o.primary}
            btnClassName={`small${o.selected ? ' on' : ''}`}
            ariaPressed={o.selected != null ? !!o.selected : undefined}
          >
            {o.content ?? (
              <>
                {o.label}
                {o.value != null ? <> ({o.value})</> : null}
              </>
            )}
          </OptionBouton>
        ))}
      </div>
    );
  }

  // layout === 'actions'
  return (
    <div className="modal-actions">
      {(shown as RollActionOption[]).map((o) => (
        <OptionBouton
          key={o.key}
          o={o}
          id={`${idPrefix}-${o.key}`}
          primary={!!o.primary}
          btnClassName={o.ghost ? 'btn-ghost' : undefined}
        >
          {o.content ?? o.label}
        </OptionBouton>
      ))}
    </div>
  );
}

/**
 * Choix à boutons d'une popin de décision (Renoncer, Sauvegarde Destin, Piège à lame, Cible montée) —
 * `OptionChooser` en barre d'actions. Source UNIQUE des paires de boutons de choix, jusqu'ici
 * réécrites à la main (`.modal-actions` copié-collé).
 */
export function ChoiceButtons({ options, idPrefix }: { options: RollActionOption[]; idPrefix?: string }) {
  return <OptionChooser options={options} layout="actions" idPrefix={idPrefix} />;
}
