/**
 * Domaine des Ombres (Ulgu) — LDB 48 p.252. Famille AMORCÉE par la démo de curation
 * Suffocation (Jalon 2.6 L10) : seuls les sorts curés figurent ici, le reste de la
 * famille passe au repli regex en attendant sa curation.
 */
import { SpellSpec } from '../../engine/spellspec';

export const DOMAINE_OMBRES: SpellSpec[] = [
  {
    label: 'Ombres étrangleuses',
    // « Vous enroulez des tentacules d'ombre d'Ulgu autour du cou de vos ennemis. En supposant
    //   qu'ils aient besoin de respirer, ils gagnent +1 État Exténué, ne peuvent pas parler et
    //   sont soumis aux règles de la Suffocation (voir page 181). » — « ne peuvent pas parler »
    //   coupe l'incantation (cf. Forme bestiale : « vous ne pouvez pas parler, ce qui signifie
    //   que vous ne pouvez pas lancer de Sorts ») → castPenalty bloquant pour la durée (BFM Rounds).
    ops: [
      { op: 'condition', name: 'Exténué' },
      { op: 'suffocate' },
      { op: 'castPenalty', skill: 'all', blocked: true, rounds: { bonusOf: 'FM' } },
      { op: 'narrative', text: 'Ombres étrangleuses : la cible ne peut pas parler (interactions vocales — arbitrage MJ).' },
    ],
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: 'LDB 47 p.252 « Ombres étrangleuses » (Suffocation : LDB 18 l.424-425)',
  },
];
