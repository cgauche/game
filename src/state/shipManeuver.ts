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
import { rollTest, evaluateTest, easeDifficulty, bestForcedRoll } from '../engine/tests';
import { DIFFICULTY_MODIFIERS } from '../engine/types';
import { testValue, partyBest } from '../engine/skills';
import { resolveShipManeuver, type ShipManeuverOutcome } from '../engine/shipNavigation';
import { navalMoveMod, navalMoveMult, navalSkillTestDR, navalTestTypeDR } from '../engine/navalTraits';
import { cargoOverload } from '../engine/seaVoyage';
import { exposedCrew } from '../engine/shipCritical';
import { crewRoleValue, crewTalentDR, moraleBand } from '../engine/crewMorale';
import { placementPenalty } from './shipPostes';
import { inBattleId } from './combatOrParty';
import { findVehicleById, findCrewRoleById } from '../data';
import type { RNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import type { PairedSense } from '../engine/ops';
import type { Get } from './flowTypes';

import type { CrewRoleRoll } from './pendings'; // défini côté pendings (neutre) — cf. quarantaine #328
export type { CrewRoleRoll };

/** Jet d'UN contributeur à son rôle : Test de la compétence du rôle (MDG ch.14). PUR (RNG injecté). `null` si le
 *  rôle est inconnu. La valeur suit `crewRoleValue` (meilleure compétence du rôle pour ce marin) ; sur un jet
 *  RÉUSSI s'ajoute le +DR de Talent en contexte Test d'équipage (`crewTalentDR` — Commandant émérite, MDG 09 l.54).
 *  `sense` (optionnel) : sens narratif du Test précis (Vigie du phare, MDG ch.13 l.337) — transmis à `crewRoleValue`. */
export function rollCrewRole(crew: Combatant, roleId: string, rng: RNG, cumul = false, sense?: PairedSense): CrewRoleRoll | null {
  const role = findCrewRoleById(roleId);
  if (!role) return null;
  // Cumul de 2 rôles (un marin déjà engagé dans un autre Test d'équipage ce Round) → +2 crans de Difficulté
  // (Manque de bras, MDG ch.14 l.53).
  const t = rollTest(crewRoleValue(crew, role, sense).value, cumul ? easeDifficulty('intermediaire', -2) : 'intermediaire', rng);
  return { roll: t.roll, target: t.target, sl: t.sl + (t.success ? crewTalentDR(crew, role) : 0) };
}

/** Résilience « Je ne faillirai pas ! » pour UN contributeur (PJ) : DR MAXIMAL à son rôle (LDB 17 l.73). PUR. */
export function forceCrewRole(crew: Combatant, roleId: string, cumul = false, sense?: PairedSense): CrewRoleRoll | null {
  const role = findCrewRoleById(roleId);
  if (!role) return null;
  // Résilience à DR max ; cible abaissée de +2 crans si cumul (Manque de bras, l.53). Le dé forcé est
  // POLICY-AWARE (`bestForcedRoll` : standard → 01 = DR max ; Fast DR → dé le plus haut, LDB 12 l.128) —
  // un 01 en dur DONNERAIT DR 0 en Fast DR (dizaines du jet). `crewTalentDR` (Commandant émérite, MDG 09 l.54)
  // PRÉSERVÉ, ajouté au DR (jamais double-compté).
  const target = crewRoleValue(crew, role, sense).value + (cumul ? DIFFICULTY_MODIFIERS[easeDifficulty('intermediaire', -2)] : 0);
  const die = bestForcedRoll(target);
  return { roll: die, target, sl: evaluateTest(die, target).sl + crewTalentDR(crew, role) };
}

/** Total du Test d'équipage de MANŒUVRE (MDG ch.14 l.13) : Σ des DR des contributeurs, le rôle ESSENTIEL compté
 *  DOUBLE (l.19), + la bande de Moral (l.13 « bonus/pénalités… en masse »), + le **Manque de bras** global
 *  (`undercrew` : −2 DR/tranche de 10 % manquant + plafond Succès Minime, l.55), + `extraDR` (SABOTAGE,
 *  l.45-47 : −1..−5 DR imposés au Test d'équipage). Ce total tient lieu de DR de
 *  Navigation que la manœuvre (ch.13) module ensuite par le Man du navire. PUR. */
export function maneuverCrewTotal(
  participants: { roleId: string; result: CrewRoleRoll | null }[],
  essentialRoleId: string | undefined,
  moraleScore: number,
  undercrew?: { dr: number; capSuccesMinime: boolean },
  extraDR = 0,
): number {
  let base = 0;
  for (const p of participants) {
    if (!p.result) continue;
    base += essentialRoleId && p.roleId === essentialRoleId ? p.result.sl * 2 : p.result.sl;
  }
  let total = base + moraleBand(moraleScore).crewTestDR + (undercrew?.dr ?? 0) + extraDR;
  if (undercrew?.capSuccesMinime && total > 0) total = 0; // jamais mieux qu'un Succès Minime (l.55)
  return total;
}

/** Agrège les jets d'une étape/pending À PARTICIPANTS (batch multi, MDG ch.14) selon `aggregate` —
 *  PARTAGÉ par le seam de jet (`rollSeam.buildBatchStep`, surface I) et la cascade (`cascade.commitStep`,
 *  surfaces M/V — `CascadeStep.participants`, seam de jet #275 Décision 4 cran 1). PUR : `'best'` = le
 *  meilleur DR l'emporte (porte forcée), `'opposed'` = le total net d'une marge adverse (contresort),
 *  `'summed-dr'` (défaut) = la somme MDG ch.14 l.13 (`maneuverCrewTotal`, Test d'équipage). */
export function aggregateCrewRolls(
  rolled: { roleId: string; result: CrewRoleRoll | null }[],
  aggregate: 'best' | 'opposed' | 'summed-dr' = 'summed-dr',
  opts: { essentialRoleId?: string; moraleScore?: number; extraDR?: number; undercrew?: { dr: number; capSuccesMinime: boolean }; opposeSl?: number } = {},
): { sl: number; success: boolean } {
  if (aggregate === 'best') {
    const best = rolled.reduce<CrewRoleRoll | null>((m, p) => (p.result && (!m || p.result.sl > m.sl) ? p.result : m), null);
    const sl = best?.sl ?? 0;
    return { sl, success: sl > 0 };
  }
  const total = maneuverCrewTotal(rolled, opts.essentialRoleId, opts.moraleScore ?? 0, opts.undercrew, opts.extraDR ?? 0);
  if (aggregate === 'opposed') {
    const sl = total - (opts.opposeSl ?? 0);
    return { sl, success: sl > 0 };
  }
  return { sl: total, success: total >= 1 };
}

/** `ManeuverResult` d'un Test d'ÉQUIPAGE : le total d'équipage tient lieu de DR de Navigation ; le virage RÉUSSIT
 *  si le DR FINAL (équipage + Man + extra) ≥ 1 (MDG ch.14 l.13 « si le total est de 1 DR ou plus, succès » — règle
 *  d'équipage, distincte du `dr ≥ 0` du barreur unique ch.13). Le déplacement suit la Progression. PUR. */
export function deriveManeuverFromCrew(ship: Combatant, crewTotal: number): ManeuverResult {
  const { baseM, manoeuvre, extraDR } = shipManeuverParams(ship);
  const out = resolveShipManeuver(crewTotal, baseM, manoeuvre, extraDR);
  return { ...out, success: out.dr >= 1, navDR: crewTotal, advanced: 0 };
}

/** Le barreur : parmi l'équipage APTE (vivant + conscient — même prédicat que `exposedCrew`), celui qui a la
 *  MEILLEURE valeur de Test de `skillId` (Voile/Ramer). Un marin à terre / inconscient ne tient pas la barre. */
function bestHelmsman(crew: Combatant[], skillId: string): Combatant | undefined {
  // Argmax sur l'axe ACTEUR (`partyBest` = maxBy sur `testValue`) : first-max strict, identique au tri desc stable
  // qui rendait le PREMIER max en `[0]`. Filtre `exposedCrew` conservé (marins présents + conscients).
  return partyBest(exposedCrew(crew), skillId)?.actor;
}

/** Le BARREUR effectif d'un navire à son tour (échelle Mer, navire-unité) : le meilleur de SON équipage présent en
 *  Voile/Ramer. `undefined` si aucun marin apte (le navire ne peut pas manœuvrer). PUR. */
export function shipHelmsman(combatants: Combatant[], ship: Combatant): Combatant | undefined {
  const { skillId } = shipManeuverParams(ship);
  const crew = (ship.crewIds ?? [])
    .map((id) => combatants.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c);
  return bestHelmsman(crew, skillId);
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
    ? placementPenalty((ship.postes ?? []).flatMap((p) => (p.side ? [{ side: p.side, weight: p.item.enc }] : [])), vd.capacity)
    : { m: 0, man: 0, navDR: 0 };
  // SURCHARGE de la cale (MDG ch.12 l.70-75, DISTINCT du déséquilibre de bord) : −1/−2/−3 M ET DR Manœuvre par
  // palier d'Encombrement supplémentaire (`ship.cargoEnc` recopié de `CampaignVessel.cargo`). Cumulée aux autres.
  const overload = vd?.capacity ? cargoOverload(ship.cargoEnc ?? 0, vd.capacity) : null;
  // « Lissage » → op `moveMod` (M +1, l.293) ; « Peu maniable » → op `skillDRBonus` (Voile/Ramer, −1/niveau,
  // l.173, DISTINCT du Man) — lus en GameOp (`naval-traits.json`, langue unique) sur Traits+Améliorations.
  // #221 : op `skillDRBonus` ciblée par `testType` (ex. « manoeuvre ») — agnostique de skillId, cumulée.
  // « Coque de course » → op `moveScale` (2×M, T2C ch.10 l.27) : facteur MULTIPLICATIF appliqué APRÈS les
  // `moveMod` additifs (ordre canonique d'`effectiveMovement`). Le M de VOYAGE (route.speed/travelSpeed) suit un
  // autre modèle et n'en dépend pas — le 2× ne joue qu'ici, où le M du navire pilote la manœuvre tactique.
  const navalTraits = [...(vd?.traits ?? []), ...(ship.upgrades ?? [])];
  const mult = navalMoveMult(navalTraits);
  return {
    baseM: Math.round(((baseM + navalMoveMod(navalTraits) + place.m + (overload?.mMod ?? 0)) * mult.num) / mult.den),
    manoeuvre: (vd?.manoeuvre ?? 0) + place.man + (overload?.manoeuvreDR ?? 0),
    extraDR: navalSkillTestDR(navalTraits, skillId) + navalTestTypeDR(navalTraits, 'manoeuvre') + place.navDR,
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
  const ship = inBattleId(battle, shipId);
  if (!battle || !ship) return null;
  const { skillId } = shipManeuverParams(ship);
  const crew = (ship.crewIds ?? [])
    .map((id) => inBattleId(battle, id))
    .filter((c): c is Combatant => !!c);
  const helm = helmsmanId ? inBattleId(battle, helmsmanId) : bestHelmsman(crew, skillId);
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
  const ship = inBattleId(get().battle, shipId);
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
