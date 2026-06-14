/**
 * Sorcellerie (Magie des Sorcières) — LDB 49, 6 sorts. Curation B4. La Sorcellerie est faite de
 * malédictions à fort arbitrage (dégradations, hantises, poupées vaudou, malchance) qui opèrent
 * surtout hors du cadre tactique : elles restent donc largement `narrative` (rien d'inventé,
 * règle 2). Les États de combat nets ET le malus global « −10 à tous les Tests » (Malédiction de
 * malchance → op `testMod`) sont mécanisés. « Menace rampante » invoque une nuée (op `summon`).
 */
import { SpellSpec } from '../../engine/spellspec';

export const SORCELLERIE: SpellSpec[] = [
  {
    label: 'Dégradation',
    // « Ciblez un puits, un champ ou un animal domestique : l'eau devient stagnante, les cultures
    //   pourrissent, l'animal tombe malade et meurt en 10 − DR jours. » — sabotage rural : arbitré.
    ops: [{ op: 'narrative', text: 'Dégradation : un puits devient saumâtre, un champ pourrit en une nuit, ou un animal domestique tombe malade et meurt en 10 − DR jours — arbitrage MJ.' }],
    durationRounds: null, // Spécial
    curated: true,
    source: 'LDB 49 — Sorcellerie « Dégradation »',
  },
  {
    label: 'Horreur obsédante',
    // « Ceux qui entrent dans le lieu hanté subissent 1 État Exténué (hors Talent Sorcellerie) et,
    //   sans Test de Calme (+0), +1 Exténué et un État Brisé jusqu'à ce qu'ils quittent le lieu. » —
    //   hantise d'un lieu unique (déclenchée à l'entrée, hors combat) : arbitré.
    ops: [{ op: 'narrative', text: 'Horreur obsédante : quiconque entre dans le lieu hanté gagne 1 Exténué (hors Talent Sorcellerie) et, sans Test de Calme (+0), +1 Exténué et un Brisé tant qu’il y reste — arbitrage MJ.' }],
    durationRounds: null, // « (Force Mentale) jours »
    curated: true,
    source: 'LDB 49 — Sorcellerie « Horreur obsédante »',
  },
  {
    label: 'Malédiction de douleur paralysante',
    // « Choisissez l'endroit poignardé (Jambe/Bras/Corps/Tête) : amputation fonctionnelle, chute,
    //   Exténué, Sonné/Inconscient… Vous pouvez changer de Localisation pour votre Action. » — choix
    //   de Localisation à effets multiples (proche d'une amputation temporaire) : arbitré.
    ops: [{ op: 'narrative', text: 'Malédiction de douleur paralysante : poignardez la poupée à une Localisation — Jambe/Bras inutilisable (comme amputé), Corps (Exténué + À Terre sur Résistance ratée), Tête (Sonné + Inconscient sur Résistance ratée). Changer de Localisation = votre Action — arbitrage MJ.' }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 49 — Sorcellerie « Malédiction de douleur paralysante »',
  },
  {
    label: 'Malédiction de malchance',
    // « La cible subit −10 à tous ses Tests et ne peut pas dépenser de Points de Chance. » — le malus
    //   GLOBAL est mécanisé (op testMod, stacke par-dessus les États) ; le blocage de la Chance reste
    //   journalisé (ressource de joueur, sans objet sur une cible pilotée par l'IA).
    ops: [
      { op: 'testMod', amount: -10 },
      { op: 'narrative', text: 'Malédiction de malchance : la cible ne peut plus dépenser de Points de Chance tant que le Sort dure — arbitrage MJ.' },
    ],
    durationRounds: null, // « (Bonus de Force Mentale) jours »
    curated: true,
    source: 'LDB 49 — Sorcellerie « Malédiction de malchance »',
  },
  {
    label: 'Mauvais œil',
    // « Test opposé d'Intimidation/Calme + DR d'Incantation : la cible subit 1 État Exténué par DR+2
    //   d'écart ; au-delà de DR+6, un État Brisé. » — l'Exténué de base est mécanique ; l'échelle au
    //   DR du Test opposé reste journalisée.
    ops: [
      { op: 'condition', name: 'Exténué' },
      { op: 'narrative', text: 'Mauvais œil : Test opposé d’Intimidation/Calme (+ votre DR d’Incantation) — la cible subit +1 Exténué par tranche de DR+2 d’écart, et un Brisé au-delà de DR+6 — arbitrage MJ.' },
    ],
    durationRounds: null, // Instantané
    curated: true,
    source: 'LDB 49 — Sorcellerie « Mauvais œil »',
  },
  {
    label: 'Menace rampante',
    // « Chaque cible se retrouve Engagée par une nuée de rats/araignées/serpents géants (Trait
    //   Nuée). Vous pouvez déplacer une nuée (Test d'Emprise sur les animaux). » — nuée alliée
    //   invoquée (moteur d'invocation : Rat géant + Trait Nuée) ; le déplacement de la nuée reste journalisé.
    ops: [{ op: 'narrative', text: 'Menace rampante : pour votre Action, un Test d’Emprise sur les animaux envoie une nuée sur une autre cible à portée — arbitrage MJ.' }],
    summon: { ref: 'Rat géant', count: 1, addTraits: ['Nuée'], allyOfCaster: true },
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 49 — Sorcellerie « Menace rampante »',
  },
];
