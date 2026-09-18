export const FEUILLES_PARTAGEES: readonly string[];

export interface RegleCss {
  selecteurs: string[];
  corps: string;
  /** Préludes at-rule empilés, joints par ` && ` — `null` au premier niveau. */
  media: string | null;
}

export function reglesCss(texte: string): RegleCss[];
export function declarations(corps: string): { prop: string; valeur: string }[];
export const PROPRIETES_DE_PLACEMENT: ReadonlySet<string>;
export const PROPRIETES_A_ECHELLE: ReadonlySet<string>;
export function estPlacement(prop: string): boolean;
export function valeurHorsEchelle(valeur: string): boolean;
