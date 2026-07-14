import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { FigTile } from './FigTile';

export interface PickGridItem {
  id: string;
  label: string;
  sub?: string;
  preview: import('./CharacterPreview').CharacterPreviewProps;
}
export interface PickGridSection {
  id: string;
  label: string;
  items: PickGridItem[];
}

/**
 * GroupedPickGrid — grille de sélection en SECTIONS par famille/classe (en-têtes small-caps +
 * rangées de `FigTile`), motif du kit ratifié « Atelier du scribe » (#412). A11y `listbox`/`option`
 * avec roving tabindex (flèches/Home/End, MÊME patron que `Tabs`/`CelestialWheel`/`FacetedPickGrid`
 * — celui-ci n'est pas modifié, son recâblage éventuel est un chantier ultérieur).
 */
export function GroupedPickGrid({ sections, selectedId, onSelect, label }: {
  sections: PickGridSection[];
  selectedId?: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  const flat = sections.flatMap((s) => s.items);
  const activeIdx = Math.max(0, flat.findIndex((it) => it.id === selectedId));
  const ref = useRef<HTMLDivElement>(null);

  const focusIdx = (idx: number) => {
    onSelect(flat[idx].id); // selection-follows-focus (patron Tabs/CelestialWheel)
    ref.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[idx]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) || !flat.length) return;
    e.preventDefault();
    const delta = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? flat.length - 1 : (activeIdx + delta + flat.length) % flat.length;
    focusIdx(next);
  };

  let cursor = 0;
  const nodes: ReactNode[] = [];
  for (const section of sections) {
    nodes.push(
      <div className="gpg-section" key={section.id}>
        <h4 className="gpg-heading">{section.label}</h4>
        <div className="gpg-row">
          {section.items.map((it) => {
            const idx = cursor++;
            return (
              <FigTile
                key={it.id}
                preview={it.preview}
                label={it.label}
                sub={it.sub}
                selected={it.id === selectedId}
                onClick={() => onSelect(it.id)}
                tabIndex={idx === activeIdx ? 0 : -1}
              />
            );
          })}
        </div>
      </div>,
    );
  }

  return (
    <div ref={ref} role="listbox" aria-label={label} className="gpg-grid" onKeyDown={onKeyDown}>
      {nodes}
    </div>
  );
}
