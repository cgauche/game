/**
 * Incantations Imparfaites & Colère des dieux — Livre de base, « Les règles
 * magiques » (Tableaux des Incantations Imparfaites Mineures p.234 / Majeures
 * p.235, LDB 46 l.61-136) et « Les prières » (Tableau de la Colère des dieux
 * p.221, LDB 40 l.55-89).
 *
 * Conception : table-driven et FIDÈLE. Le moteur tire la bonne table (d100, +10
 * par Point de Péché pour la Colère, relances « cascade » et « multiplication »),
 * puis émet des `GameOp` (engine/ops) — États nommés, Blessures ignorant BE+PA,
 * Points de Corruption, pénalités/blocages d'incantation temporisés, réduction à 0
 * PB + Inconscient — et, pour les entrées « Résistance ou Sonné », un nœud de Flow
 * `test` (`engine/flowCore`, noyau pur partagé avec la couche state) résolu CADENCE-AWARE
 * par `applyMiscast`→`runCombatFlow` (héros manuel = jet INFLUENÇABLE ; ennemi =
 * inline) — plus de jet imbriqué silencieux, plus d'op `test`. Tout le reste
 * (Pénitence, perte de Talents, invocation, lévitation…) n'est PAS inventé : son
 * texte canonique est journalisé et laissé à l'arbitrage du MJ.
 *
 * La DONNÉE vit dans `src/data/miscast.json` (éditable) ; ce module = types +
 * chargement + résolution. Ajouter/régler une entrée = éditer le JSON, jamais ce fichier.
 */
import { RNG, defaultRNG, d100, type DiceSpec } from './dice';
import { findTableEntry } from './tables';
import { GameOp, Formula } from './ops';
import { Difficulty } from './types';
// Type-only (effacé à la compilation, comme `domainAttributes`/`ops` importent déjà `TriggeredEffect`) :
// le nœud de Test imbriqué d'une entrée de table EST un nœud de Flow `test` — la STRUCTURE de logique
// partagée du jeu (noyau engine `flowCore`, feuille EffectOp), exécutée cadence-aware par `runCombatFlow`.
// AUCUNE dépendance runtime au store : les tables restent du moteur pur (`rollMiscast` testable seul).
import type { Flow } from './flowCore';
import miscastJson from '../data/miscast.json';

export type MiscastSeverity = 'mineure' | 'majeure' | 'colere';

export interface MiscastResult {
  severity: MiscastSeverity;
  /** Jet(s) effectif(s) (avec modificateur de Péché pour la Colère). */
  rolls: number[];
  /** Nom canonique de l'entrée. */
  label: string;
  /** Effets mécaniques IMMÉDIATS à appliquer au lanceur (applyOps) — Blessures/États/Corruption/
   *  pénalités. Le Test imbriqué éventuel vit dans `testFlow` (résolu cadence-aware, pas en silence). */
  ops: GameOp[];
  /** Nœud de Flow `test` imbriqué de l'entrée (« Résistance Accessible ou Sonné »), résolu CADENCE-AWARE
   *  par `applyMiscast`→`runCombatFlow` APRÈS les `ops` immédiats. Absent si l'entrée n'a pas de Test. */
  testFlow?: Flow;
  /** Ligne de journal prête à l'affichage. */
  log: string;
}

/** Spécification d'un Test imbriqué d'une entrée de table (« Résistance Accessible (+20) ou Sonné » ;
 *  « échec à −4 DR ou moins → Inconscient EN PLUS »). Transformée en nœud de Flow `test` par `mkTest`. */
interface NestedTest {
  skill?: string;
  characteristic?: 'force-mentale';
  difficulty: Difficulty;
  /** Ops appliqués au lanceur sur un ÉCHEC du Test (« ou Sonné »). */
  onFail: GameOp[];
  /** Palier d'échec aggravé (Purifier la chair LDB 40 l.99-101 : « si vous échouez avec −4 DR ou moins
   *  → 1 État Inconscient ») — appliqué EN PLUS d'`onFail` via une Condition Flow `slThreshold ≤ dr`. */
  onFailHard?: { dr: number; ops: GameOp[] };
}

// ---------------------------------------------------------------------------
// JSON data types — supersets of GameOp/Formula that encode sin-parameterisation
// ---------------------------------------------------------------------------

/**
 * Dice descriptor as it appears in the JSON. Extends the engine's `{ n, sides, plus? }` shape
 * with an optional `sinPlus` flag: when `true`, the resolved `plus` is the caller's `sinPoints`
 * value (`{ n:1, sides:10, sinPlus:true }` in JSON).
 */
