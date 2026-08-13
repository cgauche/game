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
import { DIFFICULTY_LABELS, type CharKey, type Combatant, type Difficulty } from '../engine/types';
import type { Get, Set } from './flowTypes';
import {
  findTavernGameById, resolveTavernRound, rollTavernTest, tavernOpposedLog, tavernExtendedLog,
  TAVERN_TEST_DIFFICULTY, type TavernGame, type TavernGameResult,
} from '../engine/tavernGame';
import { resolveOpposed, type TestResult } from '../engine/tests';
import { isDrunk } from '../engine/drunkenness';
import { applyOps } from '../engine/ops';
import { testValue } from '../engine/skills';
import { effectiveChar } from '../engine/characteristics';
import { battleRng } from './battleRng';
import { toBrass, fromBrass, formatMoney } from '../engine/money';
import { bourseOf, creditBourse, payWithAllocation, soloPayer } from './bourseFlow';
import {
  freeCons, testSkillLabel, monoStep, bandStep, choiceStep, rollStep, composeRollLabel, surfaceOf,
  type BuiltCascadeStep, type Consequence,
} from './rollSeam';
import { advantageModLine, type ModLine } from '../engine/combat';
import type { BatchParticipant } from './pendings';
import { registerCascadeApplier, rollBatchParticipant, pushStep } from './cascade';
import { combatStakeRef, refLabel } from '../data/index';
import {
  registerSequence, startSequence, resolveSequenceTie, sequenceCumRound, sequenceDrBonus,
  sequencePhaseOf, sequenceScoreOf, sequenceTableRow, activeSequence, setSequencePayload, SEQUENCE_PURPOSE,
  type SequenceBoard, type SequenceCloseCtx, type SequenceParams, type SequenceRound,
  type SequenceState, type SequenceVerdict,
} from './sequenceCore';
import type { RNG } from '../engine/dice';
import { actorIn } from './combatants';
import { jetSurfaced } from './netOwnership';
import { cadenceAuto } from '../engine/cadence';
import { t } from '../i18n';

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
  /** JEU D'ÉQUIPE : les rangées de chaque camp (héros ET figurants), par id de rangée. */
  teams?: { player: string[]; opponent: string[] };
  /** JEU D'ÉQUIPE : les BUTS marqués (Middenball l.121, total de camp ≥ seuil). */
  goals?: { player: number; opponent: number };
  /** JEU D'ÉQUIPE : option de Test retenue par chaque héros pour la manche EN COURS (clé d'option). */
  choices?: Record<string, number>;
  /** JEU D'ÉQUIPE : valeur de Test des COÉQUIPIERS figurants du groupe — distincte de celle du camp
   *  d'en face (`opponentValue`). Absente : la même que l'adversaire (une taverne, un même niveau). */
  allyValue?: number;
  /** JEU D'ÉQUIPE : l'AVANTAGE gagné par chaque camp POUR LE TOUR SUIVANT (l.121). Les héros portent
   *  le leur sur leur fiche (op `gainAdvantage`) ; les figurants n'ont pas de fiche, leur camp le
   *  porte ici — sans quoi une équipe de figurants ne pourrait JAMAIS gagner d'Avantage. */
  advantage?: { player: number; opponent: number };
  /** TORCHON : l'ORDRE de passage des lanceurs (un tour = un lanceur, l.111), figé à l'ouverture. */
  throwers?: { id: string; label: string; camp: 'player' | 'opponent'; value?: number }[];
  /** TORCHON : les POINTS de chaque équipe (l.111-113). */
  points?: { player: number; opponent: number };
}

/** Clés de camp de l'accumulateur du socle — le challenger et son vis-à-vis. */
const CAMP_PLAYER = 'player';
const CAMP_OPPONENT = 'opponent';

/** Kind de l'étape de CHOIX d'option de Test (Middenball l.121) — une par héros surfacé. */
const TAVERN_CHOICE_KIND = 'tavern-option';

/** Kind de l'étape de Résistance à l'alcool d'un lancer RATÉ (Torchon l.111). */
const TAVERN_DRINK_KIND = 'tavern-drink';

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
    ...(game.phases ? { phases: game.phases } : {}),
    ...(game.scoreThreshold != null ? { scoreThreshold: game.scoreThreshold } : {}),
    ...(game.table ? { table: game.table } : {}),
    ...(game.campScore ? { score: { [CAMP_PLAYER]: game.campScore, [CAMP_OPPONENT]: game.campScore } } : {}),
  };
}

/**
 * Joue une partie : instancie le socle de séquence, qui ouvre la 1ʳᵉ manche. `stakeBrass` n'est pris
 * en compte que si le jeu porte une mise (`game.stake`) ET que l'adversaire est ABSTRAIT (la maison) —
 * une mise entre deux héros ne bougerait pas la bourse commune. La mise est plafonnée à la bourse.
 */
export function playTavernGame(
  get: Get, set: Set,
  opts: { gameId: string; challengerId: string; opponent: TavernOpponent; stakeBrass?: number; allyValue?: number },
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
      ...(opts.allyValue != null ? { allyValue: Math.max(1, Math.floor(opts.allyValue)) } : {}),
    },
  });
}

/** Applier de la manche : MUET côté conséquence (l'issue est GLOBALE — elle se décide à la clôture,
 *  dans le réducteur du socle) ; ne pousse que la ligne de récit de ce qui est tombé. */
