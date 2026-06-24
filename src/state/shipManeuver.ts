/**
 * MANŒUVRE NAVALE jouable (MDG ch.13 « Navigation maritime ») — couche STATE (dépend du cap/grille, comme
 * `fireArc`/`shipPostes` ; le moteur reste pur). Le « Personnage à la barre » (RAW : « le mieux placé pour
 * influencer le mouvement ») jette un Test de Navigation — **Voile** si le navire avance à la voile, **Ramer**
 * s'il avance aux avirons — modifié par le **Man** du navire (`resolveShipManeuver`, moteur pur). Sur réussite,
 * le navire VIRE de `turnSteps` crans (`shipTurn` re-mappe d'un coup ses arcs de bordée).
 *
 * Le M (Mouvement) et le Man du navire vivent dans `vehicles.json` (facette `ship`), PAS sur le Combattant-coque
 * (`vehicleCombatant` met `movement:0`) → on les relit via `creatureId`. Le DÉPLACEMENT effectif (avancer de
 * `out.movement` cases dans le nouveau cap) et la MODALE joueur (RollFlowShell) restent à câbler (Phase 2c).
 */
import { battleRng } from './battleRng';
import { rollTest } from '../engine/tests';
import { testValue } from '../engine/skills';
import { resolveShipManeuver, type ShipManeuverOutcome } from '../engine/shipNavigation';
import { navalEffectSum } from '../engine/navalTraits';
import { findVehicleById } from '../data';
import type { Combatant } from '../engine/types';
import type { Get } from './flowTypes';

/** Le barreur : parmi l'équipage présent, celui qui a la MEILLEURE valeur de Test de `skillId` (Voile/Ramer). */
function bestHelmsman(crew: Combatant[], skillId: string): Combatant | undefined {
  return [...crew].sort((a, b) => testValue(b, skillId) - testValue(a, skillId))[0];
}

export interface ManeuverResult extends ShipManeuverOutcome {
  /** DR BRUT du Test de Navigation du barreur (avant ajout du Man). */
  navDR: number;
  /** Nom du barreur (pour le journal). */
  helmsman?: string;
}

/**
 * Résout une manœuvre du navire `shipId` qui vire de `turnSteps` crans (>0 tribord, <0 bâbord). `helmsmanId`
 * force le barreur, sinon on prend le meilleur de l'équipage en Voile/Ramer. Jette le Test (RNG de combat),
 * applique le virage sur réussite. Renvoie l'issue (pour le journal / la future modale), ou `null` hors combat.
 */
export function maneuverShip(get: Get, shipId: string, turnSteps: number, helmsmanId?: string): ManeuverResult | null {
  const battle = get().battle;
  const ship = battle?.combatants.find((c) => c.id === shipId);
  if (!battle || !ship) return null;
  const vd = ship.creatureId ? findVehicleById(ship.creatureId)?.ship : undefined;
  const baseM = vd?.sail?.m ?? vd?.oars?.m ?? 0;
  const manoeuvre = vd?.manoeuvre ?? 0;
  const skillId = vd?.sail ? 'voile' : 'ramer'; // à voile → Voile ; aux avirons → Ramer (MDG ch.13)
  const crew = (ship.crewIds ?? [])
    .map((id) => battle.combatants.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c);
  const helm = helmsmanId ? battle.combatants.find((c) => c.id === helmsmanId) : bestHelmsman(crew, skillId);
  // Test de Navigation du barreur (Intermédiaire +0) → DR brut ; le Man s'ajoute dans resolveShipManeuver.
  const navDR = helm ? rollTest(testValue(helm, skillId), 'intermediaire', battleRng()).sl : 0;
  // Traits du TYPE (`ship.traits`) + Améliorations d'INSTANCE (`ship.upgrades`) → liste navale effective.
  // Effets de manœuvre lus en DONNÉE (`naval-traits.json`) : « Peu maniable » → `maneuverDR` (−1/niveau, MDG
  // ch.12 l.173) — DISTINCT du Man (colonnes séparées) → cumulé via l'`extraDR` ; « Lissage » → `moveBonus`
  // (M +1, l.293) → ajouté au Mouvement de base.
  const navalTraits = [...(vd?.traits ?? []), ...(ship.upgrades ?? [])];
  const out = resolveShipManeuver(
    navDR, baseM + navalEffectSum(navalTraits, 'moveBonus'), manoeuvre, navalEffectSum(navalTraits, 'maneuverDR'),
  );
  if (out.success) get().shipTurn(shipId, turnSteps); // vire + re-mappe les arcs + logue le nouveau cap
  else get().log(`${helm?.name ?? "L'équipage"} rate la manœuvre de ${ship.name} (DR ${out.dr}) — le cap tient.`);
  return { ...out, navDR, helmsman: helm?.name };
}
