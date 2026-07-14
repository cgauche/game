/**
 * Jeux de taverne (Nuits agitées & dures journées, ch.16) — FLUX de jeu (état + résolution), branché
 * sur le moteur PUR `engine/tavernGame` (variante « jeu rapide », Test opposé Intermédiaire (+0), le
 * plus de DR l'emporte). Le jet du CHALLENGER (joueur) est SURFACÉ par le seam de jet (`openRoll`,
 * `state/rollSeam.ts` — hero-test, modale influençable Chance/Pacte/Résilience, #370) ; l'ADVERSAIRE
 * (compagnon ou table abstraite) roule côté MONDE dans l'applier, POST-COMMIT du jet du joueur, comme
 * le Marchandage de `portFlow.ts` (`rollMerchantOpposition`) — patron RÉUTILISÉ, jamais un jet interne
 * silencieux (avant #370, `resolveTavernGame` roulait ET décidait les DEUX côtés en synchrone, sans
 * jamais passer par la policy de surfaçage M/V/I). Mode `extended` (Bras de fer) : ENCHAÎNE une
 * nouvelle étape `openRoll` par manche jusqu'à ce qu'un camp atteigne `target` DR cumulés (patron
 * Ragot→acheteur→Marchandage de `portFlow.ts`). La mise éventuelle et le résultat (gains/pertes) sont
 * appliqués par l'applier après résolution. Réservé aux tables qui activent l'option `tavern-games`.
 */
import type { CharKey, Combatant } from '../engine/types';
import type { Get, Set } from './flowTypes';
import {
  findTavernGameById, resolveTavernRound, rollTavernTest, roundSL, tavernOpposedLog, tavernExtendedLog,
  type TavernGame, type TavernGameResult,
} from '../engine/tavernGame';
import type { TestResult } from '../engine/tests';
import { testValue } from '../engine/skills';
import { effectiveChar } from '../engine/characteristics';
import { battleRng } from './battleRng';
import { toBrass, fromBrass, formatMoney } from '../engine/money';
import { openRoll, freeCons, type Consequence } from './rollSeam';
import { registerCascadeApplier } from './cascade';
import { actorIn } from './combatOrParty';
import { scheduleFlowTimer } from './combatTimers';

/** Adversaire d'une partie : un compagnon du groupe (ses vraies valeurs) ou une valeur ABSTRAITE fixée
 *  par la table (le MJ — le jeu sans MJ n'invente pas de stats de PNJ). */
export type TavernOpponent = { kind: 'hero'; id: string } | { kind: 'abstract'; value: number };

/** Résultat de la dernière partie (affiché dans la modale). Étend l'issue moteur des libellés/mise. */
export interface TavernGamesResult extends TavernGameResult {
  gameLabel: string;
  challengerName: string;
  opponentName: string;
  /** Mise engagée (sous de cuivre) — 0 si le jeu n'a pas de mise, ou adversaire = compagnon. */
  stakeBrass: number;
  /** Variation de la bourse du groupe : +mise (gagné vs la maison) / −mise (perdu) / 0. */
  netBrass: number;
}

/** État de la modale de jeux de taverne (ouverte quand non-null ; `result` = dernière partie). */
export interface TavernGamesState {
  result: TavernGamesResult | null;
}

/**
 * Valeur EFFECTIVE d'un personnage pour un jeu (variante rapide, ch.16 l.9-11) : la Compétence indiquée
 * si le jeu en a une (spec-aware) ; sinon sa caractéristique propre (Bras de fer = Force) ; sinon le
 * Pari (« Si aucune Compétence n'est indiquée […] faites plutôt un Test opposé de Pari »).
 */
export function tavernGameValue(hero: Combatant, game: TavernGame): number {
  if (game.skill) return testValue(hero, game.skill, game.characteristic, game.spec);
  if (game.characteristic) return effectiveChar(hero, game.characteristic);
  return testValue(hero, 'pari'); // aucune Compétence indiquée → Pari (l.11)
}

