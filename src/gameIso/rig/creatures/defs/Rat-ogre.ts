import type { CreatureDef } from '../types';
import { OV_GRIFFES } from '../../parts/monstrous';

// Rat ogre (LDB, Taille Grande — ILLUSTRATION p.339) : BRUTE de chair skavenne élevée par le
// clan Molder — torse et bras de CHAIR rosée cousue de cicatrices, MANTEAU de fourrure sombre
// hirsute sur les épaules et le dos, ÉPINES implantées le long de l'échine, pagne loqueteux.
// Race Skaven (tête de rat, queue rose) + gabarit brute-bras-longs ; griffes aux mains.
const POILS = (d: string) => `<path d="${d}" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.6" stroke-linejoin="round"/>`;
// Manteau hirsute d'épaule (bord inférieur en mèches) — un par épaule, suit l'os du bras.
const OV_FOURRURE_EPAULE = POILS('M-5.5 -4 Q0 -7 5.5 -4 L5.8 6 L3.8 4.4 L2.6 8 L0.6 5 L-1 8.6 L-2.8 4.8 L-4.6 7.4 L-5.8 5 Z');
// Col/garrot de fourrure sur le HAUT du torse (déborde sur la poitrine en mèches).
const OV_FOURRURE_COL = POILS('M-12 -28 Q0 -32 12 -28 L11.5 -18 L9 -20.5 L7.5 -16 L5 -19.5 L2.5 -15 L0 -19 L-2.5 -15 L-5 -19.5 L-7.5 -16 L-9 -20.5 L-11.5 -18 Z');
// Couture de chair (cicatrice suturée, illustration : poitrine rapiécée).
const OV_COUTURE =
  `<path d="M-6 -8 Q0 -5 6 -9" stroke="#8a4a3a" stroke-width="0.9" fill="none"/>`
  + `<path d="M-4.5 -9.5 l1 3 M-1.5 -8.4 l0.6 3 M1.8 -8.6 l0.4 3 M4.6 -10 l0 3" stroke="#8a4a3a" stroke-width="0.6" fill="none"/>`;
// Épines dorsales implantées : de FACE/PROFIL quelques pointes dépassent au-dessus des
// épaules (derrière le corps) ; de DOS la rangée court le long de l'échine.
const EPINE = (x: number, y: number, s: number, a = 0) =>
  `<path transform="translate(${x},${y}) rotate(${a}) scale(${s})" d="M-1.4 0 Q0 -5.5 1 -6.5 Q1.6 -3 1.4 0 Z" fill="#9a9a5a" stroke="#4a4a24" stroke-width="0.5"/>`;
const OV_EPINES_FRONT = EPINE(-7, -29, 1.1, -18) + EPINE(-2.5, -31, 1.3, -6) + EPINE(2.5, -31, 1.3, 8) + EPINE(7, -29, 1.1, 20);
const OV_EPINES_BACK = EPINE(0, -26, 1.4) + EPINE(0, -18, 1.3) + EPINE(0, -10, 1.2) + EPINE(0, -2, 1.1) + EPINE(0, 6, 1);
const OV_EPINES_PROFILE = EPINE(-6, -27, 1.2, -32) + EPINE(-8, -20, 1.1, -50) + EPINE(-9, -12, 1, -62);

export const creature: CreatureDef = {
  name: 'Rat ogre',
  plan: 'biped',
  matchPriority: 10, // AVANT le def Skaven générique
  aliases: ['rat-ogre', 'ratogre'], // « rat ogre » = le nom
  race: 'Skaven',
  perso: {
    // MORPHO ici (chair cousue, fourrure, épines, griffes) ; son ÉQUIPEMENT (pagne-tablier
    // sanglé par les Molder) = tenue de carrière « Rat ogre » (registre, bareFoot).
    tenue: 'Rat ogre',
    gabarit: 'brute-bras-longs',
    sex: 'M',
    colors: { peau: '#b5876e', cheveux: '#3c362c' }, // chair rosée cousue + fourrure sombre
    features: [
      { bone: 'mainG', svg: OV_GRIFFES },
      { bone: 'mainD', svg: OV_GRIFFES },
      { bone: 'torse', svg: OV_FOURRURE_COL, scale: 'bone', layer: 60 },
      { bone: 'epauleG', svg: OV_FOURRURE_EPAULE, scale: 'bone', layer: 60 },
      { bone: 'epauleD', svg: OV_FOURRURE_EPAULE, scale: 'bone', layer: 60 },
      { bone: 'torse', svg: OV_COUTURE, scale: 'bone', layer: 61, view: 'front' },
      { bone: 'torse', svg: OV_EPINES_FRONT, scale: 'bone', layer: -2, view: 'front' },
      { bone: 'torse', svg: OV_EPINES_BACK, scale: 'bone', layer: 70, view: 'back' },
      { bone: 'torse', svg: OV_EPINES_PROFILE, scale: 'bone', layer: -2, view: 'profile' },
    ],
  },
};
