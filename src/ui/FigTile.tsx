import { CharacterPreview, type CharacterPreviewAmbiance, type CharacterPreviewProps } from './CharacterPreview';
import { WaxSeal } from './WaxSeal';

/**
 * FigTile — LE cadre-figurine UNIQUE (#430) : la figurine occupe la tuile EN PLEIN (full-bleed,
 * `.fig-tile > .charprev` posé en absolu dans l'enceinte bordée `.fig-tile`) — jamais un cadre
 * imbriqué dans un autre. Légende (nom + méta) en bandeau bas dégradé, état sélectionné = liseré
 * or, sceau optionnel (`sealed`, patron plaque scellée `WaxSeal`). Styles dans `frames.css`
 * (cascade APRÈS creator.css dans `styles.css` — redéclare intégralement `.fig-tile*`, l'ancien
 * motif « tuile en bois + `charprev-amb-panel` imbriqué » de creator.css #412 est ainsi mort par
 * cascade, sans toucher ce fichier hors périmètre).
 */
export function FigTile({ preview, label, sub, selected, sealed, ambiance = 'spotlight', onClick, tabIndex = -1, className }: {
  preview: CharacterPreviewProps;
  label: string;
  sub?: string;
  selected?: boolean;
  /** Sceau de cire au coin (candidat/rang « scellé ») — absent = pas de sceau. */
  sealed?: boolean;
  /** Ambiance NOMMÉE de la figurine (jamais le gris `panel` implicite, #430) — `spotlight` par défaut. */
  ambiance?: CharacterPreviewAmbiance;
  onClick: () => void;
  /** Roving tabindex (posé par `GroupedPickGrid`) — 0 pour la tuile active du groupe, -1 sinon. */
  tabIndex?: number;
  /** Modificateur d'appelant (ex. liseré de borne « tirée », `.rolled`) — jamais un second cadre,
   *  une classe ADDITIVE sur l'enceinte UNIQUE. */
  className?: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      tabIndex={tabIndex}
      className={`fig-tile${selected ? ' sel' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      <CharacterPreview {...preview} size="fill" ambiance={ambiance} />
      {sealed && <WaxSeal size={26} className="fig-tile-seal" />}
      <span className="fig-tile-legend">
        <span className="fig-tile-name">{label}</span>
        {sub && <span className="fig-tile-sub">{sub}</span>}
      </span>
    </button>
  );
}
