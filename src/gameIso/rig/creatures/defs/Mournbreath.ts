import type { CreatureDef } from '../types';
import { feat } from '../../parts/elements';
import { GRIFFES_ART } from '../../parts/elements/defs/griffes';

// Fr'hough Mournbreath — Prince démon (LDB 336, artwork p.338 = art-ref/ldb/page338_img8504.png) :
// HUMANOÏDE bipède musclé à peau blême, crâne en OGIVE clouté couronné de multiples cornes
// rouge sombre côtelées, visage démoniaque à crocs d'où pend une longue langue grise, bras
// gauche terminé en énorme pince-gueule dévorante rouge, grande lame en faux dans la main
// droite (griffes blanches), jambes digitigrades à sabots, pagne sombre ceinturé de chaînes.
// → plan biped + parts monstrueuses (tête demon / jambes chevre / bras griffe) ; le propre de
// la figure (couronne, ogive, langue, faux, dents de la pince, crêtes d'épaule) = features.

// Couronne de cornes rouge sombre côtelées rayonnant autour du crâne (3 par côté, s = ±1).
const OV_COURONNE = (s: number) =>
  `<g fill="#8a2a1e" stroke="#421008" stroke-width="0.6" stroke-linejoin="round">`
  + `<path d="M${5 * s} -9 Q${13 * s} -12 ${15.5 * s} -19 Q${16 * s} -21 ${14 * s} -22.5 Q${14.5 * s} -18 ${11 * s} -15 Q${8 * s} -12 ${3.5 * s} -10.5 Z"/>`
  + `<path d="M${7 * s} -4 Q${15 * s} -5 ${18 * s} -10.5 Q${19 * s} -12.5 ${17.5 * s} -14.5 Q${17 * s} -10.5 ${13 * s} -8 Q${10 * s} -6 ${6 * s} -5.8 Z"/>`
  + `<path d="M${7 * s} 2 Q${15 * s} 3 ${17.5 * s} 8.5 Q${18.5 * s} 10.5 ${16 * s} 12 Q${16 * s} 8 ${12 * s} 6 Q${9.5 * s} 4.6 ${6 * s} 3.8 Z"/>`
  + `<path d="M${9 * s} -12.5 q${1.2 * s} 1.4 ${0.6 * s} 2.6 M${12 * s} -16 q${1.2 * s} 1.2 ${0.8 * s} 2.4 M${11 * s} -7.4 q${0.8 * s} 1.6 ${0.2 * s} 2.8 M${14.5 * s} -10 q${1 * s} 1.4 ${0.4 * s} 2.6 M${11 * s} 5 q${0.4 * s} 1.6 ${-0.2 * s} 2.6 M${14 * s} 7.6 q${0.6 * s} 1.4 0 2.6" stroke="#c05844" stroke-width="0.5" fill="none"/>`
  + `</g>`;

