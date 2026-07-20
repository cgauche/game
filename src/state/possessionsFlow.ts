/**
 * Registre des POSSESSIONS (#615, SOCLE POSSESSIONS T1-c1, `docs/plans/2026-07-19-socle-possessions.md`
 * §6/§19) — plomberie pure `(get, set)`, même patron que `merchantFlow`/`bourseFlow`. Le registre
 * `GameState.possessions` est le SEUL foyer d'existence des possessions (bêtes/serviteurs/véhicules/
 * navires/immeubles) : aucun mirroir, aucune copie par kind.
 */
import type { Possession, PossessionLocation } from '../engine/possession';
import type { Get, Set } from './flowTypes';

/** `Omit` DISTRIBUTIF sur l'union discriminée `Possession` — `Omit<Possession,'uid'>` nu perdrait les
 *  champs propres à chaque `nature` (keyof d'une union = intersection des clés communes seulement). */
export type PossessionInput = Possession extends unknown ? Omit<Possession, 'uid'> : never;

/** Attribue un `uid` `pos-N` par SCAN du registre (anti-collision — jamais un compteur-module, cf.
 *  `newUid`/`it-N` de `engine/items.ts` qui ne convient qu'aux items). Ajoute au registre, renvoie l'uid. */
export function addPossession(get: Get, set: Set, p: PossessionInput): string {
  const existing = get().possessions;
  const maxN = existing.reduce((max, cur) => {
    const m = /^pos-(\d+)$/.exec(cur.uid);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  const uid = `pos-${maxN + 1}`;
  const full = { ...p, uid } as Possession;
  set((s) => ({ possessions: [...s.possessions, full] }));
  return uid;
}

/** Renomme l'instance (`label` — affichage pur, doctrine id/label). */
export function renamePossession(_get: Get, set: Set, uid: string, label: string): void {
  set((s) => ({ possessions: s.possessions.map((p) => (p.uid === uid ? { ...p, label } : p)) }));
}

/** Réaffecte le propriétaire (succession, don, vente). */
export function transferPossession(_get: Get, set: Set, uid: string, newOwnerId: string): void {
  set((s) => ({ possessions: s.possessions.map((p) => (p.uid === uid ? { ...p, ownerId: newOwnerId } : p)) }));
}

function setLocation(set: Set, uid: string, location: PossessionLocation): void {
  set((s) => ({ possessions: s.possessions.map((p) => (p.uid === uid ? { ...p, location } : p)) }));
}

/** Dépose la possession sur place (auberge, écurie…) — `placeId` omis = reste au lieu courant du
 *  groupe (l'appelant fournit l'id du lieu). */
export function stablePossession(_get: Get, set: Set, uid: string, placeId: string): void {
  setLocation(set, uid, { kind: 'au-lieu', placeId });
}

/** Reprend une possession déposée — elle voyage de nouveau avec le groupe. */
export function retrievePossession(_get: Get, set: Set, uid: string): void {
  setLocation(set, uid, { kind: 'avec-le-groupe' });
}

/** Embarque la possession sur un hôte (véhicule/navire — `hostUid` d'une autre possession du registre). */
export function embark(_get: Get, set: Set, uid: string, hostUid: string): void {
  setLocation(set, uid, { kind: 'embarquee', hostUid });
}

/** Débarque — la possession voyage de nouveau avec le groupe. */
export function disembark(_get: Get, set: Set, uid: string): void {
  setLocation(set, uid, { kind: 'avec-le-groupe' });
}

/** Abandon (§6, décision №4) — pose `destroyed`, la CONFIRMATION reste côté appelant/UI. */
export function abandonPossession(_get: Get, set: Set, uid: string): void {
  set((s) => ({ possessions: s.possessions.map((p) => (p.uid === uid ? { ...p, destroyed: true } : p)) }));
}

/** Ajoute un trait appris (`learnedTraits`, nature `bete` uniquement — LDB 23 → LDB 85, dresse-*). */
export function learnPossessionTrait(_get: Get, set: Set, uid: string, traitId: string): void {
  set((s) => ({
    possessions: s.possessions.map((p) => {
      if (p.uid !== uid || p.nature !== 'bete') return p;
      const learnedTraits = p.learnedTraits?.includes(traitId) ? p.learnedTraits : [...(p.learnedTraits ?? []), traitId];
      return { ...p, learnedTraits };
    }),
  }));
}

/** Possessions d'un propriétaire — inclut les détruites (l'appelant filtre s'il veut un journal). */
export function possessionsByOwner(get: Get, ownerId: string): Possession[] {
  return get().possessions.filter((p) => p.ownerId === ownerId);
}

/** Possessions par localisation — exclut les détruites (une possession détruite n'est plus « quelque
 *  part », elle est filtrée partout, `engine/possession.ts` PossessionCommon.destroyed). */
export function possessionsByLocation(get: Get, location: PossessionLocation['kind']): Possession[] {
  return get().possessions.filter((p) => !p.destroyed && p.location.kind === location);
}
