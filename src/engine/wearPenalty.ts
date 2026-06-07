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
