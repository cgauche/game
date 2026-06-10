/**
 * Sorts mineurs (LDB 47 p.240-242) — les 25, curés. Beaucoup sont des tours
 * utilitaires/narratifs (lumière, bruits, serrure…) : leur spec porte une op
 * `narrative` VERBATIM-résumée (journal + arbitrage MJ, rien d'inventé) — ce qui
 * vaut mieux que le repli regex (risque de faux-positifs sur les descs longues).
 * Les Projectiles magiques (Fléchette, Drain) sont résolus par le moteur missile ;
 * la spec ne porte que les effets ADDITIONNELS (Drain soigne le lanceur).
 */
import { SpellSpec } from '../../engine/spellspec';

const N = (label: string, text: string, durationRounds: SpellSpec['durationRounds'] = null): SpellSpec => ({
  label,
  ops: [{ op: 'narrative', text }],
  durationRounds,
  curated: true,
  source: `LDB 47 p.240-242 « ${label} »`,
});

export const MAGIE_MINEURE: SpellSpec[] = [
  N('Alerte', 'Alerte : révèle immédiatement si l’objet touché est empoisonné ou piégé.'),
  N('Amitié animale', 'Amitié animale : une créature Bestiale plus petite vous fait totalement confiance (1 heure).'),
  N('Bruits', 'Bruits : petits sons indistincts projetés à portée, sans Ligne de Vue.', { bonusOf: 'FM' }),
  {
    label: 'Choc',
    // « Votre cible reçoit 1 État Sonné » — Contact (Test opposé de Bagarre en combat, LDB 46 l.174 : non modélisé, le ciblage usuel s'applique).
    ops: [{ op: 'condition', name: 'Sonné' }],
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.240 « Choc »',
  },
  N('Conservation', 'Conservation : préserve une journée de vivres de la putréfaction (durée en jours).'),
  N('Coup de vent', 'Coup de vent : brève rafale (éteint une bougie, claque une porte…).'),
  N('Créer un petit animal', 'Créer un petit animal : fait apparaître un petit animal local (lapin, colombe, rat…).'),
  {
    label: 'Drain',
    // Projectile magique +0 ignorant les PA (moteur missile) ; « Puis vous Guérissez 1 Point de Blessure ».
    ops: [{ op: 'healCaster', amount: 1 }],
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.240 « Drain »',
  },
  {
    label: 'Éblouissant',
    // « La cible gagne un État Aveuglé, puis un autre au début de chaque round pour la durée du Sort. »
    ops: [
      { op: 'condition', name: 'Aveuglé' },
      { op: 'condition', name: 'Aveuglé', perRound: true },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.240 « Éblouissant »',
  },
  N('En catimini', 'En catimini : téléporte un petit objet proche (taille d’un poing) entre vos mains.', { bonusOf: 'FM' }),
  N('Feux follets', 'Feux follets : jusqu’à (Bonus d’Int) lumières flottantes contrôlables (Test de Focalisation Accessible).'),
  N('Flamme magique', 'Flamme magique : petite flamme inoffensive pour vous, qui chauffe et enflamme comme une flamme naturelle.', { bonusOf: 'FM' }),
  {
    label: 'Fléchette',
    ops: [], // Projectile magique +0 — entièrement résolu par le moteur missile.
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.241 « Fléchette »',
  },
  N('Lumière', 'Lumière : lueur de torche (modulable de bougie à lanterne) émanant de vous.'),
  N('Murmures', 'Murmures : projette votre voix vers un point à portée, sans Ligne de Vue.', { bonusOf: 'FM' }),
  N('Pas léger', 'Pas léger : votre passage ne laisse aucune trace organique (−20 implicite au Pistage adverse — arbitrage MJ).'),
  N('Protection contre la pluie', 'Protection contre la pluie : vous restez au sec sous toute précipitation.'),
  N("Purification de l'eau", 'Purification de l’eau : purifie l’eau d’un récipient (poisons/polluants non magiques éliminés).'),
  N('Putréfaction', 'Putréfaction : pourrit un volume organique de la taille d’un poing (cuir : −1 PA à 1 Localisation — arbitrage MJ).'),
  N('Repères', 'Repères : vous savez où est le Nord.'),
  {
    label: 'Secousse',
    // « Si l'objet est tenu, le porteur doit réussir un Test de Dextérité Accessible (+20) ou le laisser tomber. »
    ops: [{ op: 'test', skill: 'Dextérité', difficulty: 'accessible', onFail: [{ op: 'narrative', text: 'Secousse : l’objet tenu tombe (arme au sol — arbitrage MJ).' }] }],
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.241 « Secousse »',
  },
  N('Serrure ouverte', 'Serrure ouverte : déverrouille une serrure non magique touchée.'),
  {
    label: 'Sommeil',
    // « Si la cible possède un État À Terre, elle gagne l'État Inconscient » — conditionnel à
    // l'État (non exprimable en op) : journalisé fidèlement, le MJ/joueur applique.
    ops: [{ op: 'narrative', text: 'Sommeil : une cible À Terre gagne l’État Inconscient pour la durée du Sort (réveillée par bruit fort/secousse) — appliquer si À Terre.' }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.242 « Sommeil »',
  },
  N('Source', 'Source : fait jaillir ½ litre d’eau par Round (max Bonus d’Initiative litres).', { bonusOf: 'FM' }),
  N("Tendre l'oreille", 'Tendre l’oreille : vous entendez vos cibles comme si vous étiez à côté.'),
];
