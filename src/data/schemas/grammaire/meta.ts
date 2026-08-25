/**
 * MÉTA D'ÉDITION d'un champ de document (#1466 L1a) — le libellé FR et l'aide d'atelier vivent AU
 * MÊME ENDROIT que la forme du champ : `document()` exige une `MetaChamp` par clé de `champs`, si
 * bien qu'un champ ne peut pas exister sans son nom lisible (aujourd'hui l'éditeur affiche la clé
 * technique, `src/ui/compendium/editFields.ts`).
 */

/** Méta d'édition d'UN champ de premier niveau d'un document. */
export interface MetaChamp {
  /** Libellé FR affiché par l'atelier (Codex/Compendium) à la place de la clé technique. */
  label: string;
  /** Aide d'atelier — jamais une prose de document (règle stricte 5 : la prose du RAW vit dans `desc`). */
  hint?: string;
  /** Widget de saisie demandé, quand la forme zod n'en désigne pas un seul (dérivation : lot L6). */
  widget?: string;
  /** Rang d'affichage dans le formulaire ; à défaut, l'ordre de déclaration des `champs`. */
  ordre?: number;
}

/** Méta EXIGÉE pour chaque clé de `champs` d'un document — une clé de moins = erreur de type. */
export type MetaDesChamps<C> = { [K in keyof C]: MetaChamp };
