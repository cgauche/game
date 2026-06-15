/**
 * Miracles de Sigmar (LDB 42 p.225-226) — les 6, curés (cultes des pré-tirés).
 * Les zones « rayon de (Bonus de Sociabilité) mètres » vivent dans la desc →
 * `zdeRadiusMeters` (clic-case) ; les dégâts qui ignorent BE+PA = op `wounds`.
 */
import { SpellSpec } from '../../engine/spellspec';

export const MIRACLES_SIGMAR: SpellSpec[] = [
  {
    label: 'Comète à Deux Queues',
    // « Tout ce qui se trouve dans un rayon de (BSoc) mètres subit 1d10 + DR Dégâts qui
    //   ignorent BE et PA, et gagne l'État En flammes. » — 1d10 + DR mécanique via `perSL`.
    durationRounds: null,
    zdeRadiusMeters: { bonusOf: 'Soc' },
    zdeExcludesCaster: true,
    curated: true,
    source: 'LDB 42 « Comète à Deux Queues »',
  },
  {
    label: "Feu de l'âme",
    // « Toutes les cibles dans la ZdE subissent 1d10 Blessures qui ignorent BE et PA.
    //   Les cibles possédant les Traits Mort-vivant et Démoniaque gagnent aussi En flammes. »
    //   — gate par Groupe (`onlyGroups`, engine/groups : folder bestiaire → Mort-vivant/Démon).
    //   L'option « +2 DR : étendre la ZdE OU +2 Dégâts aux impies » = un CHOIX → journalisée.
    durationRounds: null,
    zdeRadiusMeters: { bonusOf: 'Soc' },
    zdeExcludesCaster: true,
    curated: true,
    source: "LDB 42 « Feu de l'âme »",
  },
  {
    label: 'Flambeau de Vertu',
    // « Tous les alliés dans votre Ligne de Vue retirent instantanément tout État Brisé,
    //   et gagnent le Talent Sans peur pendant que le Miracle est actif. » Sans peur = op
    //   grantTalent (immunité Peur/Terreur mécanique) ; la condition de MAINTIEN « reste en
    //   Ligne de Vue » et la Psychologie imposée aux peaux-vertes restent arbitrage MJ.
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 « Flambeau de Vertu »',
  },
  {
    label: 'Marteau ardent de Sigmar',
    // « Si vous portez un marteau, il est considéré comme Magique, inflige +(BSoc) Dégâts et
    //   toute cible frappée reçoit l'État En flammes et l'État À Terre. » — op enchantWeapon
    //   (approximation : enchante l'arme TENUE, la nature « marteau » n'est pas vérifiée).
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 « Marteau ardent de Sigmar »',
  },
  {
    label: "N'écoutez point la Sorcière",
    // « Tous les Sorts qui ciblent quelque chose ou quelqu'un dans les (BSoc) mètres subissent une
    //   pénalité de -20 aux Tests de Langue (Magick) […] Pour chaque +2 DR, vous pouvez augmenter
    //   la zone d'effet d'un nombre de mètres égal à votre Bonus de Sociabilité. » — aura castWard
    //   portée par le prêtre, consommée au calcul du Test d'incantation (castWardPenalty).
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: "LDB 42 « N'écoutez point la Sorcière »",
  },
  {
    label: 'Vaincre les impies',
    // « Tous les alliés affectés reçoivent le Trait Psychologique Haine à l'égard des
    //   peaux-vertes, des morts-vivants et de tout ce qui est associé au Chaos. »
    //   — trois Haine ciblées (op grantTrait → parsePsychTraits → +1 DR vs le groupe haï).
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 « Vaincre les impies »',
  },
];
