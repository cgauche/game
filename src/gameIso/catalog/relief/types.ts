/** Apparence de RENDU du relief d'environnement (falaise/rampe/tablier/pilier iso, plafond/riser/sol-repli
 *  POV). Donnée pure (`src/data/reliefMaterials.json`) : le renderer ne porte aucun littéral de couleur —
 *  l'identité du matériau vient d'ici, la lumière/l'ombrage vient de `shade.ts`. */
export interface ReliefMaterialDef {
  id: string;
  /** Face principale (claire/éclairée). */
  face: string;
  /** FALAISE : ombre de pied. */
  foot?: string;
  /** RAMPE : nez de pente éclairé (le pied est dérivé par ombrage). */
  slopeTop?: string;
  /** Facteur d'ombrage de la face/pied côté ombre (falaise/tablier). */
  shadeDark?: number;
}
