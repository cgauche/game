/**
 * Brouillon de création de personnage (état + dérivations PURES de l'assistant) — LDB 04/05.
 *
 * Tout l'aléatoire est FIGÉ par des flux RNG seedés dérivés d'un seed unique tiré à l'ouverture
 * de l'assistant : re-calculer une dérivation redonne le MÊME résultat (anti-savescum), et les
 * bonus de PX des tirages acceptés sont perdus dès qu'on dévie du chemin RAW :
 *  - Espèce (LDB 04 l.87) : d100 figé ; +20 PX si on le garde tel quel ; pas de relance.
 *  - Carrière (LDB 05 l.191-195) : 1er jet accepté = +50 PX ; sinon 2 jets de plus, choix parmi
 *    les 3 = +25 PX ; sinon choix libre / « continuez à relancer » = 0 PX (relances RAW l.195).
 *  - Caractéristiques (l.381-385) : tirage gardé = +50 ; réassignation des dix jets = +25 ;
 *    relance (RAW, 0 PX) ou répartition de 100 Points = 0.
 *  - Talents d'espèce aléatoires (l.510) : résolus par un RNG seedé fixe → re-résoudre avec
 *    d'autres choix « A ou B » ne re-tire pas les dés.
 */
import { CharKey, CHAR_KEYS, Characteristics, Combatant } from '../../engine/types';
import { makeRNG, roll } from '../../engine/dice';
import { Money } from '../../engine/money';
import {
  rollSpecies,
  rollCareer,
  validatePointBuy,
  parseStatus,
  rollInitialWealth,
  rollAge,
  rollHeight,
  rollEyes,
  rollHair,
  XP_SPECIES_ACCEPTED,
  XP_CAREER_FIRST,
  XP_CAREER_TOP3,
  XP_CHARS_KEPT,
  XP_CHARS_REASSIGNED,
} from '../../engine/creation';
import { createHero, resolveSpeciesTalents } from '../../engine/character';
import { parseEntry, splitLabel, concreteLabel, isUnresolvedChoice, splitTopLevelOu, talentMaxReached } from '../../engine/careerSlots';
import { careerSkillAdditions } from '../../engine/talentEffects';
import { findSpecies, findSkill, findTalent, careers, careersForSpecies, species as allSpecies, levelsForCareer, SpeciesData, CareerLevelData } from '../../data';
import type { Appearance } from '../../gameIso/rig/appearance';

export type CharMode = 'rolled' | 'reassigned' | 'pointBuy';

export interface CreatorDraft {
  /** Seed unique de l'assistant — tous les flux aléatoires en dérivent (figés). */
  seed: number;
  // 1) Espèce
  speciesLabel: string;
  /** Tirage d'espèce figé (label) — absent tant que le d100 n'a pas été lancé. */
  speciesRoll?: { roll: number; label: string };
  // 2) Carrière
  careerLabel: string;
  ignoreRestrictions: boolean;
  /** Jets de carrière figés (1 puis 3) ; au-delà : relances libres (0 PX, RAW l.195). */
  careerRolls: { roll: number; label: string }[];
  /** Nombre de relances LIBRES effectuées (annule tout bonus). */
  careerFreeRolls: number;
  // 3) Caractéristiques
  charMode: CharMode;
  /** Nombre de relances des dix 2d10 (0 = tirage initial ; >0 → bonus perdus, RAW l.385). */
  charRerolls: number;
  /** Réassignation : pour chaque Caractéristique, l'INDEX du jet (permutation de 0..9). */
  assignment: Record<CharKey, number>;
  /** Répartition manuelle de 100 Points (min 4 / max 18, l.385). */
  pointBuy: Record<CharKey, number>;
  /** 5 Augmentations gratuites sur les 3 Caractéristiques de carrière (l.488). */
  charAdvancesAlloc: Partial<Record<CharKey, number>>;
  fateSplit: { fate: number; resilience: number };
  // 4) Compétences & Talents
  speciesPlus5: string[];
  speciesPlus3: string[];
  /** Choix de branche des entrées de talents d'espèce « A ou B » (entrée brute → option). */
  speciesTalentChoices: Record<string, string>;
  /** Choix de spec des talents aléatoires tirés (libellé de base → spec). */
  randomSpecPicks: Record<string, string>;
  /** Résolution des entrées « (Au choix) » (entrée brute → libellé concret). */
  specChoices: Record<string, string>;
  skillAdvances: Record<string, number>;
  careerTalent?: string;
  // 5) Possessions
  weaponChoice?: string;
  // 6) Détails
  name: string;
  motivation: string;
  ambitionShort: string;
  ambitionLong: string;
  age?: number;
  height?: number;
  eyes?: string;
  hair?: string;
  sex: 'M' | 'F';
  build: number;
  appSeed: number;
  colors?: Appearance['colors'];
  parts?: Appearance['parts'];
}

