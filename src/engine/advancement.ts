/**
 * Avancement par Points d'Expérience (PX) — Livre de base, « Carrières » (07) l.31-102.
 *
 * Les Augmentations s'achètent UNE PAR UNE : le coût de la prochaine dépend du nombre déjà
 * acheté pour cette Caractéristique / Compétence (l.69, l.80). Toutes les valeurs sont copiées
 * VERBATIM du Tableau de Coût des Augmentations (l.45-62) — aucune invention.
 */
import { Combatant, CharKey, CHAR_LABELS, CHAR_BY_LABEL } from './types';
import { CareerSlot, slotCovers, concreteLabel, splitLabel } from './careerSlots';

/**
 * Détection « in-carrière » (07-Carrières l.95) : une Augmentation est au coût standard si la
 * Caractéristique / Compétence / Talent est DISPONIBLE pour le héros — Caractéristiques et
 * Compétences des niveaux ≤ courant (l.67/78), Talents du niveau courant seul (l.100) ; sinon
 * le coût est doublé (Caractéristiques/Compétences) ou interdit (Talents, l.97).
 * Les Compétences/Talents passent par les EMPLACEMENTS de `careerSlots.ts` (spécialisations) ;
 * les Caractéristiques, sans spec, par `inCareerChar`. Libellés longs → clé via CHAR_LABELS.
 */
export function inCareerChar(careerChars: string[], char: CharKey): boolean {
  return careerChars.includes(CHAR_LABELS[char]);
}

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
 *  Hors carrière, le coût est DOUBLÉ (07-Carrières l.95). `discount` : « 5 PX de moins par
 *  Augmentation » des talents Maître artisan / Oreille absolue / etc. (LDB 10) quand la
 *  Compétence ajoutée est déjà incluse dans la Carrière — appliqué in-carrière seulement. */
