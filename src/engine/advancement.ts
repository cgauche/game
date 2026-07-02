/**
 * Avancement par Points d'Expérience (PX) — Livre de base, « Carrières » (07) l.31-102.
 *
 * Les Augmentations s'achètent UNE PAR UNE : le coût de la prochaine dépend du nombre déjà
 * acheté pour cette Caractéristique / Compétence (l.69, l.80). Toutes les valeurs sont copiées
 * VERBATIM du Tableau de Coût des Augmentations (l.45-62) — aucune invention.
 */
import { Combatant, CharKey } from './types';
import { CareerSlot, slotCovers, concreteLabel, splitLabel } from './careerSlots';
import { findSkill, findTalent } from '../data';
import { slugId } from '../data/slug';
import advancementCostsJson from '../data/advancementCosts.json';

/**
 * Détection « in-carrière » (07-Carrières l.95) : une Augmentation est au coût standard si la
 * Caractéristique / Compétence / Talent est DISPONIBLE pour le héros — Caractéristiques et
 * Compétences des niveaux ≤ courant (l.67/78), Talents du niveau courant seul (l.100) ; sinon
 * le coût est doublé (Caractéristiques/Compétences) ou interdit (Talents, l.97).
 * Les Compétences/Talents passent par les EMPLACEMENTS de `careerSlots.ts` (spécialisations) ;
 * les Caractéristiques, sans spec, par `inCareerChar`. Libellés longs → clé via CHAR_LABELS.
 */
export function inCareerChar(careerChars: CharKey[], char: CharKey): boolean {
  return careerChars.includes(char);
}

/**
 * Type d'une bande du Tableau de Coût des Augmentations (07-Carrières l.45-62).
 * La bande = nombre d'Augmentations DÉJÀ achetées ; `max` est la borne haute INCLUSIVE de la bande.
 * `max: null` = bande FINALE « et au-delà » (capte tout excès — JSON n'a pas d'Infinity).
 * La donnée vit dans `src/data/advancementCosts.json` — ne pas éditer ici.
 */
export interface AdvanceCostBand { max: number | null; char: number; skill: number }

const ADVANCE_COST_TABLE: AdvanceCostBand[] = advancementCostsJson as AdvanceCostBand[];

/** Coût en PX de la PROCHAINE Augmentation (la N+1ᵉ), `advancesAlready` = N déjà achetées.
 *  Hors carrière, le coût est DOUBLÉ (07-Carrières l.95). `discount` : « 5 PX de moins par
 *  Augmentation » des talents Maître artisan / Oreille absolue / etc. (LDB 10) quand la
 *  Compétence ajoutée est déjà incluse dans la Carrière — appliqué in-carrière seulement. */
