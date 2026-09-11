/** Déclaration TS du vocabulaire des bindings vifs (#1692) — cf. `bindingsVifs.mjs`. */
export const RACINE: string;
export function sansCommentaires(src: string): string;
export function bindingsVifs(): Map<string, string>;
export function clesDuSeam(): string[];
export function nomsVifsDuFichier(src: string, parBinding: Map<string, string>): Map<string, string>;
export function espacesDeNomsDuFichier(src: string): string[];
export function accesseursVifs(): Set<string>;
export function accesseursDuFichier(src: string, vifs: Set<string>): Set<string>;
export function declarationsDeNiveauModule(src: string): { ligne: number; texte: string; boucle?: boolean }[];
export function indexFiges(chemin: string, src: string, parBinding: Map<string, string>, vifs?: Set<string>): string[];
export function resolveursDentree(): Set<string>;
export function ecrituresHorsSeam(chemin: string, src: string, parBinding: Map<string, string>, resolveurs?: Set<string>): string[];
export function fichiersSources(): string[];
export function fichiersDuSeam(): Set<string>;
