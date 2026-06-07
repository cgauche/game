/**
 * Valeur d'une Compétence/Caractéristique pour les Tests « dans le monde »
 * (hors combat) : Caractéristique + Augmentations de la compétence.
 */
import { Combatant, CharKey, CHAR_BY_LABEL } from './types';
import { findSkill } from '../data';
import { wornArmourPenalty, wornSocialMod } from './wearPenalty';
import { groupMatch } from './groups';

/** Caractéristique associée à une compétence (par son label). */
export function skillCharKey(skillLabel: string): CharKey | undefined {
  const base = skillLabel.replace(/\s*\([^)]*\)\s*$/, '').trim(); // retire la spécialisation
  const d = findSkill(base);
  return d ? CHAR_BY_LABEL[d.characteristic] : undefined;
}

/** Valeur de test d'un personnage pour une compétence ou une caractéristique. */
export function testValue(c: Combatant, skill?: string, characteristic?: CharKey): number {
  if (characteristic) return (c.characteristics[characteristic] ?? 0) + (characteristic === 'Soc' ? wornSocialMod(c) : 0);
  if (skill) {
    const ck = skillCharKey(skill) ?? 'Dex';
    const base = c.characteristics[ck] ?? 0;
    const low = skill.toLowerCase();
    const sk = c.skills.find((s) => low === s.name.toLowerCase() || low.startsWith(s.name.toLowerCase()));
    // Pénalité de port d'armure (LDB 63 l.84-95) + objet Laid sur les Tests de Sociabilité (LDB 60 l.85).
    return base + (sk?.advances ?? 0) + wornArmourPenalty(c, skill) + (ck === 'Soc' ? wornSocialMod(c) : 0);
  }
  return 0;
}

/** Pénalité de Sociabilité d'un Trait psy ciblé de `tester` visant un membre des groupes `targetGroups`
 *  (LDB 21) : Animosité −20 (l.22), Préjugé −10 (l.43-52). Cumulables. Le malus s'applique si le tester
 *  POSSÈDE le trait visant ce groupe (`psychTraits` — cas hors-combat, dialogue : pas d'affliction) OU
 *  s'il subit une affliction ACTIVE du même type (`psychState` — cas en combat). À consommer là où un
 *  Test de Sociabilité vise une cible précise (interaction/dialogue avec le groupe). */
export function socialPsychMod(tester: Combatant, targetGroups: string[]): number {
  const vs = (type: 'animosite' | 'prejuge'): boolean =>
    (tester.psychTraits ?? []).some((t) => t.type === type && t.cible && groupMatch(t.cible, targetGroups)) ||
    (tester.psychState ?? []).some((p) => p.type === type && p.active && p.cible && groupMatch(p.cible, targetGroups));
  return (vs('animosite') ? -20 : 0) + (vs('prejuge') ? -10 : 0);
}

/** Un Test (compétence ou caractéristique) relève-t-il de la **Sociabilité** (LDB 21 : malus psy −20/−10) ?
 *  Vrai si la caractéristique sous-jacente est `Soc` (Charme, Marchandage, Intimidation, Commérage…). */
export function isSocialTest(skill?: string, characteristic?: CharKey): boolean {
  if (characteristic) return characteristic === 'Soc';
  if (skill) return skillCharKey(skill) === 'Soc';
  return false;
}

/** Meilleur membre du groupe pour un test donné. `extraMod` ajoute un modificateur PAR acteur (ex. malus
 *  psy de Sociabilité, qui dépend du personnage) — la valeur effective sert au choix ET au résultat. */
export function partyBest(
  party: Combatant[],
  skill?: string,
  characteristic?: CharKey,
  extraMod?: (c: Combatant) => number,
): { actor: Combatant; value: number } | null {
  let best: { actor: Combatant; value: number } | null = null;
  for (const c of party) {
    const v = testValue(c, skill, characteristic) + (extraMod?.(c) ?? 0);
    if (!best || v > best.value) best = { actor: c, value: v };
  }
  return best;
}
