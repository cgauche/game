/**
 * Sorts d'Arcane communs (LDB 47 p.242-245) — les 23, curés. Accessibles à tout
 * Domaine. Les Projectiles magiques (Carreau, Explosion, Attaques en chaîne,
 * Souffle) sont résolus par le moteur missile (ops = effets additionnels) ; les
 * sorts à Trait de créature temporisé (Effrayant, Terrifiant, Protection, Envol,
 * Perturbant, Sang corrosif, Vision dans l'obscurité) passent par l'op `grantTrait`
 * (Jalon 2.6) ; les utilitaires hors grille restent `narrative` (rien d'inventé).
 */
import { SpellSpec } from '../../engine/spellspec';

// `text` = trace documentaire de l'effet narratif (désormais sur `SpellData.effects`) — conservé pour la relecture.
const N = (label: string, _text: string, durationRounds: SpellSpec['durationRounds'] = { bonusOf: 'FM' }): SpellSpec => ({
  label,
  durationRounds,
  curated: true,
  source: `LDB 47 p.242-245 « ${label} »`,
});

export const ARCANES_COMMUNS: SpellSpec[] = [
  {
    label: 'Arme aethyrique',
    // « Vous créez une arme de Corps à corps dont les Dégâts sont égaux à votre Bonus de Force
    //   Mentale. Elle peut prendre n'importe quelle forme et peut donc utiliser n'importe quelle
    //   Compétence de Corps à corps que vous possédez. L'arme est considérée comme Magique. » —
    //   INVOQUÉE (op conjureWeapon, `chooseForm`) : objet de mêlée Magique, Dégâts FIXES = BFM (sans
    //   Bonus de Force), tenu tant que le Sort dure. Le lanceur CHOISIT la forme (n'importe quelle
    //   Compétence de Corps à corps qu'il possède) → l'arme prend le profil de cette Spé (Groupe/allonge).
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 — Arcanes communs « Arme Aethyrique » (l.243)',
  },
  {
    label: 'Armure Aethyrique',
    // « Vous gagnez +1 PA à toutes les Localisations » — PA temporisés, lus à la mitigation.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.242 « Armure Aethyrique »',
  },
  {
    label: 'Attaques en chaîne',
    // « Si Attaques en chaîne réduit la cible à 0 Blessure, il rebondit sur une autre cible dans
    //   la portée initiale du Sort, et à une distance en mètres de la cible précédente égale à
    //   votre BFM, infligeant de nouveau les mêmes Dégâts. Il peut rebondir un nombre maximum de
    //   fois égal à votre BFM. » — rebond mécanique (chainOnKill) ; Projectile +4 (moteur missile).
    chainOnKill: { maxBounces: { bonusOf: 'FM' }, hopMeters: { bonusOf: 'FM' } },
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.242 « Attaques en chaîne »',
  },
  N('Aura ordinaire', 'Aura ordinaire : votre nature magique est indétectable (Perception de la magie et similaires).', null),
  {
    label: 'Bouclier anti-flèches',
    // « Tous les projectiles constitués de matière organique, comme des flèches en bois, sont
    //   automatiquement détruits s'ils entrent dans la Zone d'Effet, n'infligeant aucun Dégât à
    //   leur cible. Les projectiles constitués uniquement de matière non organique […] ne sont
    //   pas affectés. » — aura arrowWard (BFM m) portée par le lanceur, consommée à la
    //   résolution des tirs (flèches/carreaux/javelots détruits ; balles/pierres passent).
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.243 « Bouclier anti-flèches »',
  },
  N('Bouclier magique', 'Bouclier magique : +BFM DR à vos tentatives de Dissipation tant que le Sort est actif (la Dissipation n’est pas encore modélisée).'),
  {
    label: 'Carreau',
// Projectile magique +4 — entièrement résolu par le moteur missile.
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.243 « Carreau »',
  },
  {
    label: 'Chute',
    // « À moins que la cible réussisse un Test de Dextérité Intermédiaire (+0), l'objet tombe.
    //   Pour chaque +2 DR, −10 supplémentaire au Test » (le −10/DR : arbitrage — le Test est posé tel quel).
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.243 « Chute »',
  },
  N("Déplacement d'objet", 'Déplacement d’objet : déplace un objet inanimé (Force = votre FM) de BFM mètres.', null),
  {
    label: 'Dôme',
    // « Quiconque se trouve dans la Zone d'Effet gagne le Trait de créature Protection (6+)
    //   contre les Attaques magiques ou à distance provenant de l'extérieur du dôme. Les
    //   personnes à l'intérieur peuvent attaquer des cibles situées à l'extérieur du dôme
    //   normalement, et le dôme ne gêne pas le déplacement. » — aura domeWard (BFM m) portée
    //   par le lanceur : sauvegarde d10 ≥ 6 contre tirs ET Projectiles magiques extérieurs.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.244 « Dôme »',
  },
  {
    label: 'Effrayant',
    // « Gagnez Peur 1. Pour chaque +3 DR, vous pouvez augmenter votre valeur de Peur de 1. »
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.243 « Effrayant »',
  },
  {
    label: 'Enchevêtrement',
    type: 'Magie des Arcanes', // ≠ du miracle de Taal homonyme (Invocation)
    // « Votre cible gagne un État Empêtré d'une Force égale à votre Intelligence.
    //   Pour chaque +2 DR, +1 État Empêtré. » (+1/+2 DR mécanique via `valuePerSL` ; la Force
    //   d'entrave = Int du lanceur est MODÉLISÉE via `condition.escapeStrength` — le Test de
    //   libération oppose cette Force figée, LDB 16 l.61.)
    durationRounds: null, // « jusqu'à ce que la cible se libère » (Spécial)
    curated: true,
    source: 'LDB 47 p.243 « Enchevêtrement »',
  },
  {
    label: 'Envol',
    // « Gagnez le Trait de créature Vol (Agilité) » — Indice = votre Agilité ; le héros
    // SURVOLE les obstacles tant que le Sort dure (moveReachFor → flyReachable).
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.243 « Envol »',
  },
  {
    label: 'Explosion',
// Projectile magique +3 en ZdE — moteur missile + ciblage de zone (clic-case).
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.243 « Explosion »',
  },
  {
    label: 'Perturbant',
    // « Vous gagnez le Trait de créature Perturbant » (aura −10, dispatch existant).
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
    pushMeters: { bonusOf: 'FM' },
    durationRounds: null,
    zdeRadiusMeters: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.244 « Poussée »',
  },
  {
    label: 'Protection',
    // « Gagnez le Trait de créature Protection (9+) » — sauvegarde 1d10 ≥ 9 (dispatch existant).
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.244 « Protection »',
  },
  {
    label: 'Sang corrosif',
    // « Vous gagnez le Trait de créature Sang corrosif » (riposte corrosive, dispatch existant).
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.244 « Sang corrosif »',
  },
  {
    label: 'Souffle',
    // « Vous effectuez immédiatement une attaque de Souffle, comme si vous aviez dépensé 2 Avantages
    //   pour activer le Trait de créature Souffle (voir page 341). Souffle est un Projectile magique
    //   dont les Dégâts sont égaux à votre Bonus d'Endurance. Le MJ détermine quel type d'attaque de
    //   Souffle correspond le mieux à votre Talent Magie des Arcanes. » — délégué à l'attaque de
    //   ZONE du Trait (breathAttack), Type mappé du Domaine (Feu/Cieux/Métal/Ombres ; sinon Dégâts purs).
    breathAttack: true,
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.244 « Souffle »',
  },
  {
    label: 'Téléportation',
    // « Vous pouvez vous téléporter jusqu'à une distance en mètres égale à votre BFM »
    //   (+BFM par +2 DR). En combat : choix de la case d'arrivée après l'Appliquer (survol
    //   des obstacles, atterrissage libre) ; hors combat : repositionnement libre journalisé.
    teleportMeters: { bonusOf: 'FM' },
    teleportPerSL: { every: 2, metersFormula: { bonusOf: 'FM' } },
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.245 « Téléportation »',
  },
  {
    label: 'Terrifiant',
    // « Vous gagnez le Trait de créature Terreur 1. »
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.245 « Terrifiant »',
  },
  {
    label: "Vision dans l'obscurité",
    // « Vous gagnez le Trait de créature Infravision » (vision de la chaleur, dispatch existant).
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: "LDB 47 p.245 « Vision dans l'obscurité »",
  },
];
