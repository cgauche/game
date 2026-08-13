/**
 * Jeux de taverne (Nuits agitées & dures journées, ch.16) — FLUX de jeu branché sur le SOCLE DE
 * SÉQUENCE (`state/sequenceCore`, #1279) : UN état de séquence, UNE fabrique de manche, UN réducteur
 * de clôture. Il n'y a plus de « mode qui s'enchaîne à part » — le Test opposé simple (variante
 * rapide, ch.16 l.9-11) et le Test opposé ÉTENDU (Bras de fer, l.34) sont la MÊME séquence, dont la
 * donnée règle la cible de cumul, le plafond de DR, le départage, le Bonus de Caractéristique et les
 * effets de manche.
 *
 * DEUX MONTAGES DE MANCHE, un seul réducteur :
 *  - HÉROS contre HÉROS → BANDE, une RANGÉE PAR CAMP (patron `pursuitFlow`) : chaque siège joue SON
 *    jet, avec ses influences (#1279 S1). Le camp adverse n'est plus roulé côté monde puis figé —
 *    ce montage-là volait le jet du second héros.
 *  - HÉROS contre la SALLE (adversaire ABSTRAIT, valeur fixée par la table) → MONO à jet adverse
 *    FIGÉ (`meta.opposed.aT`, #579) : chaque influence du joueur RÉ-OPPOSE contre ce jet, jamais un
 *    second tirage caché.
 *
 * Réservé aux tables qui activent l'option `tavern-games`.
 */
import type { CharKey, Combatant } from '../engine/types';
import type { Get, Set } from './flowTypes';
import {
  findTavernGameById, resolveTavernRound, rollTavernTest, tavernOpposedLog, tavernExtendedLog,
  TAVERN_TEST_DIFFICULTY, type TavernGame, type TavernGameResult,
} from '../engine/tavernGame';
import type { TestResult } from '../engine/tests';
import { testValue } from '../engine/skills';
import { effectiveChar } from '../engine/characteristics';
import { battleRng } from './battleRng';
import { toBrass, fromBrass, formatMoney } from '../engine/money';
import { bourseOf, creditBourse, payWithAllocation, soloPayer } from './bourseFlow';
import {
  freeCons, testSkillLabel, monoStep, bandStep, rollStep, composeRollLabel, surfaceOf,
  type Consequence,
} from './rollSeam';
import type { BatchParticipant } from './pendings';
import { registerCascadeApplier, rollBatchParticipant } from './cascade';
import { combatStakeRef } from '../data/index';
import {
  registerSequence, startSequence, resolveSequenceTie, sequenceCumRound, sequenceDrBonus,
  sequencePhaseOf,
  type SequenceBoard, type SequenceCloseCtx, type SequenceParams, type SequenceRound,
  type SequenceState, type SequenceVerdict,
} from './sequenceCore';
import type { RNG } from '../engine/dice';
import { actorIn } from './combatants';
import { jetSurfaced } from './netOwnership';
import { cadenceAuto } from '../engine/cadence';

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
 *  d'indiqué), réutilisée par les mints (`req.test`, qui calculent eux-mêmes la valeur par acteur). */
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

/** Id de la définition de séquence des jeux de taverne (donnée : écrit dans les saves). */
export const TAVERN_SEQUENCE = 'tavern';

/** Kind de l'étape-jet d'une manche (bande OU mono) — UNIQUE depuis #1279 S1. */
export const TAVERN_ROUND_KIND = 'tavern-round';

/** Une étape appartient-elle à une partie de taverne en cours ? — lecture de l'UI, qui masque le
 *  formulaire de réglage pendant qu'une manche est surfacée (#370 point 4). */
export function isTavernStep(kind: string): boolean {
  return kind === TAVERN_ROUND_KIND;
}

/** CHARGE UTILE d'une partie jouée par le socle — la table, l'adversaire, la mise. */
export interface TavernPayload {
  gameId: string;
  challengerId: string;
  opponentValue: number;
  opponentName: string;
  opponentId?: string;
  stakeBrass: number;
  /** Scores de la manche close (lus par le dénouement d'une partie à manche unique). */
  last?: { playerSL: number; opponentSL: number };
}

