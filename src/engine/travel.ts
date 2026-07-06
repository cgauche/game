/**
 * Voyage entre lieux (#T2) — Livre de base, section « Voyage » (fichier source
 * `51 - Magie du Chaos.md`, découpage OCR — le contenu est le chapitre MJ « Voyage », l.183-256).
 *
 * RAW modélisé :
 *  - « Utilisez le Déplacement pour déterminer la vitesse du voyage en kilomètre par heure »
 *    (l.222 ; cf. aussi 05 l.479 « combien de kilomètres par heure vous pouvez aisément parcourir ») ;
 *    à pied, c'est le Mouvement « le plus lent d'un groupe » (l.222) — Mouvement EFFECTIF
 *    (Encombrement compris, `effectiveMovement`).
 *  - « un groupe peut voyager l'équivalent de 6 heures par jour sans avoir besoin de Tests de
 *    Résistance. S'il voyage plus rapidement ou plus loin, donnez un État Exténué à ceux échouant
 *    à ce Test, et un État Exténué supplémentaire si le Personnage est Encombré » (l.224).
 *  - Coûts de trajet (l.207-219) : « par kilomètre parcouru », diligence Déplacement 6
 *    (Intérieur 2 sous / Extérieur 1 sou par km), barge Déplacement 8 (Cabine 5 / Pont 2 sous
 *    par km) ; « modèles plus rapides/lents : prix ×2 / ÷2, Mouvement ±1 » → paramétrable.
 *  - Fatigue d'Encombrement (LDB p.295, déjà codée) : `encumbrancePenalties().travelFatigue`
 *    États Exténué « par journée de voyage » (paliers de surcharge) — enfin consommée ici.
 *
 * Tout est PARAMÉTRABLE par la donnée (carte du monde / route, éditeur) ; les défauts ci-dessous
 * sont les valeurs RAW citées, ou des choix documentés quand le canon est muet.
 */
import { Combatant } from './types';
import { RNG, defaultRNG } from './dice';
import { rollTest, testDetail } from './tests';
import { testValue } from './skills';
import { addCondition } from './conditions';
import { effectiveMovement, encumbrancePenalties } from './encumbrance';
import { Money, fromBrass } from './money';
import { rule } from './policy';
import {
  type Allure, ALLURE_KMH_PER_M, mountedSpeedKmh, partyMounts, mountProfileById, lameLedCapKmh,
} from './mountTravel';
import { VehicleData } from './types';
import vehiclesJson from '../data/vehicles.json';

/** FOYER UNIQUE des véhicules/embarcations (`src/data/vehicles.json`), data-driven (cf. `VehicleData`). */
export const VEHICLES_LIST = vehiclesJson as VehicleData[];
const VEHICLE_BY_ID: Map<string, VehicleData> = new Map(VEHICLES_LIST.map((v) => [v.id, v]));

/** Transports payants RAW (l.210-219) = véhicules dotés d'une facette `travel` (passage payant). */
export const TRAVEL_VEHICLES: VehicleData[] = VEHICLES_LIST.filter((v) => v.travel);

/** Mode de voyage : `'pied'` (Mouvement du groupe), `'monture'` (bêtes possédées, EDOC ch.4 — règle
 *  optionnelle `travel-allures`) OU l'`id` d'un véhicule à passage payant (`vehicles.json`). */
export type TravelMode = 'pied' | 'monture' | string;

/** Facette `travel` (passage payant) d'un mode ≠ `'pied'` — source UNIQUE des classes/Déplacement.
 *  Renvoie `undefined` si le mode n'est pas un véhicule à passage payant. */
export function vehicleTravel(mode: TravelMode): NonNullable<VehicleData['travel']> | undefined {
  return mode === 'pied' ? undefined : VEHICLE_BY_ID.get(mode)?.travel;
}

export const TRAVEL_MODE_LABEL: Record<string, string> = {
  pied: 'À pied',
  monture: 'En selle',
  mer: 'En mer', // traversée sur le navire de campagne (route `sea`, MDG ch.13-15)
  ...Object.fromEntries(TRAVEL_VEHICLES.map((v) => [v.id, v.label])),
};

