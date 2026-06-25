/**
 * MANŒUVRE NAVALE jouable (MDG ch.13 « Navigation maritime ») — couche STATE (dépend du cap/grille, comme
 * `fireArc`/`shipPostes` ; le moteur reste pur). Le « Personnage à la barre » jette un Test de Navigation —
 * **Voile** si le navire avance à la voile, **Ramer** s'il avance aux avirons — modifié par le **Man** du
 * navire (`resolveShipManeuver`, moteur pur). Sur réussite, le navire VIRE de `turnSteps` crans (`shipTurn`
 * re-mappe d'un coup ses arcs de bordée) ; il avance TOUJOURS le long du cap (`shipAdvance`).
 *
 * SÉPARATION jet ⟂ application (patron des flux différés, cf. `run`) : `rollShipManeuver` résout le Test
 * (RNG, AUCUNE mutation) → `ManeuverResult` ; `applyShipManeuver` exécute le virage + l'avance (mutation).
 * `forceShipManeuver` (Résilience) et `bonusShipManeuver` (Chance +1 DR) re-dérivent depuis le résultat
 * courant. `maneuverShip` (devtools + tests historiques) compose jet+application.
 *
 * Le M (Mouvement) et le Man du navire vivent dans `vehicles.json` (facette `ship`), PAS sur le Combattant-coque
 * (`vehicleCombatant` met `movement:0`) → on les relit via `creatureId` (`shipManeuverParams`).
 */
import { battleRng } from './battleRng';
import { rollTest } from '../engine/tests';
import { testValue } from '../engine/skills';
import { resolveShipManeuver, type ShipManeuverOutcome } from '../engine/shipNavigation';
import { navalMoveMod, navalSkillTestDR } from '../engine/navalTraits';
import { exposedCrew } from '../engine/shipCritical';
import { placementPenalty } from './shipPostes';
import { findVehicleById } from '../data';
import type { Combatant } from '../engine/types';
import type { Get } from './flowTypes';

/** Le barreur : parmi l'équipage APTE (vivant + conscient — même prédicat que `exposedCrew`), celui qui a la
 *  MEILLEURE valeur de Test de `skillId` (Voile/Ramer). Un marin à terre / inconscient ne tient pas la barre. */
function bestHelmsman(crew: Combatant[], skillId: string): Combatant | undefined {
  return [...exposedCrew(crew)].sort((a, b) => testValue(b, skillId) - testValue(a, skillId))[0];
}

export interface ManeuverResult extends ShipManeuverOutcome {
  /** DR du Test de Navigation du barreur (avant ajout du Man — `dr` final = `navDR` + Man + extra). */
  navDR: number;
  /** d100 du Test de Navigation (affichage de la RollLine). Synthétique (≈1) si réussite forcée. */
  roll?: number;
  /** Valeur cible du Test de Navigation (affichage). */
  target?: number;
  /** Nom du barreur (journal). */
  helmsman?: string;
  /** Cases réellement parcourues par la coque (rempli à l'application, sinon 0). */
  advanced: number;
}

/** Paramètres de Manœuvre d'un navire, lus en DONNÉE (facette `ship` de `vehicles.json` + Traits/Améliorations
 *  + répartition des pièces). PUR — `M`/`Man`/`extraDR` EFFECTIFS (Lissage, Peu maniable, déséquilibre des bords). */
export interface ManeuverParams {
  baseM: number;
  manoeuvre: number;
  extraDR: number;
  skillId: string;
}
export function shipManeuverParams(ship: Combatant): ManeuverParams {
  const vd = ship.creatureId ? findVehicleById(ship.creatureId)?.ship : undefined;
  const baseM = vd?.sail?.m ?? vd?.oars?.m ?? 0;
  const skillId = vd?.sail ? 'voile' : 'ramer'; // à voile → Voile ; aux avirons → Ramer (MDG ch.13)
  // Répartition des pièces (MDG ch.12 l.432-433) : un bord surchargé pénalise −1/−2 M, Man ET DR de Navigation
  // (trois colonnes RAW DISTINCTES → cumulées). Sans Contenance connue → aucune pénalité.
  const place = vd?.capacity
    ? placementPenalty((ship.postes ?? []).map((p) => ({ side: p.side, weight: p.item.enc })), vd.capacity)
    : { m: 0, man: 0, navDR: 0 };
  // « Lissage » → op `moveMod` (M +1, l.293) ; « Peu maniable » → op `skillDRBonus` (Voile/Ramer, −1/niveau,
  // l.173, DISTINCT du Man) — lus en GameOp (`naval-traits.json`, langue unique) sur Traits+Améliorations.
  const navalTraits = [...(vd?.traits ?? []), ...(ship.upgrades ?? [])];
  return {
    baseM: baseM + navalMoveMod(navalTraits) + place.m,
    manoeuvre: (vd?.manoeuvre ?? 0) + place.man,
    extraDR: navalSkillTestDR(navalTraits, skillId) + place.navDR,
    skillId,
  };
}

