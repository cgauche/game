// Démon : élancé nerveux, membres longs.
import type { RaceDef } from '../types';
import { OV_CORNES_DEMON } from '../../parts/monstrous';
import { lateralPair } from '../../parts/parallax';

// Définition musculaire sur la chair rouge (« peau dure comme l'airain, forgée sur l'enclume
// de guerres incessantes » LDB 84) : pectoraux, ligne médiane, abdominaux — en ombres @peauO.
// Remplace les anciens membres-rouges/stries, INVISIBLES sur un corps déjà rouge.
const OV_MUSCLES_TORSE =
  `<path d="M-8.5 -15 Q-4 -11.5 0 -12 Q4 -11.5 8.5 -15" stroke="@peauO" stroke-width="1" fill="none" opacity="0.8"/>`
  + `<path d="M0 -11.5 L0 9" stroke="@peauO" stroke-width="0.9" fill="none" opacity="0.7"/>`
  + `<path d="M-4.5 -5 Q0 -3.6 4.5 -5 M-4.2 1 Q0 2.4 4.2 1 M-3.8 7 Q0 8.4 3.8 7" stroke="@peauO" stroke-width="0.8" fill="none" opacity="0.65"/>`
  + `<path d="M-9 -18 Q-7 -12 -8.5 -6 M9 -18 Q7 -12 8.5 -6" stroke="@peauO" stroke-width="0.8" fill="none" opacity="0.55"/>`;

// Corne de PROFIL : UNE corne balayée vers l'arrière (-x) depuis le sommet du crâne — l'art
// de face plaqué de profil donnait deux anses symétriques. Paire proche/lointaine (parallaxe).
const CORNE_DEMON_PROFIL =
  `<path d="M6 -5 Q0 -9 -4.5 -13.5 Q-8.5 -18 -7.5 -23 Q-6.8 -25.8 -4.2 -26.6 Q-6.4 -22.8 -4.8 -18.8 Q-2.8 -13.8 1.6 -10 Q3.6 -8.2 6 -7 Z" fill="#1a1410" stroke="#000" stroke-width="0.5"/>`
  + `<path d="M-3.4 -14.5 q-1.8 -1 -2.4 -2.6 M-5.4 -19.5 q-1.4 -0.8 -1.7 -2.2" stroke="#3a3026" stroke-width="0.6" fill="none"/>`;

export const race: RaceDef = {
  id: 'Démon',
  gabarit: 'elance',
  gabaritOverride: { sl: 1.06, legs: 1.06 },
  palette: { peau: "#9a201a", peauO: "#601010", peauH: "#c4382c", cheveux: "#1a1410", cheveuxO: "#0a0806", cheveuxH: "#2c2620" },
  career: 'Nu',
  head: 'demon',
  legs: 'chevre', // jambes digitigrades (illustration LDB p.337 : sabots/pattes bestiales)
  features: [
    { bone: 'tete',  svg: OV_CORNES_DEMON,  scale: 'bone', layer: -2, view: 'front' },
    { bone: 'tete',  svg: OV_CORNES_DEMON,  scale: 'bone', layer: -2, view: 'back' },
    { bone: 'tete',  svg: lateralPair(CORNE_DEMON_PROFIL, { dx: 4 }), scale: 'bone', layer: -2, view: 'profile' },
    { bone: 'torse', svg: OV_MUSCLES_TORSE, scale: 'bone', layer: 60 },
  ],
};
