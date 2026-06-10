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
      { op: 'narrative', text: 'Cautériser : les Blessures ne s’infecteront pas.' },
      { op: 'test', skill: 'Calme', difficulty: 'intermediaire', onFail: [{ op: 'narrative', text: 'La cible hurle de douleur (Aqshy brûle en guérissant).' }], onFailHard: { dr: -6, ops: [{ op: 'condition', name: 'Inconscient' }] } },
    ],
    durationRounds: null,
    curated: true,
    source: 'LDB 47 p.247 « Cautériser »',
  },
  {
    label: 'Cœurs ardents',
    // « Les alliés affectés perdent tout État Brisé et État Exténué, et gagnent +1 Talent
    //   Coude-à-coude, Sans peur et Cœur vaillant tant que le Sort est actif. »
    ops: [
      { op: 'removeCondition', name: 'Brisé', value: 99 },
      { op: 'removeCondition', name: 'Exténué', value: 99 },
      { op: 'narrative', text: 'Cœurs ardents : +1 Talent Coude-à-coude, Sans peur et Cœur vaillant tant que le Sort est actif (arbitrage MJ).' },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.247 « Cœurs ardents »',
  },
  {
    label: 'Couronne de Flammes',
    // « Gagnez le Trait Peur 1 et +1 Talent Seigneur de guerre… +10 pour Focaliser et
    //   Incanter avec Aqshy tant que le Sort est actif. » Trait Peur → causesPeur n'est
    //   pas (encore) une op : journalisé ; le +10 d'incantation est un castPenalty positif.
    ops: [
      { op: 'narrative', text: 'Couronne de Flammes : Trait Peur 1 + Talent Seigneur de guerre tant que le Sort est actif (arbitrage MJ).' },
      { op: 'castPenalty', skill: 'all', mod: 10, rounds: { bonusOf: 'FM' } },
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
    ops: [
      { op: 'narrative', text: 'Épée ardente de Rhuin : l’arme gagne Dégâts +6, l’Atout Percutante, et inflige +1 En flammes à la touche (arbitrage MJ — enchantement d’arme non modélisé).' },
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
    // « toutes les créatures dans la zone gagnent +DR État En flammes » — l'op `value`
    // ne connaît pas le DR du jet : on applique 1 (plancher fidèle) + journal du +DR.
    ops: [
      { op: 'condition', name: 'En flammes' },
      { op: 'narrative', text: 'Purification : chaque créature de la zone gagne +DR État En flammes (au-delà du 1er appliqué) ; consume les Influences corruptrices — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.248 « Purification »',
  },
];
