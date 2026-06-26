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
  rollStar,
  XP_SPECIES_ACCEPTED,
  XP_CAREER_FIRST,
  XP_CAREER_TOP3,
  XP_CHARS_KEPT,
  XP_CHARS_REASSIGNED,
  XP_STAR_ROLLED,
} from '../../engine/creation';
import { rule } from '../../engine/policy';
import { createHero, resolveSpeciesTalents } from '../../engine/character';
import { parseEntry, splitLabel, concreteLabel, isUnresolvedChoice, splitTopLevelOu, talentMaxReached, wildcardSpecs } from '../../engine/careerSlots';
import { careerSkillAdditions, talentCharBonus } from '../../engine/talentEffects';
import { castingKindOf } from '../../engine/combatFeatures/dispatch';
import { bonus } from '../../engine/characteristics';
import { findSpeciesById, rigSpeciesId, findTalent, careers, careersForSpecies, species as allSpecies, levelsForCareer, findSpell, advancementLabel, findStarById, SpeciesData, CareerLevelData } from '../../data';
import type { Appearance } from '../../gameIso/rig/appearance';

export type CharMode = 'rolled' | 'reassigned' | 'pointBuy';

export interface CreatorDraft {
  /** Seed unique de l'assistant — tous les flux aléatoires en dérivent (figés). */
  seed: number;
  // 1) Espèce
  /** `id` STABLE de l'espèce (`SpeciesData.id`) — ≠ libellé. */
  speciesId: string;
  /** Tirage d'espèce figé — le d100 désigne une BORNE (LDB 04 l.90) ; `ids` = toutes les espèces
   *  de cette borne, parmi lesquelles le joueur choisit librement (bonus de PX conservé). Absent
   *  tant que le d100 n'a pas été lancé. */
  speciesRoll?: { roll: number; ids: string[] };
  // 2) Carrière
  /** `id` STABLE de la carrière (`CareerData.id`) — ≠ libellé. */
  careerId: string;
  ignoreRestrictions: boolean;
  /** Jets de carrière figés (1 puis 3) ; au-delà : relances libres (0 PX, RAW l.195). Chaque jet
   *  désigne une BORNE → `ids` = toutes les carrières de cette borne (choix libre, PX conservé). */
  careerRolls: { roll: number; ids: string[] }[];
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
  /** Sorts de Magie mineure INCLUS au Talent (LDB 10 l.587) — exactement BFM à choisir. */
  pettySpells: string[];
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
  // 3bis) Signe astral (ADE2 ch.03 — étape optionnelle, gated par la règle creation-signes-astraux)
  /** Signe astral choisi — `id` STABLE (≠ libellé) ; son `effect` est appliqué aux attributs de départ. */
  star?: string;
  /** Signe TIRÉ (1d100 figé, `id`) : si `star` lui reste égal → +25 PX (RAW l.36) ; un choix libre l'écarte. */
  starRoll?: string;
  /** Ascendant + 5 demeures célestes (ADE2 l.331-360) — flavor pur, aucun effet mécanique. */
  ascendant?: string;
  dwellings?: { house: string; sign: string }[];
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
    speciesId: sp.id,
    careerId: careersForSpecies(sp.refCareer)[0]?.id ?? careers[0].id,
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
    pettySpells: [],
    name: '',
    motivation: '',
    ambitionShort: '',
    ambitionLong: '',
    sex: 'M',
    build: 0.5,
    appSeed: (seed >> 2) & 0xffff,
  };
}

/**
 * Reconstruit un brouillon ÉDITABLE à partir d'un héros déjà construit, pour le rouvrir dans le
 * créateur. RECONSTRUCTION PARTIELLE (best-effort) : un `Combatant` ne retient PAS les tirages
 * figés ni les choix étape par étape (répartition des 40 Augmentations, talent de carrière choisi,
 * compétences d'espèce +5/+3, méthode de Caractéristiques, bonus de PX de création…). On récupère
 * ce qui est portable — espèce, carrière, identité, détails physiques, apparence — et on laisse le
 * reste aux défauts du créateur, à RE-VALIDER étape par étape. Préférer le `draft` sauvegardé du
 * roster quand il existe (round-trip sans perte) ; ce chemin est le repli (pré-tirés, imports,
 * héros d'avant cette fonctionnalité). */
