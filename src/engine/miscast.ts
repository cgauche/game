/**
 * Incantations Imparfaites & Colère des dieux — Livre de base, « Les règles
 * magiques » (Tableaux des Incantations Imparfaites Mineures p.234 / Majeures
 * p.235) et « Les prières » (Tableau de la Colère des dieux p.221).
 *
 * Conception : table-driven et FIDÈLE. Le moteur tire la bonne table (d100, +10
 * par Point de Péché pour la Colère, relances « cascade » et « multiplication »),
 * puis applique UNIQUEMENT les effets que le jeu modélise réellement — États
 * nommés, Blessures ignorant le Bonus d'Endurance et les PA, réduction à 0 PV +
 * Inconscient. Tout le reste (Corruption, Pénitence, perte de Talents, invocation,
 * mutations, Traits psy…) n'est PAS inventé : son texte canonique est journalisé
 * et laissé à l'arbitrage du MJ. Les entrées dont le texte source est dégradé par
 * la conversion PDF ne portent que les effets mécaniques certains.
 */
import { RNG, defaultRNG, d100, d10, roll as rollDice } from './dice';

export type MiscastSeverity = 'mineure' | 'majeure' | 'colere';

/** Opération mécanique applicable au lanceur (le store l'exécute). */
export interface MiscastOp {
  /** Ajoute un État nommé (value points). */
  condition?: { name: string; value: number };
  /** Blessures subies (déjà tirées) — toujours en ignorant BE et PA (auto-infligées). */
  wounds?: number;
  /** Réduit les PV à 0 puis ajoute l'État Inconscient (Châtiment, Tonnerre et foudre…). */
  reduceToZero?: boolean;
}

export interface MiscastResult {
  severity: MiscastSeverity;
  /** Jet(s) effectif(s) (avec modificateur de Péché pour la Colère). */
  rolls: number[];
  /** Nom canonique de l'entrée. */
  name: string;
  /** Effets mécaniques à appliquer au lanceur. */
  ops: MiscastOp[];
  /** Ligne de journal prête à l'affichage. */
  log: string;
}

interface Row {
  min: number;
  max: number;
  name: string;
  /** Effets auto-applicables (sinon : entrée narrative, arbitrage MJ). */
  effect?: (rng: RNG, sin: number) => MiscastOp[];
  /** Relance : sur le Tableau Majeur (cascade) ou deux fois sur le Mineur (multiplication). */
  reroll?: 'majeure' | 'mineure-x2';
}

const cond = (name: string, value = 1): MiscastOp => ({ condition: { name, value } });

// --- Tableau des Incantations Imparfaites Mineures (source propre) -----------
const MINOR: Row[] = [
  { min: 1, max: 5, name: 'Signe de Sorcière' },
  { min: 6, max: 10, name: 'Lait caillé' },
  { min: 11, max: 15, name: 'Mildiou' },
  { min: 16, max: 20, name: 'Cérumen', effect: () => [cond('Assourdi')] },
  { min: 21, max: 25, name: 'Lueur occulte' },
  { min: 26, max: 30, name: 'Murmures mortels' }, // Test FM ou 1 Corruption → MJ
  { min: 31, max: 35, name: 'Rupture', effect: (rng) => [cond('Hémorragique', d10(rng))] },
  { min: 36, max: 40, name: 'Secousse spirituelle', effect: () => [cond('À Terre')] },
  { min: 41, max: 45, name: 'Délié' },
  { min: 46, max: 50, name: 'Tenue indisciplinée', effect: () => [cond('Enchevêtré')] },
  { min: 51, max: 55, name: 'Malédiction de la sobriété' },
  { min: 56, max: 60, name: "Drain de l'âme", effect: () => [cond('Exténué')] },
  { min: 61, max: 65, name: 'Distraction', effect: () => [cond('Surpris')] }, // si Engagé
  { min: 66, max: 70, name: 'Visions impies', effect: () => [cond('Aveuglé')] }, // 1er Aveuglé inconditionnel
  { min: 71, max: 75, name: 'Langue maladroite' }, // -10 Tests de Langue 1d10 Rounds → MJ
  { min: 76, max: 80, name: "L'horreur !" }, // Test Calme ou Brisé → MJ
  { min: 81, max: 85, name: 'Malédiction de corruption' }, // 1 Corruption → MJ
  { min: 86, max: 90, name: 'Double problème' },
  { min: 91, max: 95, name: "Multiplication d'infortune", reroll: 'mineure-x2' },
  { min: 96, max: 100, name: 'Chaos en cascade', reroll: 'majeure' },
];

