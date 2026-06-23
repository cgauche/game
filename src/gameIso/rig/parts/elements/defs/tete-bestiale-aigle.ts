import type { AppearanceElement } from '../types';

// Tête d'aigle : crâne emplumé brun foncé, gros yeux ronds perçants à l'iris jaune, BEC CROCHU
// jaune-orangé pointant vers le bas (l'indice fort « rapace »), arcade sourcilière marquée.
// Os tête, face.
const AIGLE = '<g data-mut="tete-bestiale-aigle">'
  // crâne emplumé
  + '<path d="M-7 -4 Q-7.6 3 -3 6 L3 6 Q7.6 3 7 -4 Q4 -8.5 0 -8.5 Q-4 -8.5 -7 -4 Z" fill="#5a4632" stroke="#352819" stroke-width="0.7"/>'
  // plumes lisses sur le sommet (chevrons)
  + '<path d="M-4 -5 l1.6 1.4 M0 -6 l1.6 1.4 M3 -5 l1.6 1.4" stroke="#3a2c1c" stroke-width="0.5" fill="none" opacity="0.7"/>'
  // arcades sourcilières saillantes (regard perçant)
  + '<path d="M-6 -1.6 Q-4 -3 -1.2 -1.8 M6 -1.6 Q4 -3 1.2 -1.8" stroke="#2e2214" stroke-width="0.8" fill="none" stroke-linecap="round"/>'
  // gros yeux ronds jaunes
  + '<circle cx="-3.4" cy="0.4" r="2" fill="#f2c43a" stroke="#7a5a20" stroke-width="0.5"/>'
  + '<circle cx="3.4" cy="0.4" r="2" fill="#f2c43a" stroke="#7a5a20" stroke-width="0.5"/>'
  + '<circle cx="-3.4" cy="0.6" r="1" fill="#1a120a"/>'
  + '<circle cx="3.4" cy="0.6" r="1" fill="#1a120a"/>'
  // bec crochu jaune-orangé
  + '<path d="M-2.4 4.4 Q0 3.6 2.4 4.4 Q2 8 0.6 9.6 Q0.2 11.6 -0.4 9.4 Q-2 8 -2.4 4.4 Z" fill="#e8a032" stroke="#9a6814" stroke-width="0.6"/>'
  // crochet de la pointe du bec
  + '<path d="M-0.4 9.4 Q-0.8 11 -0.2 11.6 Q0.6 11 0.6 9.6" fill="#c8861e" stroke="#9a6814" stroke-width="0.4"/>'
  // narine (cire) à la base du bec
  + '<ellipse cx="0" cy="5" rx="0.7" ry="0.4" fill="#9a6814"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'tete-bestiale-aigle', label: 'Tête bestiale (Aigle)', category: 'mutation',
  overlays: [{ bone: 'tete', svg: AIGLE, view: 'front' }],
};
