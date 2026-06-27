/**
 * RÉSOLVEUR D'AIRE des munitions/armes à effet de zone — SOURCE UNIQUE partagée par le tir individuel
 * (`combatFlow.applyAttackResult`) ET la bordée navale (`combatSlice.shipBatteryConfirm`). Module FEUILLE
 * (convention « baril ») : n'importe RIEN de combatFlow ; combatFlow le ré-exporte (`export * from './combatArea'`).
 *
 * Lit GÉNÉRIQUEMENT les capacités d'arme (`resolveQualities` → `caps`) — aucun id d'arme ni chemin naval bespoke :
 *  - **Tir de zone (Indice)** (Aux Armes p.89 / MDG ch.12 l.466-472) : selon la bande de portée —
 *      · Bout portant → la cible seule, **+Indice aux Dégâts** (RAW ; ≠ l'ancien « +Indice Blessures » brut) ;
 *      · Courte à Longue → la cible **+ les Indice cibles les plus proches** ;
 *      · Extrême → comme Courte-Longue mais **−Indice aux Dégâts** (bande jadis manquante).
 *  - **Explosion (Indice)** (LDB p.298) : « Tous les Personnages situés à Indice mètres du point cible frappé
 *      subissent DR + Dégâts d'arme et gagnent tous les États infligés par l'arme. » → DR+Dégâts (déjà dans
 *      `damage`) + propagation des États PAR LE CHEMIN GÉNÉRIQUE `fireTriggers(...,'onHit',...)` (pas de pose bespoke).
 *
 * SOURCE DES CIBLES SECONDAIRES — DEUX branches PROPRES dans `areaTargets`, dispatchées sur la NATURE de la
 * cible primaire (composition LITTÉRALE de deux règles RAW, aucune invention) :
 *  - **cible = personnage (terre)** : rayon métrique Chebyshev autour de la cible, converti à l'échelle de la
 *    scène (`metresPerTile`, 2 m person-scale) — PAS le « 2 m » codé en dur ;
 *  - **cible = navire (mer, `bodyShape:'vehicule'`)** : COMPOSITION de MDG ch.13 (un coup à la Localisation
 *    « Équipage » touche un marin EXPOSÉ « comme un combat normal ») × MDG ch.12 l.466-472 / LDB p.298 (Tir de
 *    zone ajoute les Indice plus proches ; Explosion touche tous dans le rayon) → l'aire balaie l'ÉQUIPAGE
 *    EXPOSÉ du navire (`exposedCrew`, MÊME précédent que les Éclats d'un Critique de coque), car à l'échelle
 *    Mer (10 m/case) un rayon métrique < 1 case n'attraperait personne. PAS de cas spécial « navires au
 *    contact » : un autre navire n'est touché que si la règle métrique générique l'attrape (cible personnage).
 *
 * APPLIQUE les effets (mute via `loseWounds` + `fireTriggers`) et renvoie les lignes de journal. RNG injecté.
 */
import type { Get, Set as SetFn } from './flowTypes';
import type { Combatant, Weapon, HitLocation } from '../engine/types';
import { woundsFromHit, rangeBandName } from '../engine/combat';
import { bonus, effectiveChar } from '../engine/characteristics';
import { effectiveRange } from '../engine/weaponDamage';
import { resolveQualities } from '../engine/qualities/dispatch';
import { loseWounds, isOutOfAction } from '../engine/conditions';
import { exposedCrew } from '../engine/shipCritical';
import { combatantsWithinRadius } from './combatGeometry';
import { fireTriggers } from './triggeredEffects';
import { t as tr, type MsgKey } from '../i18n';
import { RNG, defaultRNG } from '../engine/dice';

/** Contexte d'une touche à résoudre en aire — commun au tir individuel et à la bordée. */
export interface AreaHit {
  attacker: Combatant;
  primaryTarget: Combatant;
  /** Arme EFFECTIVE (munition + sous-effectif déjà bakés) — porteuse des Atouts d'aire et des effets `onHit`. */
  weapon: Weapon;
  /** Dégâts BRUTS du tir (DR + Dégâts d'arme + qualités) déjà subis par la cible primaire. */
  damage: number;
  /** Localisation de la touche primaire (re-jouée sur les cibles secondaires faute de jet par cible). */
  location: HitLocation;
  /** Distance attaquant→cible en CASES (pour la bande de portée). */
  distanceTiles: number;
}

/**
 * SOURCE des cibles secondaires d'une aire — STRATÉGIE injectée (terrestre vs naval) : renvoie, des plus
 * « proches »/prioritaires aux moins, les cibles candidates EXCLUANT la primaire. `resolveWeaponArea`
 * applique ensuite le plafond d'Indice (Tir de zone) ou prend toute la liste (Explosion).
 */
export type AreaTargets = (hit: AreaHit) => Combatant[];

/** Convertit un rayon en MÈTRES en un rayon en CASES (Chebyshev), via l'échelle de scène (≥1 case). */
function metresToTiles(metres: number, metresPerTile: number): number {
  return Math.max(1, Math.ceil(metres / Math.max(1, metresPerTile)));
}

/** Un porteur de navire (carène) — détecté par `bodyShape:'vehicule'` (≠ personnage). */
const isShip = (c: Combatant): boolean => c.bodyShape === 'vehicule';