// --- Tableau des Incantations Imparfaites Majeures ----------------------------
// (source dégradée par le PDF : seules les entrées mécaniques certaines portent un effet)
const MAJOR: Row[] = [
  { min: 1, max: 5, name: 'Voix fantomatiques' }, // Test Calme ou Corruption → MJ
  { min: 6, max: 10, name: 'Regard maudit', effect: () => [cond('Aveuglé')] },
  { min: 11, max: 15, name: 'Choc aethyrique', effect: (rng) => [{ wounds: d10(rng) }] },
  { min: 16, max: 20, name: 'Marche de la mort' },
  { min: 21, max: 25, name: 'Rébellion intestinale', effect: () => [cond('Exténué')] },
  { min: 26, max: 30, name: "Feu de l'âme", effect: () => [cond('Enflammé')] },
  { min: 31, max: 35, name: 'Propos ésotériques' }, // pas d'incantation 1d10 Rounds → MJ
  { min: 36, max: 40, name: 'Essaim' },
  { min: 41, max: 45, name: 'Poupée de chiffon', effect: (rng) => [{ wounds: d10(rng) }, cond('À Terre')] },
  { min: 46, max: 50, name: 'Membre gelé' },
  { min: 51, max: 55, name: 'Vue assombrie' },
  { min: 56, max: 60, name: 'Lévitation' },
  { min: 61, max: 65, name: 'Lévitation (suite)' },
  { min: 66, max: 70, name: 'Régurgitation', effect: () => [cond('Sonné')] },
  { min: 71, max: 75, name: 'Cœur de traître' },
  { min: 76, max: 80, name: 'Cœur de traître (suite)' },
  { min: 81, max: 85, name: 'Terrible affaiblissement', effect: () => [cond('À Terre'), cond('Exténué')] },
  { min: 86, max: 90, name: 'Puanteur infernale' },
  { min: 91, max: 95, name: 'Drain de puissance' },
  { min: 96, max: 100, name: 'Contre-réaction aethyrique' }, // affecte les autres / tête explose → MJ
];

