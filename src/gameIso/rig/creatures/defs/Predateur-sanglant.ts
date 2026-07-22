import type { CreatureDef } from '../types';
import { lateralPair } from '../../parts/parallax';

// Prédateur sanglant (Middenheim, « The Bloody Hidesman » — illustration p.114) : élémentaire incarné
// de Ghur. Humanoïde GÉANT musculeux (chair tan-orangé), tête = CRÂNE décharné à DÉFENSES (sabres) et
// BOIS (andouillers) démesurés, CRINIÈRE rousse aux épaules, mains = serres/griffes, pattes arrière
// DIGITIGRADES de LION (part `fauve`). Sa stature vient de sa TAILLE Énorme (creatures.json → ×2 auto) ;
// `perso.scale` n'est que la NUANCE intra-Énorme. Carrure la plus massive (`brute`, comme le Géant).
// monster = override COMPLET (crâne + pattes fauves + griffes) ; les BOIS/DÉFENSES/CRINIÈRE sont des
// `perso.features` ADDITIFS (appliqués même sous monster), dessinés PAR VUE (cf. Démonette).

// --- Crinière rousse (fourrure @cheveux) : col sur le haut du torse + touffe par épaule (cf. Rat-ogre).
const POILS = (d: string) => `<path d="${d}" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.6" stroke-linejoin="round"/>`;
const MANE_COL = POILS('M-12 -30 Q0 -34 12 -30 L11 -18 L8.5 -21 L6.5 -16 L4 -20 L1.5 -15 L-1 -19.5 L-3.5 -15 L-6 -20 L-8.5 -16 L-11 -21 Z');
const MANE_EP = POILS('M-5.5 -4 Q0 -7 5.5 -4 L5.8 7 L3.8 4.6 L2.4 8.6 L0.4 5 L-1.4 9 L-3 4.8 L-4.8 7.6 L-5.8 5 Z');

// --- Andouillers (bois ramifiés) : beam ivoire + tines, calque DERRIÈRE le crâne. Par vue.
const ANTLER_BEAMS_FB =
  '<g stroke="#cdc1a4" stroke-width="2.1" fill="none" stroke-linecap="round">'
  + '<path d="M4 -8 Q8 -15 9.5 -24 Q10 -30 8.4 -35"/><path d="M7.2 -17 Q11 -19 13.6 -23"/><path d="M8.6 -23 Q12.6 -25 15.2 -28"/><path d="M9.2 -29 Q11.6 -32 13.6 -34"/>'
  + '<path d="M-4 -8 Q-8 -15 -9.5 -24 Q-10 -30 -8.4 -35"/><path d="M-7.2 -17 Q-11 -19 -13.6 -23"/><path d="M-8.6 -23 Q-12.6 -25 -15.2 -28"/><path d="M-9.2 -29 Q-11.6 -32 -13.6 -34"/>'
  + '</g>'
  + '<g stroke="#6a5c40" stroke-width="0.7" fill="none" stroke-linecap="round" opacity="0.6">'
  + '<path d="M4 -8 Q8 -15 9.5 -24 Q10 -30 8.4 -35"/><path d="M-4 -8 Q-8 -15 -9.5 -24 Q-10 -30 -8.4 -35"/>'
  + '</g>';
// Profil : un bois balayé en arrière (+ exemplaire lointain via lateralPair) — pas l'art de face plaqué.
const ANTLER_PROFILE = lateralPair(
  '<g stroke="#cdc1a4" stroke-width="2" fill="none" stroke-linecap="round">'
  + '<path d="M-2 -8 Q-8 -14 -11 -24 Q-12 -30 -10.5 -34"/><path d="M-7 -16 Q-12 -17 -15 -20"/><path d="M-9.5 -23 Q-14 -25 -16.5 -27"/>'
  + '</g>', { dx: 4 });

