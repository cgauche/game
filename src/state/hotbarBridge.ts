/**
 * Pont composant↔clavier de la hotbar : l'ActionBar (UI) publie ICI ses capacités VISIBLES (dans
 * l'ordre d'affichage) à chaque rendu du tour d'un héros ; le registre de raccourcis (state) lit
 * `hotbar.slots[n-1]` et appelle son `run` (si non désactivé). State-clean : ne porte QUE l'action et
 * son état désactivé — aucun ReactNode (le rendu/les libellés restent côté ActionBar).
 */
export const hotbar: { slots: { run: () => void; disabled?: boolean }[] } = { slots: [] };
