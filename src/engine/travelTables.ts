/**
 * Tables d100 de VOYAGE (EDOC ch.4-5), en DONNÉE (`src/data/*.json`) — lookup partagé via `findTableEntry`.
 * Aucune table en dur : incidents de monte, problèmes de véhicule et rencontres vivent en JSON éditable.
 * Le tirage du d100 et l'application des effets restent à l'appelant (boucle de voyage).
 */
import { findTableEntry } from './tables';
import type { StageOutcome } from './activities';
import incidentsMonteJson from '../data/incidents-monture.json';
import problemesVehiculeJson from '../data/problemes-vehicule.json';
import rencontresJson from '../data/rencontres-edoc.json';

/** Entrée d'une table de voyage : fourchette d100 `[min,max]` (00 = 100) + libellé/texte RAW.
 *  `stageOutcome` : effet de portée Étape (cf. `StageOutcome`). `vehicleWounds` : Dégâts au VÉHICULE
 *  (`Combatant` à coque) en notation de dés (« 1d10 »/« 2d10 ») — premier crochet du véhicule-à-PV. */
export interface TravelTableEntry {
  min: number;
  max: number;
  id: string;
  label: string;
  text: string;
  stageOutcome?: StageOutcome;
  vehicleWounds?: string | null;
  /** Dégâts aux OCCUPANTS du véhicule, en langue unique `GameOp` (EDOC 07 : Cassé = 1 Blessure ignorant
   *  BE et PA ; Accident = 2d10 Blessures modifiées par BE et PA, min 1). Appliqués par le flux de voyage. */
  occupantOps?: import('./ops').GameOp[];
}

interface TravelTable { id: string; label: string; die: string; source: { book: string; page: number }; entries: TravelTableEntry[] }

/** Incidents de monte (EDOC 07 l.150-155). */
export const MOUNT_INCIDENTS = (incidentsMonteJson as TravelTable).entries;
/** Problèmes de véhicule (EDOC 07 l.259-264). */
export const VEHICLE_PROBLEMS = (problemesVehiculeJson as TravelTable).entries;

export function rollMountIncident(roll: number): TravelTableEntry {
  return findTableEntry(MOUNT_INCIDENTS, roll);
}
export function rollVehicleProblem(roll: number): TravelTableEntry {
  return findTableEntry(VEHICLE_PROBLEMS, roll);
}

/** Catégorie de Rencontre de voyage (EDOC ch.5 l.186-233) — déclenchée par la qualité du Test d'Activité. */
export type EncounterCategory = 'positives' | 'fortuites' | 'dangereuses';

const ENCOUNTERS = (rencontresJson as { tables: Record<EncounterCategory, TravelTableEntry[]> }).tables;

export function encounterTable(category: EncounterCategory): TravelTableEntry[] {
  return ENCOUNTERS[category];
}
export function rollEncounter(category: EncounterCategory, roll: number): TravelTableEntry {
  return findTableEntry(ENCOUNTERS[category], roll);
}
