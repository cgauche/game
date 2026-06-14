/**
 * Miracles de Myrmidia (déesse de la guerre stratège) — LDB 42, 6 miracles. Curation B4 :
 * bénédictions martiales de groupe (PA, Coude-à-coude, Haine), enchantement de lance, éclat
 * aveuglant ; l'aigle-espion divin reste narratif. Aucune op nouvelle.
 */
import { SpellSpec } from '../../engine/spellspec';

export const MIRACLES_MYRMIDIA: SpellSpec[] = [
  {
    label: 'Appel à la Fureur',
    // « Tous les alliés affectés reçoivent le Trait Psychologique Haine à l'égard de tous ceux qui
    //   les engagent en combat. » — Haine accordée ; le ciblage « ceux qui les engagent » reste journalisé.
    ops: [
      { op: 'grantTrait', trait: 'Haine' },
      { op: 'narrative', text: 'Appel à la Fureur : la Haine vise précisément ceux qui engagent l’allié au combat — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 — Miracles de Myrmidia « Appel à la Fureur »',
  },
  {
    label: 'Bouclier de Myrmidia',
    // « Toutes les cibles affectées gagnent +1 PA à toutes les Localisations. »
    ops: [{ op: 'apAll', amount: 1 }],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 — Miracles de Myrmidia « Bouclier de Myrmidia »',
  },
  {
    label: 'Inspirant',
    // « Les cibles affectées gagnent +1 Talent Coude-à-coude. »
    ops: [
      { op: 'grantTalent', talent: 'Coude-à-coude' },
      { op: 'narrative', text: 'Inspirant : +1 Talent Coude-à-coude (bonus de surnombre coopératif) — arbitrage MJ si non câblé.' },
    ],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 — Miracles de Myrmidia « Inspirant »',
  },
  {
    label: 'Lance de Myrmidia',
    // « Si vous portez une lance, elle gagne l'Atout Percutante, et est considérée comme Magique. »
    ops: [
      { op: 'enchantWeapon', requiresWeapon: 'lance', addQualities: ['Percutante', 'Magique'] },
    ],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 — Miracles de Myrmidia « Lance de Myrmidia »',
  },
  {
    label: "Œil de l'aigle",
    // « Un aigle spectral se manifeste ; vous voyez par ses yeux et contrôlez son vol, mais ne voyez
    //   plus par les vôtres (vulnérable). » — serviteur divin de reconnaissance : non modélisé (en
    //   attente du moteur d'invocation) : arbitré.
    ops: [{ op: 'narrative', text: 'Œil de l’aigle : un aigle spectral invulnérable survole le champ ; vous percevez par ses yeux et dirigez son vol, mais vous ne percevez plus par les vôtres (vulnérable) — arbitrage MJ.' }],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: "LDB 42 — Miracles de Myrmidia « Œil de l'aigle »",
  },
  {
    label: 'Soleil flamboyant',
    // « Tous les non Myrmidiens qui regardent dans votre direction reçoivent 1 État Aveuglé. Pour
    //   chaque +2 DR, +1 État Aveuglé. » — Aveuglé échelonné au DR ; le ciblage « ceux qui regardent,
    //   hors Myrmidiens » reste journalisé.
    ops: [
      { op: 'condition', name: 'Aveuglé', value: 1, valuePerSL: { every: 2, amount: 1 } },
      { op: 'narrative', text: 'Soleil flamboyant : ne touche que les non-Myrmidiens qui regardent dans votre direction — arbitrage MJ.' },
    ],
    durationRounds: null, // Instantané
    curated: true,
    source: 'LDB 42 — Miracles de Myrmidia « Soleil flamboyant »',
  },
];
