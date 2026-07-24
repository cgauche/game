/**
 * Brouillard de guerre — assombrissement PAR OBJET, dans le flux trié par profondeur. Une case NON
 * visible voit SON décor (sol, mur, décor) assombri SUR PLACE, à sa vraie profondeur : mémorisée
 * (explorée, hors-vue) → grisée mais lisible ; inconnue (jamais vue) → quasi noire. Les cases en vue
 * ne reçoivent aucun filtre.
 *
 * POURQUOI par objet et non un voile-losange : un losange plat ne couvre QUE l'empreinte au sol → sur
 * une structure HAUTE (mur 4 m), le quart supérieur du losange fait un triangle sombre au pied tandis
 * que la face du mur reste éclairée au-dessus. Assombrir les PIXELS de l'objet couvre toute sa
 * silhouette (mur compris), sans triangle, et respecte le tri (un décor caché DEVANT reste devant, à
 * son étage, assombri).
 */
import type { StageObj } from './stage/objs';

export interface FogParams {
  /** Cases déjà vues (accumulées) : `"x,y,z"`. Hors-vue ∩ exploré ⇒ mémorisé ; hors-vue ∖ exploré ⇒ inconnu. */
  explored: Set<string>;
}

// Voiles en CSS `filter` (≠ filtre SVG `url()`) : Chrome les composite au GPU → coût quasi nul même à
// des centaines d'éléments, là où un `<filter>` SVG re-rastérise au CPU par élément (= rame). `brightness`
// est un multiplicateur : remembered = assombri + désaturé mais LISIBLE ; unknown = noir atténué.
const FOG_REMEMBERED = 'brightness(.42) saturate(.45) opacity(.82)';
const FOG_UNKNOWN = 'brightness(0) opacity(.38)';

/** Valeur de CSS `filter` (voile de brouillard) à appliquer à un objet, ou `undefined` (en vue / non tagué). */
export function fogFilterFor(o: StageObj, explored: Set<string>): string | undefined {
  if (o.x === undefined || o.vis) return undefined; // tokens/FX ou décor en vue (ou perçu) → pas de voile
  return explored.has(`${o.x},${o.y},${o.z ?? 0}`) ? FOG_REMEMBERED : FOG_UNKNOWN;
}
