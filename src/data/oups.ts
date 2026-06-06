/**
 * Tableau des Oups ! — Livre de base, « Maladresses » (14-_GoBack.md l.14-46), transcrit verbatim.
 * `00` encodé `max: 100`. `kind` = effet mécanique discriminé (appliqué par le store).
 */
export type OupsKind =
  | 'selfWound' | 'weaponDamageActLast' | 'actionPenalty'
  | 'loseMovement' | 'loseAction' | 'trauma' | 'hitAlly';

export interface OupsEntry { min: number; max: number; kind: OupsKind; label: string; }

export const OUPS_TABLE: OupsEntry[] = [
  { min: 1, max: 20, kind: 'selfWound', label: 'Vous vous blessez en attaquant — perdez 1 Blessure (ignore BE+PA).' },
  { min: 21, max: 40, kind: 'weaponDamageActLast', label: 'Arme abîmée (1 Dégât) ; vous agirez en dernier au prochain Round.' },
  { min: 41, max: 60, kind: 'actionPenalty', label: '−10 à votre Action au prochain Round.' },
  { min: 61, max: 70, kind: 'loseMovement', label: 'Vous trébuchez — vous perdez votre prochain Mouvement.' },
  { min: 71, max: 80, kind: 'loseAction', label: 'Vous lâchez ou ratez — vous perdez votre prochaine Action.' },
  { min: 81, max: 90, kind: 'trauma', label: 'Vous vous tordez la cheville — Déchirure musculaire (Mineure), compte comme Blessure critique.' },
  { min: 91, max: 100, kind: 'hitAlly', label: 'Vous touchez un allié au hasard (ou vous-même → Sonné).' },
];
