import { PROPS } from '../../gameIso/catalog/decor';
import type { SceneEntity } from '../../state/scene';
import { EMPTY_FLOW } from '../../state/flow';

/** Patch d'inspecteur quand on choisit un décor : pré-arme `interact` si le prop est `searchable`
 *  ET qu'aucun `interact` n'existe (SP2↔SP1). Ne touche jamais un `interact` présent. L'empreinte
 *  n'est PAS patchée : elle vient du catalogue (`PropData.foot`) et suit la ref au rendu. PUR. */
export function propRefPatch(ref: string, hasInteract: boolean): Partial<SceneEntity> {
  if (PROPS[ref]?.searchable && !hasInteract) return { ref, interact: { flow: EMPTY_FLOW } };
  return { ref };
}
