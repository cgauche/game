/**
 * Vue d'avancement (couche store/UI) — agrège le héros + `careerLevels.json` en une structure
 * prête à rendre. PURE et testée : pas d'état, pas d'effet de bord. Les coûts et la détection
 * in-carrière viennent du moteur (`engine/advancement.ts` + `engine/careerSlots.ts`, verbatim
 * LDB 07/09/10) ; ici on ne fait que router les listes des Niveaux de Carrière.
 *
 * Disponibilité (LDB 07) : Caractéristiques et Compétences CUMULATIVES sur les niveaux ≤
 * courant (l.67/78), Talents du niveau courant uniquement (l.100). Les emplacements
 * « (Au choix) » suivent le modèle de désignation de careerSlots (identité (name, spec)).
 */
import { Combatant, CharKey, CHAR_KEYS, CHAR_LABELS, CHAR_BY_LABEL } from '../engine/types';
import {
  advanceCost,
  talentCost,
  isCareerLevelComplete,
  careerChangeCost,
  inCareerChar,
  validateCareerChange,
} from '../engine/advancement';
import {
  CareerSlot,
  skillSlots,
  talentSlots,
  availableChars,
  designationsFor,
  inCareerStatus,
  takenLabels,
  concreteLabel,
  splitLabel,
  talentMaxReached,
  wildcardSpecs,
} from '../engine/careerSlots';
import { careerSkillAdditions, careerTalentAdditions, baseWithTalents } from '../engine/talentEffects';
import { levelsForCareer, findSkill, findSkillById, findCareerById, findClassById, careers, talentConcrete } from '../data';

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
  spec?: string;
  characteristic: CharKey;
  advances: number;
  /** Le héros possède-t-il déjà la Compétence (sinon : acquérable à 0 si in-carrière). */
  known: boolean;
  inCareer: boolean;
  nextCost: number;
}
/** Emplacement de Compétence « (Au choix) » non désigné : à apprendre/désigner via un choix de spec. */
export interface SkillSlotRow {
  slotKey: string;
  entry: string;
  group: string;
  characteristic: CharKey;
  /** Specs proposées (liste restreinte du slot ou specs de skills.json), specs déjà prises exclues. */
  options: { spec: string; ownedAdvances: number }[];
  /** Coût d'une 1re Augmentation (spec non possédée) — une spec possédée se désigne à 0 PX. */
  nextCost: number;
}
export interface TalentSlotRow {
  slotKey: string;
  entry: string;
  /** Libellé concret si l'entrée est explicite ou le slot désigné. */
  label?: string;
  times: number;
  nextCost: number;
  maxReached: boolean;
  /** Slot à choix non désigné : libellés proposés (specs/options libres de la carrière). */
  options?: { label: string; owned: boolean }[];
}
export interface CareerTarget {
  career: string;
  level: number;
  label: string;
  cost: number;
  ok: boolean;
  reason?: string;
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
  skillSlotsOpen: SkillSlotRow[];
  talents: TalentSlotRow[];
  targets: CareerTarget[];
  /** Coût d'un changement vers une carrière donnée (id, sélecteur) : +100 hors Classe (LDB 08 l.9). */
  changeCostFor: (careerId: string) => number;
}

/** Remise « 5 PX de moins par Augmentation » (LDB 10 Maître artisan/Oreille absolue/…) quand la
 *  Compétence ajoutée par un talent est DÉJÀ couverte par la carrière. */
function additionDiscount(additions: string[], slots: CareerSlot[], designations: Record<string, string>, name: string, spec?: string): number {
  const added = additions.some((a) => {
    const p = splitLabel(a);
    if (p.name !== name) return false;
    if (p.spec && /au choix/i.test(p.spec)) return true; // joker de groupe (Savoir (Région) reste exact)
    return (p.spec ?? '') === (spec ?? '');
  });
  if (!added) return 0;
  return inCareerStatus(slots, designations, name, spec) ? 5 : 0;
}

