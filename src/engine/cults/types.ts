/** Un culte : ses six Bénédictions + ses Miracles (LDB 41-42 ; suppléments). Les fichiers
 *  `cults/defs/` sont APP-OWNED (registre auto-chargé) : ajouter un dieu = ajouter un fichier de def
 *  (ou via l'éditeur de données in-app). */
export interface CultDef {
  /** Nom du culte (clé : « Sigmar », « Evawn »…). */
  key: string;
  /** Titre/épithète (« dieu de l'Empire »). */
  title?: string;
  /** Les six Bénédictions, libellés COMPLETS (« Bénédiction de Bataille »), LDB 41. */
  blessings: string[];
  /** Les Miracles du culte, par nom (« Invitation »…), LDB 42 + suppléments. */
  miracles: string[];
  /** Lore (HTML : Sphères, Adorateurs, Offrandes, Siège du pouvoir, Festivités…) — pour le Codex. */
  desc?: string;
  /** Référence source (livre + page) — pour le Codex. */
  source?: { book: string; page: number };
}
