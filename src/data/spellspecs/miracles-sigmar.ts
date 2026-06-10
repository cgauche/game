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
    ops: [
      { op: 'wounds', amount: { dice: { n: 1, sides: 10 } }, perSL: { every: 1, amount: 1 } },
      { op: 'condition', name: 'En flammes' },
      { op: 'narrative', text: 'Comète à Deux Queues : cible les ennemis de Sigmar, à l’extérieur seulement — arbitrage MJ.' },
    ],
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
    ops: [
      { op: 'wounds', amount: { dice: { n: 1, sides: 10 } } },
      { op: 'condition', name: 'En flammes', onlyGroups: ['Mort-vivant', 'Démon'] },
      { op: 'narrative', text: 'Feu de l’âme : par +2 DR, étendre la ZdE de +BSoc mètres OU +2 Dégâts aux peaux-vertes/morts-vivants/serviteurs de la Ruine — au choix, arbitrage MJ.' },
    ],
    durationRounds: null,
    zdeRadiusMeters: { bonusOf: 'Soc' },
    zdeExcludesCaster: true,
    curated: true,
    source: "LDB 42 « Feu de l'âme »",
  },
  {
    label: 'Flambeau de Vertu',
    // « Tous les alliés dans votre Ligne de Vue retirent instantanément tout État Brisé,
    //   et gagnent le Talent Sans peur pendant que le Miracle est actif. »
    ops: [
      { op: 'removeCondition', name: 'Brisé', value: 99 },
      { op: 'narrative', text: 'Flambeau de Vertu : Talent Sans peur tant que le Miracle est actif et que la cible reste en Ligne de Vue ; les peaux-vertes en LdV doivent tester leur Psychologie (arbitrage MJ).' },
    ],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 « Flambeau de Vertu »',
  },
  {
    label: 'Marteau ardent de Sigmar',
    ops: [
      { op: 'narrative', text: 'Marteau ardent : votre marteau devient Magique, +BSoc Dégâts, et chaque cible frappée reçoit En flammes + À Terre (enchantement d’arme — arbitrage MJ).' },
    ],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 « Marteau ardent de Sigmar »',
  },
  {
    label: "N'écoutez point la Sorcière",
    // « Tous les Sorts qui ciblent quelque chose dans les (BSoc) mètres subissent −20 aux
    //   Tests de Langue (Magick). » — aura anti-magie : non modélisable par cible (la pénalité
    //   frappe les LANCEURS adverses selon leur cible) → journalisé fidèlement.
    ops: [
      { op: 'narrative', text: 'N’écoutez point la Sorcière : −20 aux Tests de Langue (Magick) de tout Sort ciblant la zone de BSoc mètres autour du prêtre (+BSoc m / −10 par +2 DR) — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: "LDB 42 « N'écoutez point la Sorcière »",
  },
  {
    label: 'Vaincre les impies',
    // « Tous les alliés affectés reçoivent le Trait Psychologique Haine à l'égard des
    //   peaux-vertes, des morts-vivants et de tout ce qui est associé au Chaos. »
    //   — trois Haine ciblées (op grantTrait → parsePsychTraits → +1 DR vs le groupe haï).
    ops: [
      { op: 'grantTrait', trait: 'Haine (Peaux-Vertes)' },
      { op: 'grantTrait', trait: 'Haine (Morts-vivants)' },
      { op: 'grantTrait', trait: 'Haine (Démons)' },
    ],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 « Vaincre les impies »',
  },
];
