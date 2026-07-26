/**
 * Jeux de taverne (Nuits agitées & dures journées, ch.16 « Jeux de Taverne ») — MOTEUR GÉNÉRIQUE
 * data-driven : un jeu = une entrée de `tavernGames.json` (Compétence/carac du jeu, mode de résolution,
 * plafond de DR, variante de lecture, mise), sa règle recopiée VERBATIM. La résolution suit l'« OPTION :
 * JEUX DE TAVERNE RAPIDES » (ch.16 l.9-11) : « effectuez un Test opposé de Compétence Intermédiaire (+0)
 * en utilisant la Compétence indiquée dans la section "Jeu" du jeu en question. Si aucune Compétence
 * n'est indiquée […] faites plutôt un Test opposé de Pari Intermédiaire (+0). Celui qui obtient le nombre
 * le plus élevé de DR remporte la partie. » Le Bras de fer (l.34) est un Test opposé ÉTENDU (premier à
 * 10 DR cumulés). Moteur PUR (RNG seedable) : les valeurs de Compétence sont calculées par l'appelant.
 */
import { RNG, defaultRNG } from './dice';
import { rollTest, resolveOpposed, TestResult } from './tests';
import { Difficulty, CharKey } from './types';
import tavernGamesJson from '../data/tavernGames.json';

export interface TavernGame {
  id: string;
  label: string;
  /** Règle du jeu recopiée VERBATIM (section « Jeu : » du livre). */
  desc: string;
  /** `id` de la Compétence du jeu (skills.json) — l'appelant calcule la valeur. `null` = aucune Compétence
   *  indiquée → Pari (variante rapide, l.11). */
  skill: string | null;
  /** Spécialisation de la Compétence (« Lancer », « Art de la Guerre »…). */
  spec?: string;
  /** Caractéristique du jeu quand il ne repose pas (ou pas seulement) sur une Compétence (Bras de fer = F,
   *  Bête = CT, Alvatafl/Cerevis = Int/I). Sert à l'appelant pour calculer la valeur. */
  characteristic?: CharKey;
  /** Mode : `opposed` (un Test opposé, +DR l'emporte — variante rapide) ou `extended` (Test opposé étendu
   *  jusqu'à `target` DR cumulés — Bras de fer, l.34). */
  mode: 'opposed' | 'extended';
  /** Test étendu : DR cumulés à atteindre (Bras de fer = 10). */
  target?: number;
  /** Plafond de DR d'une manche (Boules = 6 DR). */
  drCap?: number;
  /** Variante de lecture du score (Fléchettes = unités/dizaines/×10) — documentaire ; le moteur rapide lit
   *  le DR (l.11). */
  read?: 'sl' | 'units-tens';
  /** Mise (Al-Zahr). */
  stake?: string;
  source: { book: string; page: number };
}

export const TAVERN_GAMES = tavernGamesJson as TavernGame[];
const BY_ID = new Map<string, TavernGame>(TAVERN_GAMES.map((g) => [g.id, g]));

/** Un jeu de taverne par son `id`, ou undefined. */
export function findTavernGameById(id: string): TavernGame | undefined {
  return BY_ID.get(id);
}

export interface TavernGameResult {
  winner: 'player' | 'opponent' | 'tie';
  /** Score du joueur (DR de la manche, ou DR cumulés en mode étendu). */
  playerSL: number;
  opponentSL: number;
  /** Nombre de manches jouées (1 en mode opposé). */
  rounds: number;
  log: string;
}

/** Difficulté du Test de jeu de taverne (variante rapide, l.9-11 / Bras de fer l.34) — Intermédiaire (+0). */
export const TAVERN_TEST_DIFFICULTY: Difficulty = 'intermediaire';

/** DR d'une manche, plafonné par `drCap` sur une réussite (Boules : « Le DR maximal est de 6 DR »). */
export function roundSL(t: TestResult, cap?: number): number {
  return cap != null && t.success ? Math.min(t.sl, cap) : t.sl;
}

/**
 * Roule UN côté (Intermédiaire (+0)) — PRIMITIVE `roll*` (convention du dépôt : `roll*` = un seul jet,
 * jamais une décision de confrontation ; cf. `rollMerchantOpposition`/`rollTest`). Utilisée par
 * l'APPLIER (`state/tavernFlow.ts`, POST-COMMIT du jet du joueur déjà surfacé par `openRoll`) pour
 * rouler le côté ADVERSAIRE (« l'adversaire roule côté monde » — jamais le côté joueur, qui passe par
 * le seam). N'accepte QU'un rng — ne décide rien (#370).
 */
export function rollTavernTest(value: number, rng: RNG = defaultRNG): TestResult {
  return rollTest(value, TAVERN_TEST_DIFFICULTY, rng);
}

/** Issue d'UNE manche entre deux `TestResult` DÉJÀ roulés — PUR (aucun rng, aucune décision de
 *  surfaçage) : compare via `resolveOpposed`, plafonne par `game.drCap` (Boules). */
export interface TavernRoundOutcome {
  winner: 'player' | 'opponent' | 'tie';
  playerSL: number;
  opponentSL: number;
}

/**
 * Décide UNE manche depuis deux `TestResult` DÉJÀ roulés par l'appelant (#370) : elle ne roule RIEN —
 * rouler ET décider ici contournerait le seam de jet côté joueur. Elle ne fait QUE décider, comme
 * `resolveOpposed`. Sert au mode `opposed` (manche unique) et, manche par
 * manche, au mode `extended` (Bras de fer, l'appelant cumule `playerSL`/`opponentSL` jusqu'à `target`).
 */
export function resolveTavernRound(game: TavernGame, playerTR: TestResult, opponentTR: TestResult): TavernRoundOutcome {
  const ps = roundSL(playerTR, game.drCap);
  const os = roundSL(opponentTR, game.drCap);
  const opp = resolveOpposed({ ...playerTR, sl: ps }, { ...opponentTR, sl: os });
  const winner = opp.winner === 'attacker' ? 'player' : opp.winner === 'defender' ? 'opponent' : 'tie';
  return { winner, playerSL: ps, opponentSL: os };
}

/** Ligne de journal d'une manche `opposed` (variante rapide, l.11) — DR contre DR. */
export function tavernOpposedLog(game: TavernGame, playerSL: number, opponentSL: number, winner: TavernRoundOutcome['winner']): string {
  return `${game.label} : ${playerSL} DR contre ${opponentSL} → ${winner === 'player' ? 'gagné' : winner === 'opponent' ? 'perdu' : 'égalité'}.`;
}

/** Ligne de journal d'une partie `extended` (Bras de fer, l.34) — DR cumulés sur N manches. */
export function tavernExtendedLog(game: TavernGame, playerSL: number, opponentSL: number, rounds: number): string {
  return `${game.label} : ${playerSL} DR cumulés contre ${opponentSL} en ${rounds} manche${rounds > 1 ? 's' : ''}.`;
}