/** Clés de camp de l'accumulateur du socle — le challenger et son vis-à-vis. */
const CAMP_PLAYER = 'player';
const CAMP_OPPONENT = 'opponent';

/**
 * PARAMÈTRES DE SÉQUENCE d'un jeu — TOUS lus de son entrée de données : aucune valeur de règle n'est
 * écrite ici, aucun `if` par id de jeu. Un jeu N+1 à mécanismes connus n'est qu'une entrée de plus.
 */
export function tavernParams(game: TavernGame): SequenceParams {
  return {
    ...(game.target != null ? { target: game.target } : {}),
    ...(game.drCap != null ? { drCap: game.drCap } : {}),
    ...(game.tieBreak ? { tieBreak: game.tieBreak } : {}),
    ...(game.drBonus ? { drBonus: game.drBonus } : {}),
    ...(game.roundOps ? { rounds: game.roundOps } : {}),
  };
}

/**
 * Joue une partie : instancie le socle de séquence, qui ouvre la 1ʳᵉ manche. `stakeBrass` n'est pris
 * en compte que si le jeu porte une mise (`game.stake`) ET que l'adversaire est ABSTRAIT (la maison) —
 * une mise entre deux héros ne bougerait pas la bourse commune. La mise est plafonnée à la bourse.
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
  const opponentName = opp.kind === 'hero' ? opponentHero!.label : 'un adversaire de la salle';
  const opponentId = opp.kind === 'hero' ? opponentHero!.id : undefined;

  // Mise (Al-zahr, l.7) : seulement contre la maison (compagnon = transfert interne, bourse inchangée).
  const wantStake = !!game.stake && opp.kind === 'abstract' ? Math.max(0, Math.floor(opts.stakeBrass ?? 0)) : 0;
  // La mise sort de la bourse du CHALLENGER (il paie s'il perd, encaisse s'il gagne) : plafonnée à SA bourse.
  const stakeBrass = Math.min(wantStake, toBrass(bourseOf(challenger)));

  startSequence<TavernPayload>(get, set, {
    def: TAVERN_SEQUENCE,
    params: tavernParams(game),
    payload: {
      gameId: game.id, challengerId: challenger.id, opponentValue, opponentName,
      ...(opponentId ? { opponentId } : {}), stakeBrass,
    },
  });
}

/** Applier de la manche : MUET côté conséquence (l'issue est GLOBALE — elle se décide à la clôture,
 *  dans le réducteur du socle) ; ne pousse que la ligne de récit de ce qui est tombé. */
registerCascadeApplier(TAVERN_ROUND_KIND, (get, _set, step) => {
  const dr = (n: number) => `${n >= 0 ? '+' : ''}${n} DR`;
  if (step.participants) {
    const lines = step.participants.map((row) => {
      const who = actorIn(get(), row.id)?.label ?? row.label ?? row.id;
      return `${who} : ${dr(row.result?.sl ?? 0)}.`;
    });
    return { consequences: freeCons(lines) };
  }
  if (!step.result) return {};
  return { consequences: freeCons([`${step.rollLabel ?? 'Jeu'} : ${dr(step.result.sl)}.`]) };
});

/** RANGÉE d'un camp HÉROS dans une bande de manche — patron `pursuitFlow.pursuitRow` : ligne montée
 *  par le monteur canonique (`rollStep`), surfaçage SEAT-AGNOSTIQUE (`jetSurfaced`) pour que le héros
 *  d'un AUTRE siège garde son jet À JOUER. Le porteur qu'aucun siège ne tient (ou toute rangée en
 *  cadence Auto/Rapide) naît TÉMOIN, son jet déjà roulé. */
function tavernRow(get: Get, h: Combatant, game: TavernGame): BatchParticipant {
  const test = tavernTestSpec(game);
  const row: BatchParticipant = {
    id: h.id,
    label: testSkillLabel(test) ?? game.label,
    ...(test.skill ? { skillId: test.skill } : {}),
    difficulty: TAVERN_TEST_DIFFICULTY, // « Test opposé de Compétence Intermédiaire (+0) » (l.11)
    result: null,
    interactive: true,
    ...rollStep({ actor: h, test, difficulty: TAVERN_TEST_DIFFICULTY }),
  };
  if (!cadenceAuto() && jetSurfaced(get(), h)) return row;
  return { ...row, interactive: false, result: rollBatchParticipant(row, battleRng()) };
}

