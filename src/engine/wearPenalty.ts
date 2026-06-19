/**
 * Pénalités de port d'armure (LDB 63 l.84-95) : déjà encodées dans `qualities[]` des armures
 * sous la forme « -N% en <Compétence> » (ex. « -10% en Discrétion », « -20% en Perception »).
 * Ce module les PARSE (pas de re-transcription) et somme celles des pièces ÉQUIPÉES d'un acteur,
 * modulées par l'artisanat de la pièce (Pratique réduit d'un niveau, Peu Fiable double — LDB 60 l.59/88).
 */
import { Combatant } from './types';
import type { PassiveMod } from './ops';
import { hasQuality, qualitySocMod } from './qualities/dispatch';
import { QUALITY_IDS } from './qualities/ids';
import { findSkill } from '../data';
import { slugId } from '../data/slug';

const WEAR_RE = /^\s*([+-]?\d+)\s*%?\s*en\s+(.+?)\s*$/i;

/** Parse une chaîne de pénalité de port (« -10% en Discrétion ») ; null si ce n'en est pas une. */
export function parseWearPenalty(q: string): { skill: string; value: number } | null {
  const m = WEAR_RE.exec(q);
  if (!m) return null;
  return { value: parseInt(m[1], 10), skill: m[2].trim() };
}

/** Pénalités de port (compétence en minuscules, valeur ≤ 0) des armures ÉQUIPÉES, modulées par l'artisanat
 *  (Pratique +10 plancher 0, Peu Fiable ×2). SOURCE UNIQUE : `wornArmourPenalty` + le collecteur passif. */
function wearEntries(c: Combatant): { skill: string; value: number }[] {
  const out: { skill: string; value: number }[] = [];
  for (const piece of c.items ?? []) {
    if (!piece.equipped || piece.kind !== 'armor') continue;
    for (const q of piece.qualities ?? []) {
      const p = parseWearPenalty(q);
      if (!p) continue;
      let v = p.value; // négatif
      if (hasQuality(piece, QUALITY_IDS.Pratique)) v = Math.min(0, v + 10); // Atout : -1 niveau (LDB 60 l.59)
      if (hasQuality(piece, QUALITY_IDS.PeuFiable)) v = v * 2; // Défaut : doublée (LDB 60 l.88)
      if (v) out.push({ skill: findSkill(p.skill)?.id ?? slugId(p.skill), value: v }); // libellé parsé → skillId stable
    }
  }
  return out;
}

/** Somme des pénalités de port (≤ 0) des armures ÉQUIPÉES de `c` pour la compétence `skillId` stable. */
export function wornArmourPenalty(c: Combatant, skillId: string): number {
  return wearEntries(c).filter((e) => e.skill === skillId).reduce((s, e) => s + e.value, 0);
}

/** Pénalités de port → ops `skillMod` skill-qualifiées (kind `intrinsèque`, Σ) pour le collecteur passif unifié. */
export function qualityWearMods(c: Combatant): PassiveMod[] {
  return wearEntries(c).map((e) => ({ op: { op: 'skillMod' as const, skill: e.skill, mod: e.value }, kind: 'intrinsèque' as const }));
}

/** Somme des modificateurs de Sociabilité (≤ 0) des objets ÉQUIPÉS de `c` (objet Laid -10, LDB 60 l.85). */
export function wornSocialMod(c: Combatant): number {
  let total = 0;
  for (const piece of c.items ?? []) if (piece.equipped) total += qualitySocMod(piece);
  return total;
}
