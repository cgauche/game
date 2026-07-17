/**
 * Jeux de taverne (Nuits agitées & dures journées, ch.16) — FLUX de jeu (état + résolution), branché
 * sur le moteur PUR `engine/tavernGame` (variante « jeu rapide », Test opposé Intermédiaire (+0), le
 * plus de DR l'emporte). Test OPPOSÉ RÉEL (#579) : l'ADVERSAIRE (compagnon ou table abstraite) roule
 * D'ABORD (`rollTavernTest`, `battleRng`), FIGÉ dans `meta.opposed.aT` (`OpposedFreeze`, `pendings.ts`)
 * — puis le jet du CHALLENGER (joueur) s'ouvre par le seam de jet (`openRoll`, `state/rollSeam.ts` —
 * hero-test) sur la MÊME machinerie d'opposition que `combat/triggeredTest.ts`/`combatManeuvers.ts`
 * (`FLOWS.cascade` `resolve`/`bonus.derive`, `rollFlowSpecs.ts:696-765` : chaque influence — Chance
 * « +1 DR », Résilience, dé forcé — RÉ-OPPOSE contre l'adversaire figé, jamais un second tirage caché).
 * `CascadeModal` affiche les DEUX jets (rangée témoin de l'adversaire + `VsHeader` quand l'adversaire
 * est un Combatant réel). Avant #579, l'adversaire roulait côté MONDE dans l'applier, POST-COMMIT du
 * jet du joueur (le joueur ne voyait qu'un chiffre de DR final) — patron copié du Marchandage de
 * `portFlow.ts` (`rollMerchantOpposition`), qui porte ENCORE ce travers (migration hors périmètre
 * #579, ticketée séparément). Mode `extended` (Bras de fer) : ENCHAÎNE une nouvelle étape `openRoll`
 * par manche — CHAQUE manche fige un NOUVEAU jet adverse avant d'ouvrir celui du joueur, jusqu'à ce
 * qu'un camp atteigne `target` DR cumulés (patron Ragot→acheteur→Marchandage de `portFlow.ts`). La
 * mise éventuelle et le résultat (gains/pertes) sont appliqués par l'applier après résolution.
 * Réservé aux tables qui activent l'option `tavern-games`.
 *
 * Attention, parité RNG : le tirage adverse (`battleRng`) a lieu AVANT l'ouverture du jet du joueur — inversion
 * assumée vs l'ordre pré-#579 (joueur puis adversaire) : même compte de tirages par manche, ORDRE
 * différent. Les tests seedés du périmètre taverne (`tavernFlow.test.ts`) sont adaptés à ce nouvel
 * ordre ; aucun autre flux ne partage ce seed.
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
import { openRoll, freeCons, testSkillLabel, type Consequence } from './rollSeam';
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
 * Joue une partie : fige le jet ADVERSAIRE puis OUVRE le jet du challenger par le seam (`openRoll`,
 * hero-test — modale influençable, opposée au jet figé) ; la mise se résout dans l'applier
 * `TAVERN_GAME_KIND` après commit. `stakeBrass` n'est pris en compte que si le jeu porte une mise
 * (`game.stake`) ET que l'adversaire est ABSTRAIT (la maison) — une mise entre deux héros ne
 * bougerait pas la bourse commune. La mise est plafonnée à la bourse.
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
  const opponentId = opp.kind === 'hero' ? opponentHero!.id : undefined;

  // Mise (Al-zahr, l.7) : seulement contre la maison (compagnon = transfert interne, bourse inchangée).
  const wantStake = !!game.stake && opp.kind === 'abstract' ? Math.max(0, Math.floor(opts.stakeBrass ?? 0)) : 0;
  const stakeBrass = Math.min(wantStake, toBrass(get().money));

  openTavernRound(get, set, game, challenger.id, opponentValue, opponentName, opponentId, stakeBrass, 1, 0, 0);
}

/** Ouvre l'étape-jet du challenger pour UNE manche (mono, opposée ou étendue) — SOURCE UNIQUE d'ouverture,
 *  réutilisée par `playTavernGame` (manche 1) et par l'applier (manches suivantes, mode `extended`). Test
 *  OPPOSÉ RÉEL (#579) : l'adversaire est roulé ICI, AVANT l'ouverture — figé dans `meta.opposed` (calque
 *  `combat/triggeredTest.ts`/`combatManeuvers.ts` : `FLOWS.cascade` ré-oppose à chaque influence héros,
 *  cf. `rollFlowSpecs.ts:696-765`). */
