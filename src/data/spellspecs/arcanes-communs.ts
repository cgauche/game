/**
 * Sorts d'Arcane communs (LDB 47 p.242-245) — les 23, curés. Accessibles à tout
 * Domaine. Les Projectiles magiques (Carreau, Explosion, Attaques en chaîne,
 * Souffle) sont résolus par le moteur missile (ops = effets additionnels) ; les
 * sorts à Trait de créature temporisé (Effrayant, Terrifiant, Protection, Vol…)
 * et les utilitaires restent `narrative` (journal + arbitrage MJ, rien d'inventé).
 */
import { SpellSpec } from '../../engine/spellspec';

const N = (label: string, text: string, durationRounds: SpellSpec['durationRounds'] = { bonusOf: 'FM' }): SpellSpec => ({
  label,
  ops: [{ op: 'narrative', text }],
  durationRounds,
  curated: true,
  source: `LDB 47 p.242-245 « ${label} »`,
});

export const ARCANES_COMMUNS: SpellSpec[] = [
  N('Arme aethyrique', 'Arme aethyrique : arme de Corps à corps MAGIQUE de Dégâts = BFM, toute Compétence de CC utilisable (arbitrage MJ — enchantement d’arme non modélisé).'),
  {
    label: 'Armure Aethyrique',
    // « Vous gagnez +1 PA à toutes les Localisations » — PA temporisés, lus à la mitigation.
    ops: [{ op: 'apAll', amount: 1 }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.242 « Armure Aethyrique »',
  },
  {
    label: 'Attaques en chaîne',
    ops: [{ op: 'narrative', text: 'Attaques en chaîne : si la cible tombe à 0 Blessure, le Projectile rebondit sur une cible à BFM mètres (arbitrage MJ).' }],
    durationRounds: null, // Projectile magique +4 (moteur missile)
    curated: true,
    source: 'LDB 47 p.242 « Attaques en chaîne »',
  },
  N('Aura ordinaire', 'Aura ordinaire : votre nature magique est indétectable (Perception de la magie et similaires).', null),
  N('Bouclier anti-flèches', 'Bouclier anti-flèches : les projectiles ORGANIQUES (flèches…) entrant dans la ZdE sont détruits ; les inorganiques passent (arbitrage MJ).'),
  N('Bouclier magique', 'Bouclier magique : +BFM DR à vos tentatives de Dissipation tant que le Sort est actif (la Dissipation n’est pas encore modélisée).'),
  {
    label: 'Carreau',
    ops: [], // Projectile magique +4 — entièrement résolu par le moteur missile.
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.243 « Carreau »',
  },
  {
    label: 'Chute',
    // « À moins que la cible réussisse un Test de Dextérité Intermédiaire (+0), l'objet tombe.
    //   Pour chaque +2 DR, −10 supplémentaire au Test » (le −10/DR : arbitrage — le Test est posé tel quel).
    ops: [{ op: 'test', skill: 'Dextérité', difficulty: 'intermediaire', onFail: [{ op: 'narrative', text: 'Chute : l’objet tenu tombe (arme au sol — arbitrage MJ).' }] }],
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.243 « Chute »',
  },
  N("Déplacement d'objet", 'Déplacement d’objet : déplace un objet inanimé (Force = votre FM) de BFM mètres.', null),
  N('Dôme', 'Dôme : Protection (6+) contre les attaques magiques/à distance venant de l’extérieur, pour quiconque est dans la ZdE.'),
  N('Effrayant', 'Effrayant : vous gagnez Peur 1 tant que le Sort est actif (+1 par +3 DR) — Trait temporisé, arbitrage MJ.'),
  {
    label: 'Enchevêtrement',
    type: 'Magie des Arcanes', // ≠ du miracle de Taal homonyme (Invocation)
    // « Votre cible gagne un État Empêtré d'une Force égale à votre Intelligence.
    //   Pour chaque +2 DR, +1 État Empêtré. » (La Force de l'entrave = Int du lanceur : journalisée —
    //   le Test de libération du jeu oppose la Force de la SOURCE, LDB 16 l.61.)
    ops: [
      { op: 'condition', name: 'Empêtré' },
      { op: 'narrative', text: 'Enchevêtrement : Force de l’entrave = Intelligence du lanceur ; +1 Empêtré par +2 DR (arbitrage MJ).' },
    ],
    durationRounds: null, // « jusqu'à ce que la cible se libère » (Spécial)
    curated: true,
    source: 'LDB 47 p.243 « Enchevêtrement »',
  },
  N('Envol', 'Envol : vous gagnez le Trait Vol (Agilité) tant que le Sort est actif (déplacement aérien — arbitrage MJ).'),
  {
    label: 'Explosion',
    ops: [], // Projectile magique +3 en ZdE — moteur missile + ciblage de zone (clic-case).
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.243 « Explosion »',
  },
  N('Perturbant', 'Perturbant : vous gagnez le Trait Perturbant tant que le Sort est actif (−10 aux Tests sociaux adverses — arbitrage MJ).'),
  N('Pont', 'Pont : pont d’énergie de BFM mètres (long./larg.), +BFM mètres par +2 DR (arbitrage MJ).'),
  {
    label: 'Poussée',
    // « Toutes les créatures à BFM mètres sont repoussées de BFM mètres et gagnent À Terre » —
    // zone AUTOUR DU LANCEUR : rayon porté par la spec ; le recul reste narratif (déplacement forcé
    // non modélisé), l'État À Terre s'applique à chaque cible de la zone.
    ops: [
      { op: 'condition', name: 'À Terre' },
      { op: 'narrative', text: 'Poussée : repoussé de BFM mètres (collision avec un obstacle : Dégâts = distance restante — arbitrage MJ).' },
    ],
    durationRounds: null,
    zdeRadiusMeters: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.244 « Poussée »',
  },
  N('Protection', 'Protection : vous gagnez le Trait Protection (9+) tant que le Sort est actif (arbitrage MJ).'),
  N('Sang corrosif', 'Sang corrosif : vous gagnez le Trait Sang corrosif tant que le Sort est actif (arbitrage MJ).'),
  {
    label: 'Souffle',
    ops: [{ op: 'narrative', text: 'Souffle : attaque de Souffle (type selon votre Domaine) — Projectile magique de Dégâts = votre Bonus d’Endurance.' }],
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.244 « Souffle »',
  },
  N('Téléportation', 'Téléportation : vous vous téléportez de BFM mètres (+BFM par +2 DR) — déplacement hors grille, arbitrage MJ.', null),
  N('Terrifiant', 'Terrifiant : vous gagnez le Trait Terreur 1 tant que le Sort est actif (arbitrage MJ).'),
  N("Vision dans l'obscurité", 'Vision dans l’obscurité : vous gagnez le Trait Infravision tant que le Sort est actif.'),
];
