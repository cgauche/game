/**
 * Normalisation des qualités d'objet : une chaîne libre (« Solide 3 », « précise »,
 * « Recharge (2) ») → forme canonique { clé du registre, Indice? }. Correspondance **exacte**
 * sur le label (casse ignorée) — fini le `startsWith` fragile (ex. 'Précise' vs 'Précision').
 * L'Indice typé (Solide N, Recharge N) est extrait une seule fois, au lieu d'un `parseInt`
 * dupliqué à chaque site d'usage.
 */
import { QUALITIES } from './registry';

const KEY_BY_LOWER = new Map(Object.keys(QUALITIES).map((k) => [k.toLowerCase(), k]));

export interface ParsedQuality {
  /** Clé canonique du registre (ex. 'Solide'). */
  key: string;
  /** Indice numérique éventuel (« Solide 3 » → 3). */
  indice?: number;
}

/** Sépare un éventuel Indice de fin (« X 3 » / « X (3) ») du label. */
export function splitIndice(raw: string): { label: string; indice?: number } {
  const m = raw.trim().match(/^(.*?)\s*\(?(\d+)\)?\s*$/);
  if (m && m[2] != null && m[1].trim()) return { label: m[1].trim(), indice: parseInt(m[2], 10) };
  return { label: raw.trim() };
}

/** Normalise une chaîne de qualité en { clé canonique, Indice? }, ou null si inconnue du registre. */
export function parseQuality(raw: string): ParsedQuality | null {
  const { label, indice } = splitIndice(raw);
  const key = KEY_BY_LOWER.get(label.toLowerCase());
  return key ? { key, indice } : null;
}

/** Indice de la qualité `key` dans une liste de chaînes (ex. ['Recharge 2'] → 2), sinon undefined. */
export function indiceOf(qualities: string[], key: string): number | undefined {
  for (const raw of qualities) {
    const p = parseQuality(raw);
    if (p && p.key === key) return p.indice;
  }
  return undefined;
}
