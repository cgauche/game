/**
 * CADENCE de VOYAGE — couche PARTAGÉE mer (`seaVoyageFlow`) ⇄ fluvial (`riverVoyageFlow`) : ordres
 * permanents fixés au départ + politique d'interruption (liste FERMÉE) + accumulation du PROCÈS-VERBAL
 * du jour. Ce n'est PAS une feature « mer » : c'est UNE couche que les deux boucles consomment. Elle ne
 * possède NI la boucle de jours NI la résolution des jets — seulement le régime (auto vs modale par jet)
 * et la brique d'entrée du PV.
 *
 * Doctrine : « aucun jet silencieux ». La route COMMANDÉE ne supprime pas des TRACES, seulement des
 * INTERRUPTIONS — chaque jet de ROUTINE auto-résolu laisse sa ligne au PV DU JOUR (l'auto-pilote pilote
 * LE MÊME flux de jet, jamais un `rollTest` inline). Décision requise = modale/cascade ; routine = PV.
 */
import type { NightEntry } from './restFlow';
import type { RollBreakdown } from '../engine/combat';
import type { CascadeStep } from './pendings';

/** COMMANDÉE : les Tests d'équipage de ROUTINE s'auto-résolvent (leurs lignes au PV) ; seules les
 *  décisions interrompent. JOUR-PAR-JOUR : chaque jet ouvre sa modale (cadence manuelle historique). */
export type VoyageCadence = 'commande' | 'jour-par-jour';

/** Ordres permanents d'une traversée, fixés au départ et persistés avec le `TravelPlan`. */
export interface VoyageOrders {
  cadence: VoyageCadence;
}

export const DEFAULT_VOYAGE_ORDERS: VoyageOrders = { cadence: 'commande' };

/**
 * Tests d'équipage de ROUTINE auto-résolus en route COMMANDÉE — LISTE FERMÉE (par `voyage.kind`).
 * Progression / Affaler (météo) / Phare / Orientation / Entretien : jets quotidiens sans décision.
 *
 * INTERROMPENT toujours (hors liste, donc modale) : les CRISES (`poursuite`, `tourbillon`), l'`ouragan`
 * et l'`extermination` (conséquences d'un événement de bord), l'`embuscade` ancrée, le `voyage-rapide`,
 * et tout Test dont l'échec ouvre une DÉCISION. Les urgences (voie d'eau / feu = Fuite de vapeur →
 * `pendingSteamSave`), les événements de bord à choix, le conseil de bord, l'atterrage (événement de
 * port) et le combat (abordage) sont des surfaces PROPRES : ils suspendent la boucle par eux-mêmes.
 */
export const SEA_ROUTINE_KINDS: ReadonlySet<string> = new Set([
  'progression', 'affaler', 'phare', 'orientation', 'entretien',
]);

/** Un Test d'équipage de mer de `kind` s'auto-résout-il sous ces ordres ? (route COMMANDÉE + routine). */
export function seaAutoResolves(orders: VoyageOrders | undefined, kind: string): boolean {
  return orders?.cadence === 'commande' && SEA_ROUTINE_KINDS.has(kind);
}

/** Étapes du jour FLUVIAL de ROUTINE (patron `SEA_ROUTINE_KINDS`) — LISTE FERMÉE : Réparation de
 *  gréement/Agilité de rame/Navigation/Louvoyage/sauvegardes de vent, jets déterministes SANS décision.
 *  `riverPerilCheck` (péril de rivière) en est exclu : sa CONSÉQUENCE peut ESCALADER en CHOIX joueur
 *  (Barrage — `riverObstacleChoice`, l.128), inconnu tant que le péril n'a pas été vérifié (chance
 *  d'auteur tirée à l'application) — une journée qui en porte un force l'INTERACTIF (#351, patron
 *  `seaDayAllRoutine` : toute décision potentielle bascule le jour ENTIER en cascade interactive). */
export const RIVER_ROUTINE_KINDS: ReadonlySet<string> = new Set([
  'riverControlRepair', 'riverAgility', 'riverNav', 'riverTack', 'riverCapsize', 'riverRigging',
]);

/** Une journée FLUVIALE de ROUTINE s'auto-résout-elle ? (route COMMANDÉE + AUCUNE étape hors
 *  `RIVER_ROUTINE_KINDS` — la cascade du jour se joue d'un bloc, sans modale par jet ; #91, filtre #351). */
export function riverAutoResolves(orders: VoyageOrders | undefined, steps: readonly CascadeStep[]): boolean {
  return orders?.cadence === 'commande' && steps.every((s) => RIVER_ROUTINE_KINDS.has(s.kind));
}

/** Brique d'ENTRÉE du PV du jour (une ligne du procès-verbal, rendue par `MultiRollList`). Source unique
 *  de la forme d'entrée pour les jours de voyage — mer comme fleuve accumulent les mêmes `NightEntry`. */
export function voyageDayEntry(opts: {
  id: string;
  actorId?: string;
  label: string;
  icon?: string;
  d?: RollBreakdown;
  text?: string;
  tone?: NightEntry['tone'];
}): NightEntry {
  return { id: opts.id, actorId: opts.actorId, label: opts.label, icon: opts.icon, d: opts.d, text: opts.text, tone: opts.tone };
}
