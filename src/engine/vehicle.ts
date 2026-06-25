/**
 * Véhicule-à-coque comme `Combatant` (le cœur du modèle unifié terre/fleuve/mer) — module FEUILLE.
 *
 * Un véhicule (`vehicles.json`, facette `hull`) devient une entité À PV : il encaisse des Dégâts
 * exactement comme une créature (langue UNIQUE `GameOp`/`applyOps`). Les montures restent, elles, des
 * créatures (`creatures.json`) ; ce module ne couvre que les coques inertes (chariots, barges, navires).
 *
 * RAW (EDOC ch.4) : un Problème de véhicule « Cassé »/« Accident » inflige « immédiatement Nd10 points
 * de Dégâts, modifiés avec le Bonus d'Endurance jusqu'à un minimum de 1 » à la coque (l.266-286). Les
 * tables de Localisation/Critiques de la coque (`hull.locationTable`/`criticalTable`) sont posées en
 * données et seront câblées aux dalles fluviale (MoR) et maritime (MDG) — ici, seul le total de PV joue.
 */
import { Combatant, VehicleData, Characteristics } from './types';
import { RNG, defaultRNG, parseDice } from './dice';
import { applyOps } from './ops';
import { emptyArmour } from './items';
import { rollVehicleProblem, type TravelTableEntry } from './travelTables';

const ZERO_CHARS: Characteristics = { CC: 0, CT: 0, F: 0, E: 0, I: 0, Ag: 0, Dex: 0, Int: 0, FM: 0, Soc: 0 };

/** Ce combattant est-il un VÉHICULE-coque (navire, chariot, barge) — `bodyShape:'vehicule'` ? Prédicat NOMMÉ
 *  (source UNIQUE — plus de littéral `'vehicule'` dispersé) : un véhicule agit en UNITÉ (Tests d'équipage) ; il
 *  n'a ni arme tenue, ni sort, ni marche de fantassin → les barres/chemins « héros-attaquant » doivent l'ignorer. */
export function isVehicle(c: Pick<Combatant, 'bodyShape'>): boolean {
  return c.bodyShape === 'vehicule';
}

/** Construit la coque transitoire (`Combatant`) d'un véhicule depuis sa facette `hull` (Endurance +
 *  Blessures). `undefined` si le véhicule n'a pas de profil de coque (transports sans entité à PV). */
export function vehicleCombatant(v: VehicleData, id = `vehicle-${v.id}`): Combatant | undefined {
  if (!v.hull) return undefined;
  const max = v.hull.char.B;
  return {
    id,
    name: v.label,
    kind: 'npc',
    creatureId: v.id,
    characteristics: { ...ZERO_CHARS, E: v.hull.char.E },
    wounds: { current: max, max, base: max },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: emptyArmour(),
    skills: [],
    talents: [],
    bodyShape: v.hull.bodyShape, // 'vehicule' — Tableau de Localisation de coque (data-driven, dalle 2-3)
    footprint: v.ship?.footprint, // EMPREINTE de grille (côté N×N) autorée — découplée de la Taille créature (pas de `size`)
    psychImmune: true, // une coque inerte ignore la Psychologie
    movement: 0,
  };
}

export interface VehicleProblemResult {
  entry: TravelTableEntry;
  lines: string[];
}

/** Tire un Problème de véhicule (d100) et APPLIQUE ses Dégâts à la coque (`applyOps`), si la cellule en
 *  porte (`vehicleWounds`, ex. « 1d10 »/« 2d10 »). RAW : modifiés par le Bonus d'Endurance, minimum 1. */
export function applyVehicleProblem(vehicle: Combatant, roll: number, rng: RNG = defaultRNG): VehicleProblemResult {
  const entry = rollVehicleProblem(roll);
  const lines = [`Problème de véhicule — ${entry.label}.`];
  if (entry.vehicleWounds) {
    const dice = parseDice(entry.vehicleWounds);
    if (dice) lines.push(...applyOps(vehicle, [{ op: 'wounds', amount: { dice }, ignoreTB: false, ignoreAP: true, min: 1 }], { rng }));
  }
  return { entry, lines };
}
