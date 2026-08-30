export interface EcartsDeStock {
  /** Clés OBSERVÉES absentes du stock (décorées par `remede.neuve`). */
  neuves: string[];
  /** Clés du STOCK que l'observé ne porte plus (décorées par `remede.perimee`). */
  perimees: string[];
  /** Clés DISTINCTES du stock — le plafond, lui, reste au test. */
  taille: number;
}

export function ecartsDeStock<O, S>(p: {
  observe: Iterable<O>;
  stock: Iterable<S>;
  cle: (entree: O | S) => string;
  remede?: {
    neuve?: (cle: string, entree: O) => string;
    perimee?: (cle: string) => string;
  };
}): EcartsDeStock;

export function champsAveugles<E extends Record<string, unknown>>(
  stock: Iterable<E>,
  cle: (entree: E) => string,
  champs: readonly (keyof E & string)[],
): string[];

export function lignesMalQualifiees(
  stock: Iterable<readonly [string, { lot?: string; date?: string }]>,
  opts?: { lotsConnus?: Iterable<string> },
): string[];
