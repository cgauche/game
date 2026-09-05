/** Apparence de RENDU des toits (matière de couverture iso : teintes par orientation de PENTE +
 *  liseré/rangs de tuiles ; et « plan » vu du dessus en vue carrée) — les entrées de domaine `roof`
 *  de `src/data/materials.json`. Donnée pure : le renderer ne porte aucun littéral de couleur,
 *  l'identité de la matière vient du dataset ; la FORME, elle, vit à UN endroit
 *  (`src/data/materials.types.ts`), avec celle des deux autres domaines. */
export type { RoofMaterialDef } from '../../../data/materials.types';
