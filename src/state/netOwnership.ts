/**
 * Possession réseau (Jalon 7) — source UNIQUE de « qui est concerné » :
 *  - l'UI (arbitre de modales) gate l'AFFICHAGE avec `modalOwnerOf` ;
 *  - l'HÔTE valide les INTENTS reçus avec `intentAllowedFor` (un invité ne peut piloter que
 *    SES combattants — un intent hors-tour/hors-modale d'autrui est refusé et journalisé).
 *
 * '*' = tout le monde est concerné (sort ENNEMI : moment partagé + Contre-sort multi).
 * `undefined` = aucun acteur joueur → seul l'HÔTE (siège 0) est concerné.
 */
import type { GameState } from './store';
import { pickActiveModalKey, type ModalKey } from './modalArbiter';

const OWNER_OF: Record<ModalKey, (s: GameState) => string | undefined | '*'> = {
  fateSave: (s) => s.pendingFateSave?.heroId,
  fumble: (s) => s.pendingFumble?.combatantId,
  deviation: (s) => s.pendingDeviation?.targetId,
  bladeTrap: (s) => s.pendingBladeTrap?.defenderId,
  renounce: (s) => s.pendingRenounce?.heroId,
  trample: (s) => s.pendingTrample?.attackerId,
  reveal: (s) => s.pendingReveals[0]?.subjectId, // sans sujet (entretien) → hôte
  defense: (s) => s.pendingDefense?.defenderId,
  psych: (s) => s.pendingPsych?.combatantId,
  encounterPsych: (s) => s.pendingEncounterPsych?.heroId,
  disengage: (s) => s.pendingDisengage?.moverId,
  mountTarget: (s) => (s.battle ? s.battle.order[s.battle.turn] : undefined), // l'attaquant actif qui a cliqué le couple
  frenzy: (s) => s.pendingFrenzy?.combatantId,
  approach: (s) => s.pendingApproach?.combatantId,
  run: (s) => s.pendingRun?.combatantId,
  focus: (s) => s.pendingFocus?.casterId,
  heal: (s) => s.pendingHeal?.healerId,
  // Sort d'un ENNEMI : chez tous (contre-lanceurs filtrés par possession côté UI) ; héros : son propriétaire.
  cast: (s) => {
    const casterId = s.pendingCast?.casterId;
    const caster = casterId && s.battle ? s.battle.combatants.find((c) => c.id === casterId) : undefined;
    return caster?.kind === 'enemy' ? '*' : casterId;
  },
  reload: (s) => s.pendingReload?.actorId,
  stateRecovery: (s) => s.pendingStateRecovery?.actorId,
  attack: (s) => s.pendingAttack?.attackerId,
  test: (s) => s.pendingTest?.actorId,
  corruption: (s) => s.pendingCorruption?.heroId,
};

/** Combattant concerné par la MODALE ACTIVE (ou '*' / undefined). null = aucune modale. */
export function modalOwnerOf(s: GameState): string | undefined | '*' | null {
  const key = pickActiveModalKey(s);
  return key ? OWNER_OF[key](s) : null;
}

/** Le siège possède-t-il ce combattant ? (héros non attribué → hôte, siège 0). */
export function seatOwns(s: GameState, seat: number, combatantId: string | undefined): boolean {
  if (!combatantId) return seat === 0;
  return (s.net.ownership[combatantId] ?? 0) === seat;
}

/** L'HÔTE accepte-t-il cet intent de `seat` ? Modale ouverte → seul son concerné agit ('*' = tous) ;
 *  sinon → seul le propriétaire du combattant ACTIF agit. `roundStartReady` marque son propre siège. */
export function intentAllowedFor(s: GameState, seat: number, action: string): boolean {
  if (action === 'roundStartReady') return true;
  const owner = modalOwnerOf(s);
  if (owner === '*') return true;
  if (owner !== null) return seatOwns(s, seat, owner);
  const activeId = s.battle ? s.battle.order[s.battle.turn] : undefined;
  return seatOwns(s, seat, activeId);
}
