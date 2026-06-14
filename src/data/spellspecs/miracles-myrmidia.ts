/**
 * Miracles de Myrmidia (déesse de la guerre stratège) — LDB 42 (6 miracles) + Aux Armes p. 79
 * (9 miracles). Curation B4 : bénédictions martiales de groupe (PA, Coude-à-coude, Haine, +10
 * CC/CT, Sans peur), enchantement de lance, éclat aveuglant, Terreur de soi ; l'aigle-espion, les
 * ordres tactiques, la révélation d'ennemi et les compulsions de Charge restent narratifs. Aucune
 * op nouvelle.
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
  // --- Aux Armes p. 79 — 9 miracles supplémentaires de Myrmidia ---
  {
    label: 'Commander la Légion',
    // « Vous pouvez donner un ordre à n'importe quel allié dans votre ligne de vue. […] Tout Test de
    //   Commandement que vous effectuez en conséquence bénéficie d'un bonus de +10. » — le bonus porte
    //   sur le Test que FAIT le prêtre, hors champ d'une op de cible : journalisé.
    ops: [{ op: 'narrative', text: 'Commander la Légion : un ordre à un allié à vue ; votre prochain Test de Commandement lié bénéficie de +10 — arbitrage MJ.' }],
    durationRounds: null, // Instantanée
    curated: true,
    source: 'Aux Armes p. 79 — Miracles de Myrmidia « Commander la Légion »',
  },
  {
    label: 'Connais Ton Ennemi',
    // « Le MJ doit vous permettre de consulter le profil, les Traits, les Compétences et les Talents
    //   de la cible. » — révélation d'information (l'inspection en jeu l'affiche) : narratif.
    ops: [{ op: 'narrative', text: 'Connais Ton Ennemi : profil, Traits, Compétences et Talents d’un ennemi à portée sont révélés (panneau d’inspection).' }],
    durationRounds: null, // Instantanée
    curated: true,
    source: 'Aux Armes p. 79 — Miracles de Myrmidia « Connais Ton Ennemi »',
  },
  {
    label: 'Dévotion de la Vierge Guerrière',
    // « Tous les myrmidéens à portée gagnent +1 rang du Talent Sans peur (Ennemi). » — Sans peur
    //   accordé ; la spécialisation (Ennemi) du Talent reste journalisée.
    ops: [
      { op: 'grantTalent', talent: 'Sans peur' },
      { op: 'narrative', text: 'Dévotion de la Vierge Guerrière : +1 rang Sans peur visant un ennemi précis (individu ou espèce) — arbitrage MJ.' },
    ],
    durationRounds: 4,
    curated: true,
    source: 'Aux Armes p. 79 — Miracles de Myrmidia « Dévotion de la Vierge Guerrière »',
  },
  {
    label: 'En Bon Ordre',
    // « N'importe lequel de vos alliés peut rompre le combat sans permettre à l'ennemi de gagner
    //   1 Avantage et de porter une attaque gratuite (Fuite). » — modifie le Désengagement : journalisé.
    ops: [{ op: 'narrative', text: 'En Bon Ordre : vos alliés à portée peuvent rompre le combat (Fuite) sans céder d’Avantage ni subir d’attaque gratuite — arbitrage MJ.' }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'Aux Armes p. 79 — Miracles de Myrmidia « En Bon Ordre »',
  },
  {
    label: 'En Terrain Dangereux',
    // « Vos alliés ne reçoivent pas d'État Brisé. » — immunité au Brisé pour la durée : journalisée
    //   (aucune op d'immunité d'État dédiée).
    ops: [{ op: 'narrative', text: 'En Terrain Dangereux : vos alliés à portée ne reçoivent pas l’État Brisé tant que le Miracle est actif — arbitrage MJ.' }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'Aux Armes p. 79 — Miracles de Myrmidia « En Terrain Dangereux »',
  },
  {
    label: 'Frappe Rapide',
    // « Au début de chaque Round, Test d'Initiative Intermédiaire (+0) pour gagner une attaque
    //   gratuite immédiate (arme de la main principale). » — attaque hors-tour conditionnelle : journalisée.
    ops: [{ op: 'narrative', text: 'Frappe Rapide : au début de chaque Round, un Test d’Initiative Intermédiaire (+0) réussi octroie une attaque gratuite immédiate (main principale) — arbitrage MJ.' }],
    durationRounds: 3,
    curated: true,
    source: 'Aux Armes p. 79 — Miracles de Myrmidia « Frappe Rapide »',
  },
  {
    label: 'Fureur Vengeresse',
    // « Vous devez Charger et attaquer l'ennemi impénitent le plus proche. Vous pouvez relancer
    //   tous les jets de Compétence Corps à corps. » — compulsion + relance générale : journalisé.
    ops: [{ op: 'narrative', text: 'Fureur Vengeresse : vous devez Charger l’ennemi impénitent le plus proche et pouvez relancer tous vos jets de Corps à corps tant que le Miracle est actif — arbitrage MJ.' }],
    durationRounds: 6,
    curated: true,
    source: 'Aux Armes p. 79 — Miracles de Myrmidia « Fureur Vengeresse »',
  },
  {
    label: 'Prouesses Martiales',
    // « Tous les alliés à portée bénéficient d'un bonus de +10 à leur CC et à leur CT. »
    ops: [
      { op: 'charMod', char: 'CC', mod: 10 },
      { op: 'charMod', char: 'CT', mod: 10 },
    ],
    durationRounds: 4,
    curated: true,
    source: 'Aux Armes p. 79 — Miracles de Myrmidia « Prouesses Martiales »',
  },
  {
    label: "Terrifier l'Ennemi",
    // « Vous gagnez le Trait de créature Terreur 1. »
    ops: [{ op: 'grantTrait', trait: 'Terreur', indice: 1 }],
    durationRounds: 1,
    curated: true,
    source: "Aux Armes p. 79 — Miracles de Myrmidia « Terrifier l'Ennemi »",
  },
];
