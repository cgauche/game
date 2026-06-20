/**
 * Incantations Imparfaites & Colère des dieux — Livre de base, « Les règles
 * magiques » (Tableaux des Incantations Imparfaites Mineures p.234 / Majeures
 * p.235, LDB 46 l.61-136) et « Les prières » (Tableau de la Colère des dieux
 * p.221, LDB 40 l.58-138).
 *
 * Conception : table-driven et FIDÈLE. Le moteur tire la bonne table (d100, +10
 * par Point de Péché pour la Colère, relances « cascade » et « multiplication »),
 * puis émet des `GameOp` (engine/ops) — États nommés, Blessures ignorant BE+PA,
 * Points de Corruption, pénalités/blocages d'incantation temporisés, réduction à 0
 * PB + Inconscient — et, pour les entrées « Résistance ou Sonné », un nœud de Flow
 * `test` (`engine/flowKit`, type partagé avec la couche state) résolu CADENCE-AWARE
 * par `applyMiscast`→`runCombatFlow` (héros manuel = jet INFLUENÇABLE ; ennemi =
 * inline) — plus de jet imbriqué silencieux, plus d'op `test`. Tout le reste
 * (Pénitence, perte de Talents, invocation, lévitation…) n'est PAS inventé : son
 * texte canonique est journalisé et laissé à l'arbitrage du MJ.
 */
import { RNG, defaultRNG, d100 } from './dice';
import { findTableEntry } from './tables';
import { GameOp } from './ops';
import { Difficulty } from './types';
// Type-only (effacé à la compilation, comme `domainAttributes`/`ops` importent déjà `TriggeredEffect`) :
// le nœud de Test imbriqué d'une entrée de table EST un nœud de Flow `test` — la STRUCTURE de logique
// partagée du jeu (state/flow), exécutée cadence-aware par `runCombatFlow`. AUCUNE dépendance runtime au
// store : les tables restent du moteur pur (`rollMiscast` testable seul).
import type { Flow } from '../state/flow';

export type MiscastSeverity = 'mineure' | 'majeure' | 'colere';

export interface MiscastResult {
  severity: MiscastSeverity;
  /** Jet(s) effectif(s) (avec modificateur de Péché pour la Colère). */
  rolls: number[];
  /** Nom canonique de l'entrée. */
  name: string;
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
  characteristic?: 'FM';
  difficulty: Difficulty;
  /** Ops appliqués au lanceur sur un ÉCHEC du Test (« ou Sonné »). */
  onFail: GameOp[];
  /** Palier d'échec aggravé (Purifier la chair LDB 40 l.99-101 : « si vous échouez avec −4 DR ou moins
   *  → 1 État Inconscient ») — appliqué EN PLUS d'`onFail` via une Condition Flow `slThreshold ≤ dr`. */
  onFailHard?: { dr: number; ops: GameOp[] };
}

interface Row {
  min: number;
  max: number;
  name: string;
  /** Ops IMMÉDIATS auto-applicables, closés sur les Points de Péché (sinon : entrée narrative, MJ). */
  ops?: (sin: number) => GameOp[];
  /** Test imbriqué de l'entrée (« … ou Sonné »), résolu cadence-aware. */
  test?: NestedTest;
  /** Relance : sur le Tableau Majeur (cascade) ou deux fois sur le Mineur (multiplication). */
  reroll?: 'majeure' | 'mineure-x2';
}

const cond = (name: string, value: number | { dice: { n: number; sides: number; plus?: number } } = 1): GameOp =>
  ({ op: 'condition', name, value });
const d = (n: number, sides: number, plus = 0) => ({ dice: { n, sides, plus } });

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

