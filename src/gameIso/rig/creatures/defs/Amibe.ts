import type { CreatureDef } from '../types';

// Amibe (« diable gluant ») — gabarit amorphe/hulk : créature dénuée de squelette, « sorte de gelée
// hostile » exsudant un acide digestif, « hautement inflammable » (ZI 44). Palette de gelée acide
// translucide (jaune-vert luisant) plutôt que la boue brune de la Bête des marais. Sans ce def + son
// nom-espèce, le record sans `appearance.species` retombait sur le bipède Humain par défaut
// (resolveRender) → une amibe dessinée en humanoïde tenant un « Fouet pseudopode ». Réutilisé par
// Jetsam (« très grosse amibe intelligente ») via `appearance.species: "Amibe"`.
export const creature: CreatureDef = {
  name: 'Amibe',
  plan: 'amorphous',
  // girth 1.1 : masse étalée plus large que haute (la gelée s'affaisse, ≠ tourbe « vaguement
  // humanoïde »). Gelée acide : corps jaune-vert, contour olive sombre, reflets de mucus vifs.
  hulk: {
    sl: 1.0, girth: 1.1,
    stored: { corps: '#94a64e', corpsO: '#3a4416', corpsH: '#d6e07e', cheveux: '#7c8a3a', cheveuxO: '#2a3210', cuir: '#6e7a32' },
  },
};
