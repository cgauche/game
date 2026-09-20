/** Une ligne de test qui compare une VALEUR de design à du CSS lu. */
export interface SiteValeurCss {
  file: string;
  line: number;
  /** La valeur épinglée, telle qu'écrite (`'265px'`, `'44'`, `'calc(…'`). */
  valeur: string;
  texte: string;
}

export function estNormeDite(ligne: string): boolean;
export function litDuCss(ligne: string): boolean;
export function valeurEpinglee(ligne: string): string | null;
export function sitesValeurCss(fichiers: { rel: string; text: string }[]): SiteValeurCss[];
