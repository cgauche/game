import type { RigHeldDef } from '../types';

/**
 * Def de BOUCLIER = base commune `RigHeldDef` (MÊME format que les armes : slug/label/target/art),
 * routé par LIBELLÉ (comme les armes) sur l'os `bouclier` (main faible). Seule spécificité : `fallback`,
 * la silhouette de repli quand le libellé n'est pas catalogué.
 * Ajouter un bouclier = déposer un fichier `defs/` + `npm run gen` (zéro tableau en dur).
 */
export interface ShieldDef extends RigHeldDef {
  /** Silhouette de repli quand le libellé n'est pas catalogué (UN SEUL def doit porter `fallback: true`). */
  fallback?: boolean;
}