/**
 * FABRIQUE DE MANCHE (socle). Héros contre HÉROS : une BANDE, une rangée par camp — chaque siège joue
 * SON jet. Héros contre la SALLE : l'adversaire abstrait est roulé ICI et FIGÉ (`meta.opposed`, #579),
 * puis l'étape du challenger est MINTÉE (`monoStep`) ; `immediate` quand aucun siège humain ne tient
 * le challenger (cadence Auto/Rapide, héros conduit par l'IA).
 */
function tavernRound(get: Get, seq: SequenceState<TavernPayload>, rng: RNG): SequenceRound<TavernPayload> | undefined {
  const p = seq.payload;
  const game = findTavernGameById(p.gameId);
  const challenger = get().party.find((h) => h.id === p.challengerId);
  if (!game || !challenger) return undefined;
  const opponentHero = p.opponentId ? get().party.find((h) => h.id === p.opponentId) : undefined;
  const title = `${game.label} — ${challenger.label} contre ${p.opponentName}`;
  const stake = combatStakeRef('tavernGame', {
    values: {
      jeu: game.label, adversaire: p.opponentName,
      mise: p.stakeBrass > 0 ? formatMoney(fromBrass(p.stakeBrass)) : 'aucune',
    },
  });

  if (opponentHero) {
    const rows = [tavernRow(get, challenger, game), tavernRow(get, opponentHero, game)];
    const band = bandStep({
      id: `${TAVERN_ROUND_KIND}-${seq.round}`,
      kind: TAVERN_ROUND_KIND,
      icon: 'nav/dice',
      label: `${game.label} — manche ${seq.round}`,
      stake,
      meta: { gameId: game.id, opponentName: p.opponentName, stakeBrass: p.stakeBrass, round: seq.round },
    }, rows);
    if (!band) return undefined;
    return {
      title, icon: 'nav/dice', steps: [band],
      immediate: rows.every((r) => r.interactive === false),
    };
  }

  const rolled = rollTavernTest(p.opponentValue, rng);
  const test = tavernTestSpec(game);
  const step = monoStep({
    id: `${TAVERN_ROUND_KIND}-${seq.round}`,
    kind: TAVERN_ROUND_KIND,
    icon: 'nav/dice',
    label: composeRollLabel(challenger, game.label, test),
    actor: challenger,
    difficulty: TAVERN_TEST_DIFFICULTY, // « Test opposé de Compétence Intermédiaire (+0) » (l.11)
    ligne: { test },
    stake,
    meta: {
      gameId: game.id, opponentValue: p.opponentValue, opponentName: p.opponentName,
      stakeBrass: p.stakeBrass, round: seq.round,
      opposed: { aT: rolled, attackerName: p.opponentName, attackerLabel: testSkillLabel(test) },
    },
  });
  if (!step) return undefined;
  return {
    title, icon: 'nav/dice', steps: [step],
    immediate: !surfaceOf(get, challenger),
  };
}

/** Les DEUX jets d'une manche close, quel que soit son montage — SOURCE UNIQUE de lecture du
 *  réducteur (bande : une rangée par camp ; mono : le jet du challenger et le jet adverse FIGÉ). */
function tavernSides(ctx: SequenceCloseCtx<TavernPayload>): {
  player: TestResult; opponent: TestResult; playerActor?: Combatant; opponentActor?: Combatant;
} | undefined {
  const { get, seq, done } = ctx;
  const p = seq.payload;
  const step = done.participants.find((s) => s.kind === TAVERN_ROUND_KIND);
  if (!step) return undefined;
  const asTest = (r: { roll: number; target: number; sl: number }, base?: number): TestResult => ({
    roll: r.roll, target: r.target, ...(base != null ? { base } : {}),
    // Succès BRUT (roll ≤ target) : la comparaison de manche ne connaît QUE le succès propre au jet —
    // jamais l'issue d'opposition déjà tranchée ailleurs (tie distinct, plafond `drCap` de Boules).
    success: r.roll <= r.target, sl: r.sl, isDouble: false,
  });
  if (step.participants) {
    const mien = step.participants.find((r) => r.id === p.challengerId);
    const sien = step.participants.find((r) => r.id === p.opponentId);
    if (!mien?.result || !sien?.result) return undefined;
    return {
      player: asTest(mien.result, mien.base), opponent: asTest(sien.result, sien.base),
      playerActor: actorIn(get(), p.challengerId), opponentActor: p.opponentId ? actorIn(get(), p.opponentId) : undefined,
    };
  }
  if (!step.result) return undefined;
  return {
    player: asTest(step.result, step.base),
    opponent: step.meta?.opposed?.aT ?? rollTavernTest(p.opponentValue, ctx.rng),
    playerActor: actorIn(get(), p.challengerId),
  };
}

