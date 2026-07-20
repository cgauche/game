import type { TenueDef } from '../types';

// Tenue « nue » (corps de chair, pas de vêtement) — torse/jambes peints en @peau, pour les
// monstres sans habit (trolls, goules, snotlings). Le token suit la palette d'espèce.
// Sélectionnable via le sélecteur de tenue de l'éditeur (careerTenueFor traite 'Nu' à part).
export const tenue: TenueDef = {
  label: 'Nu',
  bareFoot: true, // corps de chair : pied nu (source UNIQUE de barefoot, plus de hardcode dans resolve)
  set: {
    torse: `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L11 34 Q0 38 -11 34 L-12 4 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`,
    jambes: `<path d="M-4.5 0 Q-5 26 -3 50 L4 50 Q5 26 4.5 0 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`,
  },
};