/** Déclaration du Test (skill/char/spec) d'un jeu — MÊME repli que `tavernGameValue` (Pari si rien
 *  d'indiqué), réutilisée par `openRoll` (`req.test`, calcule lui-même `testValue` par acteur). */
function tavernTestSpec(game: TavernGame): { skill?: string; char?: CharKey; spec?: string } {
  if (game.skill) return { skill: game.skill, spec: game.spec };
  if (game.characteristic) return { char: game.characteristic };
  return { skill: 'pari' };
}

export function openTavernGames(_get: Get, set: Set): void {
  set({ tavernGames: { result: null } });
}

export function closeTavernGames(_get: Get, set: Set): void {
  set({ tavernGames: null });
}

/**
 * Joue une partie : OUVRE le jet du challenger par le seam (`openRoll`, hero-test — modale
 * influençable) ; l'adversaire et la mise se résolvent dans l'applier `TAVERN_GAME_KIND` après
 * commit. `stakeBrass` n'est pris en compte que si le jeu porte une mise (`game.stake`) ET que
 * l'adversaire est ABSTRAIT (la maison) — une mise entre deux héros ne bougerait pas la bourse
 * commune. La mise est plafonnée à la bourse.
 */
export function playTavernGame(
  get: Get, set: Set,
  opts: { gameId: string; challengerId: string; opponent: TavernOpponent; stakeBrass?: number },
): void {
  const game = findTavernGameById(opts.gameId);
  const party = get().party;
  const challenger = party.find((h) => h.id === opts.challengerId);
  if (!game || !challenger) return;
  const opp = opts.opponent;
  const opponentHero = opp.kind === 'hero' ? party.find((h) => h.id === opp.id) : undefined;
  if (opp.kind === 'hero' && !opponentHero) return;

  const opponentValue = opp.kind === 'hero' ? tavernGameValue(opponentHero!, game) : Math.max(1, opp.value);
  const opponentName = opp.kind === 'hero' ? opponentHero!.name : 'un adversaire de la salle';

  // Mise (Al-zahr, l.7) : seulement contre la maison (compagnon = transfert interne, bourse inchangée).
  const wantStake = !!game.stake && opp.kind === 'abstract' ? Math.max(0, Math.floor(opts.stakeBrass ?? 0)) : 0;
  const stakeBrass = Math.min(wantStake, toBrass(get().money));

  openTavernRound(get, set, game, challenger.id, opponentValue, opponentName, stakeBrass, 1, 0, 0);
}

/** Ouvre l'étape-jet du challenger pour UNE manche (mono, opposée ou étendue) — SOURCE UNIQUE d'ouverture,
 *  réutilisée par `playTavernGame` (manche 1) et par l'applier (manches suivantes, mode `extended`). */
function openTavernRound(
  get: Get, set: Set, game: TavernGame, challengerId: string, opponentValue: number, opponentName: string,
  stakeBrass: number, round: number, cumPlayer: number, cumOpponent: number,
): void {
  openRoll(get, set, {
    side: { actorId: challengerId },
    actionLabel: game.label,
    test: tavernTestSpec(game),
    difficulty: 'intermediaire', // « Test opposé de Compétence Intermédiaire (+0) » (l.11)
    klass: 'hero-test',
  }, TAVERN_GAME_KIND, { gameId: game.id, opponentValue, opponentName, stakeBrass, round, cumPlayer, cumOpponent });
}

/** Rejoue une cascade différée si la cascade EN COURS n'a pas fini de committer son étape (patron
 *  `portFlow.ts` `chainStep`) — sinon exécute directement (chemin inline/immédiat). */
function chainRound(get: Get, open: () => void): void {
  if (get().pendingCascade) scheduleFlowTimer(open, 0);
  else open();
}

/** Dénoue la partie : applique la mise, pose le résultat affiché par la modale, journalise. SOURCE
 *  UNIQUE des deux modes (partagée par l'applier `opposed`/`extended`). */
