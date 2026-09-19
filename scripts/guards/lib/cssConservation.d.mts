export interface DeclarationAplatie {
  pos: number;
  rel: string;
  media: string;
  sel: string;
  prop: string;
  valeur: string;
  important: boolean;
}
export function deplierImports(entree: string, lire: (rel: string) => string | null): { rel: string; texte: string }[];
export function poids(selecteur: string): [number, number, number];
export function specificite(selecteur: string): string;
export function comparerPoids(a: string, b: string): -1 | 0 | 1;
export function sujet(selecteur: string): string;
export function aplatir(entree: string, lire: (rel: string) => string | null): DeclarationAplatie[];
export function ecarts(avant: DeclarationAplatie[], apres: DeclarationAplatie[]): { disparues: DeclarationAplatie[]; apparues: DeclarationAplatie[] };
export function inversions(avant: DeclarationAplatie[], apres: DeclarationAplatie[]): { groupe: string; a: string; b: string; deplacements: [string, string][] }[];
export function bascules(avant: DeclarationAplatie[], apres: DeclarationAplatie[]): { avant: string; apres: string; contre: string; gagnaitAvant: boolean; gagneApres: boolean }[];
