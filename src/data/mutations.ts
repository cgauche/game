/**
 * Tableaux de Corruption physique et mentale — Livre de base, chapitre 19 (p.184-185), VERBATIM.
 *
 * La DONNÉE vit dans `mutations.json` (éditable, comme `creatures.json` / `trappings.json`) ; ce
 * module n'est que le TYPE + le chargement + le tirage. Ajouter / régler une mutation = éditer le
 * JSON, jamais ce fichier. Chaque entrée porte les effets modélisés (`fx` : caractéristiques
 * permanentes, Mouvement, PA naturels, mods de Tests, Traits, arme dérivée) ; la part descriptive
 * non modélisable reste en `fx.note` (journalisée, arbitrage MJ — rien d'inventé).
 */
import { RNG, d100 } from '../engine/dice';
import { findTableEntry } from '../engine/tables';
import type { Mutation } from '../engine/corruption';
import mutationsJson from './mutations.json';

/** Une ligne du Tableau de Corruption (donnée `mutations.json`). */
export interface MutationRow {
  min: number;
  max: number;
  label: string;
  fx?: Omit<Mutation, 'label' | 'kind' | 'roll'>;
}

const TABLES = mutationsJson as { physique: MutationRow[]; mentale: MutationRow[] };

/** Labels des tables — pour le registre visuel du rig et son test d'exhaustivité. */
export const LABELS_PHYSIQUES: readonly string[] = TABLES.physique.map((r) => r.label);
export const LABELS_MENTALES: readonly string[] = TABLES.mentale.map((r) => r.label);

/** Tire une mutation sur le Tableau de Corruption `kind` (d100, RNG seedable). */
export function rollMutation(kind: 'physique' | 'mentale', rng: RNG): Mutation {
  const roll = d100(rng);
  const row = findTableEntry(TABLES[kind], roll);
  return { label: row.label, kind, roll, ...(row.fx ?? {}) };
}

/** Mutation EXPLICITE par son label (tell figé en DONNÉE, sans tirage — ex. trait
 *  « Mutation (Cornes asymétriques) »). Cherche dans les deux Tableaux. `null` si inconnu. */
export function mutationByLabel(label: string): Mutation | null {
  const key = label.trim().toLowerCase().replace(/[’']/g, "'");
  for (const kind of ['physique', 'mentale'] as const) {
    const row = TABLES[kind].find((r) => r.label.toLowerCase().replace(/[’']/g, "'") === key);
    if (row) return { label: row.label, kind, roll: row.min, ...(row.fx ?? {}) };
  }
  return null;
}
