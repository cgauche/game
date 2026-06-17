/**
 * Pénalités d'Encombrement — Livre de base, « Surchargé » (p.295).
 *
 * Capacité sans pénalité = Bonus de Force + Bonus d'Endurance (cf. maxEncumbrance).
 * Au-delà, le Personnage est Surchargé, par paliers exprimés en multiples de la
 * capacité :
 *
 *   | Enc porté                | Pénalité                                   |
 *   |--------------------------|--------------------------------------------|
 *   | ≤ capacité               | aucune                                     |
 *   | ≤ 2× capacité (palier 1) | −1 Mouvement (min 3), −10 Agilité, +1 Fat. |
 *   | ≤ 3× capacité (palier 2) | −2 Mouvement (min 2), −20 Agilité, +2 Fat. |
 *   | > 3× capacité (palier 3) | immobilisé                                 |
 *
 * « Des pénalités de Mouvement […] sont appliquées immédiatement. » La Fatigue
 * du voyage (États Exténué) s'accumule en fin de journée de voyage — échelle
 * voyage, non appliquée automatiquement en combat tactique.
 */
import { Combatant } from './types';
import { maxEncumbrance, totalEncumbrance } from './items';
import { hasCondition } from './conditions';
import { traumaMovementHalved, passiveMoveMod } from './trauma';

export interface EncumbrancePenalties {
  /** Palier de surcharge : 0 (aucune) à 3 (immobilisé). */
  tier: 0 | 1 | 2 | 3;
  /** Réduction de Mouvement (cases) à appliquer. */
  movePenalty: number;
  /** Plancher de Mouvement du palier (le Mouvement ne descend pas en dessous). */
  moveFloor: number;
  /** Modificateur signé aux tests d'Agilité (0 / −10 / −20). */
  agilityPenalty: number;
  /** États Exténué gagnés par journée de voyage (échelle voyage). */
  travelFatigue: number;
  /** Surcharge > 3× la capacité : déplacement impossible. */
  immobile: boolean;
}

/** Pénalités d'Encombrement d'un combattant selon le Livre de base (p.295). */
export function encumbrancePenalties(c: Combatant): EncumbrancePenalties {
  const cap = maxEncumbrance(c);
  const enc = totalEncumbrance(c);

  // Capacité non finie (combattant sans F/E — données incomplètes) : aucun palier (et surtout pas
  // « immobile », ce que donneraient les comparaisons `enc <= NaN` toutes fausses).
  if (!Number.isFinite(cap) || enc <= cap) return { tier: 0, movePenalty: 0, moveFloor: 0, agilityPenalty: 0, travelFatigue: 0, immobile: false };
  if (enc <= cap * 2) return { tier: 1, movePenalty: 1, moveFloor: 3, agilityPenalty: -10, travelFatigue: 1, immobile: false };
  if (enc <= cap * 3) return { tier: 2, movePenalty: 2, moveFloor: 2, agilityPenalty: -20, travelFatigue: 2, immobile: false };
  // > 3× la capacité : « Vous ne pouvez pas vous déplacer. » Le LDB ne précise
  // pas de malus d'Agilité distinct ici ; on conserve celui du palier 2.
  return { tier: 3, movePenalty: Infinity, moveFloor: 0, agilityPenalty: -20, travelFatigue: 2, immobile: true };
}

/**
 * Mouvement effectif après pénalité d'Encombrement.
 * effM = min(baseM, max(baseM − pénalité, plancher)) — le plancher n'augmente
 * jamais un Mouvement déjà inférieur ; 0 si immobilisé.
 */
export function effectiveMovement(c: Combatant): number {
  const p = encumbrancePenalties(c);
  // Empêtré (LDB 16-États l.85) / Surpris (l.132 « ni Mouvement ni Action ») : Mouvement = 0.
  if (p.immobile || hasCondition(c, 'empetre') || hasCondition(c, 'surpris')) return 0;
  // `moveMod` ADDITIF du collecteur passif unifié : mutation PERMANENTE (Pattes d'animaux +1 / Corpulent /
  // Court sur pattes −1, kind `intrinsèque`) + sort actif (kind `magique`) — sommés avant tout demi-Mouvement.
  const mv = Math.max(0, c.movement + passiveMoveMod(c));
  const base = p.tier === 0 ? mv : Math.min(mv, Math.max(mv - p.movePenalty, p.moveFloor));
  // Demi-Mouvement : Sonné (LDB 16 l.123), À Terre (= ramper à ½ Mouvement, l.37), OU traumatisme de
  // jambe/torse (LDB 18 : Déchirure/Fracture). Un seul halving (pas de cumul inventé).
  return (hasCondition(c, 'sonne') || hasCondition(c, 'a-terre') || traumaMovementHalved(c)) ? Math.floor(base / 2) : base;
}

/** Modificateur signé aux tests d'Agilité dû à l'Encombrement (0 / −10 / −20). */
export function agilityTestPenalty(c: Combatant): number {
  return encumbrancePenalties(c).agilityPenalty;
}
