/**
 * Parseur d'AUTHORING des qualités d'objet : une chaîne libre saisie à l'éditeur (« Solide 3 »,
 * « précise », « Recharge (2) ») → `QualityInstance` STRUCTURÉE `{id, value?}`. Symétrique de
 * `qualityRefLabel` (id+Indice → libellé) — la même paire prose↔structure que `parseDamage`/
 * `damageString`. **Authoring uniquement** : le runtime porte déjà des `QualityInstance` structurées
 * (le dispatch lit `q.id`/`q.value` sans parser). Correspondance EXACTE sur le label (casse ignorée)
 * OU sur l'id stable (slug).
 */
import { QUALITIES } from './registry';
import { qualityIdOf } from './ids';
import { slugId } from '../../data/slug';
import type { QualityInstance } from '../types';

const KEY_BY_LOWER = new Map(Object.keys(QUALITIES).map((k) => [k.toLowerCase(), k]));
// Résolution par `id` STABLE (slug du libellé) — la donnée/runtime stocke l'id, pas le libellé.
const KEY_BY_ID = new Map(Object.keys(QUALITIES).map((k) => [slugId(k), k]));

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

/** Normalise une qualité (id STABLE OU libellé saisi à l'éditeur) en { clé canonique, Indice? }, ou null
 *  si inconnue. Résout d'abord par libellé (casse ignorée), sinon par id (slug). AUTHORING uniquement. */
export function parseQuality(raw: string): ParsedQuality | null {
  const { label, indice } = splitIndice(raw);
  const key = KEY_BY_LOWER.get(label.toLowerCase()) ?? KEY_BY_ID.get(slugId(label));
  return key ? { key, indice } : null;
}

/** Parse une qualité saisie en prose (« Solide 3 ») → `QualityInstance` structurée `{id, value?}`, ou null
 *  si inconnue. Inverse de `qualityRefLabel`. AUTHORING uniquement (éditeur d'arme conférée). */
export function parseQualityInstance(raw: string): QualityInstance | null {
  const p = parseQuality(raw);
  if (!p) return null;
  return p.indice != null ? { id: qualityIdOf(p.key), value: p.indice } : { id: qualityIdOf(p.key) };
}
