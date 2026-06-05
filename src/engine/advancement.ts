/**
 * Avancement par Points d'Expérience (PX) — Livre de base, « Carrières » (07) l.31-102.
 *
 * Les Augmentations s'achètent UNE PAR UNE : le coût de la prochaine dépend du nombre déjà
 * acheté pour cette Caractéristique / Compétence (l.69, l.80). Toutes les valeurs sont copiées
 * VERBATIM du Tableau de Coût des Augmentations (l.45-62) — aucune invention.
 */
import { Combatant, CharKey, CHAR_KEYS } from './types';

/**
 * Tableau de Coût des Augmentations de Caractéristique et Compétence (07-Carrières l.45-62).
 * La bande = nombre d'Augmentations DÉJÀ achetées ; `max` est la borne haute INCLUSIVE de la bande.
 */
const ADVANCE_COST_TABLE: { max: number; char: number; skill: number }[] = [
  { max: 5, char: 25, skill: 10 }, // 0 à 5
  { max: 10, char: 30, skill: 15 }, // 6 à 10
  { max: 15, char: 40, skill: 20 }, // 11 à 15
  { max: 20, char: 50, skill: 30 }, // 16 à 20
  { max: 25, char: 70, skill: 40 }, // 21 à 25
  { max: 30, char: 90, skill: 60 }, // 26 à 30
  { max: 35, char: 120, skill: 80 }, // 31 à 35
  { max: 40, char: 150, skill: 110 }, // 36 à 40
  { max: 45, char: 190, skill: 140 }, // 41 à 45
  { max: 50, char: 230, skill: 180 }, // 46 à 50
  { max: 55, char: 280, skill: 220 }, // 51 à 55
  { max: 60, char: 330, skill: 270 }, // 56 à 60
  { max: 65, char: 390, skill: 320 }, // 61 à 65
  { max: 70, char: 450, skill: 380 }, // 66 à 70
  { max: Infinity, char: 520, skill: 440 }, // 71 et +
];

/** Coût en PX de la PROCHAINE Augmentation (la N+1ᵉ), `advancesAlready` = N déjà achetées.
 *  Hors carrière, le coût est DOUBLÉ (07-Carrières l.95). */
export function advanceCost(advancesAlready: number, kind: 'characteristic' | 'skill', inCareer = true): number {
  const band = ADVANCE_COST_TABLE.find((b) => advancesAlready <= b.max)!;
  const base = kind === 'characteristic' ? band.char : band.skill;
  return inCareer ? base : base * 2;
}

/** Coût en PX de la prochaine Augmentation de Talent : 100 + 100 × (Augmentations déjà achetées)
 *  pour ce Talent (07-Carrières l.102). 1ʳᵉ = 100, 2ᵉ = 200, 3ᵉ = 300. */
export function talentCost(timesAlready: number): number {
  return 100 * (timesAlready + 1);
}

export interface AdvanceResult {
  ok: boolean;
  cost: number;
  reason?: string;
}

/** Achète UNE Augmentation de Caractéristique (+1 à la valeur, +1 au compteur d'Augmentations) si
 *  les PX suffisent. Mute le héros. `inCareer` false → coût doublé (hors carrière). */
export function buyCharAdvance(hero: Combatant, char: CharKey, inCareer = true): AdvanceResult {
  const already = hero.charAdvances?.[char] ?? 0;
  const cost = advanceCost(already, 'characteristic', inCareer);
  if ((hero.xp ?? 0) < cost) return { ok: false, cost, reason: 'PX insuffisants' };
  hero.xp = (hero.xp ?? 0) - cost;
  hero.charAdvances = { ...(hero.charAdvances ?? {}), [char]: already + 1 };
  hero.characteristics[char] += 1; // chaque Augmentation ajoute +1 (l.71)
  return { ok: true, cost };
}

/** Achète UNE Augmentation pour une Compétence DÉJÀ connue (+1 à ses avances) si les PX suffisent. */
export function buySkillAdvance(hero: Combatant, skillName: string, inCareer = true): AdvanceResult {
  const skill = hero.skills.find((s) => s.name === skillName);
  if (!skill) return { ok: false, cost: 0, reason: 'Compétence inconnue' };
  const cost = advanceCost(skill.advances, 'skill', inCareer);
  if ((hero.xp ?? 0) < cost) return { ok: false, cost, reason: 'PX insuffisants' };
  hero.xp = (hero.xp ?? 0) - cost;
  skill.advances += 1; // chaque Augmentation ajoute +1 au niveau de Compétence (l.82)
  return { ok: true, cost };
}

/** Achète UNE Augmentation de Talent (le crée à `times` 1 s'il est absent, sinon +1) si les PX
 *  suffisent. Les Talents hors carrière ne sont normalement pas achetables (l.97) — c'est à
 *  l'appelant de filtrer ; ici on applique le coût standard. */
export function buyTalent(hero: Combatant, talentName: string): AdvanceResult {
  const existing = hero.talents.find((t) => t.name === talentName);
  const already = existing?.times ?? 0;
  const cost = talentCost(already);
  if ((hero.xp ?? 0) < cost) return { ok: false, cost, reason: 'PX insuffisants' };
  hero.xp = (hero.xp ?? 0) - cost;
  if (existing) existing.times += 1;
  else hero.talents.push({ name: talentName, times: 1 });
  return { ok: true, cost };
}

// ── Changer de Carrière (07-Carrières l.108-137) ──

/** Nombre d'Augmentations requis pour COMPLÉTER un Niveau de Carrière (l.127-132 :
 *  Niveau 1→5, 2→10, 3→15, 4→20). Le LDB de base ne tabule que jusqu'au Niveau 4. */
export function careerCompletionAdvances(level: number): number {
  return 5 * level;
}

/** Un Niveau de Carrière est complété si (l.125) : TOUTES les Caractéristiques ont ≥ req
 *  Augmentations, AU MOINS 8 des Compétences du Niveau ont ≥ req Augmentations, et le héros
 *  possède au moins 1 Talent du Niveau. `careerSkills` / `careerTalents` = listes du Niveau. */
export function isCareerLevelComplete(hero: Combatant, level: number, careerSkills: string[], careerTalents: string[]): boolean {
  const req = careerCompletionAdvances(level);
  const allChars = CHAR_KEYS.every((k) => (hero.charAdvances?.[k] ?? 0) >= req);
  if (!allChars) return false;
  const skilled = careerSkills.filter((name) => (hero.skills.find((s) => s.name === name)?.advances ?? 0) >= req).length;
  if (skilled < 8) return false;
  return careerTalents.some((name) => hero.talents.some((t) => t.name === name && t.times > 0));
}

/** Coût en PX d'un changement de Carrière : 100 si le Niveau actuel est COMPLÉTÉ, 200 sinon (l.120). */
export function careerChangeCost(completed: boolean): number {
  return completed ? 100 : 200;
}

/** Change de Carrière/Niveau si les PX suffisent (mute le héros). `completed` = le Niveau actuel
 *  est-il complété (cf. isCareerLevelComplete) → conditionne le coût 100/200. L'appelant valide la
 *  cible autorisée (Niveau suivant ou inférieur de la même Carrière, ou Carrière différente, l.136). */
export function changeCareer(hero: Combatant, newCareer: string, newLevel: number, completed: boolean): AdvanceResult {
  const cost = careerChangeCost(completed);
  if ((hero.xp ?? 0) < cost) return { ok: false, cost, reason: 'PX insuffisants' };
  hero.xp = (hero.xp ?? 0) - cost;
  hero.career = newCareer;
  hero.careerLevel = newLevel;
  return { ok: true, cost };
}
