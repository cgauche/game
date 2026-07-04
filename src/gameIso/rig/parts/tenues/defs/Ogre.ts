import type { TenueDef } from '../types';

// Tenue d'OGRE (illustration LDB p.314) : plaque-bedaine rivetée sur le torse nu, épaulières
// de cuir, jambières de peaux. C'est de l'ÉQUIPEMENT — le corps nu (panse comprise) vit sur
// la race ; un Ogre en career 'Nu' est réellement nu, un PNJ ogre peut porter autre chose.
export const tenue: TenueDef = {
  name: 'Ogre',
  palette: { cuir: '#5a3f24', metal: '#8b94a6', vet1: '#7a6a4a' },
  set: {
    // torse de CHAIR (le slot remplace le « Nu ») + plaque-bedaine par-dessus la panse
    torse: `<g stroke-linejoin="round">`
      + `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L11 34 Q0 38 -11 34 L-12 4 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
      + `<path d="M-11 -3 Q0 -7 11 -3 L9 19 Q0 24 -9 19 Z" fill="@metal" stroke="#3a4048" stroke-width="1"/>`
      + `<circle cx="0" cy="8" r="3.2" fill="#5a6068" stroke="#3a4048" stroke-width="0.6"/>`
      + `<circle cx="-6.5" cy="1" r="1.2" fill="#3a4048"/><circle cx="6.5" cy="1" r="1.2" fill="#3a4048"/>`
      + `<circle cx="-6.5" cy="16" r="1.2" fill="#3a4048"/><circle cx="6.5" cy="16" r="1.2" fill="#3a4048"/>`
      + `<path d="M-10 -4 L-12 -14 M10 -4 L12 -14" stroke="@cuir" stroke-width="2.2" stroke-linecap="round"/>`
      + `</g>`,
    // bras de chair + épaulière de cuir rivetée (haut du bras seul, avant-bras nu)
    bras: `<g stroke-linejoin="round">`
      + `<path d="M-3.4 -3 Q0 -4.8 3.4 -3 L3 27 Q0 28.6 -3 27 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
      + `<path d="M-5.5 -4 Q0 -7 5.5 -4 Q6.2 1 5 4.5 L4 8 Q0 9.8 -4 8 L-5 4.5 Q-6.2 1 -5.5 -4 Z" fill="@cuir" stroke="#2c1e12" stroke-width="0.8"/>`
      + `<path d="M-4.8 0.5 Q0 -1.4 4.8 0.5" stroke="#2c1e12" stroke-width="0.6" fill="none" opacity="0.8"/>`
      + `<circle cx="-2.8" cy="-2" r="0.7" fill="#3a4048"/><circle cx="2.8" cy="-2" r="0.7" fill="#3a4048"/>`
      + `</g>`,
    // jambe de chair + jambière de peaux lanière (le bas finit dans la botte par défaut)
    jambes: `<g stroke-linejoin="round">`
      + `<path d="M-4.5 0 Q-5 26 -3 50 L4 50 Q5 26 4.5 0 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
      + `<path d="M-4.6 22 Q0 23.6 4.6 22 L4.2 44 L-4.2 44 Z" fill="@vet1" stroke="#4a3e28" stroke-width="0.6"/>`
      + `<path d="M-4.2 28 L4.2 30 M-4 35 L4 37" stroke="@cuir" stroke-width="1.6" stroke-linecap="round"/>`
      + `</g>`,
  },
};
