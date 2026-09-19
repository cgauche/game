export const FEUILLES_PARTAGEES: readonly string[];
export const RACINE_DES_MODULES: string;
export function moduleHorsCouche(fichier: string, css: string): boolean;

export interface RegleCss {
  selecteurs: string[];
  corps: string;
  /** Préludes at-rule empilés, joints par ` && ` — `null` au premier niveau. */
  media: string | null;
}

export function reglesCss(texte: string): RegleCss[];
/** Découpe une liste de sélecteurs sur ses virgules de NIVEAU 0 (hors `:has()`/`:is()`/`[attr]`). */
export function decoupeSelecteurs(tete: string): string[];
export function declarations(corps: string): { prop: string; valeur: string }[];
export const PROPRIETES_DE_PLACEMENT: ReadonlySet<string>;
export const PROPRIETES_A_ECHELLE: ReadonlySet<string>;
export function estPlacement(prop: string): boolean;
export function valeurHorsEchelle(valeur: string): boolean;
