/**
 * Miracles de Shallya (LDB 42 p.227) — les 6, curés (culte du pré-tiré prêtre).
 */
import { SpellSpec } from '../../engine/spellspec';

export const MIRACLES_SHALLYA: SpellSpec[] = [
  {
    label: 'Amère catharsis',
    // « Aspire un poison, ou une maladie, de la cible, le retirant complètement de son
    //   organisme. Pour chaque +2 DR, vous pouvez purger un autre poison ou maladie. » —
    //   États Empoisonné purgés + maladies retirées (op cureDisease, 1 + ⌊DR/2⌋) ;
    //   l'auto-Blessure du prêtre (1d10 − BSoc par purge, non mitigée) reste journalisée
    //   (le prêtre n'est pas la cible de l'op).
    ops: [
      { op: 'removeCondition', name: 'Empoisonné', value: 99 },
      { op: 'cureDisease', count: 1, countPerSL: { every: 2, amount: 1 } },
      { op: 'narrative', text: 'Amère catharsis : le prêtre subit 1d10 − BSoc Blessures NON mitigées par poison/maladie purgé — arbitrage MJ.' },
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
    // « La cible ne ressent aucune douleur, et ne subit aucune pénalité causée par les États. »
    // — drapeau ignoreStatePenalties (combatTestPenalty/testStatePenalty → 0) pour (BSoc) Rounds.
    ops: [
      { op: 'ignoreStatePenalties' },
      { op: 'narrative', text: 'Endurance de l’anachorète : la cible ne ressent aucune douleur (effets hors pénalités d’États — arbitrage MJ).' },
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
    // « Vous priez pendant 10 − BSoc rounds, et vous guérissez la cible d'1 Blessure
    //   Critique. Pour chaque +2 DR, +1 — jamais une amputation. » — op cureCriticalWound
    //   (retire un trauma de convalescence + criticalWounds−−) ; le CANAL de Prière
    //   ininterrompue (10 − BSoc Rounds) reste journalisé.
    ops: [
      { op: 'cureCriticalWound', count: 1, countPerSL: { every: 2, amount: 1 } },
      { op: 'narrative', text: 'Larmes de Shallya : exige 10 − BSoc Rounds de Prière ininterrompue — arbitrage MJ.' },
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
