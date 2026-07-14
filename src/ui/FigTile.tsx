import { CharacterPreview, type CharacterPreviewProps } from './CharacterPreview';

/**
 * FigTile — tuile-figurine compacte cliquable (compose `CharacterPreview` + libellé + état `.sel`,
 * motif `.plaq`/`.cs-tcard` du kit ratifié « Atelier du scribe », #412). La brique de rangée d'une
 * `GroupedPickGrid` (races/carrières/candidats) — jamais un `<button>` + portrait recodés à la main.
 */
export function FigTile({ preview, label, sub, selected, onClick, tabIndex = -1 }: {
  /** `size`/`ambiance` fixés par la tuile (`sm`/`panel`) — les fournir ici est sans effet. */
  preview: CharacterPreviewProps;
  label: string;
  sub?: string;
  selected?: boolean;
  onClick: () => void;
  /** Roving tabindex (posé par `GroupedPickGrid`) — 0 pour la tuile active du groupe, -1 sinon. */
  tabIndex?: number;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      tabIndex={tabIndex}
      className={`fig-tile${selected ? ' sel' : ''}`}
      onClick={onClick}
    >
      <CharacterPreview {...preview} size="sm" ambiance="panel" />
      <span className="fig-tile-name">{label}</span>
      {sub && <span className="fig-tile-sub">{sub}</span>}
    </button>
  );
}
