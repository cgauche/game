/**
 * VOLÉE DE BORDÉE — « Tir de batterie » (MDG ch.14 l.128), résolution PURE des Dégâts. Module FRÈRE de
 * `shipCritical.ts` : il ne mute RIEN (l'appelant applique les Blessures à la coque + un `applyHullCritical`
 * par pièce critique). RAW : un seul Test d'équipage (Artilleur essentiel) produit un DR PARTAGÉ qui REMPLACE
 * le jet de touche de chaque pièce et « s'applique à toutes les armes à feu tournées vers l'ennemi, pour le
 * meilleur et pour le pire » (ch.14 l.128). Donc, par pièce du bord qui porte :
 *  - **Dégâts** = Dégâts de l'arme + DR partagé (l.128) − BE de la coque − PA (blindage) ; **plancher 0**
 *    (un navire peut ne subir AUCUN Dégât — ch.13 l.605 ; « pour le pire » = DR négatif → Dégâts réduits/nuls),
 *    ≠ le plancher 1 des personnages.
 *  - **Localisation** = 1d100 (ch.13 l.571 : « inversez le jet d'attaque OU lancez 1d100 » — il n'y a plus de
 *    jet de touche par pièce en bordée), table par gréement (`shipHitLocation`).
 *  - **Critique** : ce 1d100 SUBSTITUE le jet de touche (l.571) → un **double** dessus = Critique de navire
 *    (ch.13 l.656) — cohérent : en combat normal un double au jet d'attaque reste un double une fois inversé.
 */
import { d100, type RNG, defaultRNG } from './dice';
import { isDoubleRoll } from './tests';
import { bonus, effectiveChar, effectiveArmourAt } from './characteristics';
import { effectiveWeaponDamage } from './weaponDamage';
import { shipHitLocation, type ShipRig, type ShipLocation } from './combat';
import { qualitySum } from './qualities/dispatch';
import { mannedPosteWeapon } from './items';
import type { Combatant, ShipPoste } from './types';

export interface VolleyShot {
  /** Nom de la pièce (journal). */
  weaponName: string;
  /** Dégâts bruts de la pièce (arme + DR partagé) avant mitigation. */
  damage: number;
  /** Blessures infligées à la coque (après BE + blindage, plancher 0). */
  wounds: number;
  /** Localisation touchée (1d100, ch.13 l.571). */
  location: ShipLocation;
  /** Le 1d100 de localisation — sert AUSSI de jet de touche substitué (l.571) : `forcedLocRoll` du Critique. */
  locRoll: number;
  /** Double sur le 1d100 → Critique de navire (ch.13 l.656). */
  critical: boolean;
}

export interface VolleyResult {
  shots: VolleyShot[];
  /** Σ des Blessures de toutes les pièces (appliquée à la coque cible par l'appelant). */
  totalWounds: number;
}

/**
 * Résout la volée d'une bordée. `firingShip` = navire tireur (source des pièces) ; `postes` = pièces du bord
 * qui porte (filtrées par `resolveBattery`) ; `target` = coque cible (BE/blindage) ; `rig` = gréement de la
 * CIBLE (colonne de Localisation) ; `dr` = DR partagé du Test d'équipage Artilleur. PUR (RNG injecté).
 */
export function resolveVolley(
  firingShip: Combatant, postes: ShipPoste[], target: Combatant, rig: ShipRig, dr: number, rng: RNG = defaultRNG,
): VolleyResult {
  const tb = bonus(effectiveChar(target, 'E'));
  const ap = Math.max(0, effectiveArmourAt(target, 'corps')); // blindage de coque (0 si nue)
  const shots: VolleyShot[] = [];
  for (const poste of postes) {
    const weapon = mannedPosteWeapon(firingShip, poste);
    if (!weapon) continue; // pièce détruite
    const damage = effectiveWeaponDamage(weapon, 0) + dr; // pas de BF pour une pièce d'artillerie ; DR partagé (l.128)
    const effAP = Math.max(0, ap - qualitySum(weapon, 'armourReduction')); // Perforante de la pièce, le cas échéant
    const wounds = Math.max(0, damage - tb - effAP); // plancher 0 (un navire peut ne rien subir, ch.13 l.605)
    const locRoll = d100(rng); // 1d100 de localisation = jet de touche substitué (ch.13 l.571)
    shots.push({
      weaponName: weapon.name, damage, wounds,
      location: shipHitLocation(rig, locRoll), locRoll,
      critical: isDoubleRoll(locRoll), // double → Critique de navire (ch.13 l.656)
    });
  }
  return { shots, totalWounds: shots.reduce((s, x) => s + x.wounds, 0) };
}