interface JsonDice extends DiceSpec {
  /** When true, `plus` = sinPoints at resolution time (replaces the old closure `d(n,s,sin)`). */
  sinPlus?: boolean;
}

/**
 * Formula as it appears in the JSON.  A plain number stays a plain number; a dice descriptor
 * uses `JsonDice` (with optional `sinPlus`); `{ sinPlus1: true }` encodes the pattern `1 + sin`.
 */
type JsonFormula =
  | number
  | { dice: JsonDice }
  | { sinPlus1: true };

/**
 * A single GameOp as stored in the JSON.  Mirrors the runtime `GameOp` union but with
 * `JsonFormula` in place of `Formula`, and two extra optional fields:
 * - `sinPlus1Value`: when true the `value` of a `condition` op is `1 + sinPoints` at runtime.
 * - `durationRounds`: a `JsonFormula` for the `durationRounds` field of a timed-condition op
 *   (old inline: `{ op:'condition', id:'sonne', durationRounds: d(1,10) }`).
 */
type JsonOp = {
  op: string;
  // condition
  id?: string;
  value?: JsonFormula;
  durationRounds?: JsonFormula;
  /** When true the condition `value` is `1 + sinPoints` (cannot be expressed as a plain Formula). */
  sinPlus1Value?: boolean;
  /** `GameOp['condition'].escapeStrength` (Empêtré : force de désengagement, ex. Tenue indisciplinée
   *  LDB 46) — déjà une `Formula` runtime valide, jamais sin-paramétrée : copiée telle quelle. */
  escapeStrength?: Formula;
  // wounds / corruption
  amount?: JsonFormula;
  /** Mitigation déclarée du `wounds` (LDB 46 / LDB 40) — recopiée telle quelle dans le `GameOp`. */
  ignoreTB?: boolean;
  ignoreAP?: boolean;
  // castPenalty
  skill?: string;
  mod?: number;
  blocked?: boolean;
  maxZeroDR?: boolean;
  rounds?: JsonFormula;
  hours?: JsonFormula;
  minutes?: JsonFormula;
  days?: number;
};

/** Spec of a nested test as stored in the JSON (same shape as NestedTest but with JsonOp[]). */
interface JsonNestedTest {
  skill?: string;
  characteristic?: string;
  difficulty: string;
  onFail: JsonOp[];
  onFailHard?: { dr: number; ops: JsonOp[] };
}

/** A table row as stored in the JSON. `id` (#422, Codex exposure) is display/navigation identity —
 *  never read by this module. */
interface JsonRow {
  id: string;
  min: number;
  max: number;
  label: string;
  ops?: JsonOp[];
  test?: JsonNestedTest;
  reroll?: 'majeure' | 'mineure-x2';
}

// ---------------------------------------------------------------------------
// JSON → runtime resolution
// ---------------------------------------------------------------------------

/** Resolve a `JsonFormula` to a runtime `Formula` (engine/ops), substituting sinPoints where flagged. */
function resolveJsonFormula(f: JsonFormula, sin: number): unknown {
  if (typeof f === 'number') return f;
  if ('sinPlus1' in f) return 1 + sin;
  // dice descriptor — sinPlus replaces the `plus` field with the current sinPoints
  const { n, sides, sinPlus } = f.dice;
  return sinPlus ? { dice: { n, sides, plus: sin } } : { dice: { n, sides } };
}

/**
 * Expand a single `JsonOp` into a runtime `GameOp`, binding `sinPoints` for all
 * sin-parameterised fields. This is the ONLY place where sin enters the ops pipeline.
 */
