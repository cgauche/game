/**
 * Grants de POSSESSION portés par des dotations (Classe/Carrière) — #617/#618 SOCLE POSSESSIONS Lot 1.
 * `buildInventory` (engine/items.ts) ignore les refs `{creatureId}`/`{vehicleId}` d'un `TrappingRef`
 * (pas des objets de sac) : ce module les MATÉRIALISE en `PossessionInput[]`, même shape que l'Effet
 * `givePossession` (state/combatEffects.ts) — bête/véhicule `avec-le-groupe`, `count` respecté.
 */
import type { TrappingRef } from '../data';
import type { PossessionInput } from './possession';

/** PUR — n'écrit rien, l'appelant (state/possessionsFlow.ts) matérialise via `addPossession`. Ignore
 *  `{id}` (objet de sac, buildInventory) et `{text}` (flavor hors catalogue). Le `count` d'une
 *  dotation bête/véhicule est toujours `{fixed}` en donnée actuelle (aucune dotation de vivant/monture
 *  n'est un jet de dés) — un `{roll}` produit UNE seule possession (défaut sûr, jamais un crash). */
export function possessionGrantsFromRefs(refs: TrappingRef[], ownerId: string): PossessionInput[] {
  const grants: PossessionInput[] = [];
  for (const ref of refs) {
    const n = ref.count && 'fixed' in ref.count ? ref.count.fixed : 1;
    if ('vehicleId' in ref) {
      // Objet NEUF à CHAQUE itération (jamais la même réf poussée N fois) — `addPossession` ne fait
      // qu'un spread SUPERFICIEL (`{...p, uid}`, possessionsFlow.ts) : un `items`/`location` partagé
      // entre N possessions dupliquées les ferait muter ensemble (embarquer sur l'une affecterait
      // les autres).
      for (let i = 0; i < n; i++) {
        grants.push({ nature: 'vehicule', vehicleId: ref.vehicleId, ownerId, location: { kind: 'avec-le-groupe' }, items: [], ...(ref.label ? { label: ref.label } : {}) });
      }
    } else if ('creatureId' in ref) {
      for (let i = 0; i < n; i++) {
        grants.push({ nature: 'bete', ref: { creatureId: ref.creatureId }, ownerId, location: { kind: 'avec-le-groupe' }, items: [], ...(ref.label ? { label: ref.label } : {}) });
      }
    }
  }
  return grants;
}
