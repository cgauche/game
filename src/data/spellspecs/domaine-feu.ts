/**
 * Domaine du Feu (Aqshy) — LDB 47 p.247, 8 sorts, pilote de curation de Domaine.
 * Chaque entrée recopie sa description canon (spells.json) ; les volets non
 * modélisables (immunités, armes enchantées, murs, talents octroyés) restent en
 * ops `narrative` — journalisés verbatim, arbitrage MJ, rien d'inventé.
 * Les Projectiles magiques (Grands feux d'U'Zhul, Mur de feu à la traversée)
 * gardent leur résolution missile (engine/magic) ; la spec ne porte que les
 * effets de soutien/État.
 */
import { SpellSpec } from '../../engine/spellspec';

export const DOMAINE_FEU: SpellSpec[] = [
  {
    label: 'Cautériser',
    // « Guérissez immédiatement 1d10 Blessures et retirez tout État Hémorragique. »
    // « Test de Calme Intermédiaire (+0) ou hurler de douleur ; échec de −6 DR ou plus →
    //   Inconscient (1d10 heures, marqué à vie). » (cibles sans Magie des Arcanes (Feu) —
    //   condition de Talent non testable ici : le Test est appliqué, fidèle au cas général.)
    ops: [
      { op: 'heal', amount: { dice: { n: 1, sides: 10 } } },
      { op: 'removeCondition', name: 'Hémorragique', value: 99 },
      { op: 'preventInfection' }, // « De plus, les Blessures ne s'infecteront pas. » (→ woundDressed, LDB 18 l.382)
      { op: 'test', skill: 'Calme', difficulty: 'intermediaire', onFail: [{ op: 'narrative', text: 'La cible hurle de douleur (Aqshy brûle en guérissant).' }], onFailHard: { dr: -6, ops: [{ op: 'condition', name: 'Inconscient' }] } },
    ],
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.247 « Cautériser »',
  },
  {
    label: 'Cœurs ardents',
    // « Les alliés affectés perdent tout État Brisé et État Exténué, et gagnent +1 Talent
    //   Coude-à-coude, Sans peur et Cœur vaillant tant que le Sort est actif. » Sans peur
    //   (immunité Peur/Terreur) et Cœur vaillant (Calme anti-Brisé même Engagé) = op
    //   grantTalent (mécaniques) ; Coude-à-coude (surnombre coopératif) reste arbitrage MJ.
    ops: [
      { op: 'removeCondition', name: 'Brisé', value: 99 },
      { op: 'removeCondition', name: 'Exténué', value: 99 },
      { op: 'grantTalent', talent: 'Sans peur' },
      { op: 'grantTalent', talent: 'Cœur vaillant' },
      { op: 'narrative', text: 'Cœurs ardents : +1 Talent Coude-à-coude tant que le Sort est actif (arbitrage MJ).' },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.247 « Cœurs ardents »',
  },
  {
    label: 'Couronne de Flammes',
    // « Gagnez le Trait Peur 1 et +1 Talent Seigneur de guerre… +10 pour Focaliser et
    //   Incanter avec Aqshy tant que le Sort est actif. » Peur 1 → op grantTrait (Jalon 2.6) ;
    //   le +10 d'incantation est un castPenalty positif. L'option « +2 DR : +1 Peur OU
    //   reprendre Seigneur de guerre » = un CHOIX → journalisée.
    ops: [
      { op: 'grantTrait', trait: 'Peur', indice: 1 },
      { op: 'castPenalty', skill: 'all', mod: 10, rounds: { bonusOf: 'FM' } },
      { op: 'narrative', text: 'Couronne de Flammes : +1 Talent Seigneur de guerre tant que le Sort est actif ; par +2 DR, +1 Peur OU Seigneur de guerre repris — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.247 « Couronne de Flammes »',
  },
  {
    label: "Grands feux d'U'Zhul",
    // Projectile magique Dégâts +10 ignore PA (résolu par le moteur missile) ; la spec
    // porte les États de la cible : « inflige +2 État En flammes et l'État À Terre ».
    // (Le brasier persistant de zone reste journalisé — zones persistantes hors périmètre.)
    ops: [
      { op: 'condition', name: 'En flammes', value: 2 },
      { op: 'condition', name: 'À Terre' },
      { op: 'narrative', text: 'Grands feux d’U’Zhul : la ZdE autour de la cible subit +5 Dégâts (ignore PA) et brûle pour la durée du Sort (1d10+6 Dégâts/Round, +1 En flammes) — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: "LDB 47 p.247 « Grands feux d'U'Zhul »",
  },
  {
    label: "L'Égide d'Aqshy",
    ops: [
      { op: 'narrative', text: 'Égide d’Aqshy : immunisé aux Dégâts de feu non magiques, ignore l’État En flammes, Protection (9+) contre le feu magique (arbitrage MJ).' },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: "LDB 47 p.247 « L'Égide d'Aqshy »",
  },
  {
    label: "L'Épée ardente de Rhuin",
    // « L'arme possède Dégâts +6 et l'Atout Percutante, et quiconque est frappé par la lame
    //   gagne +1 État En flammes. » — op enchantWeapon ; le volet « Maladresse d'un porteur
    //   sans Magie des Arcanes (Feu) » reste journalisé.
    ops: [
      {
        op: 'enchantWeapon',
        addQualities: ['Percutante'],
        damageBonus: 6,
        onHitConditions: [{ name: 'En flammes' }],
      },
      { op: 'narrative', text: 'Épée ardente de Rhuin : un porteur SANS Magie des Arcanes (Feu) qui obtient une Maladresse avec l’Épée subit ses flammes — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: "LDB 47 p.247 « L'Épée ardente de Rhuin »",
  },
  {
    label: 'Mur de feu',
    ops: [
      { op: 'narrative', text: 'Mur de feu : mur de BFM mètres (épais d’1 m) pour la durée du Sort — traverser inflige 1 En flammes + un Projectile magique de BFM Dégâts (zone persistante : arbitrage MJ).' },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.248 « Mur de feu »',
  },
  {
    label: 'Purification',
    // « toutes les créatures dans la zone gagnent +DR État Enflammé » (LDB 48 p.229) —
    // total = DR du jet, mécanique via `valuePerSL` (base 0 + 1/DR, plancher 1 de l'op).
    ops: [
      { op: 'condition', name: 'En flammes', value: 0, valuePerSL: { every: 1, amount: 1 } },
      { op: 'narrative', text: 'Purification : consume les Influences corruptrices de la zone (malepierre, objets du Chaos) — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.248 « Purification »',
  },
];