// --- Tableau de la Colère des dieux ------------------------------------------
// (le jet peut dépasser 100 via +10 par Point de Péché ; les entrées >100 ne sont
//  atteignables qu'avec des Points de Péché, non encore modélisés.)
const WRATH: Row[] = [
  { min: 1, max: 5, name: 'Visions sacrées' }, // Test Résistance ou Sonné → MJ
  { min: 6, max: 10, name: 'Pensez à vos actes' },
  { min: 11, max: 15, name: 'Tenez compte de mes enseignements' },
  { min: 16, max: 20, name: 'Prouvez votre dévotion', effect: () => [cond('À Terre')] },
  { min: 21, max: 25, name: 'Vous abusez de ma patience' },
  { min: 26, max: 30, name: 'Vous ne comprenez pas ma volonté' },
  { min: 31, max: 35, name: 'Je trouve inquiétant votre manque de foi' },
  { min: 36, max: 40, name: 'Partagez ma douleur', effect: (_r, sin) => [{ wounds: 1 + sin }] },
  { min: 41, max: 45, name: 'Votre cause est indigne' },
  { min: 46, max: 50, name: 'Cessez vos babillages' },
  { min: 51, max: 55, name: 'Ressentez ma colère', effect: (rng, sin) => [{ wounds: d10(rng) + sin }] },
  { min: 56, max: 60, name: 'Je ne vous aiderai pas' },
  { min: 61, max: 65, name: 'Blessures divines', effect: (_r, sin) => [cond('Hémorragique', 1 + sin)] },
  { min: 66, max: 70, name: 'Frappé de cécité', effect: (_r, sin) => [cond('À Terre'), cond('Aveuglé', 1 + sin)] },
  { min: 71, max: 75, name: 'Quallez-vous sacrifier ?', effect: (rng, sin) => [{ wounds: d10(rng) + sin }] },
  { min: 76, max: 80, name: 'Vous avez péché contre moi' },
  { min: 81, max: 87, name: 'Purifier la chair', effect: (rng, sin) => [{ wounds: rollDice(2, 10, rng) + sin }] },
  { min: 88, max: 88, name: 'Interférences démoniaques' },
  { min: 89, max: 95, name: 'Redoutez ma colère', effect: (_r, sin) => [cond('Brisé', 1 + sin)] },
  { min: 96, max: 100, name: 'Faites pénitence' },
  { min: 101, max: 105, name: 'Châtiment', effect: () => [{ reduceToZero: true }] },
  { min: 106, max: 110, name: 'Ne prononcez pas mon nom en vain' },
  { min: 111, max: 115, name: 'Ne vous attachez pas aux futilités' },
  { min: 116, max: 120, name: 'Vous abusez de ma miséricorde' },
  { min: 121, max: 125, name: 'Contemplez votre cruauté' },
  { min: 126, max: 130, name: 'Tonnerre et foudre', effect: () => [{ reduceToZero: true }, cond('Enflammé')] },
  { min: 131, max: 135, name: 'Souffrez comme je souffre' },
  { min: 136, max: 140, name: 'Excommunication' },
  { min: 141, max: 145, name: 'Prouvez votre valeur' },
  { min: 146, max: 150, name: 'Je te chasse' },
  { min: 151, max: 999, name: 'Appelé à rendre des comptes' },
];

const TABLES: Record<MiscastSeverity, Row[]> = { mineure: MINOR, majeure: MAJOR, colere: WRATH };

function label(sev: MiscastSeverity): string {
  return sev === 'colere' ? 'Colère des dieux' : sev === 'majeure' ? 'Incantation Imparfaite Majeure' : 'Incantation Imparfaite Mineure';
}

function pick(table: Row[], roll: number): Row {
  return table.find((r) => roll >= r.min && roll <= r.max) ?? table[table.length - 1];
}

/**
 * Effectue un jet sur la table d'Incantation Imparfaite / Colère des dieux et
 * renvoie les effets mécaniques + un journal fidèle. `sinPoints` ajoute +10 par
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
      log: `${label(severity)} (${roll}) : ${row.name} → ${sub.log}`,
    };
  }
  // Multiplication : 91-95 Mineure → deux lancers (en relançant les 91-00).
  if (row.reroll === 'mineure-x2') {
    const ops: MiscastOp[] = [];
    const rolls: number[] = [roll];
    const names: string[] = [];
    for (let i = 0; i < 2; i++) {
      let r = d100(rng);
      while (r > 90) r = d100(rng);
      const sub = pick(MINOR, r);
      rolls.push(r);
      names.push(`${sub.name} (${r})`);
      if (sub.effect) ops.push(...sub.effect(rng, 0));
    }
    return {
      severity,
      rolls,
      name: `${row.name} : ${names.join(' + ')}`,
      ops,
      log: `${label(severity)} (${roll}) : ${row.name} → ${names.join(' + ')}`,
    };
  }

  const ops = row.effect ? row.effect(rng, sinPoints) : [];
  const applied = ops.length ? ` [appliqué]` : ` [arbitrage MJ]`;
  return {
    severity,
    rolls: [roll],
    name: row.name,
    ops,
    log: `${label(severity)} (${roll}) : ${row.name}${applied}`,
  };
}
