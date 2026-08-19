/**
 * Pont composant↔clavier de la hotbar : l'ActionBar (UI) publie ICI ses capacités VISIBLES (dans
 * l'ordre d'affichage) à chaque rendu du tour d'un héros ; le registre de raccourcis (state) lit
 * `hotbar.slots[n-1]` et appelle son `run` (si non désactivé). State-clean : ne porte QUE l'IDENTITÉ
 * de l'action (`actionId` du registre `src/data/actions.json`), son dispatcher et son état désactivé —
 * aucun ReactNode, et plus aucune closure anonyme sans identité (spec HUD « Zone 12 »).
 */
export const hotbar: { slots: { actionId: string; run: () => void; disabled?: boolean }[] } = { slots: [] };