// --- Tableau des Incantations Imparfaites Mineures (LDB 46 l.61-92) ----------
const MINOR: Row[] = [
  { min: 1, max: 5, name: 'Signe de Sorcière' },
  { min: 6, max: 10, name: 'Lait caillé' },
  { min: 11, max: 15, name: 'Mildiou' },
  // « Gagnez 1 État Assourdi, qui ne peut être retiré [que par] Guérison » (l.66).
  { min: 16, max: 20, name: 'Cérumen', ops: () => [cond('assourdi')] },
  { min: 21, max: 25, name: 'Lueur occulte' },
  // « Réussissez un Test de FM Accessible (+20) ou gagnez 1 Point de Corruption » (l.70).
  { min: 26, max: 30, name: 'Murmures mortels', test: { characteristic: 'FM', difficulty: 'accessible', onFail: [{ op: 'corruption', amount: 1 }] } },
  // « Gagnez 1d10 États Hémorragique » (l.71).
  { min: 31, max: 35, name: 'Rupture', ops: () => [cond('hemorragique', d(1, 10))] },
  { min: 36, max: 40, name: 'Secousse spirituelle', ops: () => [cond('a-terre')] },
  { min: 41, max: 45, name: 'Délié' },
  { min: 46, max: 50, name: 'Tenue indisciplinée', ops: () => [cond('Enchevêtré')] },
  { min: 51, max: 55, name: 'Malédiction de la sobriété' },
  { min: 56, max: 60, name: "Drain de l'âme", ops: () => [cond('extenue')] },
  { min: 61, max: 65, name: 'Distraction', ops: () => [cond('surpris')] }, // si Engagé
  // « Recevez l'État Aveuglé ; réussissez un Test de Calme Intermédiaire (+0) ou gagnez-en un autre » (l.83).
  { min: 66, max: 70, name: 'Visions impies', ops: () => [cond('aveugle')], test: { skill: 'calme', difficulty: 'intermediaire', onFail: [cond('aveugle')] } },
  // « Tous les Tests de Langue (y compris d'Incantation) subissent −10 pendant 1d10 Rounds » (l.85).
  { min: 71, max: 75, name: 'Langue maladroite', ops: () => [{ op: 'castPenalty', skill: 'langue', mod: -10, rounds: d(1, 10) }] },
  // « Réussissez un Test de Calme Difficile (−20) ou gagnez 1 État Brisé » (l.86).
  { min: 76, max: 80, name: "L'horreur !", test: { skill: 'calme', difficulty: 'difficile', onFail: [cond('brise')] } },
  // « Gagnez 1 Point de Corruption » (l.87).
  { min: 81, max: 85, name: 'Malédiction de corruption', ops: () => [{ op: 'corruption', amount: 1 }] },
  { min: 86, max: 90, name: 'Double problème' },
  { min: 91, max: 95, name: "Multiplication d'infortune", reroll: 'mineure-x2' },
  { min: 96, max: 100, name: 'Chaos en cascade', reroll: 'majeure' },
];

// --- Tableau des Incantations Imparfaites Majeures (LDB 46 l.96-136) ----------
const MAJOR: Row[] = [
  // « Test de Calme Accessible (+20) ou 1 Point de Corruption » (l.100).
  { min: 1, max: 5, name: 'Voix fantomatiques', test: { skill: 'calme', difficulty: 'accessible', onFail: [{ op: 'corruption', amount: 1 }] } },
  { min: 6, max: 10, name: 'Regard maudit', ops: () => [cond('aveugle')] },
  // « 1d10 Blessures ignorant BE et PA. Résistance Accessible (+20) ou 1 État Sonné » (l.104).
  { min: 11, max: 15, name: 'Choc aethyrique', ops: () => [{ op: 'wounds', amount: d(1, 10) }], test: { skill: 'resistance', difficulty: 'accessible', onFail: [cond('sonne')] } },
  { min: 16, max: 20, name: 'Marche de la mort' },
  { min: 21, max: 25, name: 'Rébellion intestinale', ops: () => [cond('extenue')] },
  { min: 26, max: 30, name: "Feu de l'âme", ops: () => [cond('Enflammé')] },
  // « Vous ne pouvez pas effectuer de Test d'Incantation [pendant] 1d10 Rounds » (l.112).
  { min: 31, max: 35, name: 'Propos ésotériques', ops: () => [{ op: 'castPenalty', skill: 'langue', blocked: true, rounds: d(1, 10) }] },
  { min: 36, max: 40, name: 'Essaim' },
  { min: 41, max: 45, name: 'Poupée de chiffon', ops: () => [{ op: 'wounds', amount: d(1, 10) }, cond('a-terre')] },
  { min: 46, max: 50, name: 'Membre gelé' },
  // « Les Tests de Focalisation subissent −20 pour la durée de l'effet [1d10 heures] » (l.120).
  { min: 51, max: 55, name: 'Vue assombrie', ops: () => [{ op: 'castPenalty', skill: 'focalisation', mod: -20, hours: d(1, 10) }] },
  { min: 56, max: 60, name: 'Lévitation' },
  { min: 61, max: 65, name: 'Lévitation (suite)' },
  // « Gagnez l'État Sonné, qui dure 1d10 Rounds » (l.126).
  { min: 66, max: 70, name: 'Régurgitation', ops: () => [{ op: 'condition', name: 'sonne', durationRounds: d(1, 10) }] },
  { min: 71, max: 75, name: 'Cœur de traître' },
  { min: 76, max: 80, name: 'Cœur de traître (suite)' },
  // « Gagnez 1 Point de Corruption, 1 État À Terre et 1 État Exténué » (l.132).
  { min: 81, max: 85, name: 'Terrible affaiblissement', ops: () => [{ op: 'corruption', amount: 1 }, cond('a-terre'), cond('extenue')] },
  { min: 86, max: 90, name: 'Puanteur infernale' },
  // « Incapable d'utiliser le Talent vous permettant de lancer des Sorts pendant 1d10 minutes » (l.134).
  { min: 91, max: 95, name: 'Drain de puissance', ops: () => [{ op: 'castPenalty', skill: 'langue', blocked: true, minutes: d(1, 10) }] },
  { min: 96, max: 100, name: 'Contre-réaction aethyrique' }, // affecte les autres / tête explose → MJ
];

