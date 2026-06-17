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
    durationRounds: null,
    curated: true,
    source: 'LDB 48 — Domaine de la Mort « Caresse de Laniph »',
  },
  {
    label: 'Dernières paroles',
    // « En touchant un corps mort la journée précédente, vous pouvez communiquer avec son âme… elle
    //   ne ment pas. » — communication avec les morts récents : arbitré.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine de la Mort « Dernières paroles »',
  },
  {
    label: 'La Faux de Shyish',
    // « Vous invoquez une faux magique, qui peut être portée en combat, utilisant la Compétence Corps
    //   à corps (Arme d'hast). Elle agit comme une faux banale avec une valeur de Dégâts égale à votre
    //   Bonus de Force Mentale +3. Les ennemis possédant le Trait Mort-vivant ne reçoivent pas
    //   d'Avantage quand ils sont Engagés en combat avec vous. » — INVOQUÉE (op grantWeapon) : Arme
    //   d'hast magique à 2 mains, Dégâts FIXES = BFM+3. La clause anti-Avantage des Mort-vivant
    //   (modificateur relationnel non exprimable en une op) reste journalisée.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine de la Mort « La Faux de Shyish » (l.433)',
  },
  {
    label: 'Le Voile violet de Shyish',
    // « Gagnez +(Bonus de Force Mentale) PA à toutes les Localisations, et le Trait Peur 1 (+1 par
    //   +2 DR). » — PA temporisés (apAll = BFM) + Peur échelonnée au DR.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine de la Mort « Le Voile violet de Shyish »',
  },
  {
    label: 'Mort rapide',
    // « Si vous touchez une cible à 0 Blessure et au moins 2 Blessures Critiques, elle décède
    //   rapidement et ne peut pas être ranimée en mort-vivant. » — coup de grâce conditionnel : arbitré.
    durationRounds: null,
    curated: true,
    source: 'LDB 48 — Domaine de la Mort « Mort rapide »',
  },
  {
    label: 'Sanctifier',
    // « Les créatures Mort-vivant ne peuvent ni entrer ni sortir du cercle. » — barrière de
    //   protection anti-mort-vivant : arbitré.
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
    durationRounds: null,
    curated: true,
    source: "LDB 48 — Domaine de la Mort « Vortex d'âmes »",
  },
];
