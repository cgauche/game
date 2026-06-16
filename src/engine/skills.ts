/**
 * Valeur d'une Compétence/Caractéristique pour les Tests « dans le monde »
 * (hors combat) : Caractéristique + Augmentations de la compétence.
 */
import { Combatant, CharKey, CHAR_BY_LABEL } from './types';
import { findSkill } from '../data';
import { wornArmourPenalty } from './wearPenalty';
import { groupMatch } from './groups';
import { effectiveChar } from './characteristics';
import { testStatePenalty } from './conditions';
import { agilityTestPenalty } from './encumbrance';
import { traumaSkillPenalty, passiveSkillSum, passiveTestMod } from './trauma';

/** Caractéristique associée à une compétence (par son label). */
export function skillCharKey(skillLabel: string): CharKey | undefined {
  const base = skillLabel.replace(/\s*\([^)]*\)\s*$/, '').trim(); // retire la spécialisation
  const d = findSkill(base);
  return d ? CHAR_BY_LABEL[d.characteristic] : undefined;
}

/** Valeur de test d'un personnage pour une compétence ou une caractéristique. Mêmes modulations qu'en
 *  combat (le canon ne distingue pas) : Caractéristique EFFECTIVE (buffs magiques + pénalités de
 *  Traumatisme, LDB 18, via `effectiveChar`), pénalités d'États (LDB 16, `testStatePenalty`), pénalité
 *  d'Encombrement sur l'Agilité (LDB 61), port d'armure (LDB 63) et objet Laid sur la Sociabilité (LDB 60). */
export function testValue(c: Combatant, skill?: string, characteristic?: CharKey): number {
  if (!skill && !characteristic) return 0;
  const ck = characteristic ?? skillCharKey(skill!) ?? 'Dex';
  const low = skill?.toLowerCase();
  const sk = low ? c.skills.find((s) => low === s.name.toLowerCase() || low.startsWith(s.name.toLowerCase())) : undefined;
  const base = effectiveChar(c, ck);
  const states = testStatePenalty(c, skill);
  const enc = ck === 'Ag' ? agilityTestPenalty(c) : 0; // charge : couche d'ÉTAT orthogonale (≠ passif d'élément)
  const armour = skill ? wornArmourPenalty(c, skill) : 0;
  const traumaSkill = traumaSkillPenalty(c, skill); // séquelle permanente de fracture (Langue, LDB 18 l.300)
  // Passifs INTRINSÈQUES d'élément (Σ), tous via le collecteur unifié : mutation compétence nommée (Groin
  // poilu +10 Pistage, `passiveSkillSum`) + mods de Test char-qualifiés (`passiveTestMod` : mutation Visage
  // inversé −20 Soc, objet Laid −Soc).
  const passive = passiveSkillSum(c, skill) + passiveTestMod(c, ck);
  return base + (sk?.advances ?? 0) + states + enc + armour + traumaSkill + passive;
}

/** Le personnage possède-t-il la compétence `label` (nom seul OU « Nom (Spécialisation) », ex.
 *  « Projectiles (Poudre noire) ») ? Insensible à la casse. Sert aux modulateurs (ex. `easierIf`). */
export function actorHasSkill(c: Combatant, label: string): boolean {
  const low = label.trim().toLowerCase();
  return c.skills.some((s) => {
    const full = s.spec ? `${s.name} (${s.spec})` : s.name;
    return full.toLowerCase() === low || s.name.toLowerCase() === low;
  });
}

/** Le malus social « contenu » de `type` s'applique-t-il envers `targetGroups` ? (LDB 21) Vrai si le
 *  tester POSSÈDE le trait visant ce groupe ET n'est PAS en état ACTIF pour lui. Le −20/−10 est en effet
 *  l'issue du Test de Psychologie RÉUSSI (Animosité l.22 / Préjugé l.50) — ou, hors combat (pas de Test
 *  modélisé), la manifestation par défaut du trait possédé. En état ACTIF (Test ÉCHOUÉ) ce malus
 *  DISPARAÎT : le personnage est sous compulsion (attaquer l.24 / insulter l.52), pas socialement « contenu ». */
function containedSocialPenalty(tester: Combatant, type: 'animosite' | 'prejuge', targetGroups: string[]): boolean {
  const possede = (tester.psychTraits ?? []).some((t) => t.type === type && t.cible && groupMatch(t.cible, targetGroups));
  if (!possede) return false;
  const actif = (tester.psychState ?? []).some((p) => p.type === type && p.active && p.cible && groupMatch(p.cible, targetGroups));
  return !actif;
}

/** Pénalité de Sociabilité des Traits psy ciblés de `tester` envers les groupes `targetGroups` (LDB 21) :
 *  Animosité −20, Préjugé −10, cumulables. À consommer sur un Test de Sociabilité ciblé (dialogue/interaction). */
export function socialPsychMod(tester: Combatant, targetGroups: string[]): number {
  return (containedSocialPenalty(tester, 'animosite', targetGroups) ? -20 : 0) + (containedSocialPenalty(tester, 'prejuge', targetGroups) ? -10 : 0);
}

/** Libellé lisible du malus psy social (pour la modale de Test), ou undefined si aucun. Ex. « Animosité −20 ». */
export function socialPsychLabel(tester: Combatant, targetGroups: string[]): string | undefined {
  const parts: string[] = [];
  if (containedSocialPenalty(tester, 'animosite', targetGroups)) parts.push('Animosité −20');
  if (containedSocialPenalty(tester, 'prejuge', targetGroups)) parts.push('Préjugé −10');
  return parts.length ? parts.join(' · ') : undefined;
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
