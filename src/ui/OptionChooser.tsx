import type { ReactNode } from 'react';

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
}: {
  options: RollOption[];
  layout: 'seg' | 'grid' | 'actions';
  /** Mini-titre du groupe (surtout layout `seg`) — ex. « Réaction ». */
  groupLabel?: ReactNode;
}) {
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
        {shown.map((o) => (
          <button
            key={o.key}
            className={`btn small${o.primary ? ' btn-primary' : ''}`}
            disabled={o.disabled}
            onClick={o.onSelect}
            title={o.title}
          >
            {o.content ?? (
              <>
                {o.label}
                {o.value != null ? <> ({o.value})</> : null}
              </>
            )}
          </button>
        ))}
      </div>
    );
  }

  // layout === 'actions'
  return (
    <div className="modal-actions">
      {shown.map((o) => (
        <button
          key={o.key}
          className={`btn${o.primary ? ' btn-primary' : ''}${o.ghost ? ' btn-ghost' : ''}`}
          disabled={o.disabled}
          onClick={o.onSelect}
          title={o.title}
        >
          {o.content ?? o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Choix à boutons d'une popin de décision (Renoncer, Sauvegarde Destin, Piège à lame, Cible montée) —
 * `OptionChooser` en barre d'actions. Source UNIQUE des paires de boutons de choix, jusqu'ici
 * réécrites à la main (`.modal-actions` copié-collé).
 */
export function ChoiceButtons({ options }: { options: RollOption[] }) {
  return <OptionChooser options={options} layout="actions" />;
}
