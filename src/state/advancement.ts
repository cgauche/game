/**
 * Vue d'avancement (couche store/UI) — agrège le héros + `careerLevels.json` en une structure
 * prête à rendre. PURE et testée : pas d'état, pas d'effet de bord. Les coûts et la détection
 * in-carrière viennent du moteur (`engine/advancement.ts`, verbatim LDB 07-Carrières) ; ici on
 * ne fait que router les listes du Niveau de Carrière courant.
 */
import { Combatant, CharKey, CHAR_KEYS, CHAR_LABELS, CHAR_BY_LABEL } from '../engine/types';
import {
  advanceCost,
  talentCost,
  isCareerLevelComplete,
  careerChangeCost,
  inCareerChar,
  inCareerSkill,
  inCareerTalent,
} from '../engine/advancement';
import { levelsForCareer, findSkill } from '../data';

export interface CharAdvanceRow {
  key: CharKey;
  label: string;
  value: number;
  advances: number;
  inCareer: boolean;
  nextCost: number;
}
export interface SkillAdvanceRow {
  name: string;
  characteristic: CharKey;
  advances: number;
  /** Le héros possède-t-il déjà la Compétence (sinon : acquérable à 0 si in-carrière). */
  known: boolean;
  inCareer: boolean;
  nextCost: number;
}
export interface TalentAdvanceRow {
  name: string;
  times: number;
  inCareer: boolean;
  nextCost: number;
}
export interface CareerTarget {
  career: string;
  level: number;
  label: string;
  cost: number;
}
export interface AdvancementView {
  xp: number;
  career: string;
  careerLevel: number;
  levelLabel: string;
  status: string;
  completed: boolean;
  changeCost: number;
  chars: CharAdvanceRow[];
  skills: SkillAdvanceRow[];
  talents: TalentAdvanceRow[];
  targets: CareerTarget[];
}

export function buildAdvancementView(hero: Combatant): AdvancementView {
  const career = hero.career ?? '';
  const careerLevel = hero.careerLevel ?? 1;
  const levels = levelsForCareer(career);
  const cur = levels.find((l) => l.level === careerLevel);
  const careerChars = cur?.characteristics ?? [];
  const careerSkills = cur?.skills ?? [];
  const careerTalents = cur?.talents ?? [];

  const chars: CharAdvanceRow[] = CHAR_KEYS.map((key) => {
    const advances = hero.charAdvances?.[key] ?? 0;
    const inCareer = inCareerChar(careerChars, key);
    return { key, label: CHAR_LABELS[key], value: hero.characteristics[key], advances, inCareer, nextCost: advanceCost(advances, 'characteristic', inCareer) };
  });

  const skills: SkillAdvanceRow[] = hero.skills.map((s) => {
    const inCareer = inCareerSkill(careerSkills, s.name);
    return { name: s.name, characteristic: s.characteristic, advances: s.advances, known: true, inCareer, nextCost: advanceCost(s.advances, 'skill', inCareer) };
  });
  // Compétences du Niveau pas encore connues → acquérables à advances 0 (coût in-carrière).
  const knownSkills = new Set(hero.skills.map((s) => s.name));
  for (const name of careerSkills) {
    if (knownSkills.has(name)) continue;
    const characteristic = CHAR_BY_LABEL[findSkill(name)?.characteristic ?? ''] ?? 'Int';
    skills.push({ name, characteristic, advances: 0, known: false, inCareer: true, nextCost: advanceCost(0, 'skill', true) });
  }

  const talents: TalentAdvanceRow[] = hero.talents.map((t) => ({
    name: t.name,
    times: t.times,
    inCareer: inCareerTalent(careerTalents, t.name),
    nextCost: talentCost(t.times),
  }));
  // Talents du Niveau pas encore possédés → acquérables (les Talents hors-carrière ne s'achètent pas, l.97).
  const ownedTalents = new Set(hero.talents.map((t) => t.name));
  for (const name of careerTalents) {
    if (ownedTalents.has(name)) continue;
    talents.push({ name, times: 0, inCareer: true, nextCost: talentCost(0) });
  }

  const completed = cur ? isCareerLevelComplete(hero, careerLevel, careerSkills, careerTalents) : false;
  const changeCost = careerChangeCost(completed);

  // Cible de progression : le Niveau suivant de la même Carrière (LDB 07-Carrières l.136).
  const targets: CareerTarget[] = [];
  const next = levels.find((l) => l.level === careerLevel + 1);
  if (next) targets.push({ career, level: next.level, label: next.label, cost: changeCost });

  return {
    xp: hero.xp ?? 0,
    career,
    careerLevel,
    levelLabel: cur?.label ?? career,
    status: cur?.status ?? '',
    completed,
    changeCost,
    chars,
    skills,
    talents,
    targets,
  };
}
