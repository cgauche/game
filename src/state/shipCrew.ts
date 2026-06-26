/**
 * Dérivation ÉQUIPAGE → RÔLES pour un Test d'équipage (MDG ch.14) — couche STATE (lit l'équipage du navire + son
 * Moral de campagne). PUR (sauf `shipMoraleScore` qui lit le store). La pièce manquante : personne ne construisait le
 * `CrewAssignment[]` que `resolveBattery`/la manœuvre attendent. Partagé par TOUS les Tests d'équipage (manœuvre,
 * batterie, perception…) — un seul endroit assigne les marins aux postes.
 */
import type { Combatant } from '../engine/types';
import { crewRoleValue, MORALE_BASE, undercrewPenalty, type CrewAssignment, type UndercrewPenalty } from '../engine/crewMorale';
import { findCrewRoleById, findCrewTestTypeById, findVehicleById } from '../data';
import { exposedCrew } from '../engine/shipCritical';
import type { Get } from './flowTypes';

/**
 * Assignation de l'équipage APTE d'un navire aux rôles qui contribuent à `testTypeId` (MDG ch.14). Chaque marin tient
 * son rôle ÉPINGLÉ (`shipRole`) ou INFÉRÉ (`defaultCrewRole`), filtré aux rôles du type de Test (`crew-test-types.json`).
 * Au plus UN marin par rôle : en cas de collision, le MEILLEUR pour ce rôle (`crewRoleValue`). PUR.
 */
/** Marqueur « au repos » : un marin RETIRÉ d'un poste (✕ dans la fiche) revient à l'équipage disponible et n'est PAS
 *  ré-assigné par le défaut (sinon « retirer » serait sans effet pour un rôle déduit). */
export const BENCHED = 'repos';

/** Un marin est-il FORMÉ pour un rôle (possède une de ses compétences) ? PUR. */
function trainedForRole(c: Combatant, roleId: string): boolean {
  const role = findCrewRoleById(roleId);
  return !!role && role.skills.some((s) => (c.skills ?? []).some((k) => k.skillId === s.skillId && (s.spec == null || k.spec === s.spec)));
}

/**
 * Assignation par DÉFAUT de l'équipage aux rôles d'un Test (MDG ch.14) — GLOBALE (pas marin par marin), pour que le
 * défaut soit BON : on remplit d'abord le rôle ESSENTIEL puis les autres rôles SPÉCIFIQUES avec le MEILLEUR marin
 * FORMÉ encore libre (un titulaire par poste → on ÉTALE l'équipage au lieu d'entasser 2 PJ sur le même) ; le reste
 * tombe **Mousse** (rôle par défaut, l.15) s'il sait Voile/Ramer. Les rôles ÉPINGLÉS (`shipRole`) sont respectés —
 * et un poste épinglé PEUT avoir plusieurs titulaires (l.9). Renvoie `crewId → roleId`. PUR. */
export function shipDefaultRoles(crew: Combatant[], testTypeId: string): Map<string, string> {
  const out = new Map<string, string>();
  const testType = findCrewTestTypeById(testTypeId);
  if (!testType) return out;
  const apte = exposedCrew(crew);
  const free = new Set<string>();
  for (const c of apte) { if (c.shipRole) out.set(c.id, c.shipRole); else free.add(c.id); } // épinglés respectés (dont 'repos')
  // Rôles SPÉCIFIQUES (hors Mousse), ESSENTIEL d'abord : UN titulaire chacun = le meilleur marin FORMÉ encore libre.
  const specific = testType.roles.filter((r) => r !== 'mousse')
    .sort((a, b) => (a === testType.essential ? -1 : b === testType.essential ? 1 : 0));
  for (const roleId of specific) {
    if ([...out.values()].includes(roleId)) continue; // déjà tenu (épinglé)
    const role = findCrewRoleById(roleId)!;
    let best: { id: string; val: number } | null = null;
    for (const c of apte) {
      if (!free.has(c.id) || !trainedForRole(c, roleId)) continue;
      const v = crewRoleValue(c, role).value;
      if (!best || v > best.val) best = { id: c.id, val: v };
    }
    if (best) { out.set(best.id, roleId); free.delete(best.id); }
  }
  // Le reste → Mousse (rôle par défaut, l.15) s'il sait Voile/Ramer.
  if (testType.roles.includes('mousse')) for (const id of free) if (trainedForRole(apte.find((x) => x.id === id)!, 'mousse')) out.set(id, 'mousse');
  return out;
}

