/**
 * Tableau des Oups ! — Livre de base, « Maladresses » (14-_GoBack.md l.14-46), transcrit verbatim.
 * `00` encodé `max: 100`. `kind` = effet mécanique discriminé (appliqué par le store).
 *
 * La DONNÉE vit dans `oups.json` (éditable, comme `creatures.json`) ; ce module = type + chargement.
 * Ajouter/régler une entrée = éditer le JSON, jamais ce fichier.
 */
import { oups } from './index';

export type OupsKind =
  | 'selfWound' | 'weaponDamageActLast' | 'actionPenalty'
  | 'loseMovement' | 'loseAction' | 'trauma' | 'hitAlly';

export interface OupsEntry { min: number; max: number; kind: OupsKind; label: string; }

export const OUPS_TABLE = oups;
