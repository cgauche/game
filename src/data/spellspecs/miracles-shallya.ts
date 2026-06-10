/**
 * Miracles de Shallya (LDB 42 p.227) — les 6, curés (culte du pré-tiré prêtre).
 */
import { SpellSpec } from '../../engine/spellspec';

export const MIRACLES_SHALLYA: SpellSpec[] = [
  {
    label: 'Amère catharsis',
    // « Aspire un poison, ou une maladie, de la cible » : l'État Empoisonné est purgé ;
    // les maladies (cycle LDB 20) + l'auto-Blessure du prêtre (1d10 − BSoc par purge,
    // non mitigée) restent journalisées (montant lié au nombre de purges choisies).
    ops: [
      { op: 'removeCondition', name: 'Empoisonné', value: 99 },
      { op: 'narrative', text: 'Amère catharsis : une maladie peut être retirée (+1 purge par +2 DR) ; le prêtre subit 1d10 − BSoc Blessures NON mitigées par purge — arbitrage MJ.' },
    ],
    durationRounds: null,
    curated: true,
    source: 'LDB 42 « Amère catharsis »',
  },
  {
    label: 'Baume pour un esprit blessé',
    ops: [
      { op: 'narrative', text: 'Baume pour un esprit blessé : Traits psychologiques retirés pour la durée, puis sommeil réparateur jusqu’à l’aube (cible non volontaire : Test de Calme +0 pour résister) — arbitrage MJ.' },
    ],
    durationRounds: null, // (Bonus de Sociabilité) minutes — hors échelle tactique
    curated: true,
    source: 'LDB 42 « Baume pour un esprit blessé »',
  },
  {
    label: "Endurance de l'anachorète",
    ops: [
      { op: 'narrative', text: 'Endurance de l’anachorète : la cible ne ressent aucune douleur et ne subit AUCUNE pénalité d’État pour la durée (immunité non modélisée — arbitrage MJ).' },
    ],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: "LDB 42 « Endurance de l'anachorète »",
  },
  {
    label: 'Innocence immaculée',
    // « La cible perd 1 Point de Corruption (+1 par +2 DR). » — −1/+2 DR mécanique via `perSL`.
    // Maladresse : 1d10 Corruption pour les deux — la Maladresse de Prière déclenche déjà la
    // Colère ; le 1d10 reste MJ.
    ops: [
      { op: 'corruption', amount: -1, perSL: { every: 2, amount: -1 } },
      { op: 'narrative', text: 'Innocence immaculée : sur Maladresse, prêtre ET cible gagnent 1d10 Corruption — arbitrage MJ.' },
    ],
    durationRounds: null,
    curated: true,
    source: 'LDB 42 « Innocence immaculée »',
  },
  {
    label: 'Larmes de Shallya',
    ops: [
      { op: 'narrative', text: 'Larmes de Shallya : après 10 − BSoc Rounds de Prière ininterrompue, guérit 1 Blessure Critique (+1 par +2 DR ; jamais une amputation) — appliquer via la convalescence, arbitrage MJ.' },
    ],
    durationRounds: null,
    curated: true,
    source: 'LDB 42 « Larmes de Shallya »',
  },
  {
    label: 'Martyr',
    ops: [
      { op: 'narrative', text: 'Martyr : le prêtre reçoit les Dégâts subis par la cible (BE doublé pour ces Dégâts) — redirection non modélisée, arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 « Martyr »',
  },
];