/** Défauts DÉRIVÉS des données (rien en dur) : première espèce du Livre de base, et la
 *  première carrière qui lui est accessible. */
function defaultSpecies(): SpeciesData {
  return allSpecies.find((s) => s.source.book === 'LDB') ?? allSpecies[0];
}

export function newDraft(seed = (Date.now() & 0xffff) ^ ((Math.random() * 0xffff) | 0)): CreatorDraft {
  const sp = defaultSpecies();
  return {
    seed,
    speciesLabel: sp.label,
    careerLabel: careersForSpecies(sp.refCareer)[0]?.label ?? careers[0].label,
    ignoreRestrictions: false,
    careerRolls: [],
    careerFreeRolls: 0,
    charMode: 'rolled',
    charRerolls: 0,
    assignment: Object.fromEntries(CHAR_KEYS.map((k, i) => [k, i])) as Record<CharKey, number>,
    pointBuy: Object.fromEntries(CHAR_KEYS.map((k) => [k, 10])) as Record<CharKey, number>,
    charAdvancesAlloc: {},
    fateSplit: { fate: 0, resilience: 0 },
    speciesPlus5: [],
    speciesPlus3: [],
    speciesTalentChoices: {},
    randomSpecPicks: {},
    specChoices: {},
    skillAdvances: {},
    name: '',
    motivation: '',
    ambitionShort: '',
    ambitionLong: '',
    sex: 'M',
    build: 0.5,
    appSeed: (seed >> 2) & 0xffff,
  };
}

export const draftSpecies = (d: CreatorDraft): SpeciesData => findSpecies(d.speciesLabel)!;
export const draftLevel = (d: CreatorDraft): CareerLevelData | undefined =>
  levelsForCareer(d.careerLabel).find((l) => l.level === 1);

// ── 1) Espèce ──
export function rollDraftSpecies(d: CreatorDraft): CreatorDraft {
  if (d.speciesRoll) return d; // FIGÉ : pas de relance (LDB 04 — aucune n'est offerte)
  const r = rollSpecies(makeRNG(d.seed ^ 0x51ec));
  return withSpecies({ ...d, speciesRoll: r }, r.label);
}
export const speciesXp = (d: CreatorDraft): number =>
  d.speciesRoll && d.speciesLabel === d.speciesRoll.label ? XP_SPECIES_ACCEPTED : 0;

export function withSpecies(d: CreatorDraft, label: string): CreatorDraft {
  if (label === d.speciesLabel) return d;
  // Changer d'espèce invalide les choix dépendants (compétences/talents d'espèce, carrière tirée).
  return {
    ...d,
    speciesLabel: label,
    speciesPlus5: [],
    speciesPlus3: [],
    speciesTalentChoices: {},
    randomSpecPicks: {},
    careerRolls: [],
    careerFreeRolls: 0,
  };
}

