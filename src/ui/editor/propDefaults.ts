import { PROPS } from '../../gameIso/catalog/decor';
import type { SceneEntity } from '../../state/scene';
import { EMPTY_FLOW } from '../../state/flow';

/** Patch d'inspecteur quand on choisit un décor : pré-arme `interact` si le prop est `searchable`
 *  ET qu'aucun `interact` n'existe (SP2↔SP1), et applique l'empreinte par défaut du catalogue
 *  (`PropViz.foot` — tente 2×2, tribune 3×1… ; ajustable ensuite par entité). Ne touche jamais
 *  un `interact` présent. PUR. */
export function propRefPatch(ref: string, hasInteract: boolean): Partial<SceneEntity> {
  const foot = PROPS[ref]?.foot ? { ...PROPS[ref].foot! } : undefined;
  if (PROPS[ref]?.searchable && !hasInteract) return { ref, foot, interact: { flow: EMPTY_FLOW } };
  return { ref, foot };
}