/** `IconId` du pictogramme d'un mode de voyage (registre `src/ui/icons/`, famille `travel/*`) :
 *  donnée `vehicle.icon` ; `'pied'`/`'monture'`/`'mer'` → id fixe, défaut véhicule → `travel/coach`. */
export function travelModeIcon(mode: TravelMode): string {
  if (mode === 'pied') return 'travel/foot';
  if (mode === 'monture') return 'travel/mount';
  if (mode === 'mer') return 'travel/anchor';
  return VEHICLE_BY_ID.get(mode)?.icon ?? 'travel/coach';
}

/** Défauts paramétrables (surchargés par la carte du monde / la route dans l'éditeur). */
export const TRAVEL_DEFAULTS = {
  /** Heures de voyage par jour sans Test de Résistance (RAW l.224). */
  hoursPerDay: 6,
  /** Plafond de marche forcée (heures/jour) — LDB 51 l.195 : silence, valeur maison, paramétrable. */
  forcedMaxHours: 10,
  /** Seuil du d10 quotidien de péripétie : « événement sur un résultat de 8 » (l.237). 0 = désactivé. */
  perilDie: 8,
} as const;

/** Vitesse du groupe à pied = Mouvement EFFECTIF le plus lent (l.222), en km/h. */
export function partyWalkSpeed(party: Combatant[]): number {
  const alive = party.filter((c) => !c.dead);
  if (!alive.length) return 0;
  return Math.max(0, Math.min(...alive.map((c) => effectiveMovement(c))));
}

/** Vitesse de voyage (km/h) selon le mode. `movementOverride` = modèle rapide/lent (M ±1, l.208).
 *  `allure` (règle `travel-allures`, EDOC 07 l.140) : en selle, M de la plus lente × 1,5/2,5/3 ; en
 *  attelage forcé au galop, M de l'attelage × 3 ; à pied, une bête Boiteuse MENÉE plafonne le groupe
 *  à la moitié de sa vitesse de marche (EDOC 07 l.157). */
export function travelSpeed(party: Combatant[], mode: TravelMode, movementOverride?: number, allure?: Allure): number {
  // Traversée MARITIME : la vitesse est en MILLES/JOUR (vents, Tests d'équipage — MDG ch.13/15),
  // résolue par `seaVoyageFlow`, pas en km/h terrestre. 0 = « pas de km/h » (l'UI affiche l'estimation navale).
  if (mode === 'mer') return 0;
  if (mode === 'pied') {
    const walk = movementOverride ?? partyWalkSpeed(party);
    const cap = rule('travel-allures') ? lameLedCapKmh(party) : null;
    return cap == null ? walk : Math.min(walk, cap);
  }
  if (mode === 'monture') return movementOverride ?? mountedSpeedKmh(partyMounts(party), allure ?? 'pas');
  const t = vehicleTravel(mode)!;
  if (allure === 'galop' && t.draft) {
    // Allure forcée d'un attelage (EDOC 07 l.229) : vitesse au pas de course = M de l'attelage × 3 (l.140).
    const p = mountProfileById(t.draft.montureId);
    if (p) return p.m * ALLURE_KMH_PER_M.galop;
  }
  return movementOverride ?? t.movement;
}

export interface TravelPlanCalc {
  /** Journées de voyage entamées. */
  days: number;
  /** Heures de marche du DERNIER jour (≤ heures/jour ; les autres jours sont pleins). */
  hoursLastDay: number;
  /** Durée totale en minutes (heures de déplacement uniquement). */
  travelMinutes: number;
}

/** Découpe un trajet en journées : `km` à `kmh` km/h, `hoursPerDay` heures de route par jour. */
export function travelPlanCalc(km: number, kmh: number, hoursPerDay: number): TravelPlanCalc | null {
  if (km <= 0 || kmh <= 0 || hoursPerDay <= 0) return null;
  const totalHours = km / kmh;
  const fullDays = Math.floor(totalHours / hoursPerDay);
  const rest = totalHours - fullDays * hoursPerDay;
  const days = rest > 1e-9 ? fullDays + 1 : Math.max(1, fullDays);
  const hoursLastDay = rest > 1e-9 ? rest : hoursPerDay;
  return { days, hoursLastDay, travelMinutes: Math.round(totalHours * 60) };
}

