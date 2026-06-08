/**
 * Résolution des Blessures critiques — Livre de base, « Traumatisme » (18-Traumatisme.md).
 * Jet 1d100 sur la table de la localisation ; -20 si l'overkill dépasse le Bonus d'Endurance
 * (l.30, min 01) ; PB perdus en ignorant BE+PA ; États appliqués + Test de Résistance auto-résolu.
 */
import { d100, d10, RNG, defaultRNG } from './dice';
import { rollTest } from './tests';
import { bonus, effectiveChar } from './characteristics';
import { hitLocationByShape } from './combat';
import { BodyShape, Combatant, Difficulty, HitLocation, Trauma } from './types';
import { CRITICAL_TABLES, CritEntry } from '../data/criticals';
import { traumaFromKind } from './trauma';

/** Difficulté de l'« Amputation (X) » d'une note de critique → palier de Difficulté (LDB 18 l.331). */
const AMPUTATION_DIFFICULTY: Record<string, Difficulty> = {
  Facile: 'facile',
  Accessible: 'accessible',
  Complexe: 'complexe',
  Difficile: 'difficile',
  'Très Difficile': 'tresDifficile',
};

/** Extrait « Amputation (Difficulté) » du texte d'un critique (verbatim LDB 18), ou `null`. L'ordre des
 *  alternatives place « Très Difficile » avant « Difficile » (sinon le sous-mot capturerait à tort). */
export function parseAmputation(note: string): Difficulty | null {
  const m = note.match(/Amputation \((Très Difficile|Difficile|Complexe|Accessible|Facile)\)/);
  return m ? AMPUTATION_DIFFICULTY[m[1]] : null;
}

/**
 * Séquelle PERMANENTE d'une amputation (LDB 18 l.335-370) — distincte de la plaie chirurgicale : elle
 * survit à la Chirurgie (le membre reste absent). On NE mécanise QUE les cas sans latéralité ni comptage :
 *  - Jambe/Pied (l.369/347) : Mouvement ÷2 + −20 aux Tests de mobilité (Esquive). À pied seulement — une
 *    monture rétablit le déplacement (`mountMovement` lit la Caractéristique de la monture).
 *  - Orteil (l.366) : −1 Agilité et −1 CC (par orteil ; un critique = un orteil).
 * Bras/main/doigt/œil/oreille/nez/langue/dents → latéralité ou comptage non modélisés : effet journalisé
 * (dans la note de la plaie chirurgicale), pas de pénalité chiffrée.
 */
export function permanentAmputation(note: string, location: HitLocation): Trauma | null {
  if (location !== 'jambeG' && location !== 'jambeD') return null;
  if (/orteil/i.test(note)) {
    return {
      label: `Orteil(s) amputé(s) (${location})`,
      location,
      charPenalty: { Ag: -1, CC: -1 },
      note: 'LDB 18 l.366 : −1 Agilité et −1 CC par orteil perdu (séquelle permanente).',
    };
  }
  return {
    label: `Membre inférieur amputé (${location})`,
    location,
    movementHalved: true,
    dodgePenalty: -20,
    note: 'LDB 18 l.369/347 : Mouvement ÷2 permanent + −20 aux Tests de mobilité (Esquive). À pied seulement — une monture rétablit le déplacement.',
  };
}

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

/** Localisation d'un Coup Critique : 1d100 lu directement sur le Tableau de Localisation de la forme
 *  du corps (humanoïde p.159 / Localisations Alternatives p.312). */
export function critLocationRoll(rng: RNG = defaultRNG, shape: BodyShape = 'humanoide'): HitLocation {
  return hitLocationByShape(d100(rng), shape);
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
  const resistVal =
    effectiveChar(target, 'E') +
    (target.skills.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
  const conditions = [...(entry.conditions ?? [])];
  if (entry.resist) {
    const res = rollTest(resistVal, entry.resist.difficulty, rng);
    if (!res.success) conditions.push(...entry.resist.onFail);
  }
  // Durée de convalescence (Jalon 5) : BE déjà calculé ; 1d10 tiré seulement pour les fractures (RAW 30+1d10)
  // afin de ne pas décaler le flux RNG des critiques sans fracture.
  const traumas = (entry.traumas ?? []).map((t) =>
    traumaFromKind(t.kind, t.severity, location, { be, d10: t.kind === 'fracture' ? d10(rng) : undefined }));
  // Amputation (LDB 18 l.328-333) : « à chaque fois qu'un critique indique Amputation (Difficulté) »,
  // Test de Résistance ou À Terre ; échec −2 DR → +Sonné ; échec −4 DR → +Inconscient. Le membre perdu
  // exige la Chirurgie (l.333/401) : trauma `needsSurgery` (opérable via le Talent Chirurgie). Roll placé
  // en DERNIER (rien ne tire après) pour ne décaler le flux RNG que des critiques d'amputation.
  const ampDiff = entry.lethal ? null : parseAmputation(entry.note);
  if (ampDiff) {
    const res = rollTest(resistVal, ampDiff, rng);
    if (!res.success) {
      conditions.push({ name: 'À Terre', value: 1 });
      if (res.sl <= -2) conditions.push({ name: 'Sonné', value: 1 });
      if (res.sl <= -4) conditions.push({ name: 'Inconscient', value: 1 });
    }
    // Plaie chirurgicale (l.333/401) : retirée par la Chirurgie ; bloque la guérison jusqu'à l'opération.
    traumas.push({
      label: `Amputation (${location})`,
      location,
      needsSurgery: true,
      note: `LDB 18 l.333/401 : ${entry.note} La Blessure ne guérit pas tant qu'un chirurgien n'a pas opéré (Talent Chirurgie).`,
    });
    // Séquelle PERMANENTE (membre absent) : survit à la Chirurgie. Mécanisée pour jambe/pied/orteil (l.335-370).
    const perm = permanentAmputation(entry.note, location);
    if (perm) traumas.push(perm);
  }
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
