/**
 * PILE DES COUCHES DISMISSIBLES — socle du congédiement (Échap, B de la manette, #1476).
 *
 * Modèle STANDARD (celui des `<dialog>`/popover natifs) : chaque surface qui peut être congédiée
 * s'empile à son ouverture, se dépile à sa fermeture, et un appui congédie LA COUCHE DU DESSUS.
 * L'ordre est celui des `pushLayer` — LIFO PUR : la dernière ouverte se ferme la première. Le `kind`
 * est un LIBELLÉ DE DIAGNOSTIC (journal, tests) ; il n'entre dans aucun calcul de rang.
 *
 * Deux façons pour une couche de ne pas se fermer :
 *  - `onDismiss: null` — couche BLOQUANTE : elle CONSOMME l'appui sans rien faire (l'équivalent du
 *    `closedBy="none"` natif : dialogue PNJ en cours, jet posé qui doit être résolu) ;
 *  - `onDismiss()` qui rend `false` — REFUS dynamique.
 * Dans les deux cas la résolution s'arrête là : UN APPUI = AU PLUS UNE FERMETURE, jamais de cascade
 * vers la couche suivante.
 *
 * CONTRAT DES COUCHES : `onDismiss` est GRATUIT — il annule, il ne commet rien (aucune ressource
 * dépensée, aucune action engagée). Une sortie qui COMMET se clique.
 *
 * Module FEUILLE (patron `combatants.ts`) : zéro import runtime — ni store, ni React, ni DOM.
 */

/** Ce qu'une couche fait quand on la congédie. `void` = fermée ; `false` = refus (rien ne bouge). */
export type OnDismiss = () => void | boolean;

/** Jeton opaque rendu par `pushLayer` : la seule façon de désigner SA couche pour la retirer. */
export interface DismissHandle {
  readonly kind: string;
}

interface Couche extends DismissHandle {
  readonly onDismiss: OnDismiss | null;
}

/** Résultat d'un appui : la couche du dessus s'est fermée, a refusé, ou il n'y avait aucune couche. */
export type DismissResult = 'ferme' | 'refuse' | 'vide';

/** Mouvement de la pile, notifié aux abonnés (une surface de SURVOL se retire quand une couche
 *  s'ouvre AU-DESSUS d'elle : elle n'est plus la couche du dessus, elle n'a plus rien à recouvrir). */
export interface DismissEvent {
  readonly type: 'push' | 'pop';
  readonly handle: DismissHandle;
  readonly taille: number;
}

let pile: Couche[] = [];
let abonnes: ((e: DismissEvent) => void)[] = [];

function notifier(e: DismissEvent): void {
  for (const fn of [...abonnes]) fn(e);
}

export function pushLayer(couche: { kind: string; onDismiss: OnDismiss | null }): DismissHandle {
  const c: Couche = { kind: couche.kind, onDismiss: couche.onDismiss };
  pile.push(c);
  notifier({ type: 'push', handle: c, taille: pile.length });
  return c;
}

/** Retrait HORS-ORDRE : une couche démontée par le rendu (pas par un appui) retire LA SIENNE, où
 *  qu'elle soit dans la pile — l'ordre des autres est préservé. Idempotent. */
export function popLayer(handle: DismissHandle): void {
  const i = pile.lastIndexOf(handle as Couche);
  if (i < 0) return;
  pile.splice(i, 1);
  notifier({ type: 'pop', handle, taille: pile.length });
}

export function dismissTop(): DismissResult {
  const top = pile[pile.length - 1];
  if (!top) return 'vide';
  if (!top.onDismiss) return 'refuse';
  if (top.onDismiss() === false) return 'refuse';
  popLayer(top);
  return 'ferme';
}

export const dismissStackSize = (): number => pile.length;

/** Libellés de la pile, du bas vers le haut — DIAGNOSTIC (tests, journal) uniquement. */
export const dismissStackKinds = (): readonly string[] => pile.map((c) => c.kind);

export function subscribeDismissStack(fn: (e: DismissEvent) => void): () => void {
  abonnes.push(fn);
  return () => { abonnes = abonnes.filter((f) => f !== fn); };
}

/** Remise à zéro de l'ÉTAT de la pile — couches ET abonnés (un abonné survivant d'un test précédent
 *  rappellerait le `unpin` d'un composant démonté). Bancs de test uniquement, aucun appelant runtime ;
 *  la PORTE clavier, elle, se remet par `resetDismissLayers` (`src/ui/useDismissLayer.ts`, DOM). */
export function resetDismissStack(): void {
  pile = [];
  abonnes = [];
}
