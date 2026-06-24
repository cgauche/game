/**
 * COLLISIONS & ÉPERONNAGE d'un navire — couche PURE de MDG ch.13 « Navigation maritime » (l.423-465).
 *
 * Indice de Collision (l.444) = Bonus d'Endurance + Bonus de Blessures restantes (chiffre des dizaines).
 * Quand un vaisseau en percute un autre, CHACUN des deux reçoit l'IC de L'AUTRE + le M du navire qui a
 * causé la collision ; une collision FRONTALE ajoute le M TOTAL des deux (l.462). Facteurs (l.452-462) :
 * milieu de coque → Dégâts ×2 ; poupe → +2 PA ; la victime qui s'éloigne directement → −son M (min 0) ;
 * la manœuvre (DR signé, des DEUX navires) ajuste l'IC des deux. Les coups touchent la Coque (l.464).
 */
import type { Combatant } from './types';
import { bonus, effectiveChar } from './characteristics';

/** Indice de Collision (MDG ch.13 l.444) = Bonus d'Endurance + Bonus de Blessures restantes. PUR. */
export function collisionIndex(hull: Combatant): number {
  return bonus(effectiveChar(hull, 'E')) + bonus(hull.wounds.current);
}

/** Un navire impliqué dans une collision (vu côté Dégâts : IC, M, facteurs de localisation/manœuvre). */
export interface CollisionShip {
  /** Indice de Collision (`collisionIndex`). */
  ic: number;
  /** Mouvement du navire. */
  m: number;
  /** Localisation du coup sur CE navire : milieu → Dégâts ×2 ; poupe → +2 PA (l.457/l.456). */
  struck?: 'milieu' | 'poupe';
  /** CE navire s'éloigne directement du causeur → ses Dégâts reçus sont réduits de son M, min 0 (l.455). */
  movingAway?: boolean;
  /** DR de Manœuvre de CE navire, SIGNÉ : + aggrave, − limite l'IC des DEUX navires (l.458-461). */
  maneuverDR?: number;
  /** CE navire porte un **Bélier** (Trait/Amélioration, MDG ch.12 l.221) : éperonner de sa proue ajoute 5 à
   *  son IC, et ses 5 PA frontaux le protègent du choc qu'il porte / d'un choc frontal. Dérivé des Traits via
   *  `shipHasNavalTrait` (`navalTraits.ts`). */
  belier?: boolean;
}

export interface CollisionDamage {
  /** Dégâts BRUTS (avant Bonus d'Endurance + PA de la coque, appliqués ensuite par applyOps sur la Coque). */
  damage: number;
  /** Bonus de PA pour ce coup : poupe → +2 (l.456). Appliqué à la résolution des Dégâts, pas avant. */
  armorBonus: number;
}

export interface CollisionResolved {
  causer: CollisionDamage;
  victim: CollisionDamage;
  frontal: boolean;
}

/** Dégâts bruts reçus par `taker`, l'IC EFFECTIF de l'autre navire et le terme de M déjà calculés.
 *  `extraAP` = PA additionnels du coup (ex. les 5 PA frontaux d'un Bélier), cumulés à la poupe (+2). */
function partyDamage(taker: CollisionShip, otherEffIC: number, mTerm: number, extraAP = 0): CollisionDamage {
  let damage = otherEffIC + mTerm;
  if (taker.struck === 'milieu') damage *= 2;        // milieu de coque (l.457)
  if (taker.movingAway) damage -= taker.m;           // s'éloigne directement (l.455)
  return { damage: Math.max(0, damage), armorBonus: (taker.struck === 'poupe' ? 2 : 0) + extraAP };
}

const BELIER_IC_BONUS = 5; // MDG ch.12 l.221 : « ajoute 5 à son Bonus d'Endurance pour calculer son Indice de Collision ».
const BELIER_AP = 5;       // MDG ch.12 l.221 : « le Bélier fournit 5 PA … contre tout Dégât résultant d'une collision … venant de l'avant ».

/**
 * Résout une collision/éperonnage (MDG ch.13 l.446-464) entre le `causer` (qui percute) et la `victim`.
 * La manœuvre des DEUX (DR signé) ajuste l'IC des deux avant le calcul. **Bélier** (MDG ch.12 l.221) : si le
 * causeur frappe de sa PROUE (`ramProue`, ou collision `frontal`), son Bélier ajoute 5 à son IC (la victime
 * encaisse +5) et lui octroie 5 PA frontaux contre le choc qu'il porte ; une collision frontale frappe aussi
 * la proue de la victime → son éventuel Bélier la protège également. PUR — les Dégâts bruts produits sont à
 * appliquer sur la Localisation Coque via `applyOps` (Bonus d'Endurance + PA, dont `armorBonus`).
 */
export function resolveCollision(
  causer: CollisionShip, victim: CollisionShip, opts: { frontal?: boolean; ramProue?: boolean } = {},
): CollisionResolved {
  const icAdjust = (causer.maneuverDR ?? 0) + (victim.maneuverDR ?? 0);
  const mTerm = opts.frontal ? causer.m + victim.m : causer.m;
  const causerProue = !!(opts.ramProue || opts.frontal); // le causeur frappe de sa proue
  const causerRamIC = causer.belier && causerProue ? BELIER_IC_BONUS : 0;   // Bélier offensif → victime encaisse +5
  const causerAP = causer.belier && causerProue ? BELIER_AP : 0;            // Bélier défensif (sa proue encaisse)
  const victimAP = victim.belier && opts.frontal ? BELIER_AP : 0;           // collision frontale → la proue de la victime encaisse aussi
  return {
    causer: partyDamage(causer, victim.ic + icAdjust, mTerm, causerAP),
    victim: partyDamage(victim, causer.ic + causerRamIC + icAdjust, mTerm, victimAP),
    frontal: !!opts.frontal,
  };
}
