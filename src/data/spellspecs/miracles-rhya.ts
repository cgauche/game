/**
 * Miracles de Rhya (déesse de la terre, de la fertilité et de la guérison) — LDB 43, 6 miracles.
 * Curation B4 : « Caresse de Rhya » soigne, « Secours de Rhya » retire un État, « Récolte de Rhya »
 * produit des Rations (op `giveTrapping`, système de provisions/Faim) ; abri, communion avec la
 * terre et union restent narratifs (Miracles de fertilité hors combat).
 */
import { SpellSpec } from '../../engine/spellspec';

export const MIRACLES_RHYA: SpellSpec[] = [
  {
    label: 'Abri de Rhya',
    // « Vous découvrez un abri naturel parfait (1 personne, +1 par +2 DR), introuvable ensuite. » —
    //   abri en pleine nature : arbitré.
    ops: [{ op: 'narrative', text: 'Abri de Rhya : en extérieur sauvage, un abri naturel protégé du vent et de la pluie apparaît (1 personne, +1 par +2 DR) et ne peut être redécouvert une fois quitté — arbitrage MJ.' }],
    durationRounds: null, // Spécial
    curated: true,
    source: 'LDB 43 — Miracles de Rhya « Abri de Rhya »',
  },
  {
    label: 'Caresse de Rhya',
    // « Choisissez : Guérir (Bonus de Sociabilité) Blessures OU Traiter 1 maladie naturelle. +1 effet
    //   par +2 DR. Résultats en ≥ 10 minutes. » — le soin est modélisé ; le choix de traiter une
    //   maladie à la place (et l'échelle au DR) reste journalisé.
    ops: [
      { op: 'heal', amount: { bonusOf: 'Soc' } },
      { op: 'narrative', text: 'Caresse de Rhya : au lieu du soin, vous pouvez traiter 1 maladie contractée naturellement ; +1 effet (au choix) par +2 DR ; les résultats mettent ≥ 10 minutes à se manifester — arbitrage MJ.' },
    ],
    durationRounds: null, // Spécial
    curated: true,
    source: 'LDB 43 — Miracles de Rhya « Caresse de Rhya »',
  },
  {
    label: 'Enfants de Rhya',
    // « Vous ressentez la présence de toutes les créatures conscientes dans un rayon de (Sociabilité)
    //   mètres (+(Sociabilité) m par +2 DR). » — perception de la vie : arbitré.
    ops: [{ op: 'narrative', text: 'Enfants de Rhya : en pleine nature, vous percevez toutes les créatures conscientes dans un rayon de (Sociabilité) m (+(Sociabilité) m par +2 DR) — arbitrage MJ.' }],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 43 — Miracles de Rhya « Enfants de Rhya »',
  },
  {
    label: 'Récolte de Rhya',
    // « Par round actif, vous faites pousser de quoi nourrir 1 personne (champignons en grotte,
    //   fruits/légumes en extérieur). » — MÉCANISÉ : effet RÉCURRENT (op `perRound`) qui produit
    //   1 Ration (1 jour) à CHAQUE Round où le Miracle reste actif (système de provisions/Faim).
    //   Durée de base 1 Round, ÉTENDUE par la Surincantation de Durée (LDB 47) → autant de Rations
    //   que de Rounds tenus. Déterministe — rien à arbitrer.
    ops: [{ op: 'perRound', ops: [{ op: 'giveTrapping', trapping: 'Ration (1 jour)' }] }],
    durationRounds: 1,
    curated: true,
    source: 'LDB 43 — Miracles de Rhya « Récolte de Rhya »',
  },
  {
    label: 'Secours de Rhya',
    // « Toutes les cibles retirent 1 État. Si cela retire TOUS leurs États, elles gagnent +10 à tous
    //   les Tests lors de leur prochain Tour. » — retrait d'État mécanique ; le bonus conditionnel
    //   « si plus aucun État » reste journalisé.
    ops: [
      { op: 'removeCondition' },
      { op: 'narrative', text: 'Secours de Rhya : si ce retrait élimine TOUS les États de la cible, elle gagne +10 à tous ses Tests lors de son prochain Tour — arbitrage MJ.' },
    ],
    durationRounds: null, // Instantané
    curated: true,
    source: 'LDB 43 — Miracles de Rhya « Secours de Rhya »',
  },
  {
    label: 'Union de Rhya',
    // « Le couple consacré concevra un enfant si c'est biologiquement possible. » — Miracle de
    //   fertilité : arbitré.
    ops: [{ op: 'narrative', text: 'Union de Rhya : vous bénissez l’union de deux âmes ; tant que le Miracle dure (heures), le couple concevra un enfant si c’est biologiquement possible — arbitrage MJ.' }],
    durationRounds: null, // « (Bonus de Sociabilité) heures »
    curated: true,
    source: 'LDB 43 — Miracles de Rhya « Union de Rhya »',
  },
];
