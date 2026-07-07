/**
 * Dérivation ÉQUIPAGE → RÔLES pour un Test d'équipage (MDG ch.14) — couche STATE (lit l'équipage du navire + son
 * Moral de campagne). PUR (sauf `shipMoraleScore` qui lit le store). La pièce manquante : personne ne construisait le
 * `CrewAssignment[]` que `resolveBattery`/la manœuvre attendent. Partagé par TOUS les Tests d'équipage (manœuvre,
 * batterie, perception…) — un seul endroit assigne les marins aux postes.
 */
import type { Combatant } from '../engine/types';
import { crewRoleValue, moraleBand, MORALE_BASE, undercrewPenalty, type CrewAssignment, type UndercrewPenalty } from '../engine/crewMorale';
import type { PairedSense } from '../engine/ops';
import { findCrewRoleById, findCrewTestTypeById, findVehicleById, findSeaShantyById } from '../data';
import { exposedCrew } from '../engine/shipCritical';
import { partyBest } from '../engine/skills';
import { maxBy } from '../engine/pick';
import { applyOps } from '../engine/ops';
import { removeActiveEffects, isOutOfAction } from '../engine/conditions';
import { battleRng } from './battleRng';
import type { Get, Set as SetFn } from './flowTypes';

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
    // Meilleur marin FORMÉ encore libre : `partyBest` (skill/char indéfinis → `testValue`=0) score PUREMENT sur
    // `crewRoleValue`. Le `.filter` préserve l'ordre d'`apte` → first-max identique à la boucle strict-`>` d'origine.
    const candidates = apte.filter((c) => free.has(c.id) && trainedForRole(c, roleId));
    const winner = partyBest(candidates, undefined, undefined, (c) => crewRoleValue(c, role).value)?.actor;
    if (winner) { out.set(winner.id, roleId); free.delete(winner.id); }
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
 * rôle qu'AUCUN PJ n'occupe (l.41). PARTAGÉ par la manœuvre ET la bordée (`testTypeId`). `partyIds` = les PJ.
 * `sense` (Test à sens dominant, ex. Vigie visuelle, #149) écarte la pénalité sensorielle hors-sujet du RANKING
 * du marin représentant — parité avec la valeur de Test (#158). PUR. */
export function crewTestContributors(ship: Combatant, combatants: Combatant[], testTypeId: string, partyIds: Set<string>, sense?: PairedSense): CrewAssignment[] {
  const roleVal = (a: CrewAssignment) => { const r = findCrewRoleById(a.roleId); return r ? crewRoleValue(a.crew, r, sense).value : 0; };
  const byRole = new Map<string, CrewAssignment[]>();
  for (const a of shipCrewAssignments(ship, combatants, testTypeId)) (byRole.get(a.roleId) ?? byRole.set(a.roleId, []).get(a.roleId)!).push(a);
  const out: CrewAssignment[] = [];
  for (const group of byRole.values()) {
    const pjs = group.filter((a) => partyIds.has(a.crew.id));
    if (pjs.length) out.push(...pjs); // chaque PJ du poste lance (l.9)
    else out.push(maxBy(group, roleVal)!.item); // sinon UN marin représentant (l.39/41) — first-max = earlier item, `group` non-vide (else)
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
 * Manque de bras GLOBAL d'un navire (MDG ch.14 l.55) : `undercrewPenalty(nominal, présent)` où le NOMINAL vient
 * du type (`vehicles.json` ship.crew) et le PRÉSENT = les `crewIds` encore EN ÉTAT (`exposedCrew`), MOINS les
 * marins déjà retirés de la campagne par Embrigadement (MDG 15 l.245, `CampaignVessel.crewLost`). Les
 * morts/inconscients de combat (Éclats, critiques « Équipage ») alimentent aussi le déficit. Lit l'état persistant
 * du vaisseau de campagne comme `shipMoraleScore` (keyé `creatureId === vehicleId`). */
export function shipUndercrew(get: Get, ship: Combatant, combatants: Combatant[]): UndercrewPenalty {
  const nominal = findVehicleById(ship.creatureId ?? '')?.ship?.crew ?? 0;
  const exposed = exposedCrew((ship.crewIds ?? []).map((id) => combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c)).length;
  const vessel = get().vessel;
  const lost = vessel && ship.creatureId === vessel.vehicleId ? (vessel.crewLost ?? 0) : 0;
  return undercrewPenalty(nominal, Math.max(0, exposed - lost));
}

/** SABOTAGE des Tests d'équipage d'une coque (MDG ch.14 l.45-47 : « de -1 à -5 DR sur le Test d'équipage »)
 *  — lit `Combatant.saboteurDR` (authoré par le scénario) CLAMPÉ à la fourchette RAW [-5, 0]. PUR. */
export function shipSaboteurDR(ship: Combatant): number {
  return Math.max(-5, Math.min(0, ship.saboteurDR ?? 0));
}

/** QUART de veille (MDG 09 l.40 : « Une seule chanson de marin peut être chantée lors de chaque quart ») —
 *  le RAW ne chiffre pas le quart ; on prend le quart de veille naval STANDARD de 4 heures (240 min). */
export const QUART_MINUTES = 240;
export const quartIndex = (gameTime: number): number => Math.floor(gameTime / QUART_MINUTES);

/** Préfixe d'identité des effets de chanson (retrait ciblé à l'interruption — MDG 09 l.38). */
const SHANTY_LABEL = (label: string): string => `Chanson de marin — ${label}`;

/**
 * APPLIQUE une chanson de marin RÉUSSIE (MDG 09 l.36-40 + l.218-248) : ses `crewOps` sur CHAQUE membre
 * d'équipage APTE (« Une chanson de marin affecte un équipage entier », l.36) et ses `captainOps` sur le
 * seul TITULAIRE du rôle Capitaine (« Suivez le capitaine », l.246-248). Durée : « trois minutes plus un
 * nombre de minutes égal au DR » (l.38) → effets d'HORLOGE (`defaultUntilTime`). Pose l'identité de chant
 * sur le chanteur (interruption sur Dégâts, l.38) et consomme le QUART du navire (l.40). Renvoie le journal.
 */
export function applyShantyToCrew(get: Get, ship: Combatant, singer: Combatant, shantyId: string, sl: number): string[] {
  const shanty = findSeaShantyById(shantyId);
  if (!shanty) return [];
  const label = SHANTY_LABEL(shanty.label);
  const until = get().gameTime + 3 + Math.max(0, sl); // 3 min + DR (l.38)
  const combatants = get().battle?.combatants ?? get().party;
  const crew = exposedCrew((ship.crewIds ?? []).map((id) => combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c));
  const lines: string[] = [`${singer.name} entonne « ${shanty.label} » (${3 + Math.max(0, sl)} min).`];
  for (const c of crew) if (shanty.crewOps?.length) lines.push(...applyOps(c, shanty.crewOps, { label, effectId: shantyId, rng: battleRng(), defaultUntilTime: until }));
  if (shanty.captainOps?.length) {
    const roles = shipDefaultRoles(crew, 'manoeuvre');
    const captain = crew.find((c) => roles.get(c.id) === 'capitaine');
    if (captain) lines.push(...applyOps(captain, shanty.captainOps, { label, effectId: shantyId, rng: battleRng(), defaultUntilTime: until }));
    else lines.push('Aucun Capitaine à bord : la chanson ne trouve pas son héros.');
  }
  singer.singingShanty = { shantyId, label };
  ship.lastShantyQuart = quartIndex(get().gameTime);
  return lines;
}

/** FIN DE CHANT (MDG 09 l.38 : « Si le Personnage subit des Dégâts ou rate un Test opposé, sa Chanson de
 *  marin prend fin ») : retire l'effet de la chanson de TOUS les combattants (retrait par IDENTITÉ
 *  d'`effectId` = `shantyId` stable, ≠ libellé FR ; même chemin que l'expiration — `removeActiveEffects`).
 *  Renvoie une ligne de journal, ou []. */
export function endShanty(get: Get, singer: Combatant): string[] {
  const song = singer.singingShanty;
  if (!song) return [];
  delete singer.singingShanty;
  const combatants = get().battle?.combatants ?? get().party;
  for (const c of combatants) removeActiveEffects(c, (e) => e.effectId === song.shantyId);
  return [`La chanson de ${singer.name} s'interrompt.`];
}

/**
 * Résolution d'un NAVIRE comme UNITÉ DE COMBAT — abordage & naufrage (MDG ch.13-14). Un navire au combat =
 * sa COQUE (`bodyShape:'vehicule'`, à PV) + son ÉQUIPAGE (`crewIds`, de vrais combattants exposés). L'unité
 * sort du combat dès qu'UNE des deux issues RAW est atteinte — dans les DEUX sens, pour que la victoire
 * navale soit gagnable par CHAQUE voie :
 *  - **NAUFRAGE** — la coque tombe à 0 PB (« le navire coule », MDG ch.13 l.117). L'équipage encore en
 *    état passe par-dessus bord : il QUITTE la rencontre (`outOfRencontre`). Sans ça, couler le navire ne
 *    suffirait pas (l'équipage flotterait, or il est quasi inentamable en mêlée — table des Tailles ch.13
 *    l.618-637), et la voie « naufrage » ne conclurait jamais.
 *  - **PRISE À L'ABORDAGE** — tout l'équipage exposé est hors de combat (MDG ch.13 l.420 : « un abordage
 *    déterminé »). Sans personne à bord pour la défendre ou la manœuvrer, la coque sort du combat
 *    (`outOfRencontre`). Sans ça, vaincre l'équipage ne conclurait jamais (la coque, inentamable en mêlée,
 *    resterait un ennemi « vivant »).
 * KIND-AGNOSTIQUE (coque amie ou ennemie) mais ne s'active QUE sur une coque à équipage DÉCLARÉ
 * (`crewIds.length`) : une coque-cible SANS équipage ne se résout que par le naufrage de ses propres PV
 * (sinon elle serait « prise » d'emblée, l'ensemble vide étant vacuément vaincu). Mute EN PLACE, renvoie le
 * journal ; idempotent (une unité déjà résolue reste `outOfRencontre`). Appelé par `checkBattleOver`.
 */
export function resolveShipUnits(combatants: Combatant[]): string[] {
  const lines: string[] = [];
  for (const hull of combatants) {
    if (hull.bodyShape !== 'vehicule' || !hull.crewIds?.length || !hull.wounds) continue;
    const crew = hull.crewIds
      .map((id) => combatants.find((c) => c.id === id))
      .filter((c): c is Combatant => !!c);
    if (isOutOfAction(hull)) {
      // Naufrage : l'équipage encore en état sombre avec le navire (sort de la rencontre).
      const aboard = exposedCrew(crew).filter((c) => !isOutOfAction(c));
      if (aboard.length) {
        for (const c of aboard) c.outOfRencontre = true;
        lines.push(`${hull.name} sombre — son équipage (${aboard.map((c) => c.name).join(', ')}) passe par-dessus bord.`);
      }
    } else if (crew.length && crew.every((c) => isOutOfAction(c))) {
      // Plus personne à bord : la coque, sans équipage pour la défendre ni la manœuvrer, quitte le combat.
      hull.outOfRencontre = true;
      lines.push(`${hull.name} n'a plus d'équipage en état de le défendre : le navire est pris et sort du combat.`);
    }
  }
  return lines;
}

/**
 * Applique un DELTA de Moral au NAVIRE DE CAMPAGNE (MDG ch.14 — Rude épreuve l.110 : le Moral évolue en jeu,
 * pas seulement au recalc hebdomadaire) : PERSISTE sur `CampaignVessel.morale.score` quand la coque EST le
 * navire de campagne (sinon no-op : une coque adverse/transitoire ne suit pas de Moral). Renvoie les lignes
 * de journal (delta + changement de bande éventuel — « Des canailles que je ne parviens pas à mater »).
 */
export function applyShipMoraleDelta(get: Get, set: SetFn, ship: Combatant, delta: number): string[] {
  const vessel = get().vessel;
  if (!delta || !vessel || ship.creatureId !== vessel.vehicleId) return [];
  const before = vessel.morale.score;
  const after = before + delta;
  set({ vessel: { ...vessel, morale: { ...vessel.morale, score: after } } });
  const lines = [`Moral de l'équipage : ${delta > 0 ? '+' : ''}${delta} (${before} → ${after}).`];
  const bandAfter = moraleBand(after);
  if (bandAfter.id !== moraleBand(before).id) lines.push(`« ${bandAfter.desc.split('.')[0]}. »`);
  return lines;
}

/**
 * Applique un DELTA d'effectif PNJ CUMULÉ du navire de CAMPAGNE (Embrigadement — MDG 15 l.245 : perte de
 * 2d10 membres d'équipage, recouvrable par Ragot puis rançon/Discrétion) : PERSISTE sur
 * `CampaignVessel.crewLost`, plafonné à `[0, nominal]` (`vehicles.json` ship.crew — même source que
 * `shipUndercrew`) dans les deux sens. `delta` positif = perte, négatif = recouvrement (séquence
 * Ragot/rançon/Discrétion : `openEmbrigadementRecovery`, `embrigadementFlow`). Renvoie le journal.
 */
export function applyVesselCrewLoss(get: Get, set: SetFn, delta: number): string[] {
  const vessel = get().vessel;
  if (!delta || !vessel) return [];
  const nominal = findVehicleById(vessel.vehicleId)?.ship?.crew ?? 0;
  const before = vessel.crewLost ?? 0;
  const after = Math.max(0, Math.min(nominal, before + delta));
  if (after === before) return [];
  set({ vessel: { ...vessel, crewLost: after } });
  return [`Équipage : ${after > before ? '−' : '+'}${Math.abs(after - before)} membre(s) (reste ${Math.max(0, nominal - after)}/${nominal}).`];
}
