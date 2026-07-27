/**
 * Pénalités de port d'armure (LDB 63 l.84-95) : portées STRUCTURÉES par les pseudo-qualités d'armure
 * `en-<skillId>` (`{id:'en-discretion', value:-10}`) — l'id encode la Compétence, le `value` la magnitude.
 * Plus aucune prose FR « -N% en <Compétence> » re-parsée par regex. Somme les pièces ÉQUIPÉES d'un acteur
 * (LDB 63 l.95 : « chaque fois » → cumul), modulée par l'artisanat (Pratique réduit d'un niveau, Peu Fiable
 * double — LDB 60 l.22/58).
 */
import { Combatant } from './types';
import type { PassiveMod } from './ops';
import { hasQuality, qualitySocMod } from './qualities/dispatch';

/** Préfixe d'id des pseudo-qualités de pénalité de port : `en-<skillId>` (`en-discretion`, `en-perception`). */
const WEAR_PREFIX = 'en-';

/** Pénalités de port (skillId stable, valeur ≤ 0) des armures ÉQUIPÉES, modulées par l'artisanat
 *  (Pratique +10 plancher 0, Peu Fiable ×2). SOURCE UNIQUE : `wornArmourPenalty` + le collecteur passif. */
function wearEntries(c: Combatant): { skill: string; value: number }[] {
  const out: { skill: string; value: number }[] = [];
  for (const piece of c.items ?? []) {
    if (!piece.equipped || piece.kind !== 'armor') continue;
    for (const q of piece.qualities ?? []) {
      if (!q.id.startsWith(WEAR_PREFIX) || q.value == null) continue;
      const skill = q.id.slice(WEAR_PREFIX.length); // `en-discretion` → skillId `discretion` (stable)
      let v = q.value; // négatif (magnitude LDB 63)
      if (hasQuality(piece, 'pratique')) v = Math.min(0, v + 10); // Atout : -1 niveau (LDB 60 l.22)
      if (hasQuality(piece, 'peu-fiable')) v = v * 2; // Défaut : doublée (LDB 60 l.58)
      if (v) out.push({ skill, value: v });
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

/** Somme des modificateurs de Sociabilité (≤ 0) des objets ÉQUIPÉS de `c` (objet Laid -10, LDB 60 l.54). */
export function wornSocialMod(c: Combatant): number {
  let total = 0;
  for (const piece of c.items ?? []) if (piece.equipped) total += qualitySocMod(piece);
  return total;
}
