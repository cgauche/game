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
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: "LDB 42 — Miracles d'Ulric « Frisson du givre »",
  },
  {
    label: "Fureur d'Ulric",
    // « Les cibles gagnent le Trait de créature Frénésie. »
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: "LDB 42 — Miracles d'Ulric « Fureur d'Ulric »",
  },
  {
    label: 'Hurlement du loup',
    // « Un loup blanc — statistiques d'un Loup avec les Traits Frénésie, Magique et Taille (Grande) —
    //   combat vos ennemis pour la durée, puis repart. » — invocation d'un allié (moteur d'invocation).
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: "LDB 42 — Miracles d'Ulric « Hurlement du loup »",
  },
  {
    label: 'Jugement du Roi de la neige',
    // « La cible subit 1d10 Blessures qui ignorent le Bonus d'Endurance et les PA. Si le MJ juge la
    //   cible ni faible, ni couarde, ni fourbe, vous subissez les effets à sa place. » — Blessures
    //   directes ; le jugement moral et le retour sur le lanceur restent journalisés.
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
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: "LDB 42 — Miracles d'Ulric « Morsure de l'hiver »",
  },
  {
    label: "Peau de loup d'hiver",
    // « Les cibles ne subissent aucune pénalité automatique due au froid et aux conditions
    //   hivernales (bien qu'elles ressentent toujours douleur et inconfort). » — immunité à
    //   l'EXPOSITION météo (op weatherWard, lue par engine/exposure) ; la sensation reste narrative.
    durationRounds: null, // « (Bonus de Sociabilité) heures »
    curated: true,
    source: "LDB 42 — Miracles d'Ulric « Peau de loup d'hiver »",
  },
];
