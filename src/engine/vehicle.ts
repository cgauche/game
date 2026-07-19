/**
 * Véhicule-à-coque comme `Combatant` (le cœur du modèle unifié terre/fleuve/mer) — module FEUILLE.
 *
 * Un véhicule (`vehicles.json`, facette `hull`) devient une entité À PV : il encaisse des Dégâts
 * exactement comme une créature (langue UNIQUE `GameOp`/`applyOps`). Les montures restent, elles, des
 * créatures (`creatures.json`) ; ce module ne couvre que les coques inertes (chariots, barges, navires).
 *
 * RAW (EDOC 7) : un Problème de véhicule « Cassé »/« Accident » inflige « immédiatement Nd10 points
 * de Dégâts, modifiés avec le Bonus d'Endurance jusqu'à un minimum de 1 » à la coque (l.266-286). Les
 * tables de Localisation/Critiques de la coque (`hull.locationTable`/`criticalTable`) sont posées en
 * données et seront câblées aux dalles fluviale (MoR) et maritime (MDG) — ici, seul le total de PV joue.
 */
import { Combatant, VehicleData } from './types';
import { RNG, defaultRNG, parseDice } from './dice';
import { applyOps } from './ops';
import { inanimateCombatant } from './inanimate';
import { rollVehicleProblem, type TravelTableEntry } from './travelTables';

/** Ce combattant est-il un VÉHICULE-coque (navire, chariot, barge) — `bodyShape:'vehicule'` ? Prédicat NOMMÉ
 *  (source UNIQUE — plus de littéral `'vehicule'` dispersé) : un véhicule agit en UNITÉ (Tests d'équipage) ; il
 *  n'a ni arme tenue, ni sort, ni marche de fantassin → les barres/chemins « héros-attaquant » doivent l'ignorer. */
export function isVehicle(c: Pick<Combatant, 'bodyShape'>): boolean {
  return c.bodyShape === 'vehicule';
}

/** Adaptateur de `inanimateCombatant` (builder UNIQUE des objets inanimés) pour une coque de véhicule
 *  depuis sa facette `hull` (Endurance + Blessures). `undefined` si le véhicule n'a pas de profil de coque
 *  (transports sans entité à PV). */
export function vehicleCombatant(v: VehicleData, id = `vehicle-${v.id}`): Combatant | undefined {
  if (!v.hull) return undefined;
  return inanimateCombatant({
    id,
    label: v.label,
    refId: v.id,
    bodyShape: v.hull.bodyShape, // 'vehicule' — Tableau de Localisation de coque (data-driven, dalle 2-3)
    hull: { e: v.hull.char.endurance, woundsB: v.hull.char.B },
    footprint: v.ship?.footprint, // EMPREINTE de grille (côté N×N) autorée — découplée de la Taille créature
  });
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
