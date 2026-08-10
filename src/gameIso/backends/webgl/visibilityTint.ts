/**
 * SPIKE WebGL — APPLICATION de la politique de visibilité (`state/visibility.ts`) en facteur
 * multiplicatif de couleur de sommet. La loi (qui est vu) est ailleurs et partagée ; ici ne vit que le
 * mappage état → teinte, pris au catalogue d'ambiance (`AMBIANCE.fogTint`, donnée éditable).
 * La clé de case est celle de l'ancrage d'un `SceneEl` : `"x,y,z"`.
 */
import { visibilityOf, type Visibility } from '../../../state/visibility';
import { AMBIANCE } from '../../catalog/ambiance';

/** Teinte d'un état de visibilité (1 = pleine). */
export function tintOf(state: Visibility): number {
  return AMBIANCE.fogTint[state];
}

/** Facteur de teinte d'une case (`"x,y,z"`) selon les ensembles vu / exploré. */
export function tintFor(key: string, visible: ReadonlySet<string>, explored: ReadonlySet<string>): number {
  return tintOf(visibilityOf(key, visible, explored));
}
