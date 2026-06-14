/**
 * Miracles de Taal (dieu de la nature sauvage et des bêtes) — LDB 42, 6 miracles. Curation B4 :
 * « Enchevêtrement » entrave (Empêtré), « Roi de la Nature » invoque un animal allié (moteur
 * d'invocation), les dons d'agilité/sens accordent des Talents ; les armes naturelles de « Dent et
 * griffe » et le pistage de « Seigneur de la Chasse » restent narratifs.
 */
import { SpellSpec } from '../../engine/spellspec';

export const MIRACLES_TAAL: SpellSpec[] = [
  {
    label: 'Bondissant comme un cerf',
    // « Vous gagnez +1 Mouvement et +1 Talent Bonnes jambes ; vous réussissez automatiquement les
    //   Tests d'Athlétisme pour sauter avec au moins 0 DR. » — Bonnes jambes mécanique ; le +1
    //   Mouvement et la réussite auto des sauts restent journalisés.
    ops: [
      { op: 'grantTalent', talent: 'Bonnes jambes' },
      { op: 'narrative', text: 'Bondissant comme un cerf : vous gagnez aussi +1 Mouvement et réussissez automatiquement les Tests d’Athlétisme pour sauter (DR minimum 0) — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 — Miracles de Taal « Bondissant comme un cerf »',
  },
  {
    label: 'Dent et griffe',
    // « Gagnez les Traits Morsure (BF+3) et Arme (BF+4) ; ces attaques sont Magiques. » — deux armes
    //   naturelles ADDITIONNELLES Magiques, Dégâts SB-relatifs (op grantNaturalWeapon).
    ops: [
      { op: 'grantNaturalWeapon', name: 'Morsure', damage: 3, qualities: ['Magique'] },
      { op: 'grantNaturalWeapon', name: 'Griffe', damage: 4, qualities: ['Magique'] },
    ],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 — Miracles de Taal « Dent et griffe »',
  },
  {
    label: 'Enchevêtrement',
    type: 'Invocation', // ≠ du Sort d'Arcane homonyme (désambiguïsation par type)
    // « Toutes les cibles dans la ZdE (BSoc m) gagnent l'État Empêtré. Pour chaque +2 DR, +rayon OU
    //   +1 État Empêtré. Force d'entrave = votre Force Mentale. » — Empêtré échelonné au DR ; le rayon
    //   et la Force de libération restent journalisés.
    ops: [
      { op: 'condition', name: 'Empêtré', value: 1, valuePerSL: { every: 2, amount: 1 } },
      { op: 'narrative', text: 'Enchevêtrement (Taal) : pour chaque +2 DR, vous pouvez plutôt étendre la zone de BSoc m ; la Force d’entrave pour se libérer égale votre Force Mentale — arbitrage MJ.' },
    ],
    durationRounds: null, // Instantané (l'entrave persiste jusqu'à libération)
    curated: true,
    source: 'LDB 42 — Miracles de Taal « Enchevêtrement »',
  },
  {
    label: 'Instincts animaux',
    // « +1 Talent Sens aiguisé (Au choix) ; si vous vous reposez, vous êtes réveillé si une menace
    //   approche (Initiative m). » — Sens aiguisé accordé ; l'éveil automatique reste journalisé.
    ops: [
      { op: 'grantTalent', talent: 'Sens aiguisé' },
      { op: 'narrative', text: 'Instincts animaux : si vous vous reposez, vous êtes automatiquement réveillé par toute menace dans un rayon de (Initiative) m — arbitrage MJ.' },
    ],
    durationRounds: null, // « (Bonus de Sociabilité) heures »
    curated: true,
    source: 'LDB 42 — Miracles de Taal « Instincts animaux »',
  },
  {
    label: 'Roi de la Nature',
    // « Taal répond avec un animal convenant à la zone, qui agira selon vos souhaits pour la durée. »
    //   — invocation d'un animal allié (le MJ choisit l'espèce selon l'environnement).
    ops: [{ op: 'narrative', text: 'Roi de la Nature : le MJ choisit l’animal invoqué selon l’environnement (voir « Les bêtes du Reikland ») — ici un Loup par défaut.' }],
    summon: { ref: 'Loup', count: 1, allyOfCaster: true },
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 — Miracles de Taal « Roi de la Nature »',
  },
  {
    label: 'Seigneur de la Chasse',
    // « Vous ne pouvez pas perdre la piste de votre proie (sauf surnaturellement ou en zone habitée)
    //   et gagnez +10 à tous les Tests la concernant. » — pistage surnaturel : arbitré.
    ops: [{ op: 'narrative', text: 'Seigneur de la Chasse : vous ne perdez plus la piste de votre proie désignée et gagnez +10 à tous les Tests la concernant, pour la durée (heures) — arbitrage MJ.' }],
    durationRounds: null, // « (Bonus de Sociabilité) heures »
    curated: true,
    source: 'LDB 42 — Miracles de Taal « Seigneur de la Chasse »',
  },
];