// --- Tableau de la Colère des dieux (LDB 40 l.58-138) -------------------------
// (le jet peut dépasser 100 via +10 par Point de Péché.)
const WRATH: Row[] = [
  // « Résistance Accessible (+20). Sur un échec, 1 État Sonné » (l.60).
  { min: 1, max: 5, name: 'Visions sacrées', test: { skill: 'resistance', difficulty: 'accessible', onFail: [cond('sonne')] } },
  // « Tout Test de Prière réussi ne peut pas obtenir plus de 0 DR pour la semaine suivante » (l.63).
  { min: 6, max: 10, name: 'Pensez à vos actes', ops: () => [{ op: 'castPenalty', skill: 'priere', maxZeroDR: true, days: 7 }] },
  // « −10 à votre Compétence Prière pour les 1d10 + Péchés prochains Rounds » (l.64).
  { min: 11, max: 15, name: 'Tenez compte de mes enseignements', ops: (sin) => [{ op: 'castPenalty', skill: 'priere', mod: -10, rounds: d(1, 10, sin) }] },
  { min: 16, max: 20, name: 'Prouvez votre dévotion', ops: () => [cond('a-terre')] },
  // « Vous ne pouvez pas effectuer de Tests de Prière pendant 1d10 Rounds » (l.68).
  { min: 21, max: 25, name: 'Vous abusez de ma patience', ops: () => [{ op: 'castPenalty', skill: 'priere', blocked: true, rounds: d(1, 10) }] },
  { min: 26, max: 30, name: 'Vous ne comprenez pas ma volonté' }, // compétences choisies par le MJ
  // « Pas de Tests de Prière pendant 1d10 + Péchés Rounds » (l.72).
  { min: 31, max: 35, name: 'Je trouve inquiétant votre manque de foi', ops: (sin) => [{ op: 'castPenalty', skill: 'priere', blocked: true, rounds: d(1, 10, sin) }] },
  // « 1 + Péchés Blessures ignorant BE et PA. Résistance Accessible (+20) ou Sonné » (l.75).
  { min: 36, max: 40, name: 'Partagez ma douleur', ops: (sin) => [{ op: 'wounds', amount: 1 + sin }], test: { skill: 'resistance', difficulty: 'accessible', onFail: [cond('sonne')] } },
  { min: 41, max: 45, name: 'Votre cause est indigne' },
  // « Pas de Tests de Prière pendant 2d10 + Péchés Rounds » (l.79).
  { min: 46, max: 50, name: 'Cessez vos babillages', ops: (sin) => [{ op: 'castPenalty', skill: 'priere', blocked: true, rounds: d(2, 10, sin) }] },
  // « 1d10 + Péchés Blessures. Résistance Intermédiaire (+0) ou Sonné » (l.86).
  { min: 51, max: 55, name: 'Ressentez ma colère', ops: (sin) => [{ op: 'wounds', amount: d(1, 10, sin) }], test: { skill: 'resistance', difficulty: 'intermediaire', onFail: [cond('sonne')] } },
  { min: 56, max: 60, name: 'Je ne vous aiderai pas' }, // compétence choisie par le MJ
  { min: 61, max: 65, name: 'Blessures divines', ops: (sin) => [cond('hemorragique', 1 + sin)] },
  { min: 66, max: 70, name: 'Frappé de cécité', ops: (sin) => [cond('a-terre'), cond('aveugle', 1 + sin)] },
  // « 1d10 + Péchés Blessures ignorant BE/PA. Résistance Complexe (−10) ou Sonné » (l.95).
  { min: 71, max: 75, name: "Qu'allez-vous sacrifier ?", ops: (sin) => [{ op: 'wounds', amount: d(1, 10, sin) }], test: { skill: 'resistance', difficulty: 'complexe', onFail: [cond('sonne')] } },
  { min: 76, max: 80, name: 'Vous avez péché contre moi' }, // Tests de Prière forcés → MJ
  // « 2d10 + Péchés Blessures ignorant BE/PA. Résistance Difficile (−20) ou Sonné ;
  //   échec à −4 DR ou moins → 1 État Inconscient (min 1d10 Rounds) » (l.99-101).
  { min: 81, max: 87, name: 'Purifier la chair', ops: (sin) => [{ op: 'wounds', amount: d(2, 10, sin) }], test: { skill: 'resistance', difficulty: 'difficile', onFail: [cond('sonne')], onFailHard: { dr: -4, ops: [cond('inconscient')] } } },
  { min: 88, max: 88, name: 'Interférences démoniaques' },
  { min: 89, max: 95, name: 'Redoutez ma colère', ops: (sin) => [cond('brise', 1 + sin)] },
  { min: 96, max: 100, name: 'Faites pénitence' },
  { min: 101, max: 105, name: 'Châtiment', ops: () => [{ op: 'reduceToZero' }] },
  { min: 106, max: 110, name: 'Ne prononcez pas mon nom en vain' }, // perte de Talents 1d10+Péchés jours → MJ
  { min: 111, max: 115, name: 'Ne vous attachez pas aux futilités' },
  { min: 116, max: 120, name: 'Vous abusez de ma miséricorde' },
  { min: 121, max: 125, name: 'Contemplez votre cruauté' },
  { min: 126, max: 130, name: 'Tonnerre et foudre', ops: () => [{ op: 'reduceToZero' }, cond('Enflammé')] },
  { min: 131, max: 135, name: 'Souffrez comme je souffre' },
  { min: 136, max: 140, name: 'Excommunication' },
  { min: 141, max: 145, name: 'Prouvez votre valeur' },
  { min: 146, max: 150, name: 'Je te chasse' },
  { min: 151, max: 999, name: 'Appelé à rendre des comptes' },
];

