/**
 * ÉQUIPE des machines de guerre (ADE II ch.08 « Le théâtre de la guerre » l.233) : « Une Équipe est un
 * groupe d'individus entraînés requis pour faire fonctionner une machine de guerre correctement. Les
 * armes sans Équipe complète peuvent être utilisées avec une pénalité de –20. Elles ne peuvent être
 * utilisées avec moins de la moitié de l'Équipe nécessaire. » 3ᵉ courbe de sous-effectif, DISTINCTE de
 * `crewedPenalty` (AA/MDG ch.12, `engine/crewedWeapon.ts` : recharge ×2 + Défauts escaladés) et
 * `undercrewPenalty` (MDG ch.14, `engine/crewMorale.ts` : tranches de 10 % → DR navire plafonné) — PAS de
 * réutilisation de leur mécanique, ni de la Qualité `arme-d-equipe` (qui porterait leur courbe à elles).
 * L'Équipe requise vit en DONNÉE sur l'arme via la Qualité `equipe` (Indice = effectif requis).
 */
import type { Weapon } from './types';
import { qualityIndice } from './qualities/dispatch';

/** Dégradation d'une machine de guerre ADE II en sous-effectif. */
export interface WarMachineCrewPenalty {
  /** −20 au Test si l'Équipe est incomplète (0 si au complet ou sans Équipe requise). */
  toHitMod: number;
  /** Inutilisable : moins de la moitié de l'Équipe requise est présente. */
  unusable: boolean;
}

/** Pénalité de sous-effectif d'une machine de guerre (ADE II ch.08 l.233). `present` = effectif présent
 *  (headcount brut — le RAW ne pose ICI aucune exigence de Compétence, à la différence d'AA/MDG l.3900),
 *  `required` = Équipe requise (Indice de la Qualité `equipe`). PUR. */
export function warMachineCrewPenalty(present: number, required: number): WarMachineCrewPenalty {
  if (required <= 0) return { toHitMod: 0, unusable: false };
  const p = Math.max(0, present);
  return { toHitMod: p < required ? -20 : 0, unusable: p < required / 2 };
}

/** Équipe REQUISE d'une machine de guerre (Indice de la Qualité `equipe`), 0 si l'arme n'en porte pas
 *  (arme normale, ou machine de guerre sans Équipe déclarée). PUR. */
export function warMachineCrewRequired(w: Pick<Weapon, 'qualities'> | undefined): number {
  return qualityIndice(w, 'equipe') ?? 0;
}

/** Arme de machine de guerre effectivement tirée/maniée : bake la pénalité de sous-effectif (l.233) en
 *  `crewTeamPenalty` (lu par `attackModifiers`, DISTINCT de `crewedTohitPenalty` d'AA). N'altère PAS les
 *  Qualités/la Recharge (RAW ADE II ne prévoit ni Défaut ajouté ni recharge doublée, à la différence d'AA) —
 *  seul le malus au toucher, PLAT. Arme sans Qualité `equipe` → inchangée. PUR. */
export function warMachineFireWeapon(weapon: Weapon, present: number): Weapon {
  const required = warMachineCrewRequired(weapon);
  if (required <= 0) return weapon;
  const pen = warMachineCrewPenalty(present, required);
  if (!pen.toHitMod) return weapon;
  return { ...weapon, crewTeamPenalty: (weapon.crewTeamPenalty ?? 0) + pen.toHitMod };
}
