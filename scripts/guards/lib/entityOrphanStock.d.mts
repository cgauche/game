export const ENTITY_ORPHAN_RATCHET: ReadonlySet<string>;
/** Une ligne-FAMILLE du stock : prédicat `(category, book)` + plafond décroissant + disposition. */
export interface EntityOrphanFamily { category: string; book: string; max: number; note: string }
export const ENTITY_ORPHAN_FAMILIES: ReadonlyArray<EntityOrphanFamily>;