/** Coût d'un transport payant : prix/km × km × passagers (l.207 « par kilomètre parcouru »).
 *  `brassPerKmOverride` = prix d'auteur sur la route (défaut : classe RAW). */
export function transportCost(
  km: number,
  mode: Exclude<TravelMode, 'pied'>,
  classKey: string,
  passengers: number,
  brassPerKmOverride?: number,
): Money {
  const classes = vehicleTravel(mode)!.classes;
  const cls = classes.find((c) => c.key === classKey) ?? classes[0];
  const perKm = brassPerKmOverride ?? cls.brassPerKm;
  return fromBrass(Math.ceil(perKm * km) * Math.max(1, passengers));
}

/** Résultat STRUCTURÉ de la marche forcée : le jet s'affiche en RollLine (recap de voyage),
 *  la ligne au journal — même donnée, deux présentations. */
export interface ForcedMarchResult {
  line: string;
  /** Exténué gagnés (0 = a tenu l'allure). */
  gained: number;
  /** Détail du Test pour la ligne de jet (base + mod = cible · d100 · DR). */
  d: { label: string; base: number; modifier: number; target: number; roll: number; success: boolean; sl: number };
}

/** Cible du Test de marche forcée (Résistance +0, l.224) — base de l'étape de cascade. */
export function forcedMarchTarget(c: Combatant): number {
  return testValue(c, 'resistance', 'E');
}

/** Applique le RÉSULTAT d'un Test de marche forcée (séparé du jet pour différer/influencer en
 *  cascade) : échec → +1 Exténué (+1 si Surchargé, p.293). Mute `c` ; renvoie le journal + gagnés.
 *  Partagé par `forcedMarchTest` (eager) et l'applicateur de cascade « forcedMarch ». */
export function applyForcedMarch(c: Combatant, success: boolean): { line: string; gained: number } {
  if (success) return { line: `${c.name} — marche forcée : il tient l'allure.`, gained: 0 };
  const overloaded = encumbrancePenalties(c).tier > 0;
  const n = overloaded ? 2 : 1;
  addCondition(c, 'extenue', n);
  return { line: `${c.name} — marche forcée : ÉCHEC, +${n} Exténué${overloaded ? ' (surchargé)' : ''}.`, gained: n };
}

/** Marche forcée (l.224) : voyager plus de `hoursPerDay` heures ce jour → Test de Résistance,
 *  échec = +1 Exténué (+1 de plus si Surchargé/Encombré, p.293). Mute `c` ; null = mort. */
export function forcedMarchTest(c: Combatant, rng: RNG = defaultRNG): ForcedMarchResult | null {
  if (c.dead) return null;
  const base = forcedMarchTarget(c);
  const t = rollTest(base, 'intermediaire', rng);
  const d = testDetail('Résistance', base, t);
  const r = applyForcedMarch(c, t.success);
  return { line: `${c.name} — marche forcée : Test de Résistance 🎲 ${t.roll}/${t.target} → ${t.success ? "il tient l'allure." : `ÉCHEC, +${r.gained} Exténué${r.gained > 1 ? ' (surchargé)' : ''}.`}`, gained: r.gained, d };
}

/** Fatigue d'Encombrement d'une journée de voyage à pied (LDB p.295 — `travelFatigue` enfin
 *  appliqué) : États Exténué selon le palier de surcharge. Mute `c`, renvoie le journal. */
export function applyTravelFatigue(c: Combatant): string[] {
  if (c.dead) return [];
  const n = encumbrancePenalties(c).travelFatigue;
  if (n <= 0) return [];
  addCondition(c, 'extenue', n);
  return [`${c.name} termine la journée fourbu sous sa charge : +${n} Exténué (Encombrement).`];
}
