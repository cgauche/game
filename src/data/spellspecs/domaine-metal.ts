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
];