// --- Défenses « comme des sabres » (illustration) aux commissures de la gueule : longs crocs ivoire
// recourbés vers le bas (front + profil), par-dessus le visage.
const TUSKS_FRONT =
  '<path d="M-3 7.5 Q-5.8 13 -5.2 21 Q-4.9 24.5 -5.6 25.5 Q-3.6 17 -2.2 8.5 Z" fill="#efe8d2" stroke="#b8a888" stroke-width="0.4"/>'
  + '<path d="M3 7.5 Q5.8 13 5.2 21 Q4.9 24.5 5.6 25.5 Q3.6 17 2.2 8.5 Z" fill="#efe8d2" stroke="#b8a888" stroke-width="0.4"/>';
const TUSKS_PROFILE = '<path d="M3 9 Q6.4 14 5.6 22 Q5.2 25.5 5.8 26.5 Q4 18 2.4 10 Z" fill="#efe8d2" stroke="#b8a888" stroke-width="0.4"/>';

// --- Épines dorsales (illustration : pointes le long de l'échine et des épaules). Pointes bone-tan
// (cf. Rat-ogre) ; quelques-unes dépassent des épaules de face/profil, rangée le long du dos de dos.
const EPINE = (x: number, y: number, s: number, a = 0) =>
  `<path transform="translate(${x},${y}) rotate(${a}) scale(${s})" d="M-1.5 0 Q0 -6 1 -7 Q1.7 -3 1.5 0 Z" fill="#b5a279" stroke="#5a4a30" stroke-width="0.5"/>`;
const SPINES_FRONT = EPINE(-8, -30, 1.1, -22) + EPINE(-3, -32, 1.3, -8) + EPINE(3, -32, 1.3, 8) + EPINE(8, -30, 1.1, 22);
const SPINES_BACK = EPINE(0, -28, 1.5) + EPINE(0, -19, 1.4) + EPINE(0, -10, 1.3) + EPINE(0, -1, 1.2) + EPINE(0, 8, 1.1);
const SPINES_PROFILE = EPINE(-7, -29, 1.3, -34) + EPINE(-9, -20, 1.2, -52) + EPINE(-10, -11, 1.1, -64) + EPINE(-9.5, -2, 1, -72);

export const creature: CreatureDef = {
  label: 'Prédateur sanglant',
  id: 'predateur-sanglant',
  plan: 'biped', // race par défaut = Humain (baseSpeciesOf)
  perso: {
    tenue: 'nu', // corps de chair musculeux (ne chausse pas)
    gabarit: 'brute', // carrure la plus massive (Géant/Minotaure)
    sex: 'M',
    scale: 1.08, // NUANCE intra-Énorme (dépasse un Énorme standard)
    extremites: 'griffues', // mains = serres/griffes (#736 Lot 2) ; race Humain partagée
    monster: { tete: 'crane', griffes: true, jambes: 'fauve' },
    colors: { peau: '#c98a5a', cheveux: '#a8431d' }, // chair tan-orangé + crinière rousse
    features: [
      // BOIS — derrière le crâne (layer bas), par vue.
      { bone: 'tete', svg: ANTLER_BEAMS_FB, layer: -2, view: 'front' },
      { bone: 'tete', svg: ANTLER_BEAMS_FB, layer: -2, view: 'back' },
      { bone: 'tete', svg: ANTLER_PROFILE, layer: -2, view: 'profile' },
      // DÉFENSES — par-dessus la gueule.
      { bone: 'tete', svg: TUSKS_FRONT, layer: 50, view: 'front' },
      { bone: 'tete', svg: TUSKS_PROFILE, layer: 50, view: 'profile' },
      // ÉPINES dorsales — derrière le corps de face/profil, le long de l'échine de dos.
      { bone: 'torse', svg: SPINES_FRONT, scale: 'bone', layer: -2, view: 'front' },
      { bone: 'torse', svg: SPINES_BACK, scale: 'bone', layer: 70, view: 'back' },
      { bone: 'torse', svg: SPINES_PROFILE, scale: 'bone', layer: -2, view: 'profile' },
      // CRINIÈRE rousse — col de torse + touffe d'épaule (suit l'os).
      { bone: 'torse', svg: MANE_COL, scale: 'bone', layer: 60 },
      { bone: 'epauleG', svg: MANE_EP, scale: 'bone', layer: 60 },
      { bone: 'epauleD', svg: MANE_EP, scale: 'bone', layer: 60 },
    ],
  },
};