// ── 2) Carrière ──
export function rollDraftCareer(d: CreatorDraft): CreatorDraft {
  const sp = draftSpecies(d);
  const n = d.careerRolls.length;
  if (n === 0) {
    const r = rollCareer(careers, sp, makeRNG(d.seed ^ 0xca1));
    return r ? withCareer({ ...d, careerRolls: [r] }, r.label) : d;
  }
  if (n === 1) {
    // « Faites deux lancers de plus, ce qui porte votre total à 3 choix » (LDB 05 l.193).
    const rng = makeRNG(d.seed ^ 0xca2);
    const r2 = rollCareer(careers, sp, rng);
    const r3 = rollCareer(careers, sp, rng);
    if (!r2 || !r3) return d;
    return { ...d, careerRolls: [...d.careerRolls, r2, r3] };
  }
  // « continuez à relancer jusqu'à obtenir quelque chose qui vous plaît » (l.195) — 0 PX.
  const r = rollCareer(careers, sp, makeRNG(d.seed ^ (0xca3 + d.careerFreeRolls)));
  return r ? withCareer({ ...d, careerFreeRolls: d.careerFreeRolls + 1 }, r.label) : d;
}
export function careerXp(d: CreatorDraft): number {
  if (d.careerFreeRolls > 0) return 0;
  if (d.careerRolls.length === 1 && d.careerLabel === d.careerRolls[0].label) return XP_CAREER_FIRST;
  if (d.careerRolls.length === 3 && d.careerRolls.some((r) => r.label === d.careerLabel)) return XP_CAREER_TOP3;
  return 0;
}
export function withCareer(d: CreatorDraft, label: string): CreatorDraft {
  if (label === d.careerLabel) return d;
  return { ...d, careerLabel: label, skillAdvances: {}, specChoices: {}, careerTalent: undefined, charAdvancesAlloc: {}, weaponChoice: undefined };
}

// ── 3) Caractéristiques ──
/** Les dix jets 2d10 figés (l'ordre suit CHAR_KEYS) — relancés en bloc par `charRerolls`. */
export function charRolls(d: CreatorDraft): number[] {
  const rng = makeRNG((d.seed ^ 0xc4a5) + d.charRerolls * 7919);
  return CHAR_KEYS.map(() => roll(2, 10, rng));
}
/** Caractéristiques AVANT Augmentations gratuites et talents (base d'espèce incluse). */
export function draftChars(d: CreatorDraft): Characteristics {
  const sp = draftSpecies(d);
  const rolls = charRolls(d);
  const out = {} as Characteristics;
  for (let i = 0; i < CHAR_KEYS.length; i++) {
    const k = CHAR_KEYS[i];
    const base = sp.baseChar[k] ?? 20;
    if (d.charMode === 'pointBuy') out[k] = base + d.pointBuy[k];
    else out[k] = base + rolls[d.charMode === 'reassigned' ? d.assignment[k] : i];
  }
  return out;
}
export function charsXp(d: CreatorDraft): number {
  if (d.charRerolls > 0 || d.charMode === 'pointBuy') return 0;
  return d.charMode === 'rolled' ? XP_CHARS_KEPT : XP_CHARS_REASSIGNED;
}

export const xpTotal = (d: CreatorDraft): number => speciesXp(d) + careerXp(d) + charsXp(d);

// ── 4) Compétences & Talents ──
/** Talents d'espèce résolus (choix appliqués, tirages aléatoires FIGÉS par le seed). */
export function resolvedSpeciesTalents(d: CreatorDraft): string[] {
  return resolveSpeciesTalents(draftSpecies(d), {
    rng: makeRNG(d.seed ^ 0x7a1e),
    choices: { ...d.speciesTalentChoices, ...d.specChoices },
    pickSpec: (base, free) => (d.randomSpecPicks[base] && free.includes(d.randomSpecPicks[base]) ? d.randomSpecPicks[base] : free[0]),
  });
}

/** Probe : héros partiel (caracs + talents d'espèce + talent de carrière) pour Maxi/additions. */
export function probeHero(d: CreatorDraft, withCareerTalent = true): Combatant {
  const talents: { name: string; times: number }[] = [];
  const add = (label: string) => {
    const e = talents.find((t) => t.name === label);
    if (e) e.times += 1;
    else talents.push({ name: label, times: 1 });
  };
  for (const t of resolvedSpeciesTalents(d)) add(t);
  if (withCareerTalent && d.careerTalent) add(d.careerTalent);
  return { characteristics: draftChars(d), talents, skills: [], movement: draftSpecies(d).movement } as unknown as Combatant;
}

