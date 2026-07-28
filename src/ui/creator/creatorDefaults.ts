/**
 * Défauts de recette du créateur (DEV, #518) — PUR : applique étape par étape des choix VALIDES
 * jusqu'à `upto` incluse, en réutilisant les gestes/dérivations de `draft.ts` (jamais un chemin
 * parallèle). Consommé par `__wfrp.fillCreatorDefaults` (`src/state/devtools.ts`) via la couture
 * `CharacterCreator.tsx` — jamais appelé au flux joueur réel.
 */
import {
  type CreatorDraft,
  type StepId,
  stepIds,
  draftSpecies,
  draftLevel,
  careerCharKeys,
  withSpecies,
  withCareer,
  rollDraftChars,
  rollDraftStar,
  rollDraftTalents,
  rollDraftWealth,
  evenCareerSkillAdvances,
  careerSkillEntries,
  careerAdvTotal,
  speciesTalentRandomCount,
  careerTalentOptions,
  pettySpellQuota,
  specOptionsFor,
  CAREER_CHAR_ADVANCES,
  CAREER_SKILL_ADVANCES,
  SPECIES_SKILLS_PLUS5,
  SPECIES_SKILLS_PLUS3,
} from './draft';
import { species, careersForSpecies, levelsForCareer, advancementLabel, spells } from '../../data';
import type { CharKey } from '../../engine/types';
import { isUnresolvedChoice, splitTopLevelOu } from '../../engine/careerSlots';

function fillSpecies(d: CreatorDraft): CreatorDraft {
  if (draftSpecies(d)) return d;
  const first = species[0];
  return first ? withSpecies(d, first.id) : d;
}

function fillCareer(d: CreatorDraft): CreatorDraft {
  const sp = draftSpecies(d);
  if (!sp || draftLevel(d)) return d;
  const pool = careersForSpecies(sp.refCareer, d.ignoreRestrictions);
  const withLevel = pool.find((c) => levelsForCareer(c.id).some((l) => l.level === 1)) ?? pool[0];
  return withLevel ? withCareer(d, withLevel.id) : d;
}

function fillChars(d: CreatorDraft): CreatorDraft {
  const sp = draftSpecies(d);
  if (!sp) return d;
  let cur = d.charsRolled ? d : rollDraftChars(d);
  const keys = careerCharKeys(cur);
  const allocSum = Object.values(cur.charAdvancesAlloc).reduce((a, b) => a + (b ?? 0), 0);
  if (keys.length && allocSum !== CAREER_CHAR_ADVANCES) {
    const alloc: Partial<Record<CharKey, number>> = {};
    let remaining = CAREER_CHAR_ADVANCES;
    keys.forEach((k, i) => {
      const share = i === keys.length - 1 ? remaining : Math.floor(CAREER_CHAR_ADVANCES / keys.length);
      alloc[k] = share;
      remaining -= share;
    });
    cur = { ...cur, charAdvancesAlloc: alloc };
  }
  const split = cur.fateSplit.fate + cur.fateSplit.resilience;
  if (split !== sp.fate.extra) cur = { ...cur, fateSplit: { fate: sp.fate.extra, resilience: 0 } };
  return cur;
}

function fillStar(d: CreatorDraft): CreatorDraft {
  return d.star ? d : rollDraftStar(d);
}

