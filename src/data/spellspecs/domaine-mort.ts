/**
 * Domaine de la Mort (Shyish) — LDB 48 « Magie des Arcanes (Mort) », 8 sorts.
 * Curation B4 : Projectiles drainants (Caresse de Laniph, Vol de vie) avec vol de vie (lifeSteal)
 * et retrait d'État sur le lanceur (casterOps) ; voile de PA + Peur ; les sorts d'âme (parler aux
 * morts, coup de grâce, sanctuaire anti-mort-vivant, faux invoquée) restent narratifs.
 * L'attribut de Domaine (Shyish : +1 Exténué aux vivants) reste assuré par domainAttributes.ts.
 * Aucune op nouvelle (lifeSteal/casterOps sont des champs de SpellSpec).
 */
import { SpellSpec } from '../../engine/spellspec';

export const DOMAINE_MORT: SpellSpec[] = [
  {
    label: 'Caresse de Laniph',
    // « Projectile magique avec Dégâts +6 qui ignore le Bonus d'Endurance et les PA. Pour chaque
    //   tranche de 2 Points de Blessure infligés, vous pouvez récupérer 1 Point de Blessure. » —
    //   Dégâts via le moteur missile (desc) ; vol de vie = ⌊dégâts/2⌋ rendu au lanceur.
    ops: [],
    lifeSteal: { num: 1, den: 2, round: 'floor' },
    durationRounds: null,
    curated: true,
    source: 'LDB 48 — Domaine de la Mort « Caresse de Laniph »',
  },
  {
    label: 'Dernières paroles',
    // « En touchant un corps mort la journée précédente, vous pouvez communiquer avec son âme… elle
    //   ne ment pas. » — communication avec les morts récents : arbitré.
    ops: [{ op: 'narrative', text: 'Dernières paroles : vous parlez à l’âme d’un mort récent (la journée précédente) ; elle ne peut que parler et ne ment pas — arbitrage MJ.' }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine de la Mort « Dernières paroles »',
  },
  {
    label: 'La Faux de Shyish',
    // « Vous invoquez une faux magique (Corps à corps (Arme d'hast), Dégâts BFM+3). Les ennemis
    //   Mort-vivant ne reçoivent pas d'Avantage quand ils sont Engagés avec vous. » — arme invoquée
    //   à statistiques propres + clause anti-mort-vivant : non modélisée (création d'arme) : arbitré.
    ops: [{ op: 'narrative', text: 'La Faux de Shyish : vous maniez une faux magique invoquée (Arme d’hast, Dégâts = BFM+3) ; les Mort-vivant Engagés avec vous ne gagnent pas d’Avantage — arbitrage MJ.' }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine de la Mort « La Faux de Shyish »',
  },
  {
    label: 'Le Voile violet de Shyish',
    // « Gagnez +(Bonus de Force Mentale) PA à toutes les Localisations, et le Trait Peur 1 (+1 par
    //   +2 DR). » — PA temporisés (apAll = BFM) + Peur échelonnée au DR.
    ops: [
      { op: 'apAll', amount: { bonusOf: 'FM' } },
      { op: 'grantTrait', trait: 'Peur', indice: 1, indicePerSL: { every: 2, amount: 1 } },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine de la Mort « Le Voile violet de Shyish »',
  },
  {
    label: 'Mort rapide',
    // « Si vous touchez une cible à 0 Blessure et au moins 2 Blessures Critiques, elle décède
    //   rapidement et ne peut pas être ranimée en mort-vivant. » — coup de grâce conditionnel : arbitré.
    ops: [{ op: 'narrative', text: 'Mort rapide : une cible à 0 Blessure et ≥ 2 Blessures Critiques meurt au contact (et ne peut être ranimée en mort-vivant) — arbitrage MJ.' }],
    durationRounds: null,
    curated: true,
    source: 'LDB 48 — Domaine de la Mort « Mort rapide »',
  },
  {
    label: 'Sanctifier',
    // « Les créatures Mort-vivant ne peuvent ni entrer ni sortir du cercle. » — barrière de
    //   protection anti-mort-vivant : arbitré.
    ops: [{ op: 'narrative', text: 'Sanctifier : un cercle de Shyish (diamètre BFM m) qu’aucun Mort-vivant ne peut franchir, pour la durée — arbitrage MJ.' }],
    durationRounds: null, // « (Force Mentale) minutes »
    curated: true,
    source: 'LDB 48 — Domaine de la Mort « Sanctifier »',
  },
  {
    label: 'Vol de vie',
    // « Projectile magique avec Dégâts +6 qui ignore les PA et inflige +1 État Exténué. De plus, vous
    //   retirez tout État Exténué dont vous souffrez, et vous guérissez la moitié (arrondie au
    //   supérieur) des Blessures subies par la cible. » — Dégâts via le moteur missile ; Exténué à la
    //   touche (cible) ; retrait d'Exténué sur le LANCEUR (casterOps) ; vol de vie = ⌈dégâts/2⌉.
    ops: [{ op: 'condition', name: 'Exténué' }],
    casterOps: [{ op: 'removeCondition', name: 'Exténué', value: 99 }],
    lifeSteal: { num: 1, den: 2, round: 'ceil' },
    durationRounds: null,
    curated: true,
    source: 'LDB 48 — Domaine de la Mort « Vol de vie »',
  },
  {
    label: "Vortex d'âmes",
    // « Les cibles dans la ZdE reçoivent +1 État Brisé. Contre des cibles Mort-vivant, Vortex d'âmes
    //   est un Projectile magique avec Dégâts +10 qui ignore le Bonus d'Endurance et les PA. » — le
    //   Brisé est mécanique (toute la ZdE) ; le Projectile +10 ne devrait frapper QUE les Mort-vivant
    //   (le moteur missile, piloté par la desc, l'applique à toutes les cibles → seul écart connu).
    ops: [
      { op: 'condition', name: 'Brisé' },
      { op: 'narrative', text: 'Vortex d’âmes : les +10 Dégâts (ignorant BE et PA) ne devraient toucher QUE les cibles Mort-vivant ; contre les vivants, seul le Brisé s’applique — arbitrage MJ.' },
    ],
    durationRounds: null,
    curated: true,
    source: "LDB 48 — Domaine de la Mort « Vortex d'âmes »",
  },
];
