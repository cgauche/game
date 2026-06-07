/**
 * Valeur d'une Compétence/Caractéristique pour les Tests « dans le monde »
 * (hors combat) : Caractéristique + Augmentations de la compétence.
 */
import { Combatant, CharKey, CHAR_BY_LABEL } from './types';
import { findSkill } from '../data';
import { wornArmourPenalty, wornSocialMod } from './wearPenalty';

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

/** Meilleur membre du groupe pour un test donné. */
export function partyBest(
  party: Combatant[],
  skill?: string,
  characteristic?: CharKey,
): { actor: Combatant; value: number } | null {
  let best: { actor: Combatant; value: number } | null = null;
  for (const c of party) {
    const v = testValue(c, skill, characteristic);
    if (!best || v > best.value) best = { actor: c, value: v };
  }
  return best;
}
