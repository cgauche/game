/**
 * Miracles de Manann (dieu de la mer) — LDB 42, 6 miracles. Curation B4 : les malédictions de
 * noyade infligent des États et la Suffocation ; « Générosité de Manann » produit des Rations
 * (op `giveTrapping`, système de provisions/Faim) ; les Miracles de navigation (encalminer/propulser
 * un navire, marcher sur l'eau) restent narratifs.
 */
import { SpellSpec } from '../../engine/spellspec';

export const MIRACLES_MANANN: SpellSpec[] = [
  {
    label: 'Encalminé',
    // « Le navire ciblé est complètement encalminé ; une zone de calme l'entoure (BInit m). » —
    //   Miracle naval : arbitré.
    ops: [{ op: 'narrative', text: 'Encalminé : un navire dans la Ligne de vue est privé de vent pendant 1 heure ; une zone d’eaux calmes (BInit m) l’entoure et le suit s’il avance autrement — arbitrage MJ.' }],
    durationRounds: null,
    curated: true,
    source: 'LDB 42 — Miracles de Manann « Encalminé »',
  },
  {
    label: 'Générosité de Manann',
    // « Vous attrapez assez de poisson pour nourrir 1 personne (2 en mer), +1 par +2 DR. » —
    //   subsistance MÉCANISÉE : 1 Ration (1 jour) +1 par +2 DR (système de provisions/Faim) ; le
    //   doublement « en pleine mer » reste journalisé (contexte hors état du combat).
    ops: [
      { op: 'giveTrapping', trapping: 'Ration (1 jour)', perSL: { every: 2, amount: 1 } },
      { op: 'narrative', text: 'Générosité de Manann : en pleine mer, la prise nourrit le double (Rations × 2) — arbitrage MJ.' },
    ],
    durationRounds: null,
    curated: true,
    source: 'LDB 42 — Miracles de Manann « Générosité de Manann »',
  },
  {
    label: 'Marcher sur les eaux',
    // « Vous traversez une étendue d'eau libre (≥ 10 m de large) comme un terrain solide. » — Miracle
    //   de déplacement : arbitré.
    ops: [{ op: 'narrative', text: 'Marcher sur les eaux : vous franchissez une grande étendue d’eau (≥ 10 m de large) comme un sol ferme, pour la durée — arbitrage MJ.' }],
    durationRounds: null, // « (Bonus de Sociabilité) minutes »
    curated: true,
    source: 'LDB 42 — Miracles de Manann « Marcher sur les eaux »',
  },
  {
    label: 'Mer déchainée',
    // « La cible gagne les États Aveuglé, Assourdi et Exténué et doit réussir un Test d'Agilité
    //   Accessible (+20) pour utiliser son Mouvement ; échec → À Terre. » — les trois États sont
    //   mécaniques ; le Test de déplacement reste journalisé.
    ops: [
      { op: 'condition', name: 'Aveuglé' },
      { op: 'condition', name: 'Assourdi' },
      { op: 'condition', name: 'Exténué' },
      { op: 'narrative', text: 'Mer déchainée : pour utiliser son Mouvement, la cible doit réussir un Test d’Agilité Accessible (+20), sinon elle gagne aussi À Terre — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 — Miracles de Manann « Mer déchainée »',
  },
  {
    label: 'Vents favorables',
    // « Le voilier ciblé se déplace à sa vitesse maximale ; +10 aux Tests pour le diriger. » —
    //   Miracle naval : arbitré.
    ops: [{ op: 'narrative', text: 'Vents favorables : un voilier dans la Ligne de vue file à sa vitesse maximale (quels que soient vent/marée/courant) et gagne +10 à tous les Tests de pilotage, pendant 1 heure — arbitrage MJ.' }],
    durationRounds: null,
    curated: true,
    source: 'LDB 42 — Miracles de Manann « Vents favorables »',
  },
  {
    label: "Visage de l'homme noyé",
    // « La cible gagne Exténué et est soumise aux règles de Noyade et de Suffocation pendant la durée.
    //   À la fin, Test de Résistance Difficile (−20) ou À Terre. » — Exténué + Suffocation mécaniques ;
    //   le Test de fin reste journalisé.
    ops: [
      { op: 'condition', name: 'Exténué' },
      { op: 'suffocate' },
      { op: 'narrative', text: 'Visage de l’homme noyé : à la fin du Miracle, la cible effectue un Test de Résistance Difficile (−20) sous peine de gagner l’État À Terre — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: "LDB 42 — Miracles de Manann « Visage de l'homme noyé »",
  },
];
