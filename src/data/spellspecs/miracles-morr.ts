/**
 * Miracles de Morr (dieu de la Mort et des Rêves) — LDB 42, 6 miracles. Curation B4 :
 * « Anéantir les morts-vivants » châtie les Mort-vivant (Blessures ignorant BE/PA, ciblage de
 * Groupe) ; « Masque mortuaire » accorde Peur 1 ; les rites funéraires, la garde des mourants et
 * les barrières d'âmes restent narratifs. Aucune op nouvelle.
 */
import { SpellSpec } from '../../engine/spellspec';

export const MIRACLES_MORR: SpellSpec[] = [
  {
    label: 'Anéantir les morts-vivants',
    // « Toutes les cibles potentielles ayant le Trait Mort-vivant perdent 1d10 PB, ignorant le Bonus
    //   d'Endurance et les PA… Tout mort-vivant détruit ne peut jamais être relevé par Nécromancie.
    //   Pour chaque +2 DR, +(Bonus de Sociabilité) mètres de zone. » — Blessures aux Mort-vivant
    //   (op wounds onlyGroups) ; la non-réanimation des détruits reste journalisée.
    durationRounds: null, // Instantané
    curated: true,
    source: 'LDB 42 — Miracles de Morr « Anéantir les morts-vivants »',
  },
  {
    label: 'Condamné',
    // « …une vision de sa Destinée liée à sa mort. Le Talent Destinée peut ensuite être acheté par PX.
    //   Ne peut être pratiqué qu'une fois par Personnage. » — révélation de destinée : arbitré.
    durationRounds: null,
    curated: true,
    source: 'LDB 42 — Miracles de Morr « Condamné »',
  },
  {
    label: 'Main de Morr',
    // « La cible (0 PB, consentante) gagne Inconscient et ne se dégrade plus (maladie, Critiques,
    //   poisons ignorés) jusqu'à la fin du Miracle ou des rites funéraires. » — garde des mourants :
    //   stabilisation hors modèle : arbitré.
    durationRounds: null, // « (Bonus de Sociabilité) heures (Spécial) »
    curated: true,
    source: 'LDB 42 — Miracles de Morr « Main de Morr »',
  },
  {
    label: 'Masque mortuaire',
    // « Votre visage prend un aspect cadavérique et vous gagnez Peur 1. »
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 — Miracles de Morr « Masque mortuaire »',
  },
  {
    label: 'Rites funéraires',
    // « L'âme est envoyée par le Portail ; le cadavre ne peut plus être ciblé par la Nécromancie. Si
    //   la cible a le Trait Mort-vivant ou Fabriqué, elle est détruite. » — rite funéraire : arbitré.
    durationRounds: null,
    curated: true,
    source: 'LDB 42 — Miracles de Morr « Rites funéraires »',
  },
  {
    label: 'Seuil du Portail',
    // « Les créatures Mort-vivant doivent réussir un Test de FM (+0) pour passer la ligne ; celles à
    //   la fois Mort-vivant et Fabriqué ne peuvent pas la franchir. Reste actif jusqu'à l'aube. » —
    //   barrière d'âmes : arbitré.
    durationRounds: null, // « Spécial » (jusqu'à l'aube)
    curated: true,
    source: 'LDB 42 — Miracles de Morr « Seuil du Portail »',
  },
];