/** Construit le `ManeuverResult` pour un Test de Navigation donné (PUR, aucune mutation, aucun RNG).
 *  RAW (MDG ch.13) : le VIRAGE réussit si le **Test réussit** (d100 ≤ cible — l.304 « virement de bord =
 *  Test réussi… en cas d'échec, le bateau se déplace normalement, sans bonus »). Le Man est un modificateur
 *  de **DR** (ch.12 l.48-50, stat-bloc « −1 DR »), PAS de difficulté → il échelonne le DR (mouvement via la
 *  Progression + l'IC de collision), il ne BASCULE PAS la réussite. On prend donc `nav.success` (le d100),
 *  jamais `dr ≥ 0` (qui conflaterait un d100 raté à DR 0 en faux succès, ou un d100 réussi à DR<0 en faux échec). */
function deriveManeuver(ship: Combatant, nav: { sl: number; roll?: number; target?: number; success?: boolean }, helmsman?: string): ManeuverResult {
  const { baseM, manoeuvre, extraDR } = shipManeuverParams(ship);
  const out = resolveShipManeuver(nav.sl, baseM, manoeuvre, extraDR);
  return { ...out, success: nav.success ?? out.success, navDR: nav.sl, roll: nav.roll, target: nav.target, helmsman, advanced: 0 };
}

/**
 * Jet du Test de Navigation du barreur (RNG de combat) → `ManeuverResult`. `helmsmanId` force le barreur,
 * sinon le meilleur de l'équipage APTE en Voile/Ramer. **PUR** (ne mute rien : ni virage, ni avance, ni log).
 * `null` hors combat / navire introuvable. La direction (`turnSteps`) est ORTHOGONALE au jet (appliquée au confirm).
 */
export function rollShipManeuver(get: Get, shipId: string, helmsmanId?: string): ManeuverResult | null {
  const battle = get().battle;
  const ship = battle?.combatants.find((c) => c.id === shipId);
  if (!battle || !ship) return null;
  const { skillId } = shipManeuverParams(ship);
  const crew = (ship.crewIds ?? [])
    .map((id) => battle.combatants.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c);
  const helm = helmsmanId ? battle.combatants.find((c) => c.id === helmsmanId) : bestHelmsman(crew, skillId);
  const nav = helm ? rollTest(testValue(helm, skillId), 'intermediaire', battleRng()) : undefined;
  return deriveManeuver(ship, { sl: nav?.sl ?? 0, roll: nav?.roll, target: nav?.target, success: nav?.success }, helm?.name);
}

/** Résilience « Je ne faillirai pas ! » (LDB 17 l.73) : force le Test à RÉUSSIR (le virage a lieu) au DR
 *  minimal (succès minime, sans bonus). `null` si le Test a déjà réussi. PUR. */
export function forceShipManeuver(ship: Combatant, prev: ManeuverResult | null): ManeuverResult | null {
  if (prev?.success) return null;
  const { manoeuvre, extraDR } = shipManeuverParams(ship);
  // navDR tel que `dr = navDR + Man + extraDR = 0` ; réussite FORCÉE (le virage a lieu).
  return deriveManeuver(ship, { sl: -(manoeuvre + extraDR), roll: prev?.roll ?? 1, target: prev?.target, success: true }, prev?.helmsman);
}

/** Chance « +1 DR » (LDB 17 l.26) : re-dérive la manœuvre avec `navDR + 1` (meilleure Progression / collision) ;
 *  la réussite du Test (d100) est INCHANGÉE (le +1 DR augmente le degré, pas le succès). PUR. */
export function bonusShipManeuver(ship: Combatant, prev: ManeuverResult): ManeuverResult {
  return deriveManeuver(ship, { sl: prev.navDR + 1, roll: prev.roll, target: prev.target, success: prev.success }, prev.helmsman);
}

/**
 * APPLIQUE une manœuvre résolue (mutation) : sur réussite, vire de `turnSteps` crans (`shipTurn` re-mappe les
 * arcs) ; le navire avance TOUJOURS le long du cap (`shipAdvance`, MDG ch.13 — déplacement INCONDITIONNEL,
 * M÷2 plancher). Renvoie les cases avancées. Logue le succès (via `shipTurn`) ou l'échec.
 */
export function applyShipManeuver(get: Get, shipId: string, result: ManeuverResult, turnSteps: number): number {
  const ship = get().battle?.combatants.find((c) => c.id === shipId);
  if (result.success) get().shipTurn(shipId, turnSteps); // vire + re-mappe les arcs + logue le nouveau cap
  else get().log(`${result.helmsman ?? "L'équipage"} rate la manœuvre de ${ship?.name ?? shipId} (DR ${result.dr}) — le cap tient.`);
  return get().shipAdvance(shipId, result.movement);
}

/**
 * Manœuvre COMPOSÉE (jet + application) — `helmsmanId` force le barreur. Utilisée par les devtools `__wfrp`
 * et les tests headless ; le flux différé jouable (modale) appelle `rollShipManeuver`/`applyShipManeuver`
 * séparément. `null` hors combat.
 */
export function maneuverShip(get: Get, shipId: string, turnSteps: number, helmsmanId?: string): ManeuverResult | null {
  const r = rollShipManeuver(get, shipId, helmsmanId);
  if (!r) return null;
  const advanced = applyShipManeuver(get, shipId, r, turnSteps);
  return { ...r, advanced };
}
