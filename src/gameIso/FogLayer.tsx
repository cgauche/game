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
 * son étage, assombri). Assombrissement (pas opacité) → le décor reste OPAQUE (on ne voit pas à travers).
 */
import type { StageObj } from './stage/objs';

export interface FogParams {
  /** Cases déjà vues (accumulées) : `"x,y,z"`. Hors-vue ∩ exploré ⇒ mémorisé ; hors-vue ∖ exploré ⇒ inconnu. */
  explored: Set<string>;
}

/** Defs SVG des filtres de brouillard (assombrissement + désaturation ; zéro couleur littérale).
 *  Injectés dans le `<defs>` du stage, à côté de `lower-floor-dim`. */
export function fogDefs(): string {
  return (
    // Mémorisé : assombri + désaturé, mais LISIBLE (on se souvient de la disposition explorée).
    `<filter id="fog-remembered" x="-5%" y="-5%" width="110%" height="110%"><feColorMatrix type="saturate" values="0.5"/>` +
    `<feComponentTransfer><feFuncR type="linear" slope="0.42"/><feFuncG type="linear" slope="0.42"/><feFuncB type="linear" slope="0.48"/></feComponentTransfer></filter>` +
    // Inconnu : couleur CONSTANTE quasi noire (matrice qui IGNORE la luminance d'entrée, alpha conservé)
    // → sol/mur/décor jamais vus deviennent une masse uniforme → le terrain adverse et ses OBJETS ne
    //   transparaissent plus (un simple assombrissement laissait voir les silhouettes).
    `<filter id="fog-unknown" x="-5%" y="-5%" width="110%" height="110%">` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0.015  0 0 0 0 0.015  0 0 0 0 0.022  0 0 0 1 0"/></filter>`
  );
}

/** Filtre de brouillard à appliquer à un objet, ou `undefined` (en vue / non tagué). */
export function fogFilterFor(o: StageObj, explored: Set<string>): string | undefined {
  if (o.x === undefined || o.vis) return undefined; // tokens/FX ou décor en vue (ou perçu) → pas de voile
  return explored.has(`${o.x},${o.y},${o.z ?? 0}`) ? 'url(#fog-remembered)' : 'url(#fog-unknown)';
}