const TABLES: Record<MiscastSeverity, Row[]> = { mineure: MINOR, majeure: MAJOR, colere: WRATH };

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
      name: `${row.name} → ${sub.name}`,
      ops: sub.ops,
      ...(sub.testFlow ? { testFlow: sub.testFlow } : {}),
      log: `${label(severity)} (${roll}) : ${row.name} → ${sub.log}`,
    };
  }
  // Multiplication : 91-95 Mineure → deux lancers (en relançant les 91-00).
  if (row.reroll === 'mineure-x2') {
    const ops: GameOp[] = [];
    const tests: Flow[] = [];
    const rolls: number[] = [roll];
    const names: string[] = [];
    for (let i = 0; i < 2; i++) {
      let r = d100(rng);
      while (r > 90) r = d100(rng);
      const sub = pick(MINOR, r);
      rolls.push(r);
      names.push(`${sub.name} (${r})`);
      if (sub.ops) ops.push(...sub.ops(0));
      if (sub.test) tests.push(mkTest(sub.test));
    }
    return {
      severity,
      rolls,
      name: `${row.name} : ${names.join(' + ')}`,
      ops,
      // Deux Tests imbriqués éventuels → un `seq` joué cadence-aware en séquence (le 2ᵉ après le 1ᵉʳ).
      ...(tests.length ? { testFlow: tests.length === 1 ? tests[0] : { kind: 'seq', steps: tests } } : {}),
      log: `${label(severity)} (${roll}) : ${row.name} → ${names.join(' + ')}`,
    };
  }

  const ops = row.ops ? row.ops(sinPoints) : [];
  const testFlow = row.test ? mkTest(row.test) : undefined;
  const applied = ops.length || testFlow ? ` [appliqué]` : ` [arbitrage MJ]`;
  return {
    severity,
    rolls: [roll],
    name: row.name,
    ops,
    ...(testFlow ? { testFlow } : {}),
    log: `${label(severity)} (${roll}) : ${row.name}${applied}`,
  };
}
