/**
 * Résolution des Blessures critiques — Livre de base, « Traumatisme » (18-Traumatisme.md).
 * Jet 1d100 sur la table de la localisation ; -20 si l'overkill dépasse le Bonus d'Endurance
 * (l.30, min 01) ; PB perdus en ignorant BE+PA ; États appliqués + Test de Résistance auto-résolu.
 */
import { d100, RNG, defaultRNG } from './dice';
import { rollTest } from './tests';
import { bonus, effectiveChar } from './characteristics';
import { hitLocation } from './combat';
import { Combatant, HitLocation, Trauma } from './types';
import { CRITICAL_TABLES, CritEntry } from '../data/criticals';
import { traumaFromKind } from './trauma';

export interface CriticalResolved {
  location: HitLocation;
  name: string;
  /** PB perdus (ignore BE+PA) ; le plancher (0) est géré par l'appelant. */
  woundsLoss: number;
  lethal: boolean;
  /** États à appliquer (immédiats + échec du Test de Résistance). */
  conditions: { name: string; value: number }[];
  /** Traumatismes posés (LDB 18), à la localisation du critique. */
  traumas: Trauma[];
  note: string;
  /** Jet d100 effectif (après -20 éventuel). */
  roll: number;
  log: string;
}

/** Localisation d'un Coup Critique : 1d100 lu directement sur le Tableau de Localisation (p.159). */
export function critLocationRoll(rng: RNG = defaultRNG): HitLocation {
  return hitLocation(d100(rng));
}

function findEntry(table: CritEntry[], roll: number): CritEntry {
  return table.find((e) => roll >= e.min && roll <= e.max) ?? table[table.length - 1];
}

/**
 * Résout une Blessure critique sur `target` à la `location`. `overkill` = PB perdus au-delà des
 * PB courants (0 pour un Coup Critique sans overkill). Le Test de Résistance d'une entrée est
 * auto-résolu (RNG seedé) : sur un échec, les États `onFail` sont ajoutés à `conditions`.
 */
export function rollCritical(
  target: Combatant,
  location: HitLocation,
  rng: RNG = defaultRNG,
  overkill = 0,
): CriticalResolved {
  const be = bonus(effectiveChar(target, 'E'));
  const reduction = overkill > be ? 20 : 0; // l.30 : overkill > BE → -20 (résultat moins sévère)
  const roll = Math.max(1, d100(rng) - reduction);
  const entry = findEntry(CRITICAL_TABLES[location], roll);
  const conditions = [...(entry.conditions ?? [])];
  if (entry.resist) {
    const resistVal =
      effectiveChar(target, 'E') +
      (target.skills.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
    const res = rollTest(resistVal, entry.resist.difficulty, rng);
    if (!res.success) conditions.push(...entry.resist.onFail);
  }
  const traumas = (entry.traumas ?? []).map((t) => traumaFromKind(t.kind, t.severity, location));
  return {
    location,
    name: entry.name,
    woundsLoss: entry.wounds,
    lethal: !!entry.lethal,
    conditions,
    traumas,
    note: entry.note,
    roll,
    log: `Blessure critique (${location}) — ${entry.name}${entry.lethal ? ' — MORT !' : ''}.`,
  };
}
