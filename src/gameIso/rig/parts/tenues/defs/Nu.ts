import type { TenueDef } from '../types';
import { BODIES } from '../../bodies';

// Tenue « nue » (corps de chair, pas de vêtement) — torse/jambes du corps de base `BODIES.nu`
// (3 vues dédiées, jamais redessinées ici), pour les monstres sans habit (trolls, goules,
// snotlings). Le token @peau suit la palette d'espèce.
// Sélectionnable via le sélecteur de tenue de l'éditeur (careerTenueFor traite 'Nu' à part).
export const tenue: TenueDef = {
  label: 'Nu',
  id: 'nu',
  bareFoot: true, // corps de chair : pied nu (source UNIQUE de barefoot, plus de hardcode dans resolve)
  footStyle: 'plain', // civilisé nu-pieds par défaut — repli Nu ≠ monstre griffu (#481, décision 2026-07-21)
  set: {
    torse: { front: BODIES.nu.torseFront, back: BODIES.nu.torseBack, profile: BODIES.nu.torseProfile },
    jambes: BODIES.nu.jambe,
  },
};
