/**
 * POSTES D'ARTILLERIE d'un navire — placement & répartition (MDG ch.12 « Navires et construction navale »).
 * Couche STATE (le côté de montage est un `FireArc`, cf. fireArc.ts). RAW vérifié FR + VO (« Boats and
 * Boatbuilding ») : PAS de slots fixes — placement LIBRE, seule limite = le poids (Enc) des pièces sur un
 * « facing » vs la Contenance (`ship.capacity`). Le Sabord (Gun Port) est une Amélioration optionnelle qui
 * donne un couvert TOTAL au servant qui tire à travers (sinon tir depuis le pont, aucun couvert).
 */
import { inFireArc } from './fireArc';
import { mannedPosteWeapon } from '../engine/items';
import { exposedCrew } from '../engine/shipCritical';
import type { FireArc } from './fireArc';
import type { Combatant, ShipPoste } from '../engine/types';
import type { Dir8 } from './dir8';

// Le TYPE `ShipPoste` vit en engine/types (pour que `Combatant` le porte sans dépendance engine→state) ;
// la LOGIQUE (placement, arc, support) reste ici. Ré-export pour les importeurs historiques.
export type { ShipPoste };

type Pt = { x: number; y: number };

/** Le poids (Enc) d'une pièce montée sur un bord donné — entrée du calcul de pénalité de répartition. */
export interface MountWeight {
  side: FireArc;
  weight: number;
}

/** Pénalité de placement appliquée au navire (M, Man, et DR aux Tests de Navigation). */
export interface PlacementPenalty {
  m: number;
  man: number;
  navDR: number;
}

/**
 * Pénalité de PLACEMENT des pièces (MDG ch.12 l.432-433 / VO l.315-317). Si le poids (Enc) des pièces sur
 * UN seul « facing » (proue/poupe/bâbord/tribord) dépasse 25 % de la Contenance → −1 M / −1 Man / −1 DR aux
 * Tests de Navigation ; >50 % → −2. Seuil STRICT ; la pénalité est le PIRE palier atteint par un seul bord
 * (non cumulatif entre les bords). PUR — `capacity` = `ship.capacity` (Contenance, déjà en donnée). */
export function placementPenalty(mounts: MountWeight[], capacity: number): PlacementPenalty {
  const bySide = new Map<FireArc, number>();
  for (const m of mounts) bySide.set(m.side, (bySide.get(m.side) ?? 0) + m.weight);
  const maxSide = Math.max(0, ...bySide.values());
  if (maxSide > capacity * 0.5) return { m: -2, man: -2, navDR: -2 };
  if (maxSide > capacity * 0.25) return { m: -1, man: -1, navDR: -1 };
  return { m: 0, man: 0, navDR: 0 };
}

/** Le Combattant-coque dont l'équipage (`crewIds`) inclut `crewId`, parmi `combatants` — le SUPPORT naval du
 *  servant. KIND-AGNOSTIQUE (ne regarde pas le `kind` : héros/allié/ennemi indifférent). PUR. */
export function shipOfCrew(combatants: Combatant[], crewId: string): Combatant | undefined {
  return combatants.find((c) => c.crewIds?.includes(crewId));
}

/** Nombre de servants APTES (vivants + conscients, via `exposedCrew`) qui tiennent le poste que `chef` sert,
 *  parmi `combatants` — entrée de `crewedFireWeapon` (sous-effectif d'une Arme d'équipe, MDG ch.12). Le chef
 *  est lui-même un `crewIds` du poste, donc compté. `undefined` si `chef` ne sert aucun poste (tir normal). PUR. */
export function servingCrewPresent(chef: Combatant, combatants: Combatant[]): number | undefined {
  const poste = chef.mannedPoste;
  if (!poste) return undefined;
  const crew = (poste.crewIds ?? [])
    .map((id) => combatants.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c);
  return exposedCrew(crew).length;
}

/**
 * Une pièce MONTÉE (`weapon.mountSide`) porte-t-elle sur `targetPos` ? `heading` = cap du support (coque), `supportPos`
 * = sa position. Aucune contrainte d'arc (→ true) si l'arme n'est PAS montée, ou si le cap/la position du support
 * ne sont pas résolus (pièce au sol sans support, setup partiel…). Réutilise `inFireArc` (déjà général). PUR.
 */
export function mountedWeaponBears(weapon: { mountSide?: FireArc }, heading: Dir8 | undefined, supportPos: Pt | undefined, targetPos: Pt): boolean {
  if (!weapon.mountSide) return true;
  if (!heading || !supportPos) return true;
  return inFireArc(weapon.mountSide, heading, supportPos, targetPos);
}

/**
 * Au DÉBUT du combat (après spawn) : pour chaque Combattant-coque portant des `postes`, pose `mannedPoste`
 * sur le **chef de pièce** (`crewIds[0]`) de chaque poste, parmi `combatants`. Le canon apparaît ensuite
 * comme arme dérivée via `recomputeLoadout` (chefs héros). KIND-AGNOSTIQUE (ne regarde pas le `kind`). Mute
 * en place (comme les autres étapes de spawn). Chef de pièce introuvable / coque sans postes → ignoré.
 */
export function applyShipPostes(combatants: Combatant[]): void {
  const byId = new Map(combatants.map((c) => [c.id, c]));
  for (const hull of combatants)
    for (const poste of hull.postes ?? []) {
      const chefId = poste.crewIds?.[0];
      const chef = chefId ? byId.get(chefId) : undefined;
      if (!chef) continue;
      chef.mannedPoste = poste;
      // OCTROI direct de l'arme dérivée (taguée mountSide) — pour que le canon apparaisse aussi sur un chef à
      // STATBLOC (ennemi, qui ne passe pas par recomputeLoadout). Idempotent ; un chef héros la re-dérivera
      // identiquement au prochain recompute (rebuild from scratch → pas de doublon).
      const w = mannedPosteWeapon(chef, poste);
      if (w && !(chef.weapons ?? []).some((x) => x.uid === w.uid)) (chef.weapons ??= []).push(w);
    }
}
