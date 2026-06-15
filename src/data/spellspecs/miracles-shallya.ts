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
    durationRounds: null,
    curated: true,
    source: 'LDB 42 « Amère catharsis »',
  },
  {
    label: 'Baume pour un esprit blessé',
    // « Tous les Traits Psychologiques sont retirés pour la durée du Miracle » — op suppressPsych
    // (Traits suspendus, restitués à l'échéance d'horloge : (BSoc) minutes via untilTime, #T3).
    durationRounds: null, // (Bonus de Sociabilité) minutes — durée d'horloge (cascade #T3)
    curated: true,
    source: 'LDB 42 « Baume pour un esprit blessé »',
  },
  {
    label: "Endurance de l'anachorète",
    // « La cible ne ressent aucune douleur, et ne subit aucune pénalité causée par les États. »
    // — drapeau ignoreStatePenalties (combatTestPenalty/testStatePenalty → 0) pour (BSoc) Rounds.
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: "LDB 42 « Endurance de l'anachorète »",
  },
  {
    label: 'Innocence immaculée',
    // « La cible perd 1 Point de Corruption (+1 par +2 DR). » — −1/+2 DR mécanique via `perSL`.
    // Maladresse : 1d10 Corruption pour les deux — la Maladresse de Prière déclenche déjà la
    // Colère ; le 1d10 reste MJ.
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
    durationRounds: null,
    curated: true,
    source: 'LDB 42 « Larmes de Shallya »',
  },
  {
    label: 'Martyr',
    // « Vous recevez tous les Dégâts subis en principe par vos cibles. Si vous prenez des Dégâts
    //   à cause de ce Miracle, votre Bonus d'Endurance est doublé pour le calcul des Points de
    //   Blessure subis à cause de ces Dégâts. » — op martyr : l'effet (id du prêtre) est posé
    //   sur la CIBLE protégée ; transfert aux points de mitigation (attaques + Projectiles).
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 « Martyr »',
  },
];
