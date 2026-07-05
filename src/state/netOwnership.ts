/**
 * Possession réseau (Jalon 7) — l'HÔTE valide les INTENTS reçus : un invité ne pilote que SES
 * combattants. Le « qui est concerné » vient du REGISTRE des modales (`modalArbiter.MODAL_DEFS`,
 * source unique partagée avec le gating d'affichage UI) — ajouter une modale n'exige RIEN ici.
 */
import type { GameState } from './store';
import type { Combatant } from '../engine/types';
import { modalOwnerOf } from './modalArbiter';
import { cadenceAutoCombat } from '../engine/cadence';

export { modalOwnerOf } from './modalArbiter';

/** Le siège possède-t-il ce combattant ? (héros non attribué → hôte, siège 0). */
export function seatOwns(s: GameState, seat: number, combatantId: string | undefined): boolean {
  if (!combatantId) return seat === 0;
  return (s.net.ownership[combatantId] ?? 0) === seat;
}

/** Le siège LOCAL possède-t-il ce combattant ? (gating d'affichage P2 — vrai en solo/hôte par défaut.) */
export function ownsLocally(state: GameState, combatantId: string | undefined): boolean {
  const { mode, mySeat, ownership } = state.net;
  if (mode === 'local') return true;
  if (!combatantId) return mode === 'host';
  return (ownership[combatantId] ?? 0) === mySeat;
}

/**
 * Le combattant `c` est-il piloté par l'IA ? — base AGNOSTIQUE AU CAMP de l'orchestrateur de tour.
 * Un ENNEMI l'est toujours (comportement inchangé). Un HÉROS l'est en mode Auto-combat ET s'il est
 * contrôlé LOCALEMENT (coop : on ne joue jamais le héros d'un autre siège). Un PNJ ne l'est jamais.
 * NB : `aiDriven` ne change PAS le `kind` du combattant — les règles indexées sur `kind` (Destin réservé
 * aux héros, Corruption, déviation d'armure, Mort Subite) restent CORRECTES : un héros auto-piloté
 * demeure un héros pour la résolution. (Vit ICI, avec les primitives d'« qui pilote quoi » : `controlsActive`
 * en dépend ; `combatGate` le ré-exporte pour ses consommateurs historiques.)
 */
export function aiDriven(s: GameState, c: Combatant): boolean {
  if (c.kind === 'enemy') return true;
  // PNJ allié IA (`Combatant.aiControlled`, ex. défenseur de siège) : agit SEUL même en jeu MANUEL — sans
  // attendre l'Auto-combat global. On ne pilote jamais le combattant d'un AUTRE siège (`ownsLocally`).
  if (c.kind === 'hero' && c.aiControlled) return ownsLocally(s, c.id);
  return c.kind === 'hero' && cadenceAutoCombat() && ownsLocally(s, c.id);
}

/** Le joueur LOCAL contrôle-t-il (À LA MAIN) le combattant ACTIF du combat ? Faux pendant le tour du héros
 *  d'un AUTRE joueur (hôte inclus), ET faux quand le héros actif est piloté par l'IA (Auto-combat) : l'UI
 *  traite alors ce tour comme un tour ennemi — AUCUNE affordance (grille de déplacement, réticule, barre
 *  d'action, raccourcis). Tour ennemi → vrai : l'IA tourne et l'UI est déjà inerte par ses propres verrous. */
export function controlsActive(state: GameState): boolean {
  const b = state.battle;
  if (!b || b.over) return true;
  const activeId = b.order[b.turn];
  const active = b.combatants.find((c) => c.id === activeId);
  if (!active || active.kind !== 'hero') return true; // tour ennemi → UI déjà inerte par ses propres verrous
  if (aiDriven(state, active)) return false; // Auto-combat : l'IA pilote ce héros → pas d'affordance joueur
  if (state.net.mode === 'local') return true;
  return ownsLocally(state, activeId);
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
  // Remplacement EN PLACE : le siège doit posséder l'ANCIEN héros (1er arg). L'effectif ne change
  // pas (1 héros pour 1) → aucun check de quota d'emplacements.
  if (action === 'partyReplaceHero') return seatOwns(s, seat, typeof args[0] === 'string' ? args[0] : undefined);
  // Activités d'interlude (audit M7) : le 1er argument est le héros visé — son propriétaire agit
  // (`interludeActivity` = chemin UNIQUE des Activités à jet ; `interludeCraftStart`/`Order`/`Bank`).
  if (/^interlude(Activity|CraftStart|Order|Bank)$/.test(action)) {
    return seatOwns(s, seat, typeof args[0] === 'string' ? args[0] : undefined);
  }
  // Retrait bancaire : le dépôt appartient à un héros — son propriétaire retire.
  if (action === 'interludeWithdraw') {
    const dep = typeof args[0] === 'number' ? s.bank?.[args[0]] : undefined;
    return dep ? seatOwns(s, seat, dep.heroId) : false; // dépôt inconnu → personne
  }
  // Flux MULTI à participants = HÉROS (Contre-sort / Forçage de porte) : le JET d'un participant est
  // piloté par le propriétaire de CE héros (1ᵉʳ arg = son id). Les décisions de GROUPE (Confirm/
  // Cancel) restent ouvertes ('*' via le owner de la modale). NB : le Test Étendu (ROUNDS) et la
  // CASCADE (ÉTAPES, `args[0]` = id d'étape ≠ héros) tombent sur le owner de LEUR modale — l'acteur
  // du Round / l'acteur de l'étape COURANTE — pas sur `args[0]`.
  if (/^(counterspell|forceDoor)(Roll|Reroll|BonusSL|DarkPact|ForceSuccess)$/.test(action)) {
    return seatOwns(s, seat, typeof args[0] === 'string' ? args[0] : undefined);
  }
  const owner = modalOwnerOf(s);
  if (owner === '*') return true;
  if (owner !== null) return seatOwns(s, seat, owner);
  const activeId = s.battle ? s.battle.order[s.battle.turn] : undefined;
  return seatOwns(s, seat, activeId);
}
