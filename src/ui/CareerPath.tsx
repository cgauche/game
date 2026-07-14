import { Fragment, useRef, type KeyboardEvent } from 'react';
import { MetalStatus } from './MetalStatus';
import type { CareerLevelData } from '../data';

/**
 * CareerPath — chemin d'évolution d'une carrière en 4 niveaux (médaillons niveau/nom/statut,
 * motif `.cc-path`/`.cc-step` du kit ratifié « Atelier du scribe », #412). Consomme les
 * `CareerLevelData` réels d'une carrière (`levelsForCareer`, `src/data`) — jamais de niveau inventé.
 *
 * `onSelect` (optionnel) rend la chaîne EXPLORABLE (correctif utilisateur 2026-07-14, créateur
 * Carrière) : chaque médaillon devient un bouton `role="radio"` (groupe exclusif — `radiogroup` sur
 * la chaîne, roving tabindex flèches/Home/End) qui bascule le rang consulté (`selected`, anneau doré)
 * — le CHOIX de création reste au niveau 1 (`draft.ts` ne lit jamais ce rang consulté, c'est une pure
 * exploration en LECTURE du détail). Sans `onSelect`, la chaîne reste un simple repère non cliquable
 * (`role="list"`, ex. galerie design system).
 */
export function CareerPath({ levels, currentLevel, selected, onSelect }: {
  /** Niveaux de la carrière, triés (`levelsForCareer`). */
  levels: CareerLevelData[];
  /** Niveau courant du héros — met en évidence son médaillon (`.now`). */
  currentLevel?: number;
  /** Rang CONSULTÉ (exploration du détail) — met en évidence son médaillon (`.sel`, anneau doré). */
  selected?: number;
  /** Bascule le rang consulté ; omis = chaîne non interactive (repère seul). */
  onSelect?: (level: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const activeIdx = Math.max(0, levels.findIndex((l) => l.level === selected));

  const focusIdx = (idx: number) => {
    onSelect?.(levels[idx].level);
    ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[idx]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onSelect || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || !levels.length) return;
    e.preventDefault();
    const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? levels.length - 1 : (activeIdx + delta + levels.length) % levels.length;
    focusIdx(next);
  };

  return (
    <div
      ref={ref}
      className="cc-path row-flex"
      role={onSelect ? 'radiogroup' : 'list'}
      aria-label="Chemin de carrière"
      onKeyDown={onKeyDown}
    >
      {levels.map((lvl, i) => {
        const isSelected = lvl.level === selected;
        const body = (
          <>
            <span className="cc-step-lv">Niveau {lvl.level}</span>
            <span className="cc-step-nm" title={lvl.label}>{lvl.label}</span>
            <MetalStatus status={lvl.status} size="chip" />
          </>
        );
        return (
          <Fragment key={lvl.level}>
            {i > 0 && <span className="cc-link" aria-hidden="true" />}
            {onSelect ? (
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={i === activeIdx ? 0 : -1}
                className={`cc-step${lvl.level === currentLevel ? ' now' : ''}${isSelected ? ' sel' : ''}`}
                onClick={() => onSelect(lvl.level)}
              >
                {body}
              </button>
            ) : (
              <div className={`cc-step${lvl.level === currentLevel ? ' now' : ''}`} role="listitem">
                {body}
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