// Crâne en ogive clouté s'élevant au-dessus de la tête (base cachée sous la part de tête).
const OV_OGIVE =
  `<g><path d="M-5.5 -8 Q-4 -20 0 -25.5 Q4 -20 5.5 -8 Q0 -11 -5.5 -8 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
  + `<circle cx="0" cy="-21" r="0.8" fill="#8f8577"/><circle cx="0" cy="-17.5" r="0.9" fill="#8f8577"/><circle cx="0" cy="-14" r="1" fill="#8f8577"/></g>`;

// Longue langue grise sinueuse pendant de la gueule, terminée en boule barbelée (face seule).
const OV_LANGUE =
  `<g><path d="M-0.5 12.5 Q-2 18 0.5 21 Q3 24 1.5 27.5 Q1 28.6 0 28.4 Q1.6 25 -0.6 22.4 Q-3.4 19 -1.9 12.8 Z" fill="#9aa0a4" stroke="#5c6266" stroke-width="0.5"/>`
  + `<circle cx="0.8" cy="29" r="1.2" fill="#6a7074" stroke="#3e4448" stroke-width="0.4"/>`
  + `<path d="M0.8 27.3 l0 -1.1 M2.3 28.4 l1 -0.6 M-0.7 28.4 l-1 -0.6 M0.8 30.7 l0 1.1 M2.3 29.6 l1 0.6 M-0.7 29.6 l-1 0.6" stroke="#3e4448" stroke-width="0.5"/></g>`;

// Grande faux : hampe sombre en diagonale dans le poing, vaste lame incurvée argentée en tête.
const OV_FAUX =
  `<g><path d="M-7 16 L10 -20" stroke="#3a2c20" stroke-width="2.2" stroke-linecap="round"/>`
  + `<path d="M-7 16 L10 -20" stroke="#57432f" stroke-width="0.7"/>`
  + `<path d="M-2.6 6.6 l2.6 1.2 M-0.8 2.8 l2.6 1.2" stroke="#1e140c" stroke-width="0.8"/>`
  + `<path d="M10 -20 Q2 -30 -14 -31 Q-22 -31 -26.5 -27 Q-16 -29.2 -6 -26.6 Q3.6 -24 9.6 -17.6 Z" fill="#c3c8ce" stroke="#5a6066" stroke-width="0.6"/>`
  + `<path d="M-24.5 -27.4 Q-14 -29.4 -4 -26.8" stroke="#eef2f6" stroke-width="0.7" fill="none"/></g>`;

// Gueule dévorante DANS la pince : gosier noir + rangées de crocs sur les deux mâchoires.
const OV_GUEULE_PINCE =
  `<g><ellipse cx="-1" cy="27" rx="2.8" ry="5.2" fill="#1c0604" stroke="#0e0302" stroke-width="0.4"/>`
  + `<path d="M-3.4 23 l2.2 0.8 l-1.8 1.4 z M-3.8 26 l2.4 0.6 l-1.8 1.6 z M-3.6 29.4 l2.2 0.4 l-1.4 1.6 z" fill="#efe6cf"/>`
  + `<path d="M1.6 24 l-2 0.9 l1.8 1.2 z M2 27 l-2.2 0.7 l1.8 1.4 z M1.6 30.2 l-1.8 0.6 l1.4 1.4 z" fill="#e8dcc0"/></g>`;

// Crête d'écailles rouges segmentées sur l'épaule (accents rouges des membres de l'artwork).
const OV_CRETE_EPAULE =
  `<path d="M-3 0.5 q1.4 -2.2 2.8 0 q-1.4 1.8 -2.8 0 Z M0.4 -1.2 q1.4 -2.2 2.8 0 q-1.4 1.8 -2.8 0 Z M1 2.4 q1.3 -2 2.6 0 q-1.3 1.7 -2.6 0 Z" fill="#8a2a1e" stroke="#421008" stroke-width="0.4"/>`;

// Plaque rouge côtelée sur le tibia (jambières striées de l'artwork — la jambe chevre est
// dessinée entière sur l'os cuisse, même ancrage que la def sœur Whiptongue).
const OV_TIBIA_ROUGE =
  `<path d="M-2.6 26 L-3.4 43 L0.6 43 L0 26 Z" fill="#8a2a1e" opacity="0.9"/>`
  + `<path d="M-2.8 30 l3 0.2 M-3 34 l3.2 0.2 M-3.1 38 l3.4 0.2" stroke="#421008" stroke-width="0.5" opacity="0.85"/>`;

// Segment rouge côtelé sur l'avant-bras porteur de la faux (accents rouges du bras de l'artwork).
const OV_AVANTBRAS_ROUGE =
  `<path d="M-3 2 Q-4 7 -3.2 12 L0.8 12 Q1.4 7 0.6 2 Z" fill="#8a2a1e" opacity="0.9"/>`
  + `<path d="M-3.4 5 l4.4 0.2 M-3.6 8.4 l4.6 0.2" stroke="#421008" stroke-width="0.5" opacity="0.85"/>`;

export const creature: CreatureDef = {
  name: "Fr'hough Mournbreath",
  plan: 'biped',
  perso: {
    tenue: 'sanguinaire',
    gabarit: 'brute',
    scale: 1.35, // trait Taille (Grande) au statbloc
    monster: { tete: 'demon', jambes: 'chevre', brasG: 'griffe', cornes: true },
    colors: { peau: '#c6bbae', cheveux: '#7c241c' }, // chair blême ; pince/accents rouge sombre
    features: [
      ...feat('muscles-torse'),
      { bone: 'tete', svg: OV_COURONNE(1), scale: 'bone', layer: -2 },
      { bone: 'tete', svg: OV_COURONNE(-1), scale: 'bone', layer: -2 },
      { bone: 'tete', svg: OV_OGIVE, scale: 'bone', layer: -1 },
      { bone: 'tete', svg: OV_LANGUE, scale: 'bone', layer: 70, view: 'front' },
      { bone: 'mainD', svg: GRIFFES_ART },
      { bone: 'mainD', svg: OV_FAUX, layer: 80 },
      { bone: 'epauleG', svg: OV_GUEULE_PINCE, scale: 'bone', layer: 60 },
      { bone: 'epauleD', svg: OV_CRETE_EPAULE, scale: 'bone', layer: 60 },
      { bone: 'cuisseG', svg: OV_TIBIA_ROUGE, layer: 10 },
      { bone: 'cuisseD', svg: OV_TIBIA_ROUGE, layer: 10 },
      { bone: 'avantBrasD', svg: OV_AVANTBRAS_ROUGE, layer: 10 },
    ],
  },
};