function fillSkills(d: CreatorDraft): CreatorDraft {
  const sp = draftSpecies(d);
  if (!sp) return d;
  let cur = d;

  // 5a — Compétences de race : quotas + Spécialisations.
  if (cur.speciesPlus5.length !== SPECIES_SKILLS_PLUS5 || cur.speciesPlus3.length !== SPECIES_SKILLS_PLUS3) {
    const plus5 = sp.skills.slice(0, SPECIES_SKILLS_PLUS5).map((a) => advancementLabel('skills', a));
    const plus3 = sp.skills.slice(SPECIES_SKILLS_PLUS5, SPECIES_SKILLS_PLUS5 + SPECIES_SKILLS_PLUS3).map((a) => advancementLabel('skills', a));
    cur = { ...cur, speciesPlus5: plus5, speciesPlus3: plus3 };
  }
  let specChoices = { ...cur.specChoices };
  for (const raw of [...cur.speciesPlus5, ...cur.speciesPlus3]) {
    if (isUnresolvedChoice(raw) && !specChoices[raw]) {
      const opt = specOptionsFor(raw)[0];
      if (opt) specChoices[raw] = opt;
    }
  }
  cur = { ...cur, specChoices };

  // Entrées d'espèce « A ou B » — première branche.
  const speciesTalentChoices = { ...cur.speciesTalentChoices };
  for (const ref of sp.talents) {
    const entry = advancementLabel('talents', ref).trim();
    const branches = splitTopLevelOu(entry);
    if (branches.length > 1 && !speciesTalentChoices[entry]) speciesTalentChoices[entry] = branches[0];
  }
  cur = { ...cur, speciesTalentChoices };

  if (speciesTalentRandomCount(cur) > 0 && !cur.talentsRolled) cur = rollDraftTalents(cur);

  // 5b — Compétences de carrière : répartition égale des 40 Augmentations.
  if (careerAdvTotal(cur) !== CAREER_SKILL_ADVANCES) cur = { ...cur, skillAdvances: evenCareerSkillAdvances(cur) };
  specChoices = { ...cur.specChoices };
  for (const e of careerSkillEntries(cur)) {
    const adv = cur.skillAdvances[e] ?? 0;
    if (adv > 0 && isUnresolvedChoice(e) && !specChoices[e]) {
      const opt = specOptionsFor(e)[0];
      if (opt) specChoices[e] = opt;
    }
  }
  cur = { ...cur, specChoices };

  // 5c — Talent de carrière : première option éligible (par entrée « (Au choix) »), puis 1ᵉʳ non-Maxi.
  specChoices = { ...cur.specChoices };
  for (const o of careerTalentOptions(cur)) {
    if (o.choices && !o.selected) specChoices[o.entry] = o.choices[0];
  }
  cur = { ...cur, specChoices };
  if (!cur.careerTalent) {
    const pick = careerTalentOptions(cur).find((o) => o.selected && !o.maxed);
    if (pick?.selected) cur = { ...cur, careerTalent: pick.selected };
  }

  // Sorts de Magie mineure inclus au Talent : les N premiers.
  const quota = pettySpellQuota(cur);
  if (quota && cur.pettySpells.length !== quota) {
    const minors = spells.filter((s) => s.family === 'mineure').map((s) => s.label);
    cur = { ...cur, pettySpells: minors.slice(0, quota) };
  }
  return cur;
}

function fillTrappings(d: CreatorDraft): CreatorDraft {
  return d.wealthRoll ? d : rollDraftWealth(d);
}

function fillDetails(d: CreatorDraft): CreatorDraft {
  return d.label.trim() ? d : { ...d, label: 'Aventurier' };
}

const STEP_FILLERS: Record<StepId, (d: CreatorDraft) => CreatorDraft> = {
  species: fillSpecies,
  career: fillCareer,
  chars: fillChars,
  star: fillStar,
  skills: fillSkills,
  trappings: fillTrappings,
  details: fillDetails,
  presentation: (d) => d,
};

/** Applique les défauts de recette étape par étape jusqu'à `upto` INCLUSE — PUR, réutilise
 *  `draft.ts` (jamais un chemin parallèle). INVARIANT : `validateStep(fillDraftDefaults(d, s), s')`
 *  est `null` pour chaque étape `s' <= s` de `stepIds()`. */
export function fillDraftDefaults(d: CreatorDraft, upto: StepId): CreatorDraft {
  const order = stepIds();
  const idx = order.indexOf(upto);
  const cutoff = idx === -1 ? order.length - 1 : idx;
  let cur = d;
  for (let i = 0; i <= cutoff; i++) cur = STEP_FILLERS[order[i]](cur);
  return cur;
}
