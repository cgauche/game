/**
 * Couche ÉCONOMIQUE des qualités d'OBJET (artisanat, LDB 60 l.43-92). Pure, sans état :
 * renvoie des FACTEURS / déltas que le Marchand (#2) applique aux prix/disponibilités catalogue.
 * N'agit que sur les qualités `subType: 'Objet'` (les qualités d'arme/armure n'altèrent pas le prix).
 */
import { resolveQualities, type QualityCarrier } from './dispatch';

export type Availability = 'Commune' | 'Limitée' | 'Rare' | 'Exotique';
/** Échelle du plus COURANT au plus RARE (LDB 59). */
export const AVAILABILITY_LADDER: Availability[] = ['Commune', 'Limitée', 'Rare', 'Exotique'];

const craftDefs = (c: QualityCarrier | undefined) => resolveQualities(c).filter((r) => r.def.subType === 'Objet');

/** Nombre d'Atouts d'objet (multiplicité = répétition dans la liste). */
export function craftAtoutCount(c: QualityCarrier | undefined): number {
  return craftDefs(c).filter((r) => r.def.type === 'Atout').length;
}
/** Nombre de Défauts d'objet. */
export function craftDefautCount(c: QualityCarrier | undefined): number {
  return craftDefs(c).filter((r) => r.def.type === 'Défaut').length;
}

/** Facteur multiplicatif du prix : chaque Atout ×2, chaque Défaut ÷2 (LDB 60 l.47/75). */
export function craftPriceFactor(c: QualityCarrier | undefined): number {
  return 2 ** craftAtoutCount(c) * 0.5 ** craftDefautCount(c);
}

/** Délta d'Encombrement dû à l'artisanat (Léger -1 / Volumineux +1, LDB 60 l.56/91). */
export function craftEncDelta(c: QualityCarrier | undefined): number {
  return resolveQualities(c).reduce((s, r) => s + (r.def.encDelta ?? 0), 0);
}

/**
 * Disponibilité après modification par l'artisanat : chaque Atout rend +1 cran plus RARE, chaque
 * Défaut +1 cran plus COURANT (LDB 60 l.47/75). Exception : Exotique n'est pas rendu plus courant
 * par un Défaut (l.77). Option Guilde (l.69-72) : les Défauts RÉDUISENT la dispo et le 1er Atout ne
 * la réduit pas.
 */
export function shiftAvailability(base: Availability, c: QualityCarrier | undefined, opts: { guild?: boolean } = {}): Availability {
  const atouts = craftAtoutCount(c);
  const defauts = craftDefautCount(c);
  let idx = AVAILABILITY_LADDER.indexOf(base);
  if (idx < 0) return base;
  if (opts.guild) {
    idx += Math.max(0, atouts - 1); // le 1er Atout ne réduit pas la dispo
    idx -= defauts; // les Défauts réduisent la dispo
  } else {
    idx += atouts;
    if (base !== 'Exotique') idx -= defauts; // Exotique : non rendu plus courant par un Défaut
  }
  return AVAILABILITY_LADDER[Math.max(0, Math.min(AVAILABILITY_LADDER.length - 1, idx))];
}

/**
 * Classe de qualité (LDB 60 l.44/46/74) : **Haute Qualité** = aucun Défaut ET plus d'Atouts que
 * l'Encombrement ; **Qualité** = plus d'Atouts que de Défauts ; **Défectueuse** = l'inverse ;
 * sinon **Standard**. `enc` = Encombrement de base de l'objet.
 */
export function qualityClass(c: QualityCarrier | undefined, enc: number): 'Haute Qualité' | 'Qualité' | 'Défectueuse' | 'Standard' {
  const a = craftAtoutCount(c);
  const d = craftDefautCount(c);
  if (d === 0 && a > enc) return 'Haute Qualité';
  if (a > d) return 'Qualité';
  if (d > a) return 'Défectueuse';
  return 'Standard';
}