/**
 * SOURCE des cibles secondaires — DEUX branches RAW (cf. en-tête) dispatchées sur la cible primaire :
 *  - personnage → les ennemis vivants à ≤ `indice` mètres (Chebyshev, échelle `metresPerTile`), du plus proche au plus loin ;
 *  - navire (`bodyShape:'vehicule'`) → son ÉQUIPAGE EXPOSÉ (`crewOf` → `exposedCrew`) ; le rayon métrique ne
 *    s'applique pas (10 m/case → < 1 case). Le plafond d'Indice (Tir de zone) est appliqué par `resolveWeaponArea`.
 * `crewOf` résout les `crewIds` d'un navire en combattants (le caller le fournit ; combatFlow renvoie [] : pas d'équipage en person-scale).
 */
export function areaTargets(combatants: Combatant[], metresPerTile: number, crewOf: (ship: Combatant) => Combatant[] = () => []): (indice: number) => AreaTargets {
  return (indice) => (hit) => {
    if (isShip(hit.primaryTarget)) return exposedCrew(crewOf(hit.primaryTarget)); // mer : balaie le pont (Éclats-like)
    const center = hit.primaryTarget.pos;
    if (!center) return [];
    // TERRE : ennemis vivants dans le rayon métrique (Chebyshev), via la primitive de géométrie d'aire PARTAGÉE.
    return combatantsWithinRadius(center, metresToTiles(indice, metresPerTile), combatants,
      (c) => c.kind !== hit.attacker.kind && c.id !== hit.primaryTarget.id && !isOutOfAction(c));
  };
}

/** Applique DR+Dégâts à une cible SECONDAIRE et propage les États « infligés par l'arme » (chemin générique
 *  `onHit`). Renvoie la ligne de journal de la touche + celles des effets déclenchés. */
function hitSecondary(
  get: Get, set: SetFn, hit: AreaHit, victim: Combatant, damage: number, msgKey: MsgKey, rng: RNG,
): string[] {
  const wl = woundsFromHit(hit.weapon, victim, hit.location, damage, 0, 0); // plancher 0 (navire/ricochet)
  const lines: string[] = [];
  if (wl > 0) loseWounds(victim, wl);
  lines.push(tr(msgKey, { name: victim.name, wl }));
  // États « infligés par l'arme » via le MÊME dispatcher que le tir individuel (Empêtré, En flammes, Venin…).
  if (wl > 0 && !isOutOfAction(victim))
    lines.push(...fireTriggers(get, hit.attacker, 'onHit', { victim, weapon: hit.weapon, woundsDealt: wl, location: hit.location, attackType: hit.weapon.type, rng, set }));
  return lines;
}

/**
 * Résout TOUS les effets d'aire d'une touche (Tir de zone ET Explosion cumulables), mutant les cibles et
 * renvoyant les lignes de journal. `targetsFor(indice)` = STRATÉGIE de cibles secondaires (terrestre/naval).
 * NE re-jette AUCUN jet de toucher (RAW : un nuage de projectiles / un souffle ne re-teste pas).
 */
export function resolveWeaponArea(
  get: Get, set: SetFn, hit: AreaHit, targetsFor: (indice: number) => AreaTargets, rng: RNG = defaultRNG,
): { lines: string[] } {
  const lines: string[] = [];
  const { primaryTarget: target, weapon } = hit;
  const quals = resolveQualities(weapon);

  // ── Tir de zone (Aux Armes p.89 / MDG ch.12) ──────────────────────────────────────────────────────────
  const tz = quals.find((r) => r.caps?.areaFire);
  if (tz) {
    const indice = tz.indice ?? 1;
    const rangeM = effectiveRange(weapon.range, () => bonus(effectiveChar(hit.attacker, 'F'))); // Portée résolue (BF du tireur)
    const band = rangeM != null ? rangeBandName(hit.distanceTiles, rangeM) : 'Bout portant';
    if (band === 'Bout portant') {
      // +Indice aux DÉGÂTS sur la cible seule (≠ +Indice Blessures brut). La cible a déjà encaissé `damage` ;
      // on applique le SURCROÎT de Blessures dû à `damage + indice` (woundsFromHit est monotone).
      const extra = woundsFromHit(weapon, target, hit.location, hit.damage + indice, 0, 0) - woundsFromHit(weapon, target, hit.location, hit.damage, 0, 0);
      if (extra > 0 && !isOutOfAction(target)) loseWounds(target, extra);
      lines.push(tr('cf.blastPointBlank', { name: target.name, indice }));
    } else {
      // Courte-Longue : cible + Indice plus proches. Extrême : idem mais −Indice aux Dégâts.
      const dmg = band === 'Extrême' ? hit.damage - indice : hit.damage;
      for (const sec of targetsFor(indice)(hit).slice(0, indice))
        lines.push(...hitSecondary(get, set, hit, sec, dmg, 'cf.blastSecondary', rng));
    }
  }

  // ── Explosion (LDB p.298) : toutes les cibles candidates — DR+Dégâts + États de l'arme (pas de plafond d'Indice) ──
  const expl = quals.find((r) => r.caps?.explosion);
  if (expl) {
    const indice = expl.indice ?? 1;
    for (const victim of targetsFor(indice)(hit))
      lines.push(...hitSecondary(get, set, hit, victim, hit.damage, 'cf.blastExplosion', rng));
  }

  return { lines };
}