/** Entrées de compétences de carrière allouables : les 8 du Niveau + ajouts de talents (LDB 10). */
export function careerSkillEntries(d: CreatorDraft): string[] {
  const base = draftLevel(d)?.skills ?? [];
  return [...base, ...careerSkillAdditions(probeHero(d))];
}

/** Options de spec d'une entrée « (Au choix) » (liste restreinte ou specs des données). */
export function specOptionsFor(entry: string): string[] {
  const opt = parseEntry(entry)[0];
  if (!opt.wildcard) return [];
  if (opt.specOptions) return opt.specOptions;
  return findSkill(opt.name)?.specs ?? findTalent(opt.name)?.specs ?? [];
}

/** Libellés concrets proposés par une entrée de talent à choix (joker, joker restreint,
 *  « A ou B » de premier niveau) — null si l'entrée est déjà concrète. */
export function talentEntryChoices(entry: string): string[] | null {
  const opts = parseEntry(entry);
  if (opts.length === 1 && !opts[0].wildcard) return null;
  const out: string[] = [];
  for (const o of opts) {
    if (!o.wildcard) out.push(concreteLabel(o.name, o.spec));
    else for (const s of o.specOptions ?? findTalent(o.name)?.specs ?? []) out.push(concreteLabel(o.name, s));
  }
  return out;
}

/** Options du talent de carrière (entrées brutes du Niveau 1) : libellé sélectionné + Maxi. */
export function careerTalentOptions(d: CreatorDraft): { entry: string; choices: string[] | null; selected: string | null; maxed: boolean }[] {
  const probe = probeHero(d, false);
  return (draftLevel(d)?.talents ?? []).map((entry) => {
    const choices = talentEntryChoices(entry);
    const selected = choices ? (d.specChoices[entry] && choices.includes(d.specChoices[entry]) ? d.specChoices[entry] : null) : entry;
    return { entry, choices, selected, maxed: selected ? talentMaxReached(probe, selected) : false };
  });
}

// ── 5) Possessions ──
export function draftWealth(d: CreatorDraft): Money {
  const status = parseStatus(draftLevel(d)?.status ?? 'Bronze 0');
  return rollInitialWealth(status, makeRNG(d.seed ^ 0x901d));
}

// ── 6) Détails ──
export function rolledDetails(d: CreatorDraft): { age: number; height: number; eyes: string; hair: string } {
  const sp = draftSpecies(d);
  const rng = makeRNG(d.seed ^ 0xde7a);
  return { age: rollAge(sp, rng), height: rollHeight(sp, rng), eyes: rollEyes(sp, rng), hair: rollHair(sp, rng) };
}

