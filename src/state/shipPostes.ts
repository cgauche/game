/**
 * POSTES D'ARTILLERIE d'un navire — placement & répartition (MDG ch.12 « Navires et construction navale »).
 * Couche STATE (le côté de montage est un `FireArc`, cf. fireArc.ts). RAW vérifié FR + VO (« Boats and
 * Boatbuilding ») : PAS de slots fixes — placement LIBRE, seule limite = le poids (Enc) des pièces sur un
 * « facing » vs la Contenance (`ship.capacity`). Le Sabord (Gun Port) est une Amélioration optionnelle qui
 * donne un couvert TOTAL au servant qui tire à travers (sinon tir depuis le pont, aucun couvert).
 */
import { inFireArc } from './fireArc';
import type { FireArc } from './fireArc';
import type { Combatant, ItemInstance } from '../engine/types';
import type { Dir8 } from './dir8';

type Pt = { x: number; y: number };

/** Une pièce d'artillerie MONTÉE sur un navire (poste), authorée sur le Combattant-coque (source de vérité).
 *  L'arme est portée comme `ItemInstance` (base + qualités/enchants PAR INSTANCE) — gère catalogue, custom
 *  Codex ET arme bricolée par le joueur (un id seul perdrait les atouts). Au spawn, l'arme est posée comme
 *  arme DÉRIVÉE (taguée `mountSide = side`) sur le chef de pièce (`crewIds[0]`) — comme une morsure/un
 *  tentacule : présente dans ses `weapons`, ABSENTE de son inventaire (la pièce reste au navire, re-servable).
 *  KIND-AGNOSTIQUE : le servant peut être héros, allié ou ennemi — même chemin de tir. */
export interface ShipPoste {
  /** L'arme montée (instance complète — base via `trappingId` + `qualities`/`enchants` propres). */
  item: ItemInstance;
  /** Côté de montage relatif au cap → arc de tir (`inFireArc`). */
  side: FireArc;
  /** Tire à travers un Sabord (Gun Port) → couvert TOTAL au servant ; sinon depuis le pont (aucun couvert). */
  sabord?: boolean;
  /** Combattant(s) d'équipage servant la pièce ; le 1ᵉʳ = chef de pièce (celui qui jette, Arme d'équipe). */
  crewIds?: string[];
}

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
