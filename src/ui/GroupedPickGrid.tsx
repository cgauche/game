import { useRef, type ReactNode } from 'react';
import { FigTile } from './FigTile';
import { rovingKeyDown } from './rovingFocus';

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
 * avec roving tabindex (`rovingKeyDown`, MÊME primitive que `Tabs`/`CelestialWheel`/`SpeciesRaceScreen`).
 */
export function GroupedPickGrid({ sections, selectedId, sealedId, onSelect, label }: {
  sections: PickGridSection[];
  selectedId?: string;
  /** Tuile SCELLÉE (machine à états de l'ossature #393 : choix validé → sceau `WaxSeal` via
   *  `FigTile.sealed`) — id de l'élue une fois l'étape validée, absent sinon. */
  sealedId?: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  const flat = sections.flatMap((s) => s.items);
  const activeIdx = Math.max(0, flat.findIndex((it) => it.id === selectedId));
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = rovingKeyDown<HTMLDivElement>({
    containerRef: ref,
    selector: '[role="option"]',
    count: flat.length,
    activeIndex: activeIdx,
    onActivate: (idx) => onSelect(flat[idx].id),
    orientation: 'grid',
  });

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
                sealed={sealedId != null && it.id === sealedId}
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
