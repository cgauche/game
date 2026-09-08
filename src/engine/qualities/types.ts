/** Types des qualités d'objet (arme/armure/artisanat). Toute la MÉCANIQUE (passive `GameOp[]` +
 *  `capabilities` + `effects`) vit dans la DONNÉE (`src/data/qualities.json`), lue PAR ID par
 *  `dispatch.ts` ; il ne reste ici que le libellé d'AFFICHAGE d'une qualité résolue. */

/** Libellé FR canonique d'une qualité résolue (affichage seul). La mécanique est portée par
 *  `QualityData` (donnée), lue par id. */
export interface QualityDef {
  /** Label FR canonique (= `qualities.json[].label`). */
  key: string;
}
