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
    ops: [
      { op: 'wounds', amount: { dice: { n: 1, sides: 10 } }, onlyGroups: ['Morts-vivants'] },
      { op: 'narrative', text: 'Anéantir les morts-vivants : un mort-vivant détruit par ce Miracle ne peut jamais être relevé par Nécromancie — arbitrage MJ.' },
    ],
    durationRounds: null, // Instantané
    curated: true,
    source: 'LDB 42 — Miracles de Morr « Anéantir les morts-vivants »',
  },
  {
    label: 'Condamné',
    // « …une vision de sa Destinée liée à sa mort. Le Talent Destinée peut ensuite être acheté par PX.
    //   Ne peut être pratiqué qu'une fois par Personnage. » — révélation de destinée : arbitré.
    ops: [{ op: 'narrative', text: 'Condamné : vous offrez à la cible une vision de sa mort à venir ; elle peut désormais acheter le Talent Destinée par PX (une seule fois par Personnage) — arbitrage MJ.' }],
    durationRounds: null,
    curated: true,
    source: 'LDB 42 — Miracles de Morr « Condamné »',
  },
  {
    label: 'Main de Morr',
    // « La cible (0 PB, consentante) gagne Inconscient et ne se dégrade plus (maladie, Critiques,
    //   poisons ignorés) jusqu'à la fin du Miracle ou des rites funéraires. » — garde des mourants :
    //   stabilisation hors modèle : arbitré.
    ops: [{ op: 'narrative', text: 'Main de Morr : une cible consentante à 0 PB gagne Inconscient et cesse de se dégrader (maladie, Blessures Critiques, poisons repoussés) pour la durée du Miracle — arbitrage MJ.' }],
    durationRounds: null, // « (Bonus de Sociabilité) heures (Spécial) »
    curated: true,
    source: 'LDB 42 — Miracles de Morr « Main de Morr »',
  },
  {
    label: 'Masque mortuaire',
    // « Votre visage prend un aspect cadavérique et vous gagnez Peur 1. »
    ops: [{ op: 'grantTrait', trait: 'Peur', indice: 1 }],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 — Miracles de Morr « Masque mortuaire »',
  },
  {
    label: 'Rites funéraires',
    // « L'âme est envoyée par le Portail ; le cadavre ne peut plus être ciblé par la Nécromancie. Si
    //   la cible a le Trait Mort-vivant ou Fabriqué, elle est détruite. » — rite funéraire : arbitré.
    ops: [{ op: 'narrative', text: 'Rites funéraires : l’âme d’un cadavre est envoyée au Royaume de Morr (immunisé à la Nécromancie) ; un mort-vivant ou un être Fabriqué ciblé est détruit — arbitrage MJ.' }],
    durationRounds: null,
    curated: true,
    source: 'LDB 42 — Miracles de Morr « Rites funéraires »',
  },
  {
    label: 'Seuil du Portail',
    // « Les créatures Mort-vivant doivent réussir un Test de FM (+0) pour passer la ligne ; celles à
    //   la fois Mort-vivant et Fabriqué ne peuvent pas la franchir. Reste actif jusqu'à l'aube. » —
    //   barrière d'âmes : arbitré.
    ops: [{ op: 'narrative', text: 'Seuil du Portail : une ligne de 8 m qu’un Mort-vivant ne franchit que sur un Test de Force Mentale (+0) réussi (jamais s’il est aussi Fabriqué), jusqu’à l’aube — arbitrage MJ.' }],
    durationRounds: null, // « Spécial » (jusqu'à l'aube)
    curated: true,
    source: 'LDB 42 — Miracles de Morr « Seuil du Portail »',
  },
];
