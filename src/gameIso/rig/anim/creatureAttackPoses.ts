/**
 * Poses d'ATTAQUE des créatures par type (data-driven via les traits → cf. engine/creatureAttacks).
 * Gabarit QUADRUPÈDE / AILÉ (squelette partagé : cou `encolure`, tête `tete`, queue `queue`,
 * pattes avant `hautAvD/basAvD/piedAvD`). Chaque attaque = un PIC de deltas d'os ; l'enveloppe
 * sinus lance le coup à mi-phase puis revient au repos (boucle). Ces poses référencent des OS
 * EXISTANTS (aucune édition des composeurs de gabarit).
 */
import type { AttackKind } from '../../../engine/creatureAttacks';

// Pics de pose (deltas d'angle d'os) par type d'attaque — gabarit quad/ailé.
const QUAD_PEAK: Partial<Record<AttackKind, Record<string, number>>> = {
  morsure: { encolure: -18, tete: 28, croupe: 5 }, // l'encolure plonge en avant, la gueule happe
  caudale: { queue: 96, croupe: -12, tronc: -5, encolure: 8 }, // la queue fouette en grand arc (corps en contre)
  cornes: { encolure: 16, tete: -36, tronc: -7 }, // tête baissée puis coup de cornes vers l'avant
  arme: { hautAvD: -48, basAvD: 36, piedAvD: 18, tronc: -9, encolure: -6 }, // patte avant lève et griffe
  souffle: { encolure: -30, tete: -22 }, // tête levée, gueule ouverte vers l'avant (souffle)
  vomi: { encolure: -8, tete: 34, tronc: 6 }, // haut-le-corps : tête projetée en avant pour vomir
  regard: { encolure: -10, tete: -6, tronc: -2 }, // tête dressée, fixe la cible (regard pétrifiant)
};

/** Existe-t-il une pose d'attaque quad/ailé pour ce type ? (sinon → attackPose par défaut du plan). */
export function hasQuadAttackPose(kind: string): boolean {
  return kind in QUAD_PEAK;
}

/** Pose d'attaque quad/ailé à `phase` (0..1) : enveloppe sinus (repos → pic → repos). PUR. */
export function quadAttackPose(kind: string, phase: number): Record<string, number> {
  const peak = (QUAD_PEAK as Record<string, Record<string, number>>)[kind];
  if (!peak) return {};
  const e = Math.sin(Math.PI * Math.max(0, Math.min(1, phase)));
  const out: Record<string, number> = {};
  for (const k in peak) out[k] = peak[k] * e;
  return out;
}
