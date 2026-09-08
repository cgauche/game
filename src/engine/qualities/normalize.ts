/**
 * Parseur d'AUTHORING des qualités d'objet : une chaîne libre saisie à l'éditeur (« Solide 3 »,
 * « précise », « Recharge (2) ») → `QualityInstance` STRUCTURÉE `{id, value?}`. Symétrique de
 * `qualityRefLabel` (id+Indice → libellé) — la même paire prose↔structure que `parseDamage`/
 * `damageString`. **Authoring uniquement** : le runtime porte déjà des `QualityInstance` structurées
 * (le dispatch lit `q.id`/`q.value` sans parser). Correspondance EXACTE sur le label (casse ignorée)
 * OU sur l'id stable (slug).
 */
import { qualityIdByLabel } from '../../data';
import type { QualityInstance } from '../types';

export interface ParsedQuality {
  /** `id` STABLE du registre (ex. 'solide'). */
  id: string;
  /** Indice numérique éventuel (« Solide 3 » → 3). */
  indice?: number;
}

/** Sépare un éventuel Indice de fin (« X 3 » / « X (3) » / « X (1A) ») du label. L'UNITÉ qui suit la
 *  valeur (`QualityData.indice.unite`, rendue par `qualityRefLabel` — `AA 08 l.136` « Taillade (1A) »)
 *  est absorbée ici : sans ça, un aller-retour prose→structure perdrait l'Indice de Taillade. */
export function splitIndice(raw: string): { label: string; indice?: number } {
  const m = raw.trim().match(/^(.*?)\s*\(?(\d+)\s*[A-Za-zÀ-ÿ]*\)?\s*$/);
  if (m && m[2] != null && m[1].trim()) return { label: m[1].trim(), indice: parseInt(m[2], 10) };
  return { label: raw.trim() };
}

/** Normalise une qualité (id STABLE OU libellé saisi à l'éditeur) en { id STABLE, Indice? }, ou null si
 *  inconnue. La conversion texte→id est DÉLÉGUÉE à `qualityIdByLabel` (`src/data/index.ts`, la seule
 *  couture tolérée) : ce module ne voit qu'un id. AUTHORING uniquement. */
export function parseQuality(raw: string): ParsedQuality | null {
  const { label, indice } = splitIndice(raw);
  const id = qualityIdByLabel(label);
  return id ? { id, indice } : null;
}

/** Parse une qualité saisie en prose (« Solide 3 ») → `QualityInstance` structurée `{id, value?}`, ou null
 *  si inconnue. Inverse de `qualityRefLabel`. AUTHORING uniquement (éditeur d'arme conférée). */
export function parseQualityInstance(raw: string): QualityInstance | null {
  const p = parseQuality(raw);
  if (!p) return null;
  return p.indice != null ? { id: p.id, value: p.indice } : { id: p.id };
}