function openTavernRound(
  get: Get, set: Set, game: TavernGame, challengerId: string, opponentValue: number, opponentName: string,
  opponentId: string | undefined, stakeBrass: number, round: number, cumPlayer: number, cumOpponent: number,
): void {
  const opponentTR = rollTavernTest(opponentValue, battleRng());
  const attackerLabel = testSkillLabel(tavernTestSpec(game));
  openRoll(get, set, {
    side: { actorId: challengerId },
    actionLabel: game.label,
    test: tavernTestSpec(game),
    difficulty: 'intermediaire', // « Test opposé de Compétence Intermédiaire (+0) » (l.11)
    klass: 'hero-test',
  }, TAVERN_GAME_KIND, {
    gameId: game.id, opponentValue, opponentName, stakeBrass, round, cumPlayer, cumOpponent,
    opposed: { aT: opponentTR, ...(opponentId ? { attackerId: opponentId } : {}), attackerName: opponentName, attackerLabel },
  });
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
  const opponentId = step.meta?.opposed?.attackerId;
  const stakeBrass = Number(step.meta?.stakeBrass ?? 0);

  // Le défenseur (challenger) a joué contre l'adversaire FIGÉ AVANT l'ouverture (`meta.opposed.aT`,
  // #579) — `success` générique porte l'issue OPPOSÉE (`resolveOpposed`, tie inclus dans « résiste »),
  // reconstruite ici en succès BRUT (roll ≤ target) pour préserver EXACTEMENT le calcul historique de
  // `resolveTavernRound`/`roundSL` (tie distinct, plafond `drCap` de Boules), qui ne connaît QUE le
  // succès propre au jet — jamais l'issue d'opposition déjà tranchée par la machinerie générique.
  const playerTR: TestResult = { roll: step.result.roll, target: step.result.target, success: step.result.roll <= step.result.target, sl: step.result.sl, isDouble: false };
  const opponentTR: TestResult = step.meta?.opposed?.aT ?? rollTavernTest(opponentValue, battleRng());

  if (game.mode === 'extended') {
    const target = game.target ?? 10;
    const round = Number(step.meta?.round ?? 1);
    const cumPlayer = Number(step.meta?.cumPlayer ?? 0) + Math.max(0, roundSL(playerTR, game.drCap));
    const cumOpponent = Number(step.meta?.cumOpponent ?? 0) + Math.max(0, roundSL(opponentTR, game.drCap));
    if (cumPlayer < target && cumOpponent < target && round < 50) {
      chainRound(get, () => openTavernRound(get, set, game, challenger.id, opponentValue, opponentName, opponentId, stakeBrass, round + 1, cumPlayer, cumOpponent));
      return {};
    }
    const winner = cumPlayer > cumOpponent ? 'player' : cumOpponent > cumPlayer ? 'opponent' : 'tie';
    return finalizeTavernGame(get, set, game, challenger, opponentName, winner, cumPlayer, cumOpponent, round, stakeBrass, tavernExtendedLog(game, cumPlayer, cumOpponent, round));
  }

  const { winner, playerSL, opponentSL } = resolveTavernRound(game, playerTR, opponentTR);
  return finalizeTavernGame(get, set, game, challenger, opponentName, winner, playerSL, opponentSL, 1, stakeBrass, tavernOpposedLog(game, playerSL, opponentSL, winner));
});
