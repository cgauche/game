import type { CreatureDef } from '../types';

// Crapaud géant : batracien trapu, sac très large et bas, gros yeux bombés dorés, large bouche,
// peau verruqueuse, pas de queue. Quadrupède à build `batracien` (nouveau) + tête `crapaud`.
// Sorti du monolithique : 1 fichier, rendu en jeu via AnimatedQuadToken.
export const creature: CreatureDef = {
  name: 'Crapaud',
  plan: 'quadruped',
  aliases: ['crapaud geant', 'crapaud géant', 'batracien', 'toad'],
  quad: {
    sl: 0.98, build: 'batracien', girth: 1.5, bodyLen: 1.0, neckLen: 0.22, neckAngle: -6,
    legLen: 0.5, head: 'crapaud', tail: 'sans', ears: 'rondes', foot: 'patte',
    stored: { corps: '#6a6a3a', corpsO: '#42421f', corpsH: '#8c8c54', cheveux: '#3a3a20', cheveuxO: '#23230f', cuir: '#2a2418' },
  },
};
