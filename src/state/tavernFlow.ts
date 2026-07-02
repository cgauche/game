/**
 * Jeux de taverne (Nuits agitées & dures journées, ch.16) — FLUX de jeu (état + résolution), branché
 * sur le moteur PUR `engine/tavernGame` (variante « jeu rapide », Test opposé Intermédiaire (+0), le
 * plus de DR l'emporte). Le flux calcule les valeurs EFFECTIVES depuis le groupe (Compétence/carac du
 * jeu, ou Pari si aucune n'est indiquée, l.11), résout via `resolveTavernGame`, applique la mise
 * éventuelle à la bourse et journalise. Réservé aux tables qui activent l'option `tavern-games`.
 */
import type { Combatant } from '../engine/types';
import type { Get, Set } from './flowTypes';
import { findTavernGameById, resolveTavernGame, type TavernGame, type TavernGameResult } from '../engine/tavernGame';
import { testValue } from '../engine/skills';
import { effectiveChar } from '../engine/characteristics';
import { battleRng } from './battleRng';
import { toBrass, fromBrass, formatMoney } from '../engine/money';

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

export function openTavernGames(_get: Get, set: Set): void {
  set({ tavernGames: { result: null } });
}

export function closeTavernGames(_get: Get, set: Set): void {
  set({ tavernGames: null });
}

/**
 * Joue une partie : résout par le moteur générique et applique la mise. `stakeBrass` n'est pris en
 * compte que si le jeu porte une mise (`game.stake`) ET que l'adversaire est ABSTRAIT (la maison) —
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

  const playerValue = tavernGameValue(challenger, game);
  const opponentValue = opp.kind === 'hero' ? tavernGameValue(opponentHero!, game) : Math.max(1, opp.value);
  const opponentName = opp.kind === 'hero' ? opponentHero!.name : 'un adversaire de la salle';

  // Mise (Al-zahr, l.7) : seulement contre la maison (compagnon = transfert interne, bourse inchangée).
  const wantStake = !!game.stake && opp.kind === 'abstract' ? Math.max(0, Math.floor(opts.stakeBrass ?? 0)) : 0;
  const stakeBrass = Math.min(wantStake, toBrass(get().money));

  const res = resolveTavernGame(game, playerValue, opponentValue, battleRng());
  const netBrass = stakeBrass > 0 ? (res.winner === 'player' ? stakeBrass : res.winner === 'opponent' ? -stakeBrass : 0) : 0;
  if (netBrass !== 0) set({ money: fromBrass(Math.max(0, toBrass(get().money) + netBrass)) });

  const result: TavernGamesResult = {
    ...res,
    gameLabel: game.label,
    challengerName: challenger.name,
    opponentName,
    stakeBrass,
    netBrass,
  };
  set({ tavernGames: { result } });
  const stakeTxt = netBrass > 0 ? ` — gain ${formatMoney(fromBrass(netBrass))}` : netBrass < 0 ? ` — perte ${formatMoney(fromBrass(-netBrass))}` : '';
  get().log(`${game.label} — ${challenger.name} contre ${opponentName} : ${res.log}${stakeTxt}`);
}
