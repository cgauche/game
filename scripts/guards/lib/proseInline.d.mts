/** Descripteur ENTIER d'une racine de documents — aucune clé à résoudre. */
export interface RacineProse {
  readonly dossier: string;
  readonly suffixe: string;
  readonly recursif: boolean;
}

export const RACINE_DEPOT: string;
export const RACINES_PROSE: readonly RacineProse[];

export function livresExtraits(root?: string): Set<string>;
export function typeDuDocument(doc: unknown, chemin: string): string;
export function mesurerProseInline(
  racines?: readonly RacineProse[],
  root?: string,
): Record<string, { entrees: number; noeuds: string[] }>;
