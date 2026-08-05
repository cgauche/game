import type { QuadProps } from './quadSkeleton';

/**
 * Art d'une PART du gabarit quadrupède (tête, queue…) pour une vue : SVG constant, ou FONCTION des
 * axes de gabarit — dans ce cas la def DÉCLARE les axes consommés (`params`), et les gardes de
 * contrat les mesurent à l'exécution (design v2 §1 de #1082 : « le socle ÉCHOUE si un axe consommé
 * n'est pas déclaré »).
 */
export type QuadArt = string | ((p: QuadProps) => string);

/** Résout un art de def. Absent = la part ne peint rien sur ce canal. */
export const quadArt = (a: QuadArt | undefined, p: QuadProps): string =>
  typeof a === 'function' ? a(p) : a ?? '';
