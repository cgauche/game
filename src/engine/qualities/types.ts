/** Types du registre des qualités d'objet (arme/armure/artisanat). Le registre `QUALITIES` est DÉRIVÉ
 *  de la DONNÉE (`src/data/qualities.json`, cf. `registry.ts`) et ne porte plus que le libellé d'affichage
 *  (`{ key }`). Toute la MÉCANIQUE (passive `GameOp[]` + `capabilities` + `effects`) vit dans la donnée,
 *  lue PAR ID par `dispatch.ts`. */

/** Entrée du registre `QUALITIES` : le LIBELLÉ FR canonique seulement (affichage). La mécanique est
 *  portée par `QualityData` (donnée), lue par id. */
export interface QualityDef {
  /** Label FR canonique (= `qualities.json[].label`). */
  key: string;
}