registerCascadeApplier(TAVERN_ROUND_KIND, (get, set, step) => {
  const dr = (n: number) => `${n >= 0 ? '+' : ''}${n} DR`;
  if (step.participants) {
    const lines = step.participants.map((row) => {
      const who = actorIn(get(), row.id)?.label ?? row.label ?? row.id;
      return `${who} : ${dr(row.result?.sl ?? 0)}.`;
    });
    lines.push(...torchonRate(get, set, step.participants));
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

/* ── JEUX D'ÉQUIPE (Middenball, NADAJ 16 l.119-121) ──────────────────────────────────────────────
 * « Deux équipes de 11 joueurs s'affrontent », « chaque tour, tous les joueurs effectuent un Test […]
 * On additionne le nombre de DR obtenus pour chaque équipe ».
 *
 * COMPOSITION DES CAMPS — arbitrage UTILISATEUR (2026-08-13, verbatim au ticket #1279) : « Le RAW se
 * joue tel quel : chaque camp complète à 11 avec des figurants PNJ (patrons de taverne, valeur simple
 * éditable) — les héros portent leurs jets, les figurants roulent en témoins auto. Le but à +25 et les
 * 11 danseurs restent RAW. » L'effectif (11) vient donc de la DONNÉE du jeu (`team.size`, RAW) ; la
 * VALEUR des figurants est celle que la table fixe pour la partie (`opponent.value`, déjà éditable à
 * la modale) — c'est la seule grandeur maison, et elle est éditable, jamais figée au code. */

/** UNE OPTION de Test d'une manche (celle que l'entrée déclare, ou le repli du jeu). */
type TavernOption = { skill?: string; spec?: string; char?: CharKey; difficulty?: Difficulty; combatTest?: boolean };

/** La Difficulté d'une option : la sienne, ou celle du jeu rapide (« Test opposé de Compétence
 *  Intermédiaire (+0) », l.11) quand l'option n'en nomme pas — un camp qui se contente d'ESQUIVER ne
 *  porte pas de Difficulté propre. */
function difficulteOf(opt: TavernOption): Difficulty {
  return opt.difficulty ?? TAVERN_TEST_DIFFICULTY;
}

/**
 * L'AVANTAGE d'un camp, en ligne NOMMÉE sur la cible (`LDB 14 l.30` : +10 par point à un Test de
 * Combat ou de Psychologie APPROPRIÉ ; Middenball l.121 : « en utilisant les règles habituelles
 * relatives à l'Avantage »). Deux garde-fous, tous deux DÉCLARÉS :
 *  · l'option dit si son Test est un Test de Combat (`combatTest`) — Bagarre oui, Athlétisme non ;
 *  · la ligne est celle du moteur (`advantageModLine`), jamais un `×10` réécrit ici.
 * Le porteur est un Combatant (héros) OU un point d'Avantage de camp (figurant, qui n'en a pas).
 */
function avantageSurLaCible(opt: TavernOption, porteur: Combatant | number): ModLine[] {
  if (!opt.combatTest) return [];
  const ligne = typeof porteur === 'number'
    ? advantageModLine({ advantage: porteur } as Combatant)
    : advantageModLine(porteur);
  return ligne ? [ligne] : [];
}

/** RANGÉE d'un FIGURANT : témoin AUTO (aucun siège ne le tient), son jet déjà roulé — patron des
 *  rangées témoins de la bande (`pursuitFlow.pursuitRow`). Aucun Combatant : sa valeur est celle que
 *  la table lui donne, montée par le monteur CANONIQUE en valeur ÉTRANGÈRE (ce n'est pas un Niveau de
 *  Compétence de fiche) — la Difficulté de l'option et l'Avantage DE SON CAMP entrent dans la cible
 *  comme pour un héros (l'Avantage est gagné par l'ÉQUIPE, l.121, pas par ses seuls héros). */
function figurantRow(id: string, label: string, valeur: number, opt: TavernOption, avantage: number): BatchParticipant {
  const surLaCible = avantageSurLaCible(opt, avantage);
  const difficulty = difficulteOf(opt);
  const row: BatchParticipant = {
    id, label, difficulty, result: null, interactive: false,
    ...(opt.skill ? { skillId: opt.skill } : {}),
    ...rollStep({ valeur, valeurEtrangere: true, difficulty, ...(surLaCible.length ? { surLaCible } : {}) }),
  };
  return { ...row, result: rollBatchParticipant(row, battleRng()) };
}

/** L'option de Test retenue pour un héros : son CHOIX s'il en a fait un, sinon la PREMIÈRE option que
 *  l'entrée déclare — c'est ce que jouent les porteurs qu'aucun siège ne tient, et les figurants. */
function optionOf(game: TavernGame, choix: number | undefined): TavernOption {
  const options = game.options ?? [];
  return options[choix ?? 0] ?? { ...tavernTestSpec(game), difficulty: TAVERN_TEST_DIFFICULTY };
}

/** Héros du groupe qui jouent la partie (vivants, dans la rencontre). */
function equipiers(get: Get): Combatant[] {
  return get().party.filter((h) => !h.dead && !h.outOfRencontre);
}

/** RANGÉE d'un héros d'équipe, sur l'option qu'il a RETENUE (Test et Difficulté de cette option) —
 *  son Avantage propre entre dans la cible quand ce Test est un Test de Combat. */
function equipierRow(get: Get, h: Combatant, game: TavernGame, choix: number | undefined): BatchParticipant {
  const opt = optionOf(game, choix);
  const test = { ...(opt.skill ? { skill: opt.skill } : {}), ...(opt.spec ? { spec: opt.spec } : {}), ...(opt.char ? { char: opt.char } : {}) };
  const surLaCible = avantageSurLaCible(opt, h);
  const difficulty = difficulteOf(opt);
  const row: BatchParticipant = {
    id: h.id,
    label: testSkillLabel(test) ?? game.label,
    ...(opt.skill ? { skillId: opt.skill } : {}),
    difficulty,
    result: null,
    interactive: true,
    ...rollStep({ actor: h, test, difficulty, ...(surLaCible.length ? { surLaCible } : {}) }),
  };
  if (!cadenceAuto() && jetSurfaced(get(), h)) return row;
  return { ...row, interactive: false, result: rollBatchParticipant(row, battleRng()) };
}

/** LA BANDE d'un tour d'équipe : les héros (rangées à jouer), puis les figurants des DEUX camps
 *  (témoins auto) — l'effectif de chaque camp est complété à `team.size` (l.119). Les camps sont
 *  mémorisés PAR ID DE RANGÉE dans la charge utile : la clôture somme sur eux. */
function equipeBande(get: Get, seq: SequenceState<TavernPayload>): { band: BuiltCascadeStep; teams: { player: string[]; opponent: string[] } } | undefined {
  const p = seq.payload;
  const game = findTavernGameById(p.gameId);
  if (game?.roundShape !== 'team' || !game.team) return undefined;
  const heros = equipiers(get);
  if (!heros.length) return undefined;
  const rows: BatchParticipant[] = heros.map((h) => equipierRow(get, h, game, p.choices?.[h.id]));
  const optFigurant = optionOf(game, 0);
  const mien = [...heros.map((h) => h.id)];
  const sien: string[] = [];
  // Les coéquipiers du groupe ont LEUR valeur (`allyValue`), distincte de celle du camp d'en face :
  // sans elle, vos figurants joueraient sur la valeur de l'ADVERSAIRE.
  for (let i = heros.length; i < game.team.size; i++) {
    const id = `figurant-p-${seq.round}-${i}`;
    rows.push(figurantRow(id, t('tavern.equipier', { rang: i + 1 }), p.allyValue ?? p.opponentValue, optFigurant, p.advantage?.player ?? 0));
    mien.push(id);
  }
  for (let i = 0; i < game.team.size; i++) {
    const id = `figurant-o-${seq.round}-${i}`;
    rows.push(figurantRow(id, `${p.opponentName} ${i + 1}`, p.opponentValue, optFigurant, p.advantage?.opponent ?? 0));
    sien.push(id);
  }
  const ph = sequencePhaseOf(seq.params, seq.round);
  const band = bandStep({
    id: `${TAVERN_ROUND_KIND}-${seq.round}`,
    kind: TAVERN_ROUND_KIND,
    icon: 'nav/dice',
    label: `${game.label} — tour ${ph.roundInPhase} de la ${ph.phase}ᵉ mi-temps`,
    stake: combatStakeRef('tavernGame', {
      values: { jeu: game.label, adversaire: p.opponentName, mise: 'aucune' },
    }),
    meta: { gameId: game.id, opponentName: p.opponentName, stakeBrass: 0, round: seq.round },
  }, rows);
  return band ? { band, teams: { player: mien, opponent: sien } } : undefined;
}

/** APPLIER du CHOIX d'option : le dernier choix committé APPEND la bande du tour à la MÊME fenêtre —
 *  les rangées ne peuvent être montées qu'une fois toutes les options connues (la Difficulté et la
 *  Compétence de chaque rangée en dépendent). « Déclaration AVANT jets » : personne ne lance avant que
 *  chacun n'ait dit ce qu'il tente. */
registerCascadeApplier(TAVERN_CHOICE_KIND, (get, set, step) => {
  const seq = activeSequence<TavernPayload>(get);
  const encours = get().pendingCascade;
  if (!seq || !encours) return {};
  const choix = encours.participants.filter((s) => s.kind === TAVERN_CHOICE_KIND);
  const reste = choix.some((s) => s.chosen == null && s.id !== step.id);
  const retenu = Object.fromEntries(choix.map((s) => [s.actorId ?? '', Number(s.chosen ?? 0)]));
  const apres: TavernPayload = { ...seq.payload, choices: { ...retenu, ...(step.actorId ? { [step.actorId]: Number(step.chosen ?? 0) } : {}) } };
  setSequencePayload(get, set, apres);
  const option = step.options?.find((o) => o.key === step.chosen);
  if (reste) return option ? { consequences: freeCons([option.label]) } : {};
  const monte = equipeBande(get, { ...seq, payload: apres });
  if (monte) {
    setSequencePayload(get, set, { ...apres, teams: monte.teams });
    pushStep(set, monte.band, SEQUENCE_PURPOSE);
  }
  return option ? { consequences: freeCons([option.label]) } : {};
});

/* ── LE TORCHON TREMPÉ (NADAJ 16 l.109-113) ──────────────────────────────────────────────────────
 * « Il fait intervenir deux équipes de 12 personnes, placées en deux cercles de 11 joueurs qui dansent
 * main dans la main autour d'un membre de l'équipe adverse » (l.109) — d'où `team.size` 12 et
 * `dancers` 11, tous deux en donnée. « lorsque vous balancez le torchon, faites un Test opposé
 * Projectiles (Lancer) / Esquive d'un joueur choisi aléatoirement parmi les 11 danseurs » (l.111).
 *
 * UN TOUR = UN LANCEUR, et « le jeu se termine lorsque tous les joueurs ont lancé la serviette »
 * (l.111) : la borne de la séquence EST l'effectif des deux camps. L'ORDRE de passage n'est pas dit
 * par la source ; il est ici l'ordre des camps en alternance — et c'est sans conséquence mesurable :
 * chaque lancer est indépendant (cible tirée au sort, points additifs, un lancer par personne), donc
 * aucune décision de jeu n'en dépend. Seuls les lancers des HÉROS ouvrent une fenêtre ; les lancers de
 * figurants se résolvent sans en montrer aucune. */

/** L'ORDRE de passage, figé à l'ouverture : les héros et les figurants de votre camp, puis ceux d'en
 *  face, en ALTERNANCE (l.109 : deux équipes qui se font face). */
function torchonThrowers(get: Get, p: TavernPayload, game: TavernGame): TavernPayload['throwers'] {
  const taille = game.team?.size ?? 1;
  const heros = equipiers(get);
  const mien: NonNullable<TavernPayload['throwers']> = heros.map((h) => ({ id: h.id, label: h.label, camp: 'player' as const }));
  for (let i = heros.length; i < taille; i++) {
    mien.push({ id: `figurant-p-${i}`, label: t('tavern.equipier', { rang: i + 1 }), camp: 'player', value: p.allyValue ?? p.opponentValue });
  }
  const sien: NonNullable<TavernPayload['throwers']> = [];
  for (let i = 0; i < taille; i++) {
    sien.push({ id: `figurant-o-${i}`, label: `${p.opponentName} ${i + 1}`, camp: 'opponent', value: p.opponentValue });
  }
  const ordre: NonNullable<TavernPayload['throwers']> = [];
  for (let i = 0; i < taille; i++) {
    if (mien[i]) ordre.push(mien[i]);
    if (sien[i]) ordre.push(sien[i]);
  }
  return ordre;
}

/** FABRIQUE d'un tour de Torchon : le lanceur du rang, et LE DANSEUR tiré au sort dans le cercle d'en
 *  face (l.111) — les deux dans la MÊME bande, le danseur en témoin (son Esquive est roulée côté
 *  monde). La comparaison est faite à la clôture, comme toute bande. */
function torchonRound(get: Get, seq: SequenceState<TavernPayload>, rng: RNG): SequenceRound<TavernPayload> | undefined {
  const game = findTavernGameById(seq.payload.gameId);
  if (game?.roundShape !== 'thrower' || !game.dancers) return undefined;
  const throwers = seq.payload.throwers?.length ? seq.payload.throwers : torchonThrowers(get, seq.payload, game);
  const lanceur = throwers?.[seq.round - 1];
  if (!lanceur) return undefined;
  const p: TavernPayload = { ...seq.payload, throwers };
  const test = tavernTestSpec(game);
  const heros = lanceur.camp === 'player' ? get().party.find((h) => h.id === lanceur.id) : undefined;
  const lanceurRow: BatchParticipant = heros
    ? {
      id: lanceur.id, label: testSkillLabel(test) ?? game.label, ...(test.skill ? { skillId: test.skill } : {}),
      difficulty: TAVERN_TEST_DIFFICULTY, result: null, interactive: true,
      ...rollStep({ actor: heros, test, difficulty: TAVERN_TEST_DIFFICULTY }),
    }
    : figurantRow(lanceur.id, lanceur.label, lanceur.value ?? p.opponentValue, { difficulty: TAVERN_TEST_DIFFICULTY }, 0);
  const jouable = !!heros && !cadenceAuto() && jetSurfaced(get(), heros);
  // Un héros qu'aucun siège ne tient reste monté sur SA fiche (`equipierRow` l'a déjà roulé) : seule
  // sa rangée devient témoin. Il ne passe jamais par la porte des figurants, qui n'ont pas de fiche.
  const rows: BatchParticipant[] = [jouable ? lanceurRow : { ...lanceurRow, interactive: false, result: lanceurRow.result ?? rollBatchParticipant(lanceurRow, rng) }];
  // LE DANSEUR : tiré AU SORT parmi les 11 du cercle d'en face (l.111), il ESQUIVE (témoin). Le RANG
  // tiré est COSMÉTIQUE, et c'est fidèle : la source ne distingue les 11 danseurs par AUCUN trait —
  // ni valeur propre, ni effet de cible (l.109-111). Il ne sert donc qu'à nommer la rangée ; c'est
  // l'Esquive du cercle (valeur du camp) qui s'oppose au lancer. Le jour où une source distinguerait
  // les danseurs, ce tirage deviendrait mécanique et cette phrase tomberait.
  const rang = rng.int(1, game.dancers);
  const camp = lanceur.camp === 'player' ? p.opponentName : t('tavern.campMien');
  const valeur = lanceur.camp === 'player' ? p.opponentValue : (p.allyValue ?? p.opponentValue);
  rows.push(figurantRow(`danseur-${seq.round}`, t('tavern.danseur', { rang, camp }), valeur, { skill: 'esquive' }, 0));
  const band = bandStep({
    id: `${TAVERN_ROUND_KIND}-${seq.round}`,
    kind: TAVERN_ROUND_KIND,
    icon: 'nav/dice',
    label: `${game.label} — ${lanceur.label} balance le torchon`,
    stake: combatStakeRef('tavernGame', { values: { jeu: game.label, adversaire: p.opponentName, mise: 'aucune' } }),
    meta: { gameId: game.id, opponentName: p.opponentName, stakeBrass: 0, round: seq.round },
  }, rows);
  if (!band) return undefined;
  return {
    title: `${game.label} — lancer ${seq.round}/${throwers!.length}`,
    icon: 'nav/dice',
    steps: [band],
    immediate: !jouable,
    payload: p,
  };
}

/** APPLIER du Test de Résistance à l'alcool (l.111) : l'échec fait perdre 1 point à l'équipe — c'est la
 *  CLÔTURE qui le compte (elle lit la rangée) ; ici, la seule ligne de récit. L'op `intoxicate` (LDB 09
 *  l.475) est appliquée sur l'échec : c'est ELLE qui tire le Tableau d'Ivresse au seuil du Bonus
 *  d'Endurance, et le franchissement est noté dans la charge utile (balayage final, l.113). */
/**
 * LE RATÉ d'un lancer de torchon (l.111) : « vous devez descendre une pinte de bière et faire un Test
 * de Résistance à l'alcool Intermédiaire (+0) ». Un HÉROS tenu par un siège reçoit son étape, APPENDÉE
 * à la fenêtre du lancer (patron du choix d'option) ; tout autre lanceur (figurant, héros sans siège)
 * boit d'office, sans fenêtre. Rendu : les lignes de récit du chemin d'office (vide sinon).
 */
function torchonRate(get: Get, set: Set, rows: readonly BatchParticipant[]): string[] {
  const seq = activeSequence<TavernPayload>(get);
  const p = seq?.payload;
  const game = p ? findTavernGameById(p.gameId) : undefined;
  if (!seq || !p || game?.roundShape !== 'thrower') return [];
  const lanceur = p.throwers?.[seq.round - 1];
  const jet = rows.find((r) => r.id === lanceur?.id);
  const danseur = rows.find((r) => r.id.startsWith('danseur-'));
  if (!lanceur || !jet?.result || !danseur?.result) return [];
  const asTest = (r: BatchParticipant): TestResult => ({
    roll: r.result!.roll, target: r.result!.target, base: r.base,
    success: r.result!.roll <= r.result!.target, sl: r.result!.sl, isDouble: false,
  });
  if (resolveOpposed(asTest(jet), asTest(danseur)).attackerWins) return [];
  const heros = actorIn(get(), lanceur.id);
  const etape = heros && !cadenceAuto() && jetSurfaced(get(), heros)
    ? monoStep({
      id: `${TAVERN_DRINK_KIND}-${seq.round}`,
      kind: TAVERN_DRINK_KIND,
      icon: 'nav/dice',
      label: composeRollLabel(heros, 'Descendre une pinte', { skill: 'resistance-a-l-alcool' }),
      actor: heros,
      difficulty: TAVERN_TEST_DIFFICULTY, // « Résistance à l'alcool Intermédiaire (+0) » (l.111)
      ligne: { test: { skill: 'resistance-a-l-alcool' } },
      stake: combatStakeRef('tavernGame', { values: { jeu: game.label, adversaire: p.opponentName, mise: 'aucune' } }),
      meta: { camp: lanceur.camp, who: lanceur.label },
    })
    : undefined;
  if (etape) {
    pushStep(set, etape, SEQUENCE_PURPOSE);
    return [];
  }
  // Aucun siège : le Test se joue d'office, monté par le MÊME monteur que partout — sur la FICHE du
  // héros quand il y en a une (chemin acteur, patron `equipierRow`), en valeur de table pour un
  // figurant, qui n'a pas de fiche. Jamais un jet forgé à la main.
  const id = `${TAVERN_DRINK_KIND}-${seq.round}`;
  const test = { skill: 'resistance-a-l-alcool' };
  const pinte: BatchParticipant = heros
    ? {
      id, label: testSkillLabel(test) ?? lanceur.label, skillId: test.skill,
      difficulty: TAVERN_TEST_DIFFICULTY, result: null, interactive: false,
      ...rollStep({ actor: heros, test, difficulty: TAVERN_TEST_DIFFICULTY }),
    }
    : figurantRow(id, lanceur.label, lanceur.value ?? p.opponentValue, test, 0);
  const jete = pinte.result ?? rollBatchParticipant(pinte, battleRng());
  return torchonBoit(get, set, lanceur.id, lanceur.camp, lanceur.label, jete.success);
}

function torchonBoit(get: Get, set: Set, lanceurId: string, camp: 'player' | 'opponent', label: string, success: boolean): string[] {
  const seq = activeSequence<TavernPayload>(get);
  if (!seq) return [];
  if (success) return [t('tavern.torchonVide', { who: label })];
  const p = seq.payload;
  const points = { player: p.points?.player ?? 0, opponent: p.points?.opponent ?? 0 };
  points[camp] -= 1; // « votre équipe perd 1 point » (l.111)
  const acteur = actorIn(get(), lanceurId);
  const lignes: string[] = [t('tavern.torchonPot', { who: label })];
  if (acteur) {
    // L'op `intoxicate` (LDB 09 l.475) porte TOUT : l'échec de Résistance, la pénalité, et le tirage
    // du Tableau d'Ivresse au seuil du Bonus d'Endurance — qui laisse sa marque sur la FICHE, où le
    // balayage final la lira.
    lignes.push(...applyOps(acteur, [{ op: 'intoxicate' }], { rng: battleRng() }));
  }
  setSequencePayload(get, set, { ...p, points });
  return lignes;
}

registerCascadeApplier(TAVERN_DRINK_KIND, (get, set, step) => {
  const meta = step.meta as { camp?: 'player' | 'opponent'; who?: string } | undefined;
  if (!step.result || !step.actorId || !meta?.camp) return {};
  const label = actorIn(get(), step.actorId)?.label ?? meta.who ?? step.actorId;
  return { consequences: freeCons(torchonBoit(get, set, step.actorId, meta.camp, label, step.result.success)) };
});

/** FABRIQUE d'un TOUR d'équipe : les CHOIX d'option des héros surfacés (la bande suivra, appendée par
 *  le dernier choix) ; sans aucun siège humain, la bande se monte d'office sur la politique déclarée
 *  et se résout sans fenêtre. */
function tavernTeamRound(get: Get, seq: SequenceState<TavernPayload>): SequenceRound<TavernPayload> | undefined {
  const p = seq.payload;
  const game = findTavernGameById(p.gameId);
  if (!game?.team) return undefined;
  const ph = sequencePhaseOf(seq.params, seq.round);
  const titre = `${game.label} — ${ph.phase}ᵉ mi-temps, tour ${ph.roundInPhase}/${ph.rounds}`;
  const aChoisir = (game.options?.length ?? 0) > 1
    ? equipiers(get).filter((h) => !cadenceAuto() && jetSurfaced(get(), h))
    : [];
  if (!aChoisir.length) {
    const monte = equipeBande(get, { ...seq, payload: { ...p, choices: {} } });
    if (!monte) return undefined;
    return { title: titre, icon: 'nav/dice', steps: [monte.band], immediate: true, payload: { ...p, teams: monte.teams, choices: {} } };
  }
  const steps = aChoisir.map((h) => choiceStep({
    id: `${TAVERN_CHOICE_KIND}-${seq.round}-${h.id}`,
    kind: TAVERN_CHOICE_KIND,
    label: `${h.label} — comment jouer ce tour ?`,
    icon: 'nav/dice',
    actorId: h.id,
    options: (game.options ?? []).map((o, i) => ({
      key: String(i),
      label: refLabel('skills', { id: o.skill ?? '', ...(o.spec ? { spec: o.spec } : {}) }),
      detail: DIFFICULTY_LABELS[o.difficulty],
    })),
    defaultChoice: '0',
  })).filter((s): s is BuiltCascadeStep => !!s);
  if (!steps.length) return undefined;
  return { title: titre, icon: 'nav/dice', steps, payload: { ...p, choices: {} } };
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
  if (game.roundShape === 'thrower') return torchonRound(get, seq, rng);
  if (game.roundShape === 'team') return tavernTeamRound(get, seq);
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
 * RÉDUCTEUR DE CLÔTURE d'un lancer de TORCHON (`NADAJ 16 l.111-113` — la règle vit à l'Atlas et dans
 * la `desc` de l'entrée, ici ce qu'en fait le code) :
 *  · Test OPPOSÉ lanceur / danseur, barème de points par la TABLE déclarée en donnée, lue par le socle
 *    (`sequenceTableRow`, famille 2) sur le DR NET de l'opposition ;
 *  · lancer manqué : étape de Résistance à l'alcool APPENDÉE à la même fenêtre pour un héros, résolue
 *    d'office sinon ; son échec coûte 1 point à l'équipe (compté par l'applier de cette étape) ;
 *  · dernier lanceur : BALAYAGE final sur les lanceurs de CHAQUE camp, −1 point par lanceur qui n'a
 *    pas roulé sur le Tableau Ivre de la partie.
 */
function torchonClose(ctx: SequenceCloseCtx<TavernPayload>): SequenceVerdict<TavernPayload> {
  const { get, seq, done } = ctx;
  const p = seq.payload;
  const band = done.participants.find((s) => s.kind === TAVERN_ROUND_KIND);
  const lanceur = p.throwers?.[seq.round - 1];
  if (!band?.participants || !lanceur) return { go: 'end', outcome: 'tie' };
  const jet = band.participants.find((r) => r.id === lanceur.id);
  const danseur = band.participants.find((r) => r.id.startsWith('danseur-'));
  const points = { player: p.points?.player ?? 0, opponent: p.points?.opponent ?? 0 };
  const log: string[] = [];
  const asTest = (r: BatchParticipant): TestResult => ({
    roll: r.result!.roll, target: r.result!.target, base: r.base,
    success: r.result!.roll <= r.result!.target, sl: r.result!.sl, isDouble: false,
  });
  if (jet?.result && danseur?.result) {
    const opp = resolveOpposed(asTest(jet), asTest(danseur));
    if (opp.attackerWins) {
      const ligne = sequenceTableRow(seq.params, opp.netSL);
      const gain = ligne?.points ?? 0;
      points[lanceur.camp] += gain;
      log.push(t('tavern.torchonTouche', { who: lanceur.label, ou: ligne?.label ?? '', points: gain, s: gain > 1 ? 's' : '', dr: opp.netSL }));
    } else {
      log.push(t('tavern.torchonManque', { who: lanceur.label }));
    }
  }
  // La perte de point du pot non vidé (l.111) est comptée par l'applier du Test d'alcool, qui la
  // pose dans la charge utile : elle est donc DÉJÀ dans `p.points` quand la clôture les relit.
  const dernier = seq.round >= (p.throwers?.length ?? 0);
  const payload: TavernPayload = { ...p, points, last: { playerSL: points.player, opponentSL: points.opponent } };
  if (!dernier) return { go: 'continue', payload, log };

  // BALAYAGE FINAL (`NADAJ 16 l.111`) : le critère porte sur le jet du Tableau d'Ivresse, sans borne
  // de partie — c'est donc l'ÉTAT du personnage qui répond (`isDrunk`, `engine/drunkenness` : un
  // résultat du Tableau a été tiré), y compris pour un lanceur arrivé ivre à la taverne. Un figurant
  // n'a pas de fiche : il n'a jamais bu, il compte — pour les DEUX camps (symétrie).
  const sobres = { player: 0, opponent: 0 };
  for (const lanceurDuBalayage of p.throwers ?? []) {
    const fiche = actorIn(get(), lanceurDuBalayage.id);
    if (!fiche || !isDrunk(fiche)) sobres[lanceurDuBalayage.camp] += 1;
  }
  points.player -= sobres.player;
  points.opponent -= sobres.opponent;
  log.push(t('tavern.torchonSobres', { mien: sobres.player, sien: sobres.opponent }));
  const issue: TavernGameResult['winner'] = points.player > points.opponent ? 'player' : points.opponent > points.player ? 'opponent' : 'tie';
  return { go: 'end', outcome: issue, payload: { ...payload, points, last: { playerSL: points.player, opponentSL: points.opponent } }, log };
}

/**
 * RÉDUCTEUR DE CLÔTURE d'un TOUR D'ÉQUIPE (Middenball NADAJ 16 l.121, verbatim) : « On additionne le
 * nombre de DR obtenus pour chaque équipe. L'équipe qui obtient le total le plus élevé gagne +1
 * Avantage pour le tour suivant […], et marquera un but si son total est de +25 ou plus. Une partie
 * dure deux mi-temps de trois tours chacune. »
 *  · la SOMME par camp est la formule DÉCLARÉE en donnée (`campScore: 'sum'`, famille 3 du socle) ;
 *  · le +1 Avantage est l'op de manche DÉCLARÉE, appliquée par le socle aux héros du camp vainqueur ;
 *  · le BUT est le seuil DÉCLARÉ (`scoreThreshold`), et il n'est marqué que par le camp qui l'emporte ;
 *  · la partie s'achève à la DERNIÈRE manche des phases déclarées, sur le compte des buts.
 * Les figurants n'ont aucun Combatant : ils comptent dans la somme, jamais dans les ops de manche.
 */
function tavernTeamClose(ctx: SequenceCloseCtx<TavernPayload>, game: TavernGame): SequenceVerdict<TavernPayload> {
  const { seq, done } = ctx;
  const p = seq.payload;
  const band = done.participants.find((s) => s.kind === TAVERN_ROUND_KIND);
  const teams = p.teams;
  if (!band?.participants || !teams) return { go: 'end', outcome: 'tie' };
  const drOf = (ids: readonly string[]): number[] => ids
    .map((id) => band.participants!.find((r) => r.id === id))
    .filter((r): r is BatchParticipant => !!r)
    .map((r) => r.result?.sl ?? 0);
  const total = {
    [CAMP_PLAYER]: sequenceScoreOf(seq.params.score?.[CAMP_PLAYER], drOf(teams.player)),
    [CAMP_OPPONENT]: sequenceScoreOf(seq.params.score?.[CAMP_OPPONENT], drOf(teams.opponent)),
  };
  const tp = total[CAMP_PLAYER];
  const to = total[CAMP_OPPONENT];
  const gagnant: TavernGameResult['winner'] = tp > to ? 'player' : to > tp ? 'opponent' : 'tie';
  const seuil = seq.params.scoreThreshold;
  const but = seuil != null && gagnant !== 'tie' && Math.max(tp, to) >= seuil;
  const goals = {
    player: (p.goals?.player ?? 0) + (but && gagnant === 'player' ? 1 : 0),
    opponent: (p.goals?.opponent ?? 0) + (but && gagnant === 'opponent' ? 1 : 0),
  };
  const ph = sequencePhaseOf(seq.params, seq.round);
  const heros = new Set(equipiers(ctx.get).map((h) => h.id));
  const vainqueurs = gagnant === 'player' ? teams.player.filter((id) => heros.has(id)) : [];
  const roundActors = { winners: vainqueurs, all: [...teams.player.filter((id) => heros.has(id))] };
  const log = [`${game.label} — tour ${seq.round} : ${tp} DR contre ${to}${but ? ` — BUT pour ${gagnant === 'player' ? 'votre équipe' : p.opponentName} !` : ''}`];
  // AVANTAGE « pour le tour suivant » (l.121), SYMÉTRIQUE : les héros le reçoivent en op de manche
  // (le socle), les camps le portent ici pour leurs figurants. Il ne s'accumule pas — c'est +1 pour
  // LE tour suivant, et le camp qui ne gagne pas ce tour retombe à 0.
  const advantage = { player: gagnant === 'player' ? 1 : 0, opponent: gagnant === 'opponent' ? 1 : 0 };
  const payload: TavernPayload = { ...p, goals, advantage, last: { playerSL: tp, opponentSL: to } };
  if (!ph.last) return { go: 'continue', payload, log, roundActors };
  const issue: TavernGameResult['winner'] = goals.player > goals.opponent ? 'player' : goals.opponent > goals.player ? 'opponent' : 'tie';
  return { go: 'end', outcome: issue, payload, log, roundActors };
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
  if (game?.roundShape === 'thrower') return torchonClose(ctx);
  if (game?.roundShape === 'team') return tavernTeamClose(ctx, game);
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
  const rounds = Math.max(1, seq.round);
  // TORCHON (l.111-113) : ce qui se compte, ce sont les POINTS d'équipe — jamais des DR ni des buts.
  if (game.roundShape === 'thrower') {
    const pts = p.points ?? { player: 0, opponent: 0 };
    finalizeTavernGame(get, set, game, challenger, p.opponentName, winner, pts.player, pts.opponent, rounds, 0,
      t('tavern.torchonFinal', { mien: pts.player, sien: pts.opponent, lancers: rounds }));
    return;
  }
  // JEU D'ÉQUIPE : ce qui se dit à la fin, ce sont les BUTS (l.121) — la somme de DR n'était que le
  // moyen de les marquer. Le score affiché est donc le compte de buts de chaque camp.
  if (game.roundShape === 'team') {
    const buts = p.goals ?? { player: 0, opponent: 0 };
    finalizeTavernGame(get, set, game, challenger, p.opponentName, winner, buts.player, buts.opponent, rounds, 0,
      `${game.label} : ${buts.player} but${buts.player > 1 ? 's' : ''} contre ${buts.opponent} en ${rounds} tour${rounds > 1 ? 's' : ''}.`);
    return;
  }
  const playerSL = p.last?.playerSL ?? 0;
  const opponentSL = p.last?.opponentSL ?? 0;
  const log = seq.params.target != null
    ? tavernExtendedLog(game, playerSL, opponentSL, rounds)
    : tavernOpposedLog(game, playerSL, opponentSL, winner);
  finalizeTavernGame(get, set, game, challenger, p.opponentName, winner, playerSL, opponentSL, rounds, p.stakeBrass, log);
}

/** TABLEAU DE MARQUE d'une partie EN COURS (affichage) : score par camp, cible, manche, phase. Une
 *  partie à manche UNIQUE sans cible n'a rien à montrer avant son verdict — pas de tableau.
 *  JEU D'ÉQUIPE : le score d'un camp est son compte de BUTS (l.121), et la note porte la SOMME de DR
 *  du dernier tour — c'est elle qui décide le but, elle se lit donc à côté. */
function tavernBoard(get: Get, seq: SequenceState<TavernPayload>): SequenceBoard | undefined {
  const p = seq.payload;
  const game = findTavernGameById(p.gameId);
  const challenger = actorIn(get(), p.challengerId);
  if (!game || !challenger) return undefined;
  const ph = sequencePhaseOf(seq.params, seq.round);
  const phase = ph.total > 0 ? { rounds: ph.total, phase: `${ph.phase}/${ph.count}` } : {};
  // TORCHON : le score d'un camp EST son total de points (l.111) — aucun cumul, aucune cible.
  if (game.roundShape === 'thrower') {
    return {
      title: game.label,
      camps: [
        { id: CAMP_PLAYER, label: t('tavern.campMien'), score: p.points?.player ?? 0 },
        { id: CAMP_OPPONENT, label: p.opponentName, score: p.points?.opponent ?? 0 },
      ],
      round: seq.round,
      ...(p.throwers?.length ? { rounds: p.throwers.length } : {}),
    };
  }
  if (game.roundShape === 'team') {
    const somme = (n: number | undefined): string => t('tavern.sommeTour', { n: n ?? 0 });
    return {
      title: game.label,
      camps: [
        { id: CAMP_PLAYER, label: t('tavern.campMien'), score: p.goals?.player ?? 0, note: somme(p.last?.playerSL) },
        { id: CAMP_OPPONENT, label: p.opponentName, score: p.goals?.opponent ?? 0, note: somme(p.last?.opponentSL) },
      ],
      round: seq.round,
      ...phase,
    };
  }
  if (seq.params.target == null && ph.total === 0) return undefined;
  return {
    title: game.label,
    camps: [
      { id: CAMP_PLAYER, label: challenger.label, score: seq.cum[CAMP_PLAYER] ?? 0, ...(seq.params.target != null ? { target: seq.params.target } : {}) },
      { id: CAMP_OPPONENT, label: p.opponentName, score: seq.cum[CAMP_OPPONENT] ?? 0, ...(seq.params.target != null ? { target: seq.params.target } : {}) },
    ],
    round: seq.round,
    ...phase,
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
