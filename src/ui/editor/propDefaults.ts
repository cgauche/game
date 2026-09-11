import { PROPS } from '../../gameIso/catalog/decor';
import type { SceneEntity } from '../../state/scene';
import { EMPTY_FLOW } from '../../state/flow';
import { ACTION_FOUILLER } from '../../state/usable';

/** Patch d'inspecteur quand on choisit un décor : pré-arme une action authorée `fouiller` si le prop
 *  est `searchable` ET que l'instance n'en porte encore AUCUNE. Ne touche jamais une liste d'actions
 *  existante. L'empreinte n'est PAS patchée : elle vient du catalogue (`PropData.foot`) et suit la ref
 *  au rendu. PUR. */
export function propRefPatch(ref: string, usable: SceneEntity['usable']): Partial<SceneEntity> {
  if (PROPS[ref]?.searchable && !usable?.actions?.length)
    return { ref, usable: { ...usable, actions: [{ id: ACTION_FOUILLER, flow: EMPTY_FLOW, unique: true }] } };
  return { ref };
}
