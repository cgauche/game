/** Un culte et ses six Bénédictions (LDB 41). 1 culte = 1 fichier dans `cults/defs/` →
 *  ajouter un dieu = déposer un fichier, zéro code applicatif. */
export interface CultDef {
  /** Nom du culte (clé : « Sigmar », « Shallya »…). */
  key: string;
  /** Les SIX Bénédictions par suffixe (« Bataille » → « Bénédiction de Bataille », LDB 41). */
  blessings: string[];
}
