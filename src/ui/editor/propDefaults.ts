import { PROPS } from '../../gameIso/catalog/decor';
import type { SceneEntity } from '../../state/scene';

/** Patch d'inspecteur quand on choisit un décor : pré-arme `interact` si le prop est `searchable`
 *  ET qu'aucun `interact` n'existe (SP2↔SP1). Ne touche jamais un `interact` présent. PUR. */
export function propRefPatch(ref: string, hasInteract: boolean): Partial<SceneEntity> {
  if (PROPS[ref]?.searchable && !hasInteract) return { ref, interact: { effects: [] } };
  return { ref };
}
