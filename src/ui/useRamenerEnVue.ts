import { useEffect, type RefObject } from 'react';
import { prefersReducedMotion } from './useRollFrisson';

/**
 * RAMENER EN VUE — geste UNIQUE de recentrage d'un élément dans son conteneur défilant.
 *
 * Il portait quatre recopies (`PlaqueRow`, `InitiativeStrip`, `MasterDetail`, `CharacterSheet`),
 * chacune avec son propre dosage de `block`/`behavior` et son propre oubli : la préférence
 * « réduire les animations » n'était honorée nulle part, et `scrollIntoView` (absent en jsdom)
 * n'était protégé que par deux d'entre elles.
 *
 * Trois invariants, tenus ICI et nulle part ailleurs :
 *  · `block`/`inline: 'nearest'` par défaut — on ne bouge RIEN tant que la cible est visible,
 *    jamais un saut agressif en haut de rail ;
 *  · `behavior: 'smooth'` SEULEMENT si le système ne demande pas de réduire les animations
 *    (`prefersReducedMotion`, source unique) ;
 *  · appel par chaînage optionnel sur la MÉTHODE : jsdom ne l'implémente pas, et une galerie ou un
 *    test de fumée mourrait sur un « is not a function ».
 */
export function ramenerEnVue(el: Element | null | undefined, options?: ScrollIntoViewOptions): void {
  if (!el) return;
  el.scrollIntoView?.({
    block: 'nearest',
    inline: 'nearest',
    ...options,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
}

/**
 * Forme HOOK du même geste : ramène la cible en vue au FRONT MONTANT de `actif` (et à chaque
 * changement de `cle` — l'entrée au trait d'une frise change de nœud sans que `actif` retombe),
 * jamais à chaque render.
 */
export function useRamenerEnVue(ref: RefObject<Element | null>, actif: boolean, cle?: unknown): void {
  useEffect(() => {
    if (actif) ramenerEnVue(ref.current);
  }, [ref, actif, cle]);
}