export function draftFromHero(hero: Combatant): CreatorDraft {
  const d = newDraft();
  // `Combatant.species` est l'id LDB (rules) ; `appearance.species` est une clé de rig (libellé) → on
  // reconstruit le brouillon depuis l'id rules, pas depuis l'apparence.
  const speciesId = hero.species ?? d.speciesId;
  const withSp = withSpecies(d, speciesId);
  const withCa = hero.career ? withCareer(withSp, hero.career) : withSp;
  return {
    ...withCa,
    speciesId,
    careerId: hero.career ?? withCa.careerId,
    name: hero.name ?? '',
    motivation: hero.motivation ?? '',
    ambitionShort: hero.details?.ambitionShort ?? '',
    ambitionLong: hero.details?.ambitionLong ?? '',
    age: hero.details?.age,
    height: hero.details?.height,
    eyes: hero.details?.eyes,
    hair: hero.details?.hair,
    star: hero.star,
    ascendant: hero.details?.ascendant,
    dwellings: hero.details?.dwellings,
    sex: hero.appearance?.sex ?? d.sex,
    build: hero.appearance?.build ?? d.build,
    appSeed: hero.appearance?.seed ?? d.appSeed,
    colors: hero.appearance?.colors,
    parts: hero.appearance?.parts,
  };
}

export const draftSpecies = (d: CreatorDraft): SpeciesData => findSpeciesById(d.speciesId)!;
export const draftLevel = (d: CreatorDraft): CareerLevelData | undefined =>
  levelsForCareer(d.careerId).find((l) => l.level === 1);

/** Caractéristiques de carrière du Niveau 1 (clés `CharKey` stables) sur lesquelles se répartissent
 *  les 5 Augmentations gratuites de création (LDB 05 l.379). La donnée EST déjà en `CharKey`
 *  (« CT », « F »… ; cf. CareerLevelData.characteristics) ; on filtre par sûreté. SOURCE UNIQUE
 *  partagée par la grille d'allocation et `validateStep` (plus de re-dérivation divergente). */
export const careerCharKeys = (d: CreatorDraft): CharKey[] =>
  (draftLevel(d)?.characteristics ?? []).filter((k): k is CharKey => CHAR_KEYS.includes(k as CharKey));

// ── 1) Espèce ──
export function rollDraftSpecies(d: CreatorDraft): CreatorDraft {
  if (d.speciesRoll) return d; // FIGÉ : pas de relance (LDB 04 — aucune n'est offerte)
  const r = rollSpecies(makeRNG(d.seed ^ 0x51ec));
  // La borne tirée propose `ids` ; on sélectionne la 1ʳᵉ par défaut, le joueur peut choisir une autre.
  return withSpecies({ ...d, speciesRoll: r }, r.ids[0]);
}
// +20 PX tant que l'espèce choisie appartient à la BORNE tirée (le bonus récompense le tirage, l.87).
export const speciesXp = (d: CreatorDraft): number =>
  d.speciesRoll && d.speciesRoll.ids.includes(d.speciesId) ? XP_SPECIES_ACCEPTED : 0;

