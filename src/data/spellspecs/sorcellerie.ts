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
    durationRounds: null, // Spécial
    curated: true,
    source: 'LDB 49 — Sorcellerie « Dégradation »',
  },
  {
    label: 'Horreur obsédante',
    // « Ceux qui entrent dans le lieu hanté subissent 1 État Exténué (hors Talent Sorcellerie) et,
    //   sans Test de Calme (+0), +1 Exténué et un État Brisé jusqu'à ce qu'ils quittent le lieu. » —
    //   hantise d'un lieu unique (déclenchée à l'entrée, hors combat) : arbitré.
    durationRounds: null, // « (Force Mentale) jours »
    curated: true,
    source: 'LDB 49 — Sorcellerie « Horreur obsédante »',
  },
  {
    label: 'Malédiction de douleur paralysante',
    // « Choisissez l'endroit poignardé (Jambe/Bras/Corps/Tête) : amputation fonctionnelle, chute,
    //   Exténué, Sonné/Inconscient… Vous pouvez changer de Localisation pour votre Action. » — choix
    //   de Localisation à effets multiples (proche d'une amputation temporaire) : arbitré.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 49 — Sorcellerie « Malédiction de douleur paralysante »',
  },
  {
    label: 'Malédiction de malchance',
    // « La cible subit −10 à tous ses Tests et ne peut pas dépenser de Points de Chance. » — le malus
    //   GLOBAL est mécanisé (op testMod, stacke par-dessus les États) ; le blocage de la Chance reste
    //   journalisé (ressource de joueur, sans objet sur une cible pilotée par l'IA).
    durationRounds: null, // « (Bonus de Force Mentale) jours »
    curated: true,
    source: 'LDB 49 — Sorcellerie « Malédiction de malchance »',
  },
  {
    label: 'Mauvais œil',
    // « Test opposé d'Intimidation/Calme + DR d'Incantation : la cible subit 1 État Exténué par DR+2
    //   d'écart ; au-delà de DR+6, un État Brisé. » — l'Exténué de base est mécanique ; l'échelle au
    //   DR du Test opposé reste journalisée.
    durationRounds: null, // Instantané
    curated: true,
    source: 'LDB 49 — Sorcellerie « Mauvais œil »',
  },
  {
    label: 'Menace rampante',
    // « Chaque cible se retrouve Engagée par une nuée de rats/araignées/serpents géants (Trait
    //   Nuée). Vous pouvez déplacer une nuée (Test d'Emprise sur les animaux). » — nuée alliée
    //   invoquée (moteur d'invocation : Rat géant + Trait Nuée) ; le déplacement de la nuée reste journalisé.
    summon: { ref: 'Rat géant', count: 1, addTraits: ['Nuée'], allyOfCaster: true },
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 49 — Sorcellerie « Menace rampante »',
  },
];