/**
 * RÉDUCTEUR DE CLÔTURE (socle) — LE SEUL juge d'une manche, quel que soit son montage :
 *  1. DR de manche de chaque camp = DR du jet (plafonné `drCap`) + Bonus de Caractéristique DÉCLARÉ
 *     (Bras de fer l.34 : « à chaque tour, ajoutez votre Bonus de Force au nombre de DR ») ;
 *  2. vainqueur de la manche par `resolveTavernRound`, égalité DÉPARTAGÉE par le paramètre déclaré
 *     (Dominos l.107) ;
 *  3. sans cible de cumul : la partie s'achève sur cette manche (variante rapide, l.11) ;
 *  4. avec cible : CUMUL par le socle (`sequenceCumRound` → `extendedTestStep`, LDB 12 l.174 — le DR
 *     du Round s'ajoute AVEC SON SIGNE, seul le TOTAL est planché à 0) jusqu'à `target`.
 * Ne mute rien : les effets de manche déclarés (famille 4) sont DÉCLENCHÉS par le socle sur les
 * porteurs que le verdict nomme.
 */
function tavernClose(ctx: SequenceCloseCtx<TavernPayload>): SequenceVerdict<TavernPayload> {
  const { seq } = ctx;
  const p = seq.payload;
  const game = findTavernGameById(p.gameId);
  const sides = tavernSides(ctx);
  if (!game || !sides) return { go: 'end', outcome: 'tie' };

  const bonusPlayer = sequenceDrBonus(seq.params, sides.playerActor);
  const bonusOpponent = sequenceDrBonus(seq.params, sides.opponentActor, p.opponentValue);
  const { winner, playerSL, opponentSL } = resolveTavernRound(game, sides.player, sides.opponent, {
    player: bonusPlayer, opponent: bonusOpponent,
  });
  const departage = winner === 'tie'
    ? resolveSequenceTie(seq.params.tieBreak, { roll: sides.player.roll, sl: playerSL }, { roll: sides.opponent.roll, sl: opponentSL })
    : 'tie';
  const manche: TavernGameResult['winner'] = winner !== 'tie'
    ? winner
    : departage === 'a' ? 'player' : departage === 'b' ? 'opponent' : 'tie';

  // PORTEURS des effets de manche (famille 4) : le vainqueur de la manche (Bras de fer l.34, +1
  // Avantage), et tous les participants pour l'attrition d'intervalle (l.35, +1 Exténué).
  const all = [p.challengerId, ...(p.opponentId ? [p.opponentId] : [])];
  const gagnantId = manche === 'player' ? p.challengerId : manche === 'opponent' ? p.opponentId : undefined;
  const roundActors = { ...(gagnantId ? { winners: [gagnantId] } : {}), all };

  if (seq.params.target == null) {
    return { go: 'end', outcome: manche, payload: { ...p, last: { playerSL, opponentSL } }, roundActors };
  }

  const { cum, done } = sequenceCumRound(seq, {
    [CAMP_PLAYER]: { success: sides.player.success, sl: playerSL },
    [CAMP_OPPONENT]: { success: sides.opponent.success, sl: opponentSL },
  });
  if (!done.length) return { go: 'continue', cum, payload: { ...p, last: { playerSL, opponentSL } }, roundActors };
  const cp = cum[CAMP_PLAYER] ?? 0;
  const co = cum[CAMP_OPPONENT] ?? 0;
  const issue: TavernGameResult['winner'] = cp > co ? 'player' : co > cp ? 'opponent' : 'tie';
  return { go: 'end', outcome: issue, cum, payload: { ...p, last: { playerSL: cp, opponentSL: co } }, roundActors };
}

