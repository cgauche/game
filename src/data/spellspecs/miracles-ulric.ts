/**
 * Miracles d'Ulric (dieu de l'hiver, de la guerre et des loups) — LDB 42, 6 miracles. Curation B4 :
 * Frénésie/Peur accordées, châtiment du Roi de la neige (Blessures), invocation du loup blanc
 * (moteur d'invocation), hache d'hiver enchantée ; les auras de froid et l'endurance hivernale
 * restent narratives.
 */
import { SpellSpec } from '../../engine/spellspec';

export const MIRACLES_ULRIC: SpellSpec[] = [
  {
    label: 'Frisson du givre',
    // « Vous insufflez Peur 1 à tous les ennemis ; ceux dans un rayon de (Sociabilité) m perdent −1
    //   Avantage au début de chaque round. » — Peur 1 (aura du lanceur) ; la perte d'Avantage de zone
    //   reste journalisée.
    ops: [
      { op: 'grantTrait', trait: 'Peur', indice: 1 },
      { op: 'narrative', text: 'Frisson du givre : tous ceux dans un rayon de (Sociabilité) m perdent −1 Avantage au début de chaque round (gelés jusqu’aux os) — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: "LDB 42 — Miracles d'Ulric « Frisson du givre »",
  },
  {
    label: "Fureur d'Ulric",
    // « Les cibles gagnent le Trait de créature Frénésie. »
    ops: [{ op: 'grantTrait', trait: 'Frénésie' }],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: "LDB 42 — Miracles d'Ulric « Fureur d'Ulric »",
  },
  {
    label: 'Hurlement du loup',
    // « Un loup blanc — statistiques d'un Loup avec les Traits Frénésie, Magique et Taille (Grande) —
    //   combat vos ennemis pour la durée, puis repart. » — invocation d'un allié (moteur d'invocation).
    ops: [{ op: 'narrative', text: 'Hurlement du loup : à la fin du Miracle, le loup blanc repart aux Terrains de Chasse d’Ulric dans un hurlement effrayant — arbitrage MJ.' }],
    summon: { ref: 'Loup', count: 1, addTraits: ['Frénésie', 'Magique'], size: 'grande', allyOfCaster: true },
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: "LDB 42 — Miracles d'Ulric « Hurlement du loup »",
  },
  {
    label: 'Jugement du Roi de la neige',
    // « La cible subit 1d10 Blessures qui ignorent le Bonus d'Endurance et les PA. Si le MJ juge la
    //   cible ni faible, ni couarde, ni fourbe, vous subissez les effets à sa place. » — Blessures
    //   directes ; le jugement moral et le retour sur le lanceur restent journalisés.
    ops: [
      { op: 'wounds', amount: { dice: { n: 1, sides: 10 } } },
      { op: 'narrative', text: 'Jugement du Roi de la neige : si le MJ juge la cible ni faible, ni couarde, ni fourbe, c’est VOUS qui subissez ces Blessures à sa place — arbitrage MJ.' },
    ],
    durationRounds: null,
    curated: true,
    source: "LDB 42 — Miracles d'Ulric « Jugement du Roi de la neige »",
  },
  {
    label: "Morsure de l'hiver",
    // « Si vous portez une hache, elle est Magique, cause +DR Dégâts, et toute cible vivante frappée
    //   doit réussir un Test de Résistance (+0) ou gagner Sonné ; les frappes retirent l'Hémorragique
    //   et n'en causent jamais. » — Magique mécanique ; le +DR Dégâts, le Test/Sonné et la gestion de
    //   l'Hémorragique (conditionnels, hache seulement) restent journalisés.
    // « …toute cible VIVANTE frappée teste Résistance (+0) ou gagne Sonné. » — « vivante » = hors des
    //   Groupes Mort-vivant/Démon (système de Groupes) → Test à la touche gaté par exclusion.
    ops: [
      { op: 'enchantWeapon', addQualities: ['Magique'], onHitTest: { exceptGroups: ['Mort-vivant', 'Démon'], skill: 'Résistance', difficulty: 'intermediaire', onFail: [{ name: 'Sonné' }] } },
      { op: 'narrative', text: 'Morsure de l’hiver : ne vaut que si vous portez une hache ; elle inflige aussi +DR Dégâts et ses frappes retirent tout Hémorragique sans jamais en causer — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: "LDB 42 — Miracles d'Ulric « Morsure de l'hiver »",
  },
  {
    label: "Peau de loup d'hiver",
    // « Les cibles ne subissent aucune pénalité automatique due au froid et aux conditions
    //   hivernales (bien qu'elles ressentent toujours douleur et inconfort). » — endurance au froid :
    //   arbitré.
    ops: [{ op: 'narrative', text: 'Peau de loup d’hiver : pour la durée (heures), les cibles ne subissent aucune pénalité due au froid ou aux conditions hivernales — arbitrage MJ.' }],
    durationRounds: null, // « (Bonus de Sociabilité) heures »
    curated: true,
    source: "LDB 42 — Miracles d'Ulric « Peau de loup d'hiver »",
  },
];