export function buildAdvancementView(hero: Combatant): AdvancementView {
  const career = hero.career ?? '';
  const careerLevel = hero.careerLevel ?? 1;
  const levels = levelsForCareer(career);
  const cur = levels.find((l) => l.level === careerLevel);
  const sSlots = skillSlots(levels, careerLevel); // cumul niveaux ≤ courant (LDB 07 l.78)
  const tSlots = talentSlots(levels, careerLevel); // niveau courant seul (l.100)
  const careerChars = availableChars(levels, careerLevel); // cumul (l.67)
  const designations = designationsFor(hero, career);
  const additions = careerSkillAdditions(hero);

  const chars: CharAdvanceRow[] = CHAR_KEYS.map((key) => {
    const advances = hero.charAdvances?.[key] ?? 0;
    const inCareer = inCareerChar(careerChars, key);
    return { key, label: CHAR_LABELS[key], value: baseWithTalents(hero, key), advances, inCareer, nextCost: advanceCost(advances, 'characteristic', inCareer) };
  });

  // Compétences connues — identité (name, spec) : chaque Spécialisation est une Compétence
  // distincte (LDB 09 l.42). In-carrière = slot explicite / désigné / joker libre, OU
  // compétence ajoutée par un talent (« à n'importe quelle Carrière », LDB 10).
  const skills: SkillAdvanceRow[] = hero.skills.map((s) => {
    const sName = findSkillById(s.skillId)?.label ?? s.skillId;
    const status = inCareerStatus(sSlots, designations, sName, s.spec);
    const addedExact = additions.some((a) => {
      const p = splitLabel(a);
      return p.name === sName && (!p.spec || /au choix/i.test(p.spec) || (p.spec ?? '') === (s.spec ?? ''));
    });
    const inCareer = status != null || addedExact;
    const discount = additionDiscount(additions, sSlots, designations, sName, s.spec);
    return {
      name: sName,
      spec: s.spec,
      characteristic: s.characteristic,
      advances: s.advances,
      known: true,
      inCareer,
      nextCost: advanceCost(s.advances, 'skill', inCareer, discount),
    };
  });
  // Entrées EXPLICITES de carrière pas encore connues → acquérables à advances 0.
  const knows = (name: string, spec?: string) => hero.skills.some((s) => (findSkillById(s.skillId)?.label ?? s.skillId) === name && (s.spec ?? '') === (spec ?? ''));
  for (const slot of sSlots) {
    if (slot.needsChoice) continue;
    const o = slot.options[0];
    if (knows(o.name, o.spec)) continue;
    if (skills.some((r) => !r.known && r.name === o.name && (r.spec ?? '') === (o.spec ?? ''))) continue;
    const characteristic = findSkill(o.name)?.characteristic ?? 'Int';
    skills.push({ name: o.name, spec: o.spec, characteristic, advances: 0, known: false, inCareer: true, nextCost: advanceCost(0, 'skill', true) });
  }
  // Emplacements de Compétence « (Au choix) » non désignés → choix de spec (désigner/apprendre).
  const taken = takenLabels([...sSlots, ...tSlots], designations);
  const skillSlotsOpen: SkillSlotRow[] = [];
  for (const slot of sSlots) {
    if (!slot.needsChoice || designations[slot.key]) continue;
    const o = slot.options[0];
    const specPool = o.specOptions ?? wildcardSpecs(o.name);
    const options = specPool
      .filter((spec) => !taken.has(concreteLabel(o.name, spec)))
      .map((spec) => ({ spec, ownedAdvances: hero.skills.find((s) => (findSkillById(s.skillId)?.label ?? s.skillId) === o.name && (s.spec ?? '') === spec)?.advances ?? 0 }));
    const characteristic = findSkill(o.name)?.characteristic ?? 'Int';
    skillSlotsOpen.push({ slotKey: slot.key, entry: slot.entry, group: o.name, characteristic, options, nextCost: advanceCost(0, 'skill', true) });
  }

  // Talents : un rang par EMPLACEMENT du niveau courant (LDB 07 l.100).
  const talents: TalentSlotRow[] = tSlots.map((slot) => {
    const label = slot.needsChoice ? designations[slot.key] : concreteLabel(slot.options[0].name, slot.options[0].spec);
    if (label) {
      const times = hero.talents.find((t) => talentConcrete(t) === label)?.times ?? 0;
      return { slotKey: slot.key, entry: slot.entry, label, times, nextCost: talentCost(times), maxReached: talentMaxReached(hero, label) };
    }
    // Slot à choix non désigné : proposer les options concrètes non prises par la carrière.
    const options: { label: string; owned: boolean }[] = [];
    for (const o of slot.options) {
      const specs = o.specOptions ?? wildcardSpecs(o.name);
      const pool: (string | undefined)[] = o.wildcard ? (specs.length ? specs : [undefined]) : [o.spec];
      for (const spec of pool) {
        const lbl = concreteLabel(o.name, spec);
        if (taken.has(lbl)) continue;
        options.push({ label: lbl, owned: (hero.talents.find((t) => talentConcrete(t) === lbl)?.times ?? 0) > 0 });
      }
    }
    return { slotKey: slot.key, entry: slot.entry, times: 0, nextCost: talentCost(0), maxReached: false, options };
  });
  // Talents AJOUTÉS aux carrières par un talent possédé (Flagellant → Frénésie, LDB 10) : apprenables
  // en carrière même hors emplacement de niveau. Dédupe contre les slots déjà projetés (par libellé).
  for (const label of careerTalentAdditions(hero)) {
    if (talents.some((r) => r.label === label || r.options?.some((o) => o.label === label))) continue;
    const times = hero.talents.find((t) => talentConcrete(t) === label)?.times ?? 0;
    talents.push({ slotKey: `add:${label}`, entry: label, label, times, nextCost: talentCost(times), maxReached: talentMaxReached(hero, label) });
  }

  const completed = cur
    ? isCareerLevelComplete(hero, careerLevel, { skillSlots: sSlots, talentSlots: tSlots, careerChars, designations })
    : false;
  const changeCost = careerChangeCost(completed);

  // Cibles de progression (LDB 07 l.137) : Niveau suivant (exige la complétion) + Niveaux inférieurs.
  const targets: CareerTarget[] = [];
  for (const l of levels) {
    if (l.level === careerLevel) continue;
    if (l.level > careerLevel + 1) continue; // pas de saut de niveau (réservé au MJ)
    const v = validateCareerChange(hero, career, l.level, { completed, sameClass: true, targetLevelExists: true });
    targets.push({ career, level: l.level, label: l.label, cost: v.cost, ok: v.ok, reason: v.reason });
  }

  const curClass = findCareerById(career)?.class;
  const changeCostFor = (careerId: string) =>
    changeCost + (findCareerById(careerId)?.class === curClass ? 0 : 100); // LDB 08 l.9-11

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
    skillSlotsOpen,
    talents,
    targets,
    changeCostFor,
  };
}

/** Toutes les carrières, pour le sélecteur de changement (id + libellé + libellé de Classe). */
export function allCareerChoices(): { id: string; label: string; className: string }[] {
  return careers.map((c) => ({ id: c.id, label: c.label, className: findClassById(c.class)?.label ?? c.class }));
}
