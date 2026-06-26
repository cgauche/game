import type { ManeuverDef } from '../../data';

/** SOURCE UNIQUE des libellés FR du profil d'une manœuvre (`ManeuverDef`) partagés par l'AFFICHAGE
 *  lecture seule du Codex (`registry.ts`) ET l'éditeur (`CodexEdit.tsx`). Seuls les deux champs
 *  réellement consommés des deux côtés vivent ici ; les libellés propres à l'éditeur (stat / défense /
 *  mode d'Avantage) restent locaux à `CodexEdit`. Type exhaustif `Record<ManeuverDef[…]>` ⇒ ajouter une
 *  valeur au champ ⇒ le compilateur exige son libellé ICI, un seul endroit. */
export const MANEUVER_ACTIVATION_LABEL: Record<ManeuverDef['activation'], string> = {
  action: 'Action', free: 'Gratuite (coût d’Avantage)', charge: 'À la Charge',
};
export const MANEUVER_TARGETING_LABEL: Record<ManeuverDef['targeting'], string> = {
  melee: 'Mêlée', ranged: 'Distance', zone: 'Zone', allFoes: 'Tous les ennemis',
};
