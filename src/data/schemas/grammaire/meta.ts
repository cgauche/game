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
  /**
   * Libellé FR de chaque VALEUR d'un champ ENUMÉRÉ (#1686 lot 3a-2) — le pendant de `label`, un cran
   * plus bas : `label` nomme le champ, `valeurs` nomme ce qu'il peut valoir. Les clés sont les options
   * de l'enum, la fabrique l'exige (`document()` refuse une clé de plus, une de moins, ou un `valeurs`
   * sur un champ qui n'est pas énuméré) : un site d'affichage lit donc `valeurs` sans jamais tenir sa
   * propre table par valeur, et le `select` de l'atelier en tire À LA FOIS ses options et leurs noms.
   */
  valeurs?: Readonly<Record<string, string>>;
}

/** Méta EXIGÉE pour chaque clé de `champs` d'un document — une clé de moins = erreur de type. */
export type MetaDesChamps<C> = { [K in keyof C]: MetaChamp };

/**
 * LIBELLÉ FR d'une VALEUR d'un champ énuméré — lecture canonique de `MetaChamp.valeurs` (#1686 lot
 * 3a-2), partagée par le Codex (groupe/sous-titre/fait), le `select` de l'atelier et tout site
 * d'affichage. Repli sur la valeur BRUTE : la donnée reste lisible même quand un def n'a pas encore
 * nommé ses valeurs (stock décroissant, `valeurs-de-champ.test.ts`).
 */
export function libelleDeValeur(meta: Readonly<Record<string, MetaChamp>> | undefined, champ: string, valeur: string): string {
  return meta?.[champ]?.valeurs?.[valeur] ?? valeur;
}

/** Valeurs NOMMÉES d'un champ énuméré (`valeur → libellé FR`), ou `undefined` si le champ n'est pas
 *  énuméré, ou si son def ne nomme pas ses valeurs — l'ordre des clés EST celui de l'enum
 *  (`document()` l'exige). C'est ce qui fait d'un champ un `select` : ses options ET leurs noms
 *  viennent du def. */
export function valeursDuChamp(meta: Readonly<Record<string, MetaChamp>> | undefined, champ: string): Readonly<Record<string, string>> | undefined {
  return meta?.[champ]?.valeurs;
}
