import type { CreatureDef } from '../types';

// Manticore (LDB 79 l.108, artwork LDB p.324) : gueule FÉLINE cerclée d'une crinière rousse
// flamboyante (@cheveux) à grands crocs (tête 'felin'), paire de CORNES SOMBRES qui percent la
// crinière (deco tete — trait de l'artwork), avant-train écailleux bleu-gris à dorsale d'épines
// (build 'draconic'), grandes ailes de chauve-souris VIOLET POURPRE dressées à demi-ouvertes
// (membrane + wingPose 'dressees', famille @aile* propre — la couleur signature de l'artwork),
// longue queue segmentée arquée au-dessus du dos HÉRISSÉE DE PIQUANTS (deco queue) finie en
// DARD de scorpion (queue 'dard'). Gabarit AILÉ — distinct du griffon (cuir vs plumes).
export const creature: CreatureDef = {
  name: 'Manticore',
  plan: 'winged',
  quad: {
    sl: 1.15, build: 'draconic', girth: 1.0, bodyLen: 1.06, neckLen: 0.6, neckAngle: -22, legLen: 0.95,
    head: 'felin', headScale: 1.25, tail: 'dard', tailLen: 1.15, ears: 'rondes', foot: 'patte',
    wings: 'membrane', wingSpan: 1.55, wingPose: 'dressees', mane: 'hirsute', ridge: 'epines',
    deco: {
      // cornes courbées vers l'extérieur, teinte sombre de la robe (@corpsO) pour trancher sur
      // la crinière rousse ; symétriques autour de l'axe → lisibles de face, profil et dos
      tete: `<g data-deco="cornes" transform="scale(1.5)">` +
        `<path d="M-4.6 -9 Q-11 -13.6 -12.4 -21.5 Q-6.8 -16.5 -5.6 -10.2 Z" fill="@corpsO" stroke="#1a140e" stroke-width="0.45"/>` +
        `<path d="M4.6 -9 Q11 -13.6 12.4 -21.5 Q6.8 -16.5 5.6 -10.2 Z" fill="@corpsO" stroke="#1a140e" stroke-width="0.45"/>` +
        `<path d="M-8.6 -13 q1.7 0.7 2.5 1.8 M-10.2 -16.6 q1.5 0.7 2.3 1.7 M8.6 -13 q-1.7 0.7 -2.5 1.8 M10.2 -16.6 q-1.5 0.7 -2.3 1.7" stroke="@corpsH" stroke-width="0.5" fill="none" opacity="0.5"/>` +
        `</g>`,
      // piquants barbelés le long du fouet — même compensation que l'art 'dard' du gabarit
      // (×tailLen puis rotate(-34) scale(-1,1)) pour suivre la courbe de la queue au profil
      queue: `<g data-deco="piquants" transform="scale(1.15) rotate(-34) scale(-1,1)">` +
        `<path d="M5.5 0.6 Q4.4 -4.2 2.6 -5.8 Q6 -4.2 8.4 0.2 Z M12.5 1.2 Q11.6 -3.8 9.8 -5.4 Q13.2 -3.8 15.4 0.8 Z M19.5 0.8 Q18.8 -4.4 17 -6 Q20.6 -4.4 22.6 0.4 Z M26.5 -0.4 Q26.2 -5.6 24.6 -7.2 Q28.2 -5.4 29.8 -1 Z M32.5 -2.8 Q33 -8 31.8 -9.8 Q35 -7.6 35.8 -3.6 Z M37.5 -6.8 Q38.8 -11.6 38.2 -13.6 Q40.8 -10.8 40.6 -6.6 Z M41.5 -12 Q43.6 -16 43.6 -18.4 Q45.6 -15 44.6 -11 Z" fill="@corpsO" stroke="#1a140e" stroke-width="0.35"/>` +
        `</g>`,
    },
    stored: {
      corps: '#5c6478', corpsO: '#303648', corpsH: '#8f96aa', cheveux: '#c25a1e', cheveuxO: '#7b330f',
      aile: '#7d5a92', aileO: '#43305c', aileH: '#a887bd', // membrane violet pourpre (signature artwork)
      cuir: '#3f3a4c',
    },
  },
};
