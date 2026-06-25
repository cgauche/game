/**
 * Dérivation ÉQUIPAGE → RÔLES pour un Test d'équipage (MDG ch.14) — couche STATE (lit l'équipage du navire + son
 * Moral de campagne). PUR (sauf `shipMoraleScore` qui lit le store). La pièce manquante : personne ne construisait le
 * `CrewAssignment[]` que `resolveBattery`/la manœuvre attendent. Partagé par TOUS les Tests d'équipage (manœuvre,
 * batterie, perception…) — un seul endroit assigne les marins aux postes.
 */
import type { Combatant } from '../engine/types';
import { crewRoleValue, defaultCrewRole, MORALE_BASE, type CrewAssignment } from '../engine/crewMorale';
import { findCrewRoleById, findCrewTestTypeById } from '../data';
import { exposedCrew } from '../engine/shipCritical';
import type { Get } from './flowTypes';

/**
 * Assignation de l'équipage APTE d'un navire aux rôles qui contribuent à `testTypeId` (MDG ch.14). Chaque marin tient
 * son rôle ÉPINGLÉ (`shipRole`) ou INFÉRÉ (`defaultCrewRole`), filtré aux rôles du type de Test (`crew-test-types.json`).
 * Au plus UN marin par rôle : en cas de collision, le MEILLEUR pour ce rôle (`crewRoleValue`). PUR.
 */
export function shipCrewAssignments(ship: Combatant, combatants: Combatant[], testTypeId: string): CrewAssignment[] {
  const roleSet = new Set(findCrewTestTypeById(testTypeId)?.roles ?? []);
  const crew = (ship.crewIds ?? [])
    .map((id) => combatants.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c);
  // MULTI par rôle (MDG ch.14 l.13 : « tout le monde effectue son Test, tous les DR sont additionnés ») — plusieurs
  // membres PEUVENT tenir le même poste (2 PJ à la barre, un équipage de pièce). Chaque marin APTE contribue à son
  // rôle ÉPINGLÉ (`shipRole`) ou INFÉRÉ (`defaultCrewRole`), filtré aux rôles de ce Test. Une entrée PAR membre.
  const out: CrewAssignment[] = [];
  for (const c of exposedCrew(crew)) {
    const roleId = c.shipRole ?? defaultCrewRole(c) ?? undefined;
    if (roleId && roleSet.has(roleId) && findCrewRoleById(roleId)) out.push({ crew: c, roleId });
  }
  return out;
}

/**
 * Moral effectif d'un navire pour un Test d'équipage (la bande de Moral pèse en ±DR, MDG ch.14). Pont CAMPAGNE → COMBAT :
 * la coque `Combatant` ne porte AUCUN Moral (il vit sur `CampaignVessel`, recalc hebdomadaire) → on lit `vessel.morale.score`
 * si la coque EST le navire de campagne, sinon `MORALE_BASE` (75, équipage neuf). Dérivé à l'usage, jamais stocké sur la coque.
 */
export function shipMoraleScore(get: Get, ship: Combatant): number {
  const vessel = get().vessel;
  return vessel && ship.creatureId === vessel.vehicleId ? vessel.morale.score : MORALE_BASE;
}