/** DÉNOUEMENT (socle) : mise, modale de résultat, journal. */
function tavernSettle(get: Get, set: Set, seq: SequenceState<TavernPayload>, outcome: string): void {
  const p = seq.payload;
  const game = findTavernGameById(p.gameId);
  const challenger = actorIn(get(), p.challengerId);
  if (!game || !challenger) return;
  const winner: TavernGameResult['winner'] = outcome === 'player' || outcome === 'opponent' ? outcome : 'tie';
  const playerSL = p.last?.playerSL ?? 0;
  const opponentSL = p.last?.opponentSL ?? 0;
  const rounds = Math.max(1, seq.round);
  const log = seq.params.target != null
    ? tavernExtendedLog(game, playerSL, opponentSL, rounds)
    : tavernOpposedLog(game, playerSL, opponentSL, winner);
  finalizeTavernGame(get, set, game, challenger, p.opponentName, winner, playerSL, opponentSL, rounds, p.stakeBrass, log);
}

/** TABLEAU DE MARQUE d'une partie EN COURS (affichage) : score par camp, cible, manche, phase. Une
 *  partie à manche UNIQUE sans cible n'a rien à montrer avant son verdict — pas de tableau. */
function tavernBoard(get: Get, seq: SequenceState<TavernPayload>): SequenceBoard | undefined {
  const p = seq.payload;
  const game = findTavernGameById(p.gameId);
  const challenger = actorIn(get(), p.challengerId);
  if (!game || !challenger) return undefined;
  const ph = sequencePhaseOf(seq.params, seq.round);
  if (seq.params.target == null && ph.total === 0) return undefined;
  return {
    title: game.label,
    camps: [
      { id: CAMP_PLAYER, label: challenger.label, score: seq.cum[CAMP_PLAYER] ?? 0, ...(seq.params.target != null ? { target: seq.params.target } : {}) },
      { id: CAMP_OPPONENT, label: p.opponentName, score: seq.cum[CAMP_OPPONENT] ?? 0, ...(seq.params.target != null ? { target: seq.params.target } : {}) },
    ],
    round: seq.round,
    ...(ph.total > 0 ? { rounds: ph.total, phase: `${ph.phase}/${ph.count}` } : {}),
  };
}

registerSequence<TavernPayload>(TAVERN_SEQUENCE, {
  round: tavernRound, close: tavernClose, settle: tavernSettle, board: tavernBoard,
});

/** Dénoue la partie : applique la mise, pose le résultat affiché par la modale, journalise. */
function finalizeTavernGame(
  get: Get, set: Set, game: TavernGame, challenger: Combatant, opponentName: string,
  winner: TavernGameResult['winner'], playerSL: number, opponentSL: number, rounds: number, stakeBrass: number, log: string,
): { consequences: Consequence[] } {
  const netBrass = stakeBrass > 0 ? (winner === 'player' ? stakeBrass : winner === 'opponent' ? -stakeBrass : 0) : 0;
  // Gain → crédit du challenger ; perte → débit de SA bourse (soloPayer, plafonné à la mise déjà bornée à sa bourse).
  if (netBrass > 0) creditBourse(get, set, challenger.id, fromBrass(netBrass));
  else if (netBrass < 0) payWithAllocation(get, set, { debits: soloPayer(challenger.id, fromBrass(-netBrass)), purpose: 'jeu de taverne' });
  const result: TavernGamesResult = {
    winner, playerSL, opponentSL, rounds, log,
    gameLabel: game.label,
    challengerName: challenger.label,
    opponentName,
    stakeBrass,
    netBrass,
  };
  set({ tavernGames: { result } });
  const stakeTxt = netBrass > 0 ? ` — gain ${formatMoney(fromBrass(netBrass))}` : netBrass < 0 ? ` — perte ${formatMoney(fromBrass(-netBrass))}` : '';
  return { consequences: freeCons([`${game.label} — ${challenger.label} contre ${opponentName} : ${log}${stakeTxt}`]) };
}
