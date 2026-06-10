/**
 * Sorts d'Arcane communs (LDB 47 p.242-245) — les 23, curés. Accessibles à tout
 * Domaine. Les Projectiles magiques (Carreau, Explosion, Attaques en chaîne,
 * Souffle) sont résolus par le moteur missile (ops = effets additionnels) ; les
 * sorts à Trait de créature temporisé (Effrayant, Terrifiant, Protection, Envol,
 * Perturbant, Sang corrosif, Vision dans l'obscurité) passent par l'op `grantTrait`
 * (Jalon 2.6) ; les utilitaires hors grille restent `narrative` (rien d'inventé).
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
  {
    label: 'Arme aethyrique',
    // « Vous créez une arme de Corps à corps dont les Dégâts sont égaux à votre BFM… L'arme est
    //   considérée comme Magique. » — approximation : l'Atout Magique est posé sur l'arme TENUE
    //   (op enchantWeapon) ; la création d'une arme dédiée (Dégâts = BFM seuls, toute Compétence
    //   de CC) reste journalisée.
    ops: [
      { op: 'enchantWeapon', addQualities: ['Magique'] },
      { op: 'narrative', text: 'Arme aethyrique : arme créée de Dégâts = BFM (sans Bonus de Force), maniable avec n’importe quelle Compétence de Corps à corps — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.242 « Arme aethyrique »',
  },
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
  {
    label: 'Effrayant',
    // « Gagnez Peur 1. Pour chaque +3 DR, vous pouvez augmenter votre valeur de Peur de 1. »
    ops: [{ op: 'grantTrait', trait: 'Peur', indice: 1, indicePerSL: { every: 3, amount: 1 } }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.243 « Effrayant »',
  },
  {
    label: 'Enchevêtrement',
    type: 'Magie des Arcanes', // ≠ du miracle de Taal homonyme (Invocation)
    // « Votre cible gagne un État Empêtré d'une Force égale à votre Intelligence.
    //   Pour chaque +2 DR, +1 État Empêtré. » (+1/+2 DR mécanique via `valuePerSL` ; la Force
    //   de l'entrave = Int du lanceur reste journalisée — le Test de libération du jeu oppose
    //   la Force de la SOURCE, LDB 16 l.61.)
    ops: [
      { op: 'condition', name: 'Empêtré', valuePerSL: { every: 2, amount: 1 } },
      { op: 'narrative', text: 'Enchevêtrement : Force de l’entrave = Intelligence du lanceur (arbitrage MJ).' },
    ],
    durationRounds: null, // « jusqu'à ce que la cible se libère » (Spécial)
    curated: true,
    source: 'LDB 47 p.243 « Enchevêtrement »',
  },
  {
    label: 'Envol',
    // « Gagnez le Trait de créature Vol (Agilité) » — Indice = votre Agilité ; le héros
    // SURVOLE les obstacles tant que le Sort dure (moveReachFor → flyReachable).
    ops: [{ op: 'grantTrait', trait: 'Vol', indice: { charOf: 'Ag' } }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.243 « Envol »',
  },
  {
    label: 'Explosion',
    ops: [], // Projectile magique +3 en ZdE — moteur missile + ciblage de zone (clic-case).
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.243 « Explosion »',
  },
  {
    label: 'Perturbant',
    // « Vous gagnez le Trait de créature Perturbant » (aura −10, dispatch existant).
    ops: [{ op: 'grantTrait', trait: 'Perturbant' }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.244 « Perturbant »',
  },
  N('Pont', 'Pont : pont d’énergie de BFM mètres (long./larg.), +BFM mètres par +2 DR (arbitrage MJ).'),
  {
    label: 'Poussée',
    // « Toutes les créatures à BFM mètres sont repoussées de BFM mètres et gagnent À Terre » —
    // zone AUTOUR DU LANCEUR (rayon de la spec) ; le RECUL est mécanique (pushAway : ligne
    // lanceur→cible jusqu'à l'obstacle) ; la collision (Dégâts = distance restante) reste MJ.
    ops: [{ op: 'condition', name: 'À Terre' }],
    pushMeters: { bonusOf: 'FM' },
    durationRounds: null,
    zdeRadiusMeters: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.244 « Poussée »',
  },
  {
    label: 'Protection',
    // « Gagnez le Trait de créature Protection (9+) » — sauvegarde 1d10 ≥ 9 (dispatch existant).
    ops: [{ op: 'grantTrait', trait: 'Protection', indice: 9 }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.244 « Protection »',
  },
  {
    label: 'Sang corrosif',
    // « Vous gagnez le Trait de créature Sang corrosif » (riposte corrosive, dispatch existant).
    ops: [{ op: 'grantTrait', trait: 'Sang corrosif' }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.244 « Sang corrosif »',
  },
  {
    label: 'Souffle',
    ops: [{ op: 'narrative', text: 'Souffle : attaque de Souffle (type selon votre Domaine) — Projectile magique de Dégâts = votre Bonus d’Endurance.' }],
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.244 « Souffle »',
  },
  {
    label: 'Téléportation',
    // « Vous pouvez vous téléporter jusqu'à une distance en mètres égale à votre BFM »
    //   (+BFM par +2 DR). En combat : choix de la case d'arrivée après l'Appliquer (survol
    //   des obstacles, atterrissage libre) ; hors combat : repositionnement libre journalisé.
    ops: [],
    teleportMeters: { bonusOf: 'FM' },
    teleportPerSL: { every: 2, metersFormula: { bonusOf: 'FM' } },
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.245 « Téléportation »',
  },
  {
    label: 'Terrifiant',
    // « Vous gagnez le Trait de créature Terreur 1. »
    ops: [{ op: 'grantTrait', trait: 'Terreur', indice: 1 }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.245 « Terrifiant »',
  },
  {
    label: "Vision dans l'obscurité",
    // « Vous gagnez le Trait de créature Infravision » (vision de la chaleur, dispatch existant).
    ops: [{ op: 'grantTrait', trait: 'Infravision' }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: "LDB 47 p.245 « Vision dans l'obscurité »",
  },
];
