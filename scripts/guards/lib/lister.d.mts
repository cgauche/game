export const parUnitesDeCode: (a: string, b: string) => number;
export const parLibelle: (a: string, b: string) => number;
export function listerDossier(dir: string, options?: { absent?: 'lever' | 'vide' }): string[];
export function listerArbre(
  dir: string,
  options?: { filtre?: (rel: string) => boolean; descendre?: (rel: string) => boolean; absent?: 'lever' | 'vide' },
): string[];
