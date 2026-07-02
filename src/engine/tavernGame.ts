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

/** DR d'une manche, plafonné par `drCap` sur une réussite (Boules : « Le DR maximal est de 6 DR »). */
function roundSL(t: TestResult, cap?: number): number {
  return cap != null && t.success ? Math.min(t.sl, cap) : t.sl;
}

/**
 * Résout une partie de jeu de taverne (variante rapide RAW, ch.16 l.9-11 / Bras de fer l.34). PUR :
 * `playerValue`/`opponentValue` = valeurs EFFECTIVES de la Compétence/caractéristique du jeu (calculées par
 * l'appelant depuis le groupe), toutes deux testées Intermédiaire (+0). Le plus de DR l'emporte ; en mode
 * étendu, on accumule les DR jusqu'à ce qu'un joueur atteigne `target`.
 */
export function resolveTavernGame(
  game: TavernGame,
  playerValue: number,
  opponentValue: number,
  rng: RNG = defaultRNG,
): TavernGameResult {
  const diff: Difficulty = 'intermediaire'; // « Test opposé de Compétence Intermédiaire (+0) » (l.11)
  if (game.mode === 'extended') {
    const target = game.target ?? 10;
    let p = 0, o = 0, rounds = 0;
    while (p < target && o < target && rounds < 50) {
      rounds++;
      p += Math.max(0, roundSL(rollTest(playerValue, diff, rng), game.drCap));
      o += Math.max(0, roundSL(rollTest(opponentValue, diff, rng), game.drCap));
    }
    const winner = p > o ? 'player' : o > p ? 'opponent' : 'tie';
    return { winner, playerSL: p, opponentSL: o, rounds, log: `${game.label} : ${p} DR cumulés contre ${o} en ${rounds} manche${rounds > 1 ? 's' : ''}.` };
  }
  const pt = rollTest(playerValue, diff, rng);
  const ot = rollTest(opponentValue, diff, rng);
  const ps = roundSL(pt, game.drCap);
  const os = roundSL(ot, game.drCap);
  const opp = resolveOpposed({ ...pt, sl: ps }, { ...ot, sl: os });
  const winner = opp.winner === 'attacker' ? 'player' : opp.winner === 'defender' ? 'opponent' : 'tie';
  return { winner, playerSL: ps, opponentSL: os, rounds: 1, log: `${game.label} : ${ps} DR contre ${os} → ${winner === 'player' ? 'gagné' : winner === 'opponent' ? 'perdu' : 'égalité'}.` };
}