function finalizeTavernGame(
  get: Get, set: Set, game: TavernGame, challenger: Combatant, opponentName: string,
  winner: TavernGameResult['winner'], playerSL: number, opponentSL: number, rounds: number, stakeBrass: number, log: string,
): { consequences: Consequence[] } {
  const netBrass = stakeBrass > 0 ? (winner === 'player' ? stakeBrass : winner === 'opponent' ? -stakeBrass : 0) : 0;
  if (netBrass !== 0) set({ money: fromBrass(Math.max(0, toBrass(get().money) + netBrass)) });
  const result: TavernGamesResult = {
    winner, playerSL, opponentSL, rounds, log,
    gameLabel: game.label,
    challengerName: challenger.name,
    opponentName,
    stakeBrass,
    netBrass,
  };
  set({ tavernGames: { result } });
  const stakeTxt = netBrass > 0 ? ` — gain ${formatMoney(fromBrass(netBrass))}` : netBrass < 0 ? ` — perte ${formatMoney(fromBrass(-netBrass))}` : '';
  return { consequences: freeCons([`${game.label} — ${challenger.name} contre ${opponentName} : ${log}${stakeTxt}`]) };
}

/** Kind de l'étape-jet du challenger — exporté pour que la modale sache masquer le formulaire de
 *  réglage pendant qu'une manche est EN COURS (cascade surfacée par-dessus, #370 point 4). */
export const TAVERN_GAME_KIND = 'tavern-game';
registerCascadeApplier(TAVERN_GAME_KIND, (get, set, step) => {
  if (!step.result) return {};
  const gameId = String(step.meta?.gameId ?? '');
  const game = findTavernGameById(gameId);
  const challenger = step.actorId ? actorIn(get(), step.actorId) : undefined;
  if (!game || !challenger) return {};
  const opponentValue = Number(step.meta?.opponentValue ?? 0);
  const opponentName = String(step.meta?.opponentName ?? 'un adversaire de la salle');
  const stakeBrass = Number(step.meta?.stakeBrass ?? 0);

  const playerTR: TestResult = { roll: step.result.roll, target: step.result.target, success: step.result.success, sl: step.result.sl, isDouble: false };
  // « L'adversaire roule côté monde » (patron `portFlow.ts` PORT_SELL_BARGAIN_KIND : le héros a DÉJÀ
  // posé son jet via `openRoll`, l'applier roule ensuite l'adversaire, moteur pur POST-COMMIT).
  const opponentTR = rollTavernTest(opponentValue, battleRng());

  if (game.mode === 'extended') {
    const target = game.target ?? 10;
    const round = Number(step.meta?.round ?? 1);
    const cumPlayer = Number(step.meta?.cumPlayer ?? 0) + Math.max(0, roundSL(playerTR, game.drCap));
    const cumOpponent = Number(step.meta?.cumOpponent ?? 0) + Math.max(0, roundSL(opponentTR, game.drCap));
    if (cumPlayer < target && cumOpponent < target && round < 50) {
      chainRound(get, () => openTavernRound(get, set, game, challenger.id, opponentValue, opponentName, stakeBrass, round + 1, cumPlayer, cumOpponent));
      return {};
    }
    const winner = cumPlayer > cumOpponent ? 'player' : cumOpponent > cumPlayer ? 'opponent' : 'tie';
    return finalizeTavernGame(get, set, game, challenger, opponentName, winner, cumPlayer, cumOpponent, round, stakeBrass, tavernExtendedLog(game, cumPlayer, cumOpponent, round));
  }

  const { winner, playerSL, opponentSL } = resolveTavernRound(game, playerTR, opponentTR);
  return finalizeTavernGame(get, set, game, challenger, opponentName, winner, playerSL, opponentSL, 1, stakeBrass, tavernOpposedLog(game, playerSL, opponentSL, winner));
});
