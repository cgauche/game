/**
 * VOLÉE DE BORDÉE — « Tir de batterie » (MDG ch.14 l.128), résolution PURE. Module FRÈRE de `shipCritical.ts` : ne mute
 * RIEN (l'appelant applique les Blessures + un `applyHullCritical` par pièce critique). RAW : un seul Test d'équipage
 * (Artilleur ★) produit un DR PARTAGÉ qui REMPLACE le jet de touche de chaque pièce, « pour le meilleur et pour le pire »
 * (l.128) → le DR (POSITIF OU NÉGATIF) s'ajoute aux Dégâts de chaque pièce.
 *
 * PRINCIPE (corrige une DÉRIVE : la volée ré-implémentait son propre calcul de Dégâts, larguant munitions/sous-effectif/
 * qualités) — chaque pièce est résolue par les MÊMES fonctions AGNOSTIQUES que le tir individuel : préparation d'arme
 * (`weaponWithAmmo` munition + `crewedFireWeapon` sous-effectif), DR d'Atouts (`attackDRAdjust` : Imprécise), Dégâts
 * (`effectiveWeaponDamage` + `qualitySum 'damageDR'`), Blessures (`woundsFromHit` : BE + blindage + Perforante + bypass,
 * plancher 0 navire). Seules la LOCALISATION (1d100 par gréement, ch.13 l.571 — pas de jet de touche par pièce en bordée)
 * et la détection de CRITIQUE (double sur ce 1d100, OU coque à 0 — ch.13 l.656) restent spécifiques au navire.
 */
import { d100, type RNG, defaultRNG } from './dice';
import { isDoubleRoll } from './tests';
import { effectiveWeaponDamage } from './weaponDamage';
import { woundsFromHit, shipHitLocation, type ShipRig, type ShipLocation } from './combat';
import { qualitySum, attackDRAdjust } from './qualities/dispatch';
import { mannedPosteWeapon, selectedAmmo, weaponWithAmmo } from './items';
import { crewedFireWeapon } from './crewedWeapon';
import { exposedCrew } from './shipCritical';
import type { Combatant, ShipPoste, Weapon, ItemInstance } from './types';

export interface VolleyShot {
  weaponName: string;
  /** Munition tirée (journal), si une était chargée. */
  ammoName?: string;
  /** Dégâts bruts (arme + DR partagé + qualités) avant mitigation. */
  damage: number;
  /** Blessures infligées à la coque (après BE + blindage + Perforante, plancher 0). */
  wounds: number;
  location: ShipLocation;
  /** Le 1d100 de localisation — jet de touche substitué (ch.13 l.571). */
  locRoll: number;
  /** Double sur le 1d100, OU coque déjà à 0 → Critique de navire (ch.13 l.656). */
  critical: boolean;
  /** uid de la pièce (`item.uid`) — pour poser la Recharge sur le bon poste après le tir. */
  posteUid: string;
  /** Munition TIRÉE (l'instance du stock du poste / de l'inventaire du chef) — consommée par l'appelant
   *  (`consumeAmmo`, MDG ch.12 l.410-424) : le résolveur reste PUR, aucune mutation ici. */
  ammo?: ItemInstance;
  /** Recharge effective de la pièce (Recharge N, ×2 si sous-effectif via `crewedFireWeapon`) — Rounds avant de re-tirer. */
  reload: number;
  /** Arme EFFECTIVE de la pièce (munition + sous-effectif déjà bakés) — pour rejouer les effets `onHit` et l'AIRE
   *  côté appelant SANS re-dériver l'arme (anti-duplication : `resolveVolley` la construit déjà). */
  weapon: Weapon;
}

export interface VolleyResult {
  shots: VolleyShot[];
  totalWounds: number;
}

// (La sélection de munition passe par `selectedAmmo` — SOURCE UNIQUE partagée avec le tir individuel :
//  choix ponctuel du chef `c.ammoUid` > sélection persistante du poste `poste.ammoUid` > 1re compatible,
//  pool = stock du poste (MDG ch.12 l.410-424) ∪ inventaire du chef. Pas de gate `kind:'hero'` : un
//  équipage PNJ charge aussi sa munition.)

/**
 * Résout la volée d'une bordée. `firingShip` = navire tireur ; `postes` = pièces du bord qui porte ; `target` = coque
 * cible ; `rig` = gréement de la CIBLE (colonne de localisation) ; `dr` = DR partagé du Test d'équipage Artilleur ;
 * `crew` = combattants de l'équipage tireur (pour résoudre chef + effectif de chaque pièce). PUR (RNG injecté).
 */
export function resolveVolley(
  firingShip: Combatant, postes: ShipPoste[], target: Combatant, rig: ShipRig, dr: number, crew: Combatant[], rng: RNG = defaultRNG,
): VolleyResult {
  const byId = new Map(crew.map((c) => [c.id, c] as const));
  const shots: VolleyShot[] = [];
  for (const poste of postes) {
    const servants = exposedCrew((poste.crewIds ?? []).map((id) => byId.get(id)).filter((c): c is Combatant => !!c));
    if (!servants.length) continue; // pièce non servie → ne tire pas (RAW : il faut un équipage)
    let weapon = mannedPosteWeapon(firingShip, poste);
    if (!weapon) continue; // pièce détruite
    const chef = byId.get((poste.crewIds ?? [])[0]);
    const ammo = chef ? selectedAmmo(chef, weapon) : undefined;
    if (ammo) weapon = weaponWithAmmo(weapon, ammo);
    weapon = crewedFireWeapon(weapon, servants.length); // Recharge×2 / Imprécise / Dangereuse selon l'effectif
    // DR de la pièce = DR partagé + Atouts d'attaque (Imprécise du sous-effectif). « Pour le pire » : un DR négatif
    // RÉDUIT les Dégâts (≠ tir normal où le SL est plancher 0) → on N'écrase PAS le DR à 0.
    const gunDR = dr + attackDRAdjust(weapon);
    const damage = effectiveWeaponDamage(weapon, 0) + gunDR + qualitySum(weapon, 'damageDR'); // +Pointue
    const wounds = woundsFromHit(weapon, target, 'corps', damage, 0, 0); // BE/blindage/Perforante/bypass, plancher 0
    const locRoll = d100(rng);
    shots.push({
      weaponName: weapon.name, ammoName: ammo?.name, ammo, damage, wounds, weapon, // arme effective : Atouts d'aire + effets onHit côté appelant
      location: shipHitLocation(rig, locRoll), locRoll,
      critical: isDoubleRoll(locRoll) || target.wounds.current <= 0, // double, OU coque à 0 (l.656)
      posteUid: poste.item.uid, reload: weapon.reload ?? 0, // Recharge effective (crewedFireWeapon a doublé si sous-effectif)
    });
  }
  return { shots, totalWounds: shots.reduce((s, x) => s + x.wounds, 0) };
}
