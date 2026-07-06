/**
 * POUSSÉE d'un engin de siège CREWÉ (ADE II ch.08 l.256/258 : la baliste/le bélier sont « dotés de roues
 * pour se déplacer sur le champ de bataille » — RAW muet sur un Test ou une vitesse chiffrée). Décision de
 * design (#156, Lot 2) : mouvement SIMPLE (aucun jet), effort collectif de l'Équipe — le CHEF de pièce
 * pousse, l'ENGIN et TOUS les servants du poste (`ShipPoste.crewIds`) translatent du MÊME delta (formation
 * rigide), exactement comme `shipAdvance` (store.ts:1239) déplace une coque + son équipage. Distance
 * plafonnée à une valeur MAISON éditable (`rule('siege-engine-push-speed')`, engine/policy.ts).
 *
 * Module FEUILLE (aucune dépendance combatFlow/combatSlice) : mute les combattants, l'appelant (store)
 * re-set `battle` + émet SCENE_DIRTY — MÊME convention que `mount.ts`.
 */
import type { Combatant, ShipPoste, Weapon } from '../engine/types';
import type { BattleState } from './store';
import type { MoveEnv } from './path';
import { mannedPosteWeapon } from '../engine/items';
import { warMachineCrewRequired, warMachineCrewPenalty } from '../engine/warMachineCrew';
import { exposedCrew } from '../engine/shipCritical';
import { footprintN } from './footprint';
import { moveEnv } from './combatGeometry';
import { rule } from '../engine/policy';

/** Le Combattant-affût qui PORTE `poste` (le poste vit sur `hull.postes`) — recherche par `uid` de la
 *  pièce (pas de dépendance à l'identité d'objet), MÊME esprit que `isPosteManned` (shipPostes.ts).
 *  `undefined` si `poste` n'appartient à aucun Combattant présent (scène désynchronisée). PUR. */
export function posteHullOf(poste: ShipPoste, combatants: Combatant[]): Combatant | undefined {
  return combatants.find((h) => h.postes?.some((p) => p.item.uid === poste.item.uid));
}

/** L'arme dérivée d'un poste est-elle un engin de siège MOBILE (ADE II ch.08) : catalogue « armes de
 *  siège » (`subType`) portant la Qualité `equipe` (l.233 — l'Équipe requise, réutilisée comme seuil de
 *  poussée). Un poste NAVAL (bordée de navire, MDG ch.12) n'a jamais cette combinaison → jamais poussable
 *  ici — la coque, elle, avance par `shipAdvance` (cap + Manœuvre), mécanisme DISTINCT jamais mêlé à
 *  celui-ci. PUR. */
export function isPushableEngine(w: Pick<Weapon, 'subType' | 'qualities'>): boolean {
  return w.subType === 'armes-de-siege' && warMachineCrewRequired(w) > 0;
}

/** `active` est-il le CHEF d'un poste d'engin MOBILE (rôle/équipement — ne juge PAS l'effectif, cf.
 *  `pushCrewOk`) ? Symétrique de la gate 'poste' d'attaque (`availableAttacks`, combatManeuvers.ts l.263) :
 *  l'appelant vérifie séparément l'Action disponible (`canTakeAction`/`battle.acted`). PUR. */
export function pushEligible(active: Combatant): boolean {
  const poste = active.mannedPoste;
  if (!poste || poste.crewIds?.[0] !== active.id) return false;
  const w = mannedPosteWeapon(active, poste);
  return !!w && isPushableEngine(w);
}

/** Effectif de poussée SUFFISANT : ≥ la moitié de l'Équipe requise (ADE II ch.08 l.233 — « [les armes de
 *  siège] ne peuvent être utilisées avec moins de la moitié de l'Équipe nécessaire » ; ici étendu à l'EFFORT
 *  de déplacement, pas seulement le tir, MÊME seuil que `firedAttackBlock`, combatFlow.ts:296-310). Effectif
 *  BRUT (`exposedCrew` : vivant + conscient) — le RAW ADE II ne pose ICI aucune exigence de Compétence
 *  (≠ `servingCrewPresent`, qui filtre par Projectiles pour la courbe AA/MDG — hors sujet ADE II, cf.
 *  `warMachineCrew.ts` en-tête). PUR. */
export function pushCrewOk(poste: ShipPoste, weapon: Weapon, combatants: Combatant[]): boolean {
  const required = warMachineCrewRequired(weapon);
  if (required <= 0) return true;
  const crew = (poste.crewIds ?? []).map((id) => combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c);
  return !warMachineCrewPenalty(exposedCrew(crew).length, required).unusable;
}

/** Portée de poussée PLAFONNÉE (cases) — PARALLÈLE à `mountMovement` (state/mount.ts:154-158), sémantique
 *  DISTINCTE : un engin poussé n'emprunte PAS le Mouvement du chef, seulement la valeur maison éditable
 *  (ADE II ch.08 l.258 : roues, aucune vitesse chiffrée). N'altère PAS `mountMovement`. PUR. */
export function pushMovement(): number {
  return Number(rule('siege-engine-push-speed'));
}

/** État du SLOT « Pousser » de la barre d'action (`ui/ActionBar`) — SOURCE UNIQUE du gate d'affordance,
 *  découplée du reste des conditions de barre (Action dispo / Sonné / Brisé, qui vivent dans ActionBar).
 *  `show` = `active` est chef d'un engin poussable RÉSOLU (arme + affût présents) ; `undercrew` = visible mais
 *  Équipe sous la moitié requise → bouton DÉSACTIVÉ (parité tir sous-effectif, `firedAttackBlock`). PUR. */
export function pushSlot(active: Combatant, combatants: Combatant[]): { show: boolean; undercrew: boolean } {
  const poste = pushEligible(active) ? active.mannedPoste : undefined;
  const w = poste ? mannedPosteWeapon(active, poste) : undefined;
  const show = !!poste && !!w && !!posteHullOf(poste, combatants);
  return { show, undercrew: show && !pushCrewOk(poste!, w!, combatants) };
}

/** Environnement de déplacement de la poussée : celui du CHEF (`moveEnv`, mêmes obstacles/barrières)
 *  mais avec l'empreinte de l'ENGIN substituée (`footprintN(hull)`) — c'est l'ENGIN qui doit tenir dans un
 *  passage, pas le chef. `servablePostes` impose déjà au chef d'être à ≤1 case de l'engin (adjacence), donc
 *  l'ancrage au chef reste une approximation fidèle tant que l'engin garde une empreinte 1×1 (cas courant :
 *  aucun engin ADE II n'a d'empreinte >1 en donnée aujourd'hui). PUR. */
export function pushMoveEnv(battle: BattleState, active: Combatant, hull: Combatant): MoveEnv {
  return { ...moveEnv(battle, active), foot: footprintN(hull) };
}
