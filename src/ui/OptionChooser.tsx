import { useId, type ReactNode } from 'react';
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
 * Option porteuse d'une RAISON DE REFUS — MÊME forme pour les trois layouts (`grid`, `seg`,
 * `actions`), parce que c'est le même bouton : `GatedAction`, le bouton d'engagement unique du jeu,
 * qui compose lui-même l'infobulle unique (`CodexRef refus`, que d'autres sites portent directement).
 * Deux formes, selon qui tient le texte :
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

/**
 * Option d'un SEGMENT : même contrat de refus ENCORE — le `seg` compose le même `OptionBouton`, en
 * variante NUE (`GatedAction bare` : aucune boîte apportée, la géométrie reste au `.seg`), donc la
 * raison y a exactement la forme des deux autres layouts. Ce qu'elle ne peut PAS être, c'est
 * simplement `disabled` : un segment est un CHOIX posé sous les yeux de l'utilisateur — l'éteindre
 * sans dire pourquoi est le défaut que l'arbitrage du 2026-08-24 vise. Le régime muet n'a plus de
 * consommateur après la migration des sites (`CharacterSheet`, `useDefenseJetProps`, `CastModal`,
 * `ShantyModal`, `TavernGameModal`) : il se refuse PAR LE TYPE plutôt que par une convention.
 */
export type RollSegOption = RollGridOption & { disabled?: never };

/**
 * Composition UNIQUE d'une option-bouton, partagée par les TROIS layouts : l'option qui porte une
 * raison compose `GatedAction`, l'option muette reste un `<button>`. Une seule fonction pour tous les
 * layouts — la forme du refus ne se décline pas par layout, seule la MATIÈRE change (`bare`).
 */
function OptionBouton({
  o,
  id,
  primary,
  btnClassName,
  ariaPressed,
  bare = false,
  children,
}: {
  o: RollGridOption;
  id: string;
  primary: boolean;
  btnClassName?: string;
  ariaPressed?: boolean;
  /** Variante NUE du `seg` : le bouton n'apporte AUCUNE boîte — ni `.btn` sur l'option muette, ni
   *  padding/hauteur sur l'option refusée (`GatedAction`, prop `bare` → `.btn-nu`). La géométrie
   *  reste au conteneur `.seg`. */
  bare?: boolean;
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
        bare={bare}
        btnClassName={btnClassName}
        ariaPressed={ariaPressed}
      />
    );
  }
  return (
    <button
      className={bare ? (btnClassName ?? '') : `btn${primary ? ' btn-primary' : ''}${btnClassName ? ` ${btnClassName}` : ''}`}
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
 *
 * Les trois passent par `OptionBouton` : une option refusée y porte sa raison SOUS LA MÊME FORME,
 * seule la matière change (le `seg` compose en variante nue, sans `.btn`).
 */
export function OptionChooser({
  options,
  layout,
  groupLabel,
  idPrefix = 'opt',
}: {
  /** Mini-titre du groupe (surtout layout `seg`) — ex. « Réaction ». */
  groupLabel?: ReactNode;
  /** Préfixe des ids QUE CE COMPOSANT ÉMET (la copie accessible d'une raison de refus) : deux
   *  châssis sur le même document servent souvent les MÊMES clés d'option — sans préfixe propre,
   *  ils collent le même id deux fois. Le `useId` de React s'y ajoute (`${idPrefix}-${uid}-${key}`)
   *  pour que deux INSTANCES du même appelant, qui partagent forcément le même préfixe, restent
   *  distinctes. */
  idPrefix?: string;
} & (
  | { layout: 'grid'; options: RollGridOption[] }
  | { layout: 'actions'; options: RollActionOption[] }
  | { layout: 'seg'; options: RollSegOption[] }
)) {
  const shown = options.filter((o) => !o.hidden);
  const uid = useId();

  if (layout === 'seg') {
    return (
      <div className="rm-loc-inline">
        {groupLabel != null && <span className="mini-title">{groupLabel}</span>}
        <div className="seg">
          {(shown as RollSegOption[]).map((o) => (
            <OptionBouton
              key={o.key}
              o={o}
              id={`${idPrefix}-${uid}-${o.key}`}
              primary={false}
              /* Le segment passe par la MÊME composition que la grille et la barre d'actions, en
                 variante NUE : le refus y prend sa forme unique (`aria-disabled`, clic inerte,
                 infobulle `CodexRef` et copie hors écran liée par `aria-describedby`, tous portés par
                 `GatedAction`) sans que le `.seg` perde sa géométrie. Le CONTENU est celui d'un
                 segment offert — valeur effective comprise : un refus ne change pas ce qu'on lit. */
              bare
              btnClassName={o.selected ? 'on' : ''}
              ariaPressed={!!o.selected}
            >
              {o.content ?? (
                <>
                  {o.label}
                  {o.value != null ? <> {o.value}</> : null}
                </>
              )}
            </OptionBouton>
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
            id={`${idPrefix}-${uid}-${o.key}`}
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
          id={`${idPrefix}-${uid}-${o.key}`}
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
