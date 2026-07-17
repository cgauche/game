import type { KeyboardEvent } from 'react';

/**
 * rovingKeyDown — invariant UNIQUE du roving tabindex (pattern WAI-ARIA : flèches + Home/End
 * déplacent le focus ET activent l'élément, selection-follows-focus). Extrait de 4 duplications
 * à l'identique (#519) : `Tabs`, `GroupedPickGrid`, `CelestialWheel`, `SpeciesRaceScreen` (grille de
 * race + lignées). Fonction PURE (aucun hook interne) — certains appelants ne sont pas des
 * composants (ex. `talentsZones`, appelé conditionnellement dans un ternaire) et ne peuvent pas
 * porter de `useRef`/`useCallback` ; le conteneur est donc un simple `{ current: E | null }` fourni
 * par l'appelant (un `useRef` dans un vrai composant, un objet littéral sinon).
 *
 * `orientation: 'horizontal'` (défaut) n'écoute que Gauche/Droite/Home/End (`Tabs`, jamais de
 * rangée verticale) ; `'grid'` ajoute Haut/Bas aliasés sur le même axe (les autres sites : liste à
 * plat, pas de vraie grille 2D — Haut/Bas se comportent comme Gauche/Droite).
 */
export function rovingKeyDown<E extends Element>({
  containerRef,
  selector,
  count,
  activeIndex,
  onActivate,
  orientation = 'horizontal',
  stopPropagation = false,
}: {
  containerRef: { current: E | null };
  /** Sélecteur CSS des éléments focalisables (`[role="tab"]`, `[role="option"]`, `[role="radio"]`…). */
  selector: string;
  count: number;
  activeIndex: number;
  onActivate: (index: number) => void;
  orientation?: 'horizontal' | 'grid';
  /** Tabs vit parfois dans une modale : n'affronte pas le roving générique de `useModalA11y`. */
  stopPropagation?: boolean;
}) {
  return (e: KeyboardEvent<E>) => {
    const keys =
      orientation === 'grid'
        ? ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
        : ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key) || !count) return;
    e.preventDefault();
    if (stopPropagation) e.stopPropagation();
    const delta = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? count - 1 : (activeIndex + delta + count) % count;
    onActivate(next);
    containerRef.current?.querySelectorAll<HTMLElement>(selector)[next]?.focus();
  };
}
