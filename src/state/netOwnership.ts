/**
 * Possession réseau (Jalon 7) — l'HÔTE valide les INTENTS reçus : un invité ne pilote que SES
 * combattants. Le « qui est concerné » vient du REGISTRE des modales (`modalArbiter.MODAL_DEFS`,
 * source unique partagée avec le gating d'affichage UI) — ajouter une modale n'exige RIEN ici.
 */
import type { GameState } from './store';
import { modalOwnerOf } from './modalArbiter';

export { modalOwnerOf } from './modalArbiter';

/** Le siège possède-t-il ce combattant ? (héros non attribué → hôte, siège 0). */
export function seatOwns(s: GameState, seat: number, combatantId: string | undefined): boolean {
  if (!combatantId) return seat === 0;
  return (s.net.ownership[combatantId] ?? 0) === seat;
}

/** Emplacements de groupe encore à remplir par ce siège : slots attribués − héros possédés.
 *  (En mode local, slots = [0,0,0,0] → l'hôte garde les 4 emplacements, comme avant la coop.) */
export function seatSlotsRemaining(s: GameState, seat: number): number {
  const slots = (s.net.slots ?? [0, 0, 0, 0]).filter((x) => x === seat).length;
  const owned = s.party.filter((h) => (s.net.ownership[h.id] ?? 0) === seat).length;
  return slots - owned;
}

/** L'HÔTE accepte-t-il cet intent de `seat` ? Modale ouverte → seul son concerné agit ('*' = tous) ;
 *  sinon → seul le propriétaire du combattant ACTIF agit. Cas à part : les ready-checks et ✋
 *  marquent leur propre siège ; `assignVictoryGear` n'attribue le butin qu'à SES héros. */
export function intentAllowedFor(s: GameState, seat: number, action: string, args: unknown[] = []): boolean {
  if (action === 'roundStartReady' || action === 'victoryReady' || action === 'raiseHand') return true;
  if (action === 'assignVictoryGear') return seatOwns(s, seat, typeof args[1] === 'string' ? args[1] : undefined);
  // Composition du groupe : un siège remplit SES emplacements (quota attribué par l'hôte) et
  // ne retire que SES héros.
  if (action === 'partyAddHero') return seatSlotsRemaining(s, seat) > 0;
  if (action === 'partyRemoveHero') return seatOwns(s, seat, typeof args[0] === 'string' ? args[0] : undefined);
  const owner = modalOwnerOf(s);
  if (owner === '*') return true;
  if (owner !== null) return seatOwns(s, seat, owner);
  const activeId = s.battle ? s.battle.order[s.battle.turn] : undefined;
  return seatOwns(s, seat, activeId);
}