function expandOp(op: JsonOp, sin: number): GameOp {
  switch (op.op) {
    case 'condition': {
      // sinPlus1Value → value = 1 + sin; plain value → resolve formula; absent → omit (e.g. durationRounds-only op)
      const base: Record<string, unknown> = { op: 'condition', id: op.id };
      if (op.sinPlus1Value) {
        base.value = 1 + sin;
      } else if (op.value !== undefined) {
        base.value = resolveJsonFormula(op.value, sin);
      }
      if (op.durationRounds !== undefined) {
        base.durationRounds = resolveJsonFormula(op.durationRounds, sin);
      }
      if (op.escapeStrength !== undefined) {
        base.escapeStrength = op.escapeStrength;
      }
      return base as unknown as GameOp;
    }
    case 'wounds':
      return {
        op: 'wounds', amount: resolveJsonFormula(op.amount!, sin),
        ...(op.ignoreTB !== undefined ? { ignoreTB: op.ignoreTB } : {}),
        ...(op.ignoreAP !== undefined ? { ignoreAP: op.ignoreAP } : {}),
      } as unknown as GameOp;
    case 'corruption':
      return { op: 'corruption', amount: op.amount as number } as unknown as GameOp;
    case 'reduceToZero':
      return { op: 'reduceToZero' } as unknown as GameOp;
    case 'castPenalty': {
      const base: Record<string, unknown> = { op: 'castPenalty', skill: op.skill };
      if (op.mod !== undefined) base.mod = op.mod;
      if (op.blocked) base.blocked = true;
      if (op.maxZeroDR) base.maxZeroDR = true;
      if (op.rounds !== undefined) base.rounds = resolveJsonFormula(op.rounds, sin);
      if (op.hours !== undefined) base.hours = resolveJsonFormula(op.hours, sin);
      if (op.minutes !== undefined) base.minutes = resolveJsonFormula(op.minutes, sin);
      if (op.days !== undefined) base.days = op.days;
      return base as unknown as GameOp;
    }
    default:
      return op as unknown as GameOp;
  }
}

/** Expand a `JsonOp[]` into `GameOp[]`, substituting sinPoints. */
function expandOps(jsonOps: JsonOp[], sin: number): GameOp[] {
  return jsonOps.map((o) => expandOp(o, sin));
}