export function advanceCost(advancesAlready: number, kind: 'characteristic' | 'skill', inCareer = true, discount = 0): number {
  const band = ADVANCE_COST_TABLE.find((b) => b.max === null || advancesAlready <= b.max)!;
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
  const id = findSkill(skillName)?.id ?? slugId(skillName);
  const skill = hero.skills.find((s) => s.skillId === id && (s.spec ?? '') === (spec ?? ''));
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
  const { name, spec } = splitLabel(talentName);
  const id = findTalent(name)?.id ?? slugId(name);
  const existing = hero.talents.find((t) => t.talentId === id && (t.spec ?? '') === (spec ?? ''));
  const already = existing?.times ?? 0;
  const cost = talentCost(already);
  if ((hero.xp ?? 0) < cost) return { ok: false, cost, reason: 'PX insuffisants' };
  hero.xp = (hero.xp ?? 0) - cost;
  if (existing) existing.times += 1;
  else hero.talents.push({ talentId: id, spec, times: 1 });
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
    /** Caractéristiques de carrière disponibles, clés `CharKey` (careerSlots.availableChars). */
    careerChars: CharKey[];
    /** Désignations du héros pour SA carrière (careerSlots.designationsFor). */
    designations: Record<string, string>;
  },
): boolean {
  const req = careerCompletionAdvances(level);
  const charKeys = opts.careerChars; // déjà des CharKey
  if (!charKeys.length || !charKeys.every((k) => (hero.charAdvances?.[k] ?? 0) >= req)) return false;

  const skillAdv = (label: string): number => {
    const { name, spec } = splitLabel(label);
    const id = findSkill(name)?.id ?? slugId(name);
    return hero.skills.find((s) => s.skillId === id && (s.spec ?? '') === (spec ?? ''))?.advances ?? 0;
  };
  let held = 0;
  for (const slot of opts.skillSlots) {
    const label = explicitLabel(slot) ?? opts.designations[slot.key];
    if (label && skillAdv(label) >= req) held += 1;
  }
  if (held < 8) return false;

  return opts.talentSlots.some((slot) => {
    const label = explicitLabel(slot) ?? opts.designations[slot.key];
    if (label == null) return false;
    const { name, spec } = splitLabel(label);
    const id = findTalent(name)?.id ?? slugId(name);
    return hero.talents.some((t) => t.talentId === id && (t.spec ?? '') === (spec ?? '') && t.times > 0);
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
  /** Option MJ (LDB 07 l.140 + l.148, « Avec l'accord du MJ ») : autoriser un SAUT de Niveau (même
   *  Carrière, Niveau supérieur non-adjacent) ET l'accès au MÊME Niveau d'une autre Carrière de la
   *  Classe. Piloté par la règle optionnelle `advancement-career-jump` côté state ; false = RAW strict. */
  gmJump?: boolean;
}

/**
 * Valide et chiffre un changement de Carrière (LDB 07 l.135-148) :
 *  - même Carrière : Niveau SUIVANT (exige la complétion, l.137) ou n'importe quel Niveau INFÉRIEUR
 *    (l.137) ; un SAUT vers un Niveau supérieur non-adjacent n'est permis qu'avec l'accord du MJ
 *    (l.140, `gmJump`) ;
 *  - autre Carrière : 1er Niveau (l.144 ; +100 PX si la Classe diffère) OU, avec l'accord du MJ et le
 *    Niveau courant complété, le MÊME Niveau d'une autre Carrière de la MÊME Classe (l.148, `gmJump`).
 *  Coût de base : 100 PX si complété, 200 sinon (l.118).
 */
export function validateCareerChange(
  hero: Combatant,
  newCareer: string,
  newLevel: number,
  ctx: CareerChangeContext,
): { ok: boolean; cost: number; reason?: string } {
  const base = careerChangeCost(ctx.completed);
  if (!ctx.targetLevelExists) return { ok: false, cost: base, reason: 'niveau de carrière inconnu' };
  const cur = hero.careerLevel ?? 1;
  if (newCareer === (hero.career ?? '')) {
    if (newLevel === cur) return { ok: false, cost: base, reason: 'déjà à ce niveau' };
    if (newLevel < cur) return { ok: true, cost: base };
    if (newLevel === cur + 1) {
      if (!ctx.completed) return { ok: false, cost: base, reason: 'niveau actuel non complété' };
      return { ok: true, cost: base };
    }
    // Niveau supérieur non-adjacent : saut réservé au MJ (l.140), coût 100/200 comme un changement normal.
    if (ctx.gmJump) return { ok: true, cost: base };
    return { ok: false, cost: base, reason: 'saut de niveau impossible (option MJ requise)' };
  }
  if (newLevel === 1) return { ok: true, cost: base + (ctx.sameClass ? 0 : 100) };
  // MÊME Niveau d'une autre Carrière de la Classe (l.148) : exige l'accord du MJ, la complétion et la
  // même Classe ; coût 100 PX (base complété).
  if (ctx.gmJump && ctx.sameClass && ctx.completed && newLevel === cur) return { ok: true, cost: base };
  return { ok: false, cost: base, reason: 'nouvelle carrière : 1er niveau uniquement' };
}

/**
 * Mentor requis (LDB 07 l.89 : « le MJ peut exiger que vous trouviez un mentor qui puisse vous
 * enseigner cette formation inhabituelle ») : une Augmentation HORS carrière (dont le coût est déjà
 * DOUBLÉ) est BLOQUÉE tant qu'aucun mentor n'est disponible, quand la règle optionnelle est active.
 * `policyOn` = règle `advancement-mentor` ; `hasMentor` = flag de groupe/scène. Renvoie vrai = bloqué.
 */
export function mentorBlocks(inCareer: boolean, policyOn: boolean, hasMentor: boolean): boolean {
  return !inCareer && policyOn && !hasMentor;
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
