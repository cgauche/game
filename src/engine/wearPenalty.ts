/**
 * Pénalités de port d'armure (LDB 63 l.84-95) : déjà encodées dans `qualities[]` des armures
 * sous la forme « -N% en <Compétence> » (ex. « -10% en Discrétion », « -20% en Perception »).
 * Ce module les PARSE (pas de re-transcription) et somme celles des pièces ÉQUIPÉES d'un acteur,
 * modulées par l'artisanat de la pièce (Pratique réduit d'un niveau, Peu Fiable double — LDB 60 l.59/88).
 */
import { Combatant } from './types';
import { hasQuality } from './qualities/dispatch';

const WEAR_RE = /^\s*([+-]?\d+)\s*%?\s*en\s+(.+?)\s*$/i;

/** Parse une chaîne de pénalité de port (« -10% en Discrétion ») ; null si ce n'en est pas une. */
export function parseWearPenalty(q: string): { skill: string; value: number } | null {
  const m = WEAR_RE.exec(q);
  if (!m) return null;
  return { value: parseInt(m[1], 10), skill: m[2].trim() };
}

/** Somme des pénalités de port (≤ 0) des armures ÉQUIPÉES de `c` pour la compétence `skill`
 *  (spécialisation/casse ignorées). Pratique réduit d'un niveau (+10, plancher 0), Peu Fiable double. */
export function wornArmourPenalty(c: Combatant, skill: string): number {
  const base = skill.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
  let total = 0;
  for (const piece of c.items ?? []) {
    if (!piece.equipped || piece.kind !== 'armor') continue;
    for (const q of piece.qualities ?? []) {
      const p = parseWearPenalty(q);
      if (!p || p.skill.toLowerCase() !== base) continue;
      let v = p.value; // négatif
      if (hasQuality(piece, 'Pratique')) v = Math.min(0, v + 10); // Atout : -1 niveau (LDB 60 l.59)
      if (hasQuality(piece, 'Peu Fiable')) v = v * 2; // Défaut : doublée (LDB 60 l.88)
      total += v;
    }
  }
  return total;
}
