/**
 * POSSESSION LOCALE VUE DE L'UI (#1262 L1) — PORTE UNIQUE par laquelle une fenêtre demande « ce siège
 * pilote-t-il ce combattant ? ». Elle ne DÉCIDE rien : elle DÉLÈGUE au routage siège→combattant de
 * `state/netOwnership.ownsLocally` (même table de vérité que la validation d'intent chez l'hôte —
 * afficher et agir ne peuvent pas répondre différemment).
 *
 * Ce qu'elle SUPPRIME : le terme `net.mode === 'local'` que chaque site recopiait devant l'appel.
 * `ownsLocally` rend déjà `true` en solo pour TOUT combattant (`netOwnership.ts`, branche
 * `mode === 'local'` ; asserté par `netOwnership.test.ts` — « SOLO : `ownsLocally` est vrai pour
 * TOUS »), donc ce court-circuit ne changeait aucune réponse : il faisait seulement lire la
 * possession comme une affaire de mode réseau, et divergeait d'un site à l'autre (`!online || …`,
 * `online ? … : tout`, `mode === 'local' || …`).
 *
 * POLICE (pas verrou) : `ownsLocally` reste exporté par `netOwnership` (6 consommateurs internes) et
 * ré-exporté par `netFlow` — l'import ne peut donc pas être MURÉ. Une règle `no-restricted-imports`
 * (`eslint.config.js`) l'interdit sous `src/ui/**` HORS ce module ; elle échoue la CI, elle
 * n'empêche pas d'écrire la ligne. Mesurée par `ownership-lint.test.ts` sur la config RÉELLE.
 */
import { useGame } from '../state/store';
import type { GameState } from '../state/store';
import { ownsLocally } from '../state/netOwnership';

/**
 * Le siège LOCAL possède-t-il ce combattant ? SOLO : toujours vrai (un seul siège tient tout).
 * `combatantId` absent : l'hôte (contrat de `seatOwns`) — une rangée sans acteur présentable
 * (étape MONDE) passe par ce même chemin, sans garde d'appelant.
 */
export function ownsLocal(s: GameState, combatantId: string | undefined): boolean {
  return ownsLocally(s, combatantId);
}

/**
 * Vue LIVE du prédicat pour une fenêtre : s'ABONNE au siège (`net` — prise/relâche du rôle MJ,
 * attribution d'un héros re-rendent la fenêtre) et lit l'état FRAIS à chaque appel (une rangée
 * interroge la possession pendant le rendu, après des `set` du même geste). Hook : à appeler
 * INCONDITIONNELLEMENT, avant tout retour anticipé.
 */
export function useOwns(): (combatantId: string | undefined) => boolean {
  useGame((s) => s.net);
  return (id) => ownsLocal(useGame.getState(), id);
}

/** Vue RÉSEAU minimale : ce que le prédicat consulte quand aucun combat n'est ouvert. */
export type NetView = Pick<GameState['net'], 'mode' | 'mySeat' | 'ownership'> & { gmSeat?: number };

/**
 * Même prédicat, pour un écran HORS COMBAT piloté par son état réseau EN PROP (Interlude, écran de
 * Groupe : rendus en SSR par un seam de test, sans store). L'état réduit couvre EXACTEMENT ce que le
 * routage lit alors : `seatOwns` (netOwnership) consulte `net.ownership`, `net.gmSeat` et `battle` —
 * et sa branche `gmSeat` ne concerne QUE les combattants `kind:'enemy'` PRÉSENTS dans `battle`. Sans
 * combat il n'y en a aucun : le verdict d'un HÉROS est son siège d'attribution, MJ ou pas.
 */
export function ownsLocalNet(net: NetView, combatantId: string | undefined): boolean {
  return ownsLocally({ net, battle: null } as unknown as GameState, combatantId);
}