/** Expand a `JsonNestedTest` into a runtime `NestedTest`, binding sinPoints (tests never use sin directly). */
function expandNestedTest(t: JsonNestedTest): NestedTest {
  const result: NestedTest = {
    ...(t.skill ? { skill: t.skill } : {}),
    ...(t.characteristic ? { characteristic: t.characteristic as 'force-mentale' } : {}),
    difficulty: t.difficulty as Difficulty,
    onFail: expandOps(t.onFail, 0), // test onFail ops never reference sin
  };
  if (t.onFailHard) {
    result.onFailHard = { dr: t.onFailHard.dr, ops: expandOps(t.onFailHard.ops, 0) };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Runtime Row type (after JSON expansion)
// ---------------------------------------------------------------------------

interface Row {
  min: number;
  max: number;
  label: string;
  /** Ops IMMÉDIATS auto-applicables, closés sur les Points de Péché (sinon : entrée narrative, MJ). */
  ops?: (sin: number) => GameOp[];
  /** Test imbriqué de l'entrée (« … ou Sonné »), résolu cadence-aware. */
  test?: NestedTest;
  /** Relance : sur le Tableau Majeur (cascade) ou deux fois sur le Mineur (multiplication). */
  reroll?: 'majeure' | 'mineure-x2';
}

/** Build a runtime `Row` from a `JsonRow`. */
function buildRow(jr: JsonRow): Row {
  const row: Row = { min: jr.min, max: jr.max, label: jr.label };
  if (jr.reroll) row.reroll = jr.reroll;
  if (jr.ops && jr.ops.length > 0) {
    const jsonOps = jr.ops;
    row.ops = (sin: number) => expandOps(jsonOps, sin);
  }
  if (jr.test) {
    row.test = expandNestedTest(jr.test);
  }
  return row;
}

// ---------------------------------------------------------------------------
// Tables built from JSON at module load time
// ---------------------------------------------------------------------------

const data = miscastJson as { minor: JsonRow[]; major: JsonRow[]; wrath: JsonRow[] };

const MINOR: Row[] = data.minor.map(buildRow);
const MAJOR: Row[] = data.major.map(buildRow);
const WRATH: Row[] = data.wrath.map(buildRow);

const TABLES: Record<MiscastSeverity, Row[]> = { mineure: MINOR, majeure: MAJOR, colere: WRATH };

// ---------------------------------------------------------------------------
// mkTest — unchanged resolution code (factory, not data)
// ---------------------------------------------------------------------------

/** Enveloppe une liste de GameOps en une feuille de Flow `do` appliquée au lanceur (`on:'target'` =
 *  le combattant qui subit la maladresse — c'est lui la « cible » du sous-Flow joué par `applyMiscast`). */
const doOps = (ops: GameOp[]): Flow => ({ kind: 'do', effect: { type: 'ops', on: 'target', ops } });

/** Construit le nœud de Flow `test` d'une entrée (« Test de X Difficulté ou onFail » ; palier
 *  `onFailHard` via Condition Flow `slThreshold ≤ dr` dans la branche d'échec — comme Lot 4b). La
 *  branche `success` est vide (le Test réussi = aucun effet). */
function mkTest(t: NestedTest): Flow {
  const fail: Flow = t.onFailHard
    ? {
        kind: 'seq',
        steps: [
          doOps(t.onFail),
          { kind: 'if', cond: { kind: 'slThreshold', op: '<=', value: t.onFailHard.dr }, then: doOps(t.onFailHard.ops) },
        ],
      }
    : doOps(t.onFail);
  return {
    kind: 'test',
    test: { ...(t.skill ? { skill: t.skill } : {}), ...(t.characteristic ? { characteristic: t.characteristic } : {}), difficulty: t.difficulty },
    success: { kind: 'seq', steps: [] },
    fail,
  };
}

// ---------------------------------------------------------------------------
// Public API — unchanged signatures
// ---------------------------------------------------------------------------

/**
 * Composant d'incantation (LDB 46 l.161, règle optionnelle) — transformation PURE de la sévérité
 * d'une Incantation Imparfaite quand le lanceur a sacrifié un composant adapté au Sort :
 * « toute Incantation Imparfaite Majeure devient Mineure, et aucune Incantation Imparfaite Mineure
 * n'a d'effet ». `null` = annulée (aucun effet). N'affecte PAS la Colère des dieux (l.163 : les
 * composants ne concernent que les Sorts d'Arcane et de Domaine, pas les Prières).
 */
export function componentDowngrade(severity: MiscastSeverity): MiscastSeverity | null {
  if (severity === 'majeure') return 'mineure'; // Majeure → Mineure
  if (severity === 'mineure') return null; // Mineure → aucun effet
  return severity; // Colère : hors périmètre des composants (RAW)
}

function label(sev: MiscastSeverity): string {
  return sev === 'colere' ? 'Colère des dieux' : sev === 'majeure' ? 'Incantation Imparfaite Majeure' : 'Incantation Imparfaite Mineure';
}

function pick(table: Row[], roll: number): Row {
  return findTableEntry(table, roll);
}

/**
 * Effectue un jet sur la table d'Incantation Imparfaite / Colère des dieux et
 * renvoie les ops mécaniques + un journal fidèle. `sinPoints` ajoute +10 par
 * point au jet de Colère (Livre de base, Péché et Colère Divine).
 */
export function rollMiscast(severity: MiscastSeverity, rng: RNG = defaultRNG, sinPoints = 0): MiscastResult {
  const table = TABLES[severity];
  const base = d100(rng);
  const roll = severity === 'colere' ? base + sinPoints * 10 : base;
  const row = pick(table, roll);

  // Cascade : 96-00 Mineure → relance sur la table Majeure.
  if (row.reroll === 'majeure') {
    const sub = rollMiscast('majeure', rng, 0);
    return {
      severity,
      rolls: [roll, ...sub.rolls],
      label: `${row.label} → ${sub.label}`,
      ops: sub.ops,
      ...(sub.testFlow ? { testFlow: sub.testFlow } : {}),
      log: `${label(severity)} (${roll}) : ${row.label} → ${sub.log}`,
    };
  }
  // Multiplication : 91-95 Mineure → deux lancers (en relançant les 91-00).
  if (row.reroll === 'mineure-x2') {
    const ops: GameOp[] = [];
    const tests: Flow[] = [];
    const rolls: number[] = [roll];
    const labels: string[] = [];
    for (let i = 0; i < 2; i++) {
      let r = d100(rng);
      while (r > 90) r = d100(rng);
      const sub = pick(MINOR, r);
      rolls.push(r);
      labels.push(`${sub.label} (${r})`);
      if (sub.ops) ops.push(...sub.ops(0));
      if (sub.test) tests.push(mkTest(sub.test));
    }
    return {
      severity,
      rolls,
      label: `${row.label} : ${labels.join(' + ')}`,
      ops,
      // Deux Tests imbriqués éventuels → un `seq` joué cadence-aware en séquence (le 2ᵉ après le 1ᵉʳ).
      ...(tests.length ? { testFlow: tests.length === 1 ? tests[0] : { kind: 'seq', steps: tests } } : {}),
      log: `${label(severity)} (${roll}) : ${row.label} → ${labels.join(' + ')}`,
    };
  }

  const ops = row.ops ? row.ops(sinPoints) : [];
  const testFlow = row.test ? mkTest(row.test) : undefined;
  const applied = ops.length || testFlow ? ` [appliqué]` : ` [arbitrage MJ]`;
  return {
    severity,
    rolls: [roll],
    label: row.label,
    ops,
    ...(testFlow ? { testFlow } : {}),
    log: `${label(severity)} (${roll}) : ${row.label}${applied}`,
  };
}
