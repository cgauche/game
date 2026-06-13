/**
 * Domaine du Métal (Chamon) — LDB 48 p.250. Famille AMORCÉE par la démo de curation
 * Suffocation (Jalon 2.6 L10) : seuls les sorts curés figurent ici, le reste de la
 * famille passe au repli regex en attendant sa curation.
 */
import { SpellSpec } from '../../engine/spellspec';

export const DOMAINE_METAL: SpellSpec[] = [
  {
    label: 'Transmutation de Chamon',
    // « Il s'agit d'un Projectile magique affectant tout ce qui se trouve dans la Zone d'Effet,
    //   avec une valeur de Dégâts égale à votre Bonus de Force Mentale ; le Sort ignore le Bonus
    //   d'Endurance et inflige +1 États Aveuglé, Assourdi et Sonné, qui persistent tous pour la
    //   durée du Sort. Toutes les cibles affectées gagnent +1 PA issu de l'or qui entoure leur
    //   corps, mais souffrent également de Suffocation (voir page 181). » (LDB 48 l.397)
    //   Dégâts/ignore-BE : résolus par le moteur missile (desc) ; ici les ops de la touche.
    ops: [
      { op: 'condition', name: 'Aveuglé', durationRounds: { bonusOf: 'FM' } },
      { op: 'condition', name: 'Assourdi', durationRounds: { bonusOf: 'FM' } },
      { op: 'condition', name: 'Sonné', durationRounds: { bonusOf: 'FM' } },
      { op: 'apAll', amount: 1 },
      { op: 'suffocate' },
      { op: 'narrative', text: 'Transmutation de Chamon : une cible qui meurt pendant le Sort est enfermée dans une carapace de métal — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 l.397 « Transmutation de Chamon » (Suffocation : LDB 18 l.424-425)',
  },
  {
    label: 'Arme enchantée',
    // « …l'arme est considérée comme Magique et gagne un bonus au Dégâts égal à votre Bonus de Force
    //   Mentale, et l'Atout Incassable. Pour chaque +3 DR, vous pouvez aussi ajouter +1 Atout ou
    //   retirer 1 Défaut. » — enchantement d'arme (Magique + Incassable + Dégâts +BFM) ; l'échelle
    //   « +1 Atout / −1 Défaut par +3 DR » reste journalisée.
    ops: [
      { op: 'enchantWeapon', addQualities: ['Magique', 'Incassable'], damageBonus: { bonusOf: 'FM' } },
      { op: 'narrative', text: 'Arme enchantée : par tranche de +3 DR, ajoutez +1 Atout ou retirez 1 Défaut de l’arme tant que le Sort dure — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine du Métal « Arme enchantée »',
  },
  {
    label: 'Creuset de Chamon',
    // « …l'objet se répand sous forme de métal fondu. S'il est tenu, l'objet est lâché. S'il est
    //   porté, le porteur subit une frappe équivalente à celle d'un Projectile magique, de Dégâts
    //   égaux à votre BFM, qui ignore le Bonus d'Endurance. » — destruction d'objet métallique
    //   (arbitré) ; la frappe « si porté » est résolue par le moteur missile (desc « Projectile
    //   magique »), approximée à BFM Dégâts.
    ops: [{ op: 'narrative', text: 'Creuset de Chamon : un objet métallique non magique fond (lâché s’il est tenu, conserve sa valeur de matière première) ; la frappe ne touche que si l’objet est PORTÉ — arbitrage MJ.' }],
    durationRounds: null, // Instantané
    curated: true,
    source: 'LDB 48 — Domaine du Métal « Creuset de Chamon »',
  },
  {
    label: "Écaille d'acier",
    // « Gagnez le Trait de créature Protection (9+) contre toutes les attaques et Sorts vous
    //   prenant pour cible. Chaque frappe évitée augmente l'efficacité de Protection de 1, jusqu'à un
    //   maximum de Protection (3+). » — Protection (9+) accordée ; l'amélioration progressive
    //   (9→3) reste journalisée.
    ops: [
      { op: 'grantTrait', trait: 'Protection', indice: 9 },
      { op: 'narrative', text: 'Écaille d’acier : chaque frappe évitée améliore la Protection de 1 (jusqu’à 3+) — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'E' }, // « (Bonus d'Endurance) Rounds »
    curated: true,
    source: "LDB 48 — Domaine du Métal « Écaille d'acier »",
  },
  {
    label: 'Forge de Chamon',
    // « Vous modifiez la qualité d'un objet de métal. Ajoutez 1 Atout ou retirez 1 Défaut ; +1 par
    //   +2 DR. » — artisanat magique (hors combat) : arbitré.
    ops: [{ op: 'narrative', text: 'Forge de Chamon : sur un objet métallique, ajoutez 1 Atout ou retirez 1 Défaut (+1 par +2 DR) — arbitrage MJ.' }],
    durationRounds: null, // « (Force Mentale) minutes »
    curated: true,
    source: 'LDB 48 — Domaine du Métal « Forge de Chamon »',
  },
  {
    label: "L'Or des fous",
    // « Tout le métal de l'objet devient de l'or pour la durée du Sort… Les effets sont à l'entière
    //   préférence du MJ. » — transmutation utilitaire : arbitré.
    ops: [{ op: 'narrative', text: 'L’Or des fous : tout le métal d’un objet non magique devient de l’or pour la durée (peut alourdir une armure, ruiner une arme…) — arbitrage MJ.' }],
    durationRounds: null, // « (Force Mentale) minutes »
    curated: true,
    source: "LDB 48 — Domaine du Métal « L'Or des fous »",
  },
  {
    label: 'Métal changeant',
    // « Vous pouvez plier et tordre l'objet avec un Test de Force Accessible (+20), ou une
    //   modification complexe avec un Test de Métier (Forgeron). » — façonnage utilitaire : arbitré.
    ops: [{ op: 'narrative', text: 'Métal changeant : un objet métallique non magique devient malléable (Test de Force ou de Métier pour le façonner) — arbitrage MJ.' }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine du Métal « Métal changeant »',
  },
  {
    label: 'Plume de plomb',
    // « Choisissez : la cible est Surchargée de deux paliers supplémentaires, OU n'est pas
    //   considérée comme Surchargée. » — modulation d'Encombrement (non modélisée en combat) : arbitré.
    ops: [{ op: 'narrative', text: 'Plume de plomb : dans la ZdE, choisissez — les biens sont alourdis de +2 paliers de Surcharge, ou n’imposent plus de Surcharge — arbitrage MJ.' }],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 48 — Domaine du Métal « Plume de plomb »',
  },
];
