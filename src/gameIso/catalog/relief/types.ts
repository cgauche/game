/** Apparence de RENDU du relief d'environnement (falaise/rampe/tablier/pilier iso, plafond POV) —
 *  les entrées de domaine `relief` de `src/data/materials.json`. Donnée pure : le renderer ne porte
 *  aucun littéral de couleur, l'ombrage vient de `shade.ts` ; la FORME vit à UN endroit
 *  (`src/data/materials.types.ts`), avec celle des deux autres domaines. */
export type { ReliefMaterialDef } from '../../../data/materials.types';
