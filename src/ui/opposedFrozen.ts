import type { GameState } from '../state/store';
import { rolledLocally } from '../state/netOwnership';
import type { PanelRowData } from './RollPanel';
import type { RollRowData } from './RollShell';

/**
 * CALENDRIER de révélation d'un Test OPPOSÉ à jet FIGÉ (#990) — feuille de PRÉSENTATION : aucune
 * règle, aucune valeur touchée (le jet figé garde ses chiffres exacts, seul son AFFICHAGE est masqué).
 *
 * Masqué jusqu'au jet de réponse (#990) : le jet figé du premier participant s'affiche masqué tant
 * que le répondant n'a pas lancé ; les deux se révèlent à son jet. Confort de jeu RÉVISABLE —
 * candidat à devenir une option (patron de la cadence).
 *
 * SOURCE UNIQUE de TOUS les sites à jet figé (défense réactive, incantation opposée, étape de cascade
 * `meta.opposed`, Au Contact, Distraire, Empoignade, Désengagement, Marchandage) : un site qui
 * recompose la règle à la main dérive du calendrier. Aucun décompte ici — il se périme.
 */

/** Participant d'un flux opposé, réduit à ce que le calendrier lit (id, rangée jouée ou témoin, jet posé). */
export interface OpposedParticipantLike {
  id?: string;
  interactive?: boolean;
  result?: unknown;
}

/**
 * Le RÉPONDANT a-t-il joué ? Formule UNIQUE, mono comme multi (le mono = N=1, même expression) :
 *  - au moins une rangée de CE siège (jouée ET produite ici) → il faut qu'elles aient TOUTES leur jet
 *    (multi acteur : chacun joue à l'aveugle et ne voit qu'après SON propre jet) ;
 *  - aucune rangée de ce siège (SPECTATEUR tiers — coop, siège qui ne tient aucun des jets) → repli
 *    sur la PREMIÈRE réponse posée : il n'y a rien à attendre de lui, il regarde la table ;
 *  - aucun répondant du tout (jet non opposé) → rien à attendre : la ligne se lit normalement.
 */
export function opposedResponded(s: GameState, participants: readonly OpposedParticipantLike[]): boolean {
  if (!participants.length) return true;
  const mine = participants.filter((p) => p.interactive && rolledLocally(s, p.id));
  return mine.length ? mine.every((p) => !!p.result) : participants.some((p) => !!p.result);
}

/** Le jet figé de `ownerId` est-il DÉCOUVERT pour ce siège ? Un siège ne se masque jamais son propre
 *  dé (`rolledLocally`) ; sinon la découverte suit le jet de réponse. */
export function opposedRevealed(s: GameState, ownerId: string | undefined, responded: boolean): boolean {
  return rolledLocally(s, ownerId) || responded;
}

/**
 * Pose le calendrier sur une rangée DÉJÀ construite — la forme à employer quand la rangée porte aussi
 * son cycle d'influence (rangée du LANCEUR d'une incantation opposée). ENVELOPPE la rangée : le résultat
 * ne dépend d'aucun ordre de composition côté appelant.
 *
 * Une rangée MASQUÉE neutralise TOUT ce qui DÉRIVE du résultat — liste EXPLICITE et exhaustive, car un
 * champ oublié rend le dé caché inutile : `forceShow` (« Je ne faillirai pas ! » n'est offert qu'après
 * un échec), `rerollable` (Chance : après un échec), `darkPactable`, `reverse` (son `preview` PORTE
 * `{roll, sl, success}`), `resist` (offert sur issue défavorable), `extendedDr` (DR cumulés), `winner`
 * (l'accent gagnant/perdant EST le verdict) et la SOUS-LIGNE `row.note` (issue en clair — canal unique
 * de la rangée). Ce qui ne dérive PAS du résultat traverse intact (`rolled`, `onRoll`, `interactive`,
 * `actor`, ressources…).
 */
export function maskOpposedRow<T extends RollRowData>(
  s: GameState,
  o: { ownerId?: string; responded: boolean },
  row: T,
): T {
  if (opposedRevealed(s, o.ownerId, o.responded)) return row;
  const { d, pending } = row.row;
  return {
    ...row,
    row: {
      ...row.row,
      note: undefined,
      ...(d ? { d: { ...d, mask: 'roll' as const } } : {}),
      ...(pending ? { pending: { ...pending, mask: 'roll' as const } } : {}),
    },
    forceShow: false,
    rerollable: false,
    darkPactable: false,
    reverse: undefined,
    resist: undefined,
    extendedDr: undefined,
    winner: undefined,
  };
}

/** Rangée TÉMOIN d'un jet figé d'adversaire (figée, sans cycle d'influence), masquée jusqu'au jet de réponse. */
export function frozenOpposedRow(
  s: GameState,
  o: { ownerId?: string; responded: boolean; row: PanelRowData },
): RollRowData {
  return maskOpposedRow(s, o, { row: o.row, rolled: true, interactive: false });
}