export function withSpecies(d: CreatorDraft, id: string): CreatorDraft {
  if (id === d.speciesId) return d;
  // Changer d'espèce invalide les choix dépendants (compétences/talents d'espèce, carrière tirée).
  return {
    ...d,
    speciesId: id,
    speciesPlus5: [],
    speciesPlus3: [],
    speciesTalentChoices: {},
    randomSpecPicks: {},
    pettySpells: [],
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
    // Chaque jet désigne une borne (`ids`) ; défaut = 1ʳᵉ carrière, le joueur peut en choisir une autre.
    return r ? withCareer({ ...d, careerRolls: [r] }, r.ids[0]) : d;
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
  return r ? withCareer({ ...d, careerFreeRolls: d.careerFreeRolls + 1 }, r.ids[0]) : d;
}
export function careerXp(d: CreatorDraft): number {
  if (d.careerFreeRolls > 0) return 0;
  // +50 si la carrière choisie est dans la borne du 1ᵉʳ jet ; +25 si elle est dans l'une des 3 bornes.
  if (d.careerRolls.length === 1 && d.careerRolls[0].ids.includes(d.careerId)) return XP_CAREER_FIRST;
  if (d.careerRolls.length === 3 && d.careerRolls.some((r) => r.ids.includes(d.careerId))) return XP_CAREER_TOP3;
  return 0;
}
export function withCareer(d: CreatorDraft, id: string): CreatorDraft {
  if (id === d.careerId) return d;
  return { ...d, careerId: id, skillAdvances: {}, specChoices: {}, careerTalent: undefined, pettySpells: [], charAdvancesAlloc: {}, weaponChoice: undefined };
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

/** PX du signe astral : +25 si le signe choisi reste celui qui a été TIRÉ (ADE2 ch.03 l.36), sinon 0. */
export const starXp = (d: CreatorDraft): number => (d.starRoll && d.star === d.starRoll ? XP_STAR_ROLLED : 0);

export const xpTotal = (d: CreatorDraft): number => speciesXp(d) + careerXp(d) + charsXp(d) + starXp(d);

// ── 3bis) Signe astral (ADE2 ch.03) ──
/** 5 demeures célestes (ADE2 l.342-350) — ossature narrative FIXE de la lecture astrale (flavor pur). */
const CELESTIAL_HOUSES = ['Demeure du Sens', 'Demeure des Épreuves', 'Demeure de la Pensée', "Demeure de l'Amour", "Demeure de l'Argent"];

/** Tirage 1d100 FIGÉ du signe (anti-savescum, comme l'espèce) : on le garde (+25 PX) ou on choisit
 *  librement ensuite (+0 PX, RAW l.36). Pas de relance — RAW n'en offre aucune. */
export function rollDraftStar(d: CreatorDraft): CreatorDraft {
  const id = rollStar(makeRNG(d.seed ^ 0x57a2)); // `id` STABLE du signe (≠ libellé)
  return { ...d, starRoll: id, star: id };
}

/** Ascendant + demeures célestes (ADE2 l.331-360) — flavor pur, tirages figés par le seed. `rollStar`
 *  renvoie un `id` ; pour cette astrologie purement NARRATIVE on stocke le LIBELLÉ lisible. */
export function rollDraftAstrology(d: CreatorDraft): CreatorDraft {
  const rng = makeRNG(d.seed ^ 0xa57e);
  const signLabel = (): string => findStarById(rollStar(rng))?.label ?? '';
  return { ...d, ascendant: signLabel(), dwellings: CELESTIAL_HOUSES.map((house) => ({ house, sign: signLabel() })) };
}

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
  const base = (draftLevel(d)?.skills ?? []).map((a) => advancementLabel('skills', a));
  return [...base, ...careerSkillAdditions(probeHero(d))];
}

/** « Répartition simple » (étape 5) : +5 sur chacune des 8 Compétences de carrière du Niveau
 *  (LDB 05). Keyé par LIBELLÉ — comme la grille, `careerAdvTotal` et `validateStep` ; une clé
 *  par objet `AdvancementRef` donnerait « [object Object] », illisible (jamais comptée). */
export function evenCareerSkillAdvances(d: CreatorDraft): Record<string, number> {
  return Object.fromEntries((draftLevel(d)?.skills ?? []).map((a) => [advancementLabel('skills', a), 5]));
}

/** Options de spec d'une entrée « (Au choix) » (liste restreinte, sinon `wildcardSpecs` partagé). */
export function specOptionsFor(entry: string): string[] {
  const opt = parseEntry(entry)[0];
  if (!opt.wildcard) return [];
  return opt.specOptions ?? wildcardSpecs(opt.name);
}

/** Libellés concrets proposés par une entrée de talent à choix (joker, joker restreint,
 *  « A ou B » de premier niveau) — null si l'entrée est déjà concrète. */
export function talentEntryChoices(entry: string): string[] | null {
  const opts = parseEntry(entry);
  if (opts.length === 1 && !opts[0].wildcard) return null;
  const out: string[] = [];
  for (const o of opts) {
    if (!o.wildcard) out.push(concreteLabel(o.name, o.spec));
    else for (const s of o.specOptions ?? wildcardSpecs(o.name)) out.push(concreteLabel(o.name, s));
  }
  return out;
}

/** Sorts de Magie mineure INCLUS au Talent (LDB 10 l.587 : « vous mémorisez… un nombre de
 *  Sorts égal à votre Bonus de Force Mentale ») : quota à choisir = BFM FINAL (Augmentations
 *  gratuites + talents « +5 FM » appliqués, même pipeline que createHero) — 0 sans le Talent. */
export function pettySpellQuota(d: CreatorDraft): number {
  const all = [...resolvedSpeciesTalents(d), ...(d.careerTalent ? [d.careerTalent] : [])];
  // Libellés d'authoring → id stable (la donnée des carrières/espèces porte le libellé) pour le lookup par DONNÉE.
  if (!all.some((t) => castingKindOf(findTalent(splitLabel(t).name)?.id ?? '') === 'mineure')) return 0;
  let fm = draftChars(d).FM + (d.charAdvancesAlloc.FM ?? 0);
  for (const t of all) if (talentCharBonus(t) === 'FM') fm += 5;
  return bonus(fm);
}

/** Options du talent de carrière (entrées brutes du Niveau 1) : libellé sélectionné + Maxi. */
export function careerTalentOptions(d: CreatorDraft): { entry: string; choices: string[] | null; selected: string | null; maxed: boolean }[] {
  const probe = probeHero(d, false);
  return (draftLevel(d)?.talents ?? []).map((ref) => {
    const entry = advancementLabel('talents', ref);
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

export type StepId = 'species' | 'career' | 'chars' | 'star' | 'skills' | 'trappings' | 'details' | 'recap';

/** Étapes du créateur dans l'ordre — `star` insérée après `chars` quand la règle optionnelle ADE2
 *  `creation-signes-astraux` est active. SOURCE UNIQUE de l'ordre ET de la présence des étapes (le
 *  rendu et la validation en dérivent — plus d'index positionnel fragile). */
export function stepIds(): StepId[] {
  const ids: StepId[] = ['species', 'career', 'chars', 'skills', 'trappings', 'details', 'recap'];
  if (rule('creation-signes-astraux')) ids.splice(3, 0, 'star');
  return ids;
}

// ── Validation par étape ──
export function validateStep(d: CreatorDraft, id: StepId): string | null {
  const sp = draftSpecies(d);
  const level = draftLevel(d);
  switch (id) {
    case 'career': {
      if (!level) return 'Carrière sans Niveau 1 dans les données.';
      return null;
    }
    case 'chars': {
      if (d.charMode === 'pointBuy') {
        const v = validatePointBuy(d.pointBuy as Record<CharKey, number>);
        if (!v.ok) return `Répartition des 100 Points : ${v.reason}.`;
      }
      if (d.charMode === 'reassigned') {
        const idx = CHAR_KEYS.map((k) => d.assignment[k]);
        if (new Set(idx).size !== 10) return 'Réassignation : chaque jet doit être utilisé une seule fois.';
      }
      const careerChars = careerCharKeys(d).length;
      const alloc = Object.values(d.charAdvancesAlloc).reduce((a, b) => a + (b ?? 0), 0);
      if (careerChars && alloc !== 5) return `Répartissez 5 Augmentations sur les Caractéristiques de carrière (actuel : ${alloc}).`;
      const split = d.fateSplit.fate + d.fateSplit.resilience;
      if (split !== sp.fate.extra) return `Répartissez les ${sp.fate.extra} points entre Destin et Résilience (actuel : ${split}).`;
      return null;
    }
    case 'skills': {
      if (d.speciesPlus5.length !== 3 || d.speciesPlus3.length !== 3) return 'Choisissez 3 Compétences d\'espèce à +5 et 3 à +3.';
      if (d.speciesPlus5.some((s) => d.speciesPlus3.includes(s))) return 'Une Compétence d\'espèce ne peut pas être à la fois +5 et +3.';
      for (const raw of [...d.speciesPlus5, ...d.speciesPlus3]) {
        if (isUnresolvedChoice(raw) && !d.specChoices[raw]) return `Choisissez la Spécialisation de « ${raw} ».`;
      }
      // Entrées d'espèce « A ou B » : un choix requis quand il y en a.
      for (const ref of sp.talents) {
        const entry = advancementLabel('talents', ref);
        if (splitTopLevelOu(entry).length > 1 && !d.speciesTalentChoices[entry]) return `Choisissez : « ${entry} ».`;
      }
      const entries = careerSkillEntries(d);
      const total = entries.reduce((a, e) => a + (d.skillAdvances[e] ?? 0), 0);
      if (total !== 40) return `Répartissez 40 Augmentations de carrière (actuel : ${total}).`;
      for (const e of entries) {
        const adv = d.skillAdvances[e] ?? 0;
        if (adv < 0 || adv > 10) return `Maximum 10 Augmentations par Compétence à la création (« ${e} »).`;
        if (adv > 0 && isUnresolvedChoice(e) && !d.specChoices[e]) return `Choisissez la Spécialisation de « ${e} ».`;
      }
      if (!d.careerTalent) return 'Choisissez votre Talent de carrière.';
      if (talentMaxReached(probeHero(d, false), d.careerTalent)) return `« ${d.careerTalent} » : Maxi déjà atteint.`;
      const quota = pettySpellQuota(d);
      if (quota && d.pettySpells.length !== quota) {
        return `Choisissez vos ${quota} sorts de Magie mineure (actuel : ${d.pettySpells.length}).`;
      }
      return null;
    }
    case 'details': {
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
  const plus5 = d.speciesPlus5.length === 3 ? d.speciesPlus5 : sp.skills.slice(0, 3).map((a) => advancementLabel('skills', a));
  const plus3 = d.speciesPlus3.length === 3 ? d.speciesPlus3 : sp.skills.slice(3, 6).map((a) => advancementLabel('skills', a));
  const hero = createHero({
    speciesId: d.speciesId,
    careerId: d.careerId,
    name: d.name.trim() || 'Aventurier',
    manualChars: draftChars(d),
    charAdvancesAlloc: d.charAdvancesAlloc,
    careerTalent: d.careerTalent,
    skillAdvances: d.skillAdvances,
    speciesSkillAdvances: { plus5, plus3 },
    speciesTalentsResolved: resolvedSpeciesTalents(d),
    specChoices: d.specChoices,
    starId: d.star,
    fateSplit: d.fateSplit,
    xpBonus: xpTotal(d),
    details: {
      age: d.age,
      height: d.height,
      eyes: d.eyes,
      hair: d.hair,
      ambitionShort: d.ambitionShort.trim() || undefined,
      ambitionLong: d.ambitionLong.trim() || undefined,
      ascendant: d.ascendant,
      dwellings: d.dwellings?.length ? d.dwellings : undefined,
    },
    motivation: d.motivation.trim() || undefined,
    rng: makeRNG(d.seed ^ 0xf17a1),
    id,
  });
  // appearance.species = id d'espèce RIG (slug, via rigSpeciesId) ≠ Combatant.species (id rules).
  hero.appearance = { species: rigSpeciesId(d.speciesId), sex: d.sex, build: d.build, seed: d.appSeed, colors: d.colors, parts: d.parts };
  if (d.star) hero.star = d.star;
  // Sorts de Magie mineure inclus au Talent (LDB 10 l.587) — choisis à l'étape 4, mémorisés.
  // (Les Bénédictions de Béni sont déjà octroyées par applyTalentAcquisition dans createHero.)
  const quota = pettySpellQuota(d);
  if (quota && d.pettySpells.length) {
    // pettySpells = libellés (choix UI) → ids runtime ; dédup par id.
    const pickedIds = d.pettySpells.slice(0, quota).map((l) => findSpell(l)?.id ?? l).filter((id) => !(hero.spells ?? []).includes(id));
    hero.spells = [...(hero.spells ?? []), ...pickedIds];
  }
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