export function advanceCost(advancesAlready: number, kind: 'characteristic' | 'skill', inCareer = true, discount = 0): number {
  const band = ADVANCE_COST_TABLE.find((b) => advancesAlready <= b.max)!;
  const base = kind === 'characteristic' ? band.char : band.skill;
  return inCareer ? Math.max(1, base - discount) : base * 2;
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

/** Achète UNE Augmentation pour une Compétence DÉJÀ connue — identité (name, spec) : chaque
 *  Spécialisation est une Compétence distincte (LDB 09 l.42). */
export function buySkillAdvance(hero: Combatant, skillName: string, spec: string | undefined, inCareer = true, discount = 0): AdvanceResult {
  const skill = hero.skills.find((s) => s.name === skillName && (s.spec ?? '') === (spec ?? ''));
  if (!skill) return { ok: false, cost: 0, reason: 'Compétence inconnue' };
  const cost = advanceCost(skill.advances, 'skill', inCareer, discount);
  if ((hero.xp ?? 0) < cost) return { ok: false, cost, reason: 'PX insuffisants' };
  hero.xp = (hero.xp ?? 0) - cost;
  skill.advances += 1; // chaque Augmentation ajoute +1 au niveau de Compétence (l.82)
  return { ok: true, cost };
}

/** Achète UNE Augmentation de Talent (le crée à `times` 1 s'il est absent, sinon +1) si les PX
 *  suffisent. `talentName` = libellé CONCRET (spec résolue). Les Talents hors carrière ne sont
 *  pas achetables (l.97) et le Maxi doit être respecté (LDB 10) — vérifiés par l'appelant
 *  (`talentMaxReached`) ; ici on applique le coût standard. */
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

/** La valeur concrète d'un slot SANS choix (entrée explicite), sinon null. */
function explicitLabel(slot: CareerSlot): string | null {
  if (slot.needsChoice) return null;
  const o = slot.options[0];
  return concreteLabel(o.name, o.spec);
}

/**
 * Un Niveau de Carrière est complété si (l.125) : toutes les CARACTÉRISTIQUES DE LA CARRIÈRE
 * disponibles (cumul des niveaux ≤ courant, l.67) ont ≥ req Augmentations, AU MOINS 8 des
 * Compétences disponibles (cumul, l.78) ont ≥ req Augmentations, et le héros possède au moins
 * 1 Talent du Niveau COURANT. Un emplacement « (Au choix) » compte via sa spec DÉSIGNÉE
 * (un slot non désigné n'est pas tenu) — chaque libellé concret ne valide qu'un slot, garanti
 * par l'unicité des désignations (cf. careerSlots.designateSlot).
 */
export function isCareerLevelComplete(
  hero: Combatant,
  level: number,
  opts: {
    /** Slots de Compétences des niveaux ≤ courant (careerSlots.skillSlots). */
    skillSlots: CareerSlot[];
    /** Slots de Talents du niveau courant (careerSlots.talentSlots). */
    talentSlots: CareerSlot[];
    /** Caractéristiques de carrière disponibles, libellés longs (careerSlots.availableChars). */
    careerChars: string[];
    /** Désignations du héros pour SA carrière (careerSlots.designationsFor). */
    designations: Record<string, string>;
  },
): boolean {
  const req = careerCompletionAdvances(level);
  const charKeys = opts.careerChars.map((label) => CHAR_BY_LABEL[label]).filter(Boolean);
  if (!charKeys.length || !charKeys.every((k) => (hero.charAdvances?.[k] ?? 0) >= req)) return false;

  const skillAdv = (label: string): number => {
    const { name, spec } = splitLabel(label);
    return hero.skills.find((s) => s.name === name && (s.spec ?? '') === (spec ?? ''))?.advances ?? 0;
  };
  let held = 0;
  for (const slot of opts.skillSlots) {
    const label = explicitLabel(slot) ?? opts.designations[slot.key];
    if (label && skillAdv(label) >= req) held += 1;
  }
  if (held < 8) return false;

  return opts.talentSlots.some((slot) => {
    const label = explicitLabel(slot) ?? opts.designations[slot.key];
    return label != null && hero.talents.some((t) => t.name === label && t.times > 0);
  });
}

/** Coût en PX d'un changement de Carrière : 100 si le Niveau actuel est COMPLÉTÉ, 200 sinon (l.120). */
export function careerChangeCost(completed: boolean): number {
  return completed ? 100 : 200;
}

export interface CareerChangeContext {
  /** Le Niveau de Carrière COURANT est-il complété (cf. isCareerLevelComplete) ? */
  completed: boolean;
  /** La Carrière cible est-elle de la MÊME Classe que l'actuelle (LDB 08 l.9 : sinon +100 PX) ? */
  sameClass: boolean;
  /** Le Niveau cible existe-t-il dans les données de la Carrière cible ? */
  targetLevelExists: boolean;
}

/**
 * Valide et chiffre un changement de Carrière (LDB 07 l.137 + LDB 08 l.7-11) :
 *  - même Carrière : Niveau SUIVANT (exige la complétion) ou n'importe quel Niveau INFÉRIEUR ;
 *    pas de saut de Niveau (réservé au MJ) ;
 *  - autre Carrière : 1er Niveau uniquement ; +100 PX si la Classe diffère.
 *  Coût de base : 100 PX si complété, 200 sinon (l.120).
 */
export function validateCareerChange(
  hero: Combatant,
  newCareer: string,
  newLevel: number,
  ctx: CareerChangeContext,
): { ok: boolean; cost: number; reason?: string } {
  const base = careerChangeCost(ctx.completed);
  if (!ctx.targetLevelExists) return { ok: false, cost: base, reason: 'niveau de carrière inconnu' };
  if (newCareer === (hero.career ?? '')) {
    const cur = hero.careerLevel ?? 1;
    if (newLevel === cur) return { ok: false, cost: base, reason: 'déjà à ce niveau' };
    if (newLevel === cur + 1) {
      if (!ctx.completed) return { ok: false, cost: base, reason: 'niveau actuel non complété (LDB 07 l.137)' };
      return { ok: true, cost: base };
    }
    if (newLevel < cur) return { ok: true, cost: base };
    return { ok: false, cost: base, reason: 'saut de niveau impossible (LDB 07 l.137)' };
  }
  if (newLevel !== 1) return { ok: false, cost: base, reason: 'nouvelle carrière : 1er niveau uniquement (LDB 08 l.9)' };
  return { ok: true, cost: base + (ctx.sameClass ? 0 : 100) };
}

/** Change de Carrière/Niveau si la cible est valide et les PX suffisent (mute le héros).
 *  Validation + coût par `validateCareerChange` ; les désignations d'emplacements de l'ANCIENNE
 *  carrière sont conservées (elles sont par carrière — un retour les retrouve). */
export function changeCareer(hero: Combatant, newCareer: string, newLevel: number, ctx: CareerChangeContext): AdvanceResult {
  const v = validateCareerChange(hero, newCareer, newLevel, ctx);
  if (!v.ok) return { ok: false, cost: v.cost, reason: v.reason };
  if ((hero.xp ?? 0) < v.cost) return { ok: false, cost: v.cost, reason: 'PX insuffisants' };
  hero.xp = (hero.xp ?? 0) - v.cost;
  hero.career = newCareer;
  hero.careerLevel = newLevel;
  return { ok: true, cost: v.cost };
}
