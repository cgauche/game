/**
 * Magie du Chaos — Domaine de Tzeentch (le Changeur de Voies) — LDB 51 / EDO, 14 sorts. Curation
 * B4 : les feux de Tzeentch sont des Projectiles (moteur missile) qui enflamment et corrompent
 * (composition test→corruption), « Aura dorée » accorde Protection, « Maître du Destin » accorde
 * de la Chance (gainFortune) ; les sorts de prescience, de malédiction de sorcier et de
 * transformation restent narratifs (effets de méta-jeu / arbitrage).
 */
import { SpellSpec } from '../../engine/spellspec';

export const MAGIE_TZEENTCH: SpellSpec[] = [
  {
    label: 'Aura dorée de Tzeentch',
    // « Le Lanceur bénéficie du Trait de créature Protection 9+. »
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 51 — Tzeentch « Aura dorée de Tzeentch »',
  },
  {
    label: 'Avantage de Tzeentch',
    // « Choisissez un Sort de n'importe quel Domaine ; vous pouvez le lancer comme mémorisé pour la
    //   durée. Une erreur de canalisation l'efface. » — accès temporaire à un Sort : arbitré.
    durationRounds: null, // « (Bonus d'Initiative) jours »
    curated: true,
    source: 'LDB 51 — Tzeentch « Avantage de Tzeentch »',
  },
  {
    label: 'Éclair du changement',
    // « Projectile magique, Dégâts +7. La Cible teste Résistance (+0) ou +1 Corruption. Maladresse →
    //   jet de Mutation immédiat + Talent Magie du Chaos (Tzeentch) ; un Point de Détermination
    //   résiste à la Mutation. » — Dégâts via le moteur missile ; Corruption à la touche ; la Mutation
    //   sur Maladresse reste journalisée.
    durationRounds: null,
    curated: true,
    source: 'LDB 51 — Tzeentch « Éclair du changement »',
  },
  {
    label: 'Feu bleu de Tzeentch',
    // « Projectile magique. Quiconque dans (BInit) m autour de la cible subit +3 Dégâts et gagne 1
    //   État En flammes. Si une cible de Taille ≥ Petite tombe à 0 PB sous cet État, 1d10 = 9 → deux
    //   Horreurs bleues jaillissent (la tuant). » — Dégâts ZdE (moteur missile) ; En flammes à la
    //   touche ; l'éclosion d'Horreurs reste journalisée.
    durationRounds: null,
    curated: true,
    source: 'LDB 51 — Tzeentch « Feu bleu de Tzeentch »',
  },
  {
    label: 'Feu rose de Tzeentch',
    // « Projectile magique, Dégâts +6, +1 État En flammes. Si une cible de Taille ≥ Petite tombe à 0
    //   PB sous cet État, 1d10 = 9 → une Horreur rose éclot (la tuant). » — Dégâts via le moteur
    //   missile ; En flammes à la touche ; l'éclosion reste journalisée.
    durationRounds: null,
    curated: true,
    source: 'LDB 51 — Tzeentch « Feu rose de Tzeentch »',
  },
  {
    label: 'Feu spirituel',
    // « La cible teste Calme (+0) ou +1 Corruption (+1 par +2 DR). Si une Mutation en résulte, jet sur
    //   les Mutations MENTALES + 1 État En flammes. » — Test de Corruption (composition) ; En flammes
    //   sur cible et la mutation mentale restent journalisés.
    durationRounds: null,
    curated: true,
    source: 'LDB 51 — Tzeentch « Feu spirituel »',
  },
  {
    label: 'Flammes vacillantes du capricieux destin',
    // « Les créatures vivantes/démons qui le perçoivent peuvent relancer chaque Test (comme un Point
    //   de Chance), mais testent Résistance (+0) ou +1 Corruption à chaque fois (sauf marque de
    //   Tzeentch). » — aura de relance corruptrice : arbitré.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 51 — Tzeentch « Flammes vacillantes du capricieux destin »',
  },
  {
    label: 'La Main Pourpre',
    // « Malédiction (paumes violettes) durant 1 heure par DR. » — code d'intimidation de la Main
    //   Pourpre : arbitré.
    durationRounds: null, // Variable
    curated: true,
    source: 'LDB 51 — Tzeentch « La Main Pourpre »',
  },
  {
    label: 'Maître du Destin',
    // « Pour chaque DR positif, gagnez 1 Point de Chance utilisable pendant la durée ; si le Sort
    //   échoue, +1 Corruption par DR négatif. » — Chance accordée (gainFortune au DR, temporaire) ;
    //   la Corruption sur échec reste journalisée (le Sort raté n'applique pas les ops de réussite).
    durationRounds: null, // « (Bonus de Force Mentale) jours » (Chance temporaire à échéance d'horloge)
    curated: true,
    source: 'LDB 51 — Tzeentch « Maître du Destin »',
  },
  {
    label: 'Malédiction de Tzeentch',
    // « Sur un Test opposé de FM gagné, la Cible perd l'accès à un Sort pris au hasard, 1 jour par
    //   DR. » — vol de sort : arbitré.
    durationRounds: null, // Variable
    curated: true,
    source: 'LDB 51 — Tzeentch « Malédiction de Tzeentch »',
  },
  {
    label: 'Parole de Tzeentch',
    // « Test opposé d'Intelligence : la Cible perdante gagne 1 État Sonné (+1 par DR d'écart) ;
    //   Maladresse → Inconscient + Corruption. Une fois les États retirés, Test de Résistance (+20)
    //   ou +1 Corruption. » — l'opposition d'Intelligence est un MULTIJET dans la modale (`opposed`) :
    //   la Cible perdante gagne 1 Sonné + 1 par DR d'ÉCART (échelle sur la marge). Les suites
    //   (Maladresse → Inconscient/Corruption, Résistance à la fin) restent journalisées.
    opposed: { kind: 'resist', char: 'Int' },
    durationRounds: { bonusOf: 'Int' },
    curated: true,
    source: 'LDB 51 — Tzeentch « Parole de Tzeentch »',
  },
  {
    label: "Percevoir l'écheveau",
    // « Le MJ révèle la Motivation et les Ambitions (court/long terme) d'une cible visible. » —
    //   prescience : arbitré.
    durationRounds: 1,
    curated: true,
    source: "LDB 51 — Tzeentch « Percevoir l'écheveau »",
  },
  {
    label: 'Tempête de feu de Tzeentch',
    // « Les Cibles gagnent l'État À Terre et sont impuissantes pour la durée. À la fin, Test de
    //   Résistance (+0) opposé à votre Langue (Magick) : perte → +1 Corruption (+1 par DR d'écart). »
    //   — À Terre mécanique ; l'impuissance et la Corruption de fin restent journalisées.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 51 — Tzeentch « Tempête de feu de Tzeentch »',
  },
  {
    label: 'Trahison de Tzeentch',
    // « La cible ne peut plus utiliser de Talents ni ajouter ses Augmentations de Compétences (Tests
    //   sur la Caractéristique non modifiée). » — sabotage des aptitudes : non modélisé (débuff
    //   global d'avances/Talents) : arbitré.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 51 — Tzeentch « Trahison de Tzeentch »',
  },
];