// ── Validation par étape ──
export function validateStep(d: CreatorDraft, step: number): string | null {
  const sp = draftSpecies(d);
  const level = draftLevel(d);
  switch (step) {
    case 2: {
      if (!level) return 'Carrière sans Niveau 1 dans les données.';
      return null;
    }
    case 3: {
      if (d.charMode === 'pointBuy') {
        const v = validatePointBuy(d.pointBuy as Record<CharKey, number>);
        if (!v.ok) return `Répartition des 100 Points : ${v.reason}.`;
      }
      if (d.charMode === 'reassigned') {
        const idx = CHAR_KEYS.map((k) => d.assignment[k]);
        if (new Set(idx).size !== 10) return 'Réassignation : chaque jet doit être utilisé une seule fois.';
      }
      const careerChars = (level?.characteristics ?? []).length;
      const alloc = Object.values(d.charAdvancesAlloc).reduce((a, b) => a + (b ?? 0), 0);
      if (careerChars && alloc !== 5) return `Répartissez 5 Augmentations sur les Caractéristiques de carrière (actuel : ${alloc}).`;
      const split = d.fateSplit.fate + d.fateSplit.resilience;
      if (split !== sp.fate.extra) return `Répartissez les ${sp.fate.extra} points entre Destin et Résilience (actuel : ${split}).`;
      return null;
    }
    case 4: {
      if (d.speciesPlus5.length !== 3 || d.speciesPlus3.length !== 3) return 'Choisissez 3 Compétences d\'espèce à +5 et 3 à +3 (LDB 05 l.510).';
      if (d.speciesPlus5.some((s) => d.speciesPlus3.includes(s))) return 'Une Compétence d\'espèce ne peut pas être à la fois +5 et +3.';
      for (const raw of [...d.speciesPlus5, ...d.speciesPlus3]) {
        if (isUnresolvedChoice(raw) && !d.specChoices[raw]) return `Choisissez la Spécialisation de « ${raw} ».`;
      }
      // Entrées d'espèce « A ou B » : un choix requis quand il y en a.
      for (const entry of sp.talents) {
        if (splitTopLevelOu(entry).length > 1 && !d.speciesTalentChoices[entry]) return `Choisissez : « ${entry} ».`;
      }
      const entries = careerSkillEntries(d);
      const total = entries.reduce((a, e) => a + (d.skillAdvances[e] ?? 0), 0);
      if (total !== 40) return `Répartissez 40 Augmentations de carrière (actuel : ${total}).`;
      for (const e of entries) {
        const adv = d.skillAdvances[e] ?? 0;
        if (adv < 0 || adv > 10) return `Maximum 10 Augmentations par Compétence à la création (« ${e} »).`;
        if (adv > 0 && isUnresolvedChoice(e) && !d.specChoices[e]) return `Choisissez la Spécialisation de « ${e} » (LDB 09 l.38).`;
      }
      if (!d.careerTalent) return 'Choisissez votre Talent de carrière.';
      if (talentMaxReached(probeHero(d, false), d.careerTalent)) return `« ${d.careerTalent} » : Maxi déjà atteint (LDB 10).`;
      return null;
    }
    case 6: {
      if (!d.name.trim()) return 'Donnez un nom à votre personnage.';
      return null;
    }
    default:
      return null;
  }
}

// ── Construction finale ──
export function buildHero(d: CreatorDraft, id?: string): Combatant {
  const sp = draftSpecies(d);
  const plus5 = d.speciesPlus5.length === 3 ? d.speciesPlus5 : sp.skills.slice(0, 3);
  const plus3 = d.speciesPlus3.length === 3 ? d.speciesPlus3 : sp.skills.slice(3, 6);
  const hero = createHero({
    speciesLabel: d.speciesLabel,
    careerLabel: d.careerLabel,
    name: d.name.trim() || 'Aventurier',
    manualChars: draftChars(d),
    charAdvancesAlloc: d.charAdvancesAlloc,
    careerTalent: d.careerTalent,
    skillAdvances: d.skillAdvances,
    speciesSkillAdvances: { plus5, plus3 },
    speciesTalentsResolved: resolvedSpeciesTalents(d),
    specChoices: d.specChoices,
    fateSplit: d.fateSplit,
    xpBonus: xpTotal(d),
    details: {
      age: d.age,
      height: d.height,
      eyes: d.eyes,
      hair: d.hair,
      ambitionShort: d.ambitionShort.trim() || undefined,
      ambitionLong: d.ambitionLong.trim() || undefined,
    },
    motivation: d.motivation.trim() || undefined,
    rng: makeRNG(d.seed ^ 0xf17a1),
    id,
  });
  hero.appearance = { species: d.speciesLabel, sex: d.sex, build: d.build, seed: d.appSeed, colors: d.colors, parts: d.parts };
  return hero;
}

/** Le total déjà alloué des 40 Augmentations de carrière. */
export function careerAdvTotal(d: CreatorDraft): number {
  return careerSkillEntries(d).reduce((a, e) => a + (d.skillAdvances[e] ?? 0), 0);
}

/** Libellé concret d'une entrée pour l'affichage (résolution courante incluse). */
export function entryLabel(d: CreatorDraft, raw: string): string {
  if (!isUnresolvedChoice(raw)) return raw;
  const chosen = d.specChoices[raw];
  if (chosen && !isUnresolvedChoice(chosen)) return chosen;
  return raw;
}

export { splitLabel, concreteLabel, isUnresolvedChoice, splitTopLevelOu, parseEntry };