export function shipCrewAssignments(ship: Combatant, combatants: Combatant[], testTypeId: string): CrewAssignment[] {
  const roleSet = new Set(findCrewTestTypeById(testTypeId)?.roles ?? []);
  const crew = (ship.crewIds ?? [])
    .map((id) => combatants.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c);
  // Une entrée PAR titulaire de rôle (le rôle vient du défaut GLOBAL `shipDefaultRoles` : essentiel rempli + PJ étalés).
  // Filtré aux rôles de CE Test (exclut 'repos' et les rôles d'un autre Test). MULTI possible si épinglé (MDG ch.14 l.9).
  const roles = shipDefaultRoles(crew, testTypeId);
  const out: CrewAssignment[] = [];
  for (const c of exposedCrew(crew)) {
    const roleId = roles.get(c.id);
    if (roleId && roleSet.has(roleId)) out.push({ crew: c, roleId });
  }
  return out;
}

/**
 * Contributeurs d'un Test d'équipage (MDG ch.14) — UN jet par POSTE, pas par marin. Par rôle tenu : TOUS les PJ du
 * poste lancent (l.9 « plusieurs Personnages peuvent contribuer ») ; sinon UN seul marin REPRÉSENTANT (le meilleur),
 * car « la performance des Personnages représente celle de tout l'équipage » (l.39) — les PNJ ne testent que pour un
 * rôle qu'AUCUN PJ n'occupe (l.41). PARTAGÉ par la manœuvre ET la bordée (`testTypeId`). `partyIds` = les PJ. PUR. */
export function crewTestContributors(ship: Combatant, combatants: Combatant[], testTypeId: string, partyIds: Set<string>): CrewAssignment[] {
  const roleVal = (a: CrewAssignment) => { const r = findCrewRoleById(a.roleId); return r ? crewRoleValue(a.crew, r).value : 0; };
  const byRole = new Map<string, CrewAssignment[]>();
  for (const a of shipCrewAssignments(ship, combatants, testTypeId)) (byRole.get(a.roleId) ?? byRole.set(a.roleId, []).get(a.roleId)!).push(a);
  const out: CrewAssignment[] = [];
  for (const group of byRole.values()) {
    const pjs = group.filter((a) => partyIds.has(a.crew.id));
    if (pjs.length) out.push(...pjs); // chaque PJ du poste lance (l.9)
    else out.push(group.reduce((b, a) => (roleVal(a) > roleVal(b) ? a : b))); // sinon UN marin représentant (l.39/41)
  }
  return out;
}

/** Ajoute des marins à la liste « ayant agi ce Round » d'un navire (Manque de bras / cumul, MDG ch.14 l.53). PUR
 *  (renvoie un nouveau `crewActed`). Dédupliqué : un marin déjà listé n'y figure qu'une fois. */
export function withCrewActed(crewActed: Record<string, string[]> | undefined, shipId: string, ids: string[]): Record<string, string[]> {
  return { ...(crewActed ?? {}), [shipId]: [...new Set([...(crewActed?.[shipId] ?? []), ...ids])] };
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

/**
 * Manque de bras GLOBAL d'un navire (MDG ch.14 l.55) : compare l'équipage NOMINAL du type (`ship.crew` de
 * `vehicles.json`) aux membres encore EN ÉTAT (`exposedCrew` des `crewIds`) → −2 DR par tranche de 10 % manquant
 * + plafond Succès Minime. Les morts/inconscients (Éclats, critiques « Équipage ») alimentent le déficit. Dérivé
 * à l'usage. PUR (lit la donnée du type, pas le store). */
export function shipUndercrew(ship: Combatant, combatants: Combatant[]): UndercrewPenalty {
  const nominal = findVehicleById(ship.creatureId ?? '')?.ship?.crew ?? 0;
  const present = exposedCrew((ship.crewIds ?? []).map((id) => combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c)).length;
  return undercrewPenalty(nominal, present);
}
