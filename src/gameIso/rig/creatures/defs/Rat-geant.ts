import type { CreatureDef } from '../types';

// Rat géant — fidélité à l'artwork officiel (art-ref/ldb/page318_img7416.png, figure principale) :
// bête BASSE et RAMASSÉE (pattes courtes, corps massif arqué), tête tendue LOIN EN AVANT au ras du
// sol (encolure très couchée, l'os tete contre-pivote pour garder le museau à l'horizontale),
// museau BAVEUX/MALADE (deco tete : dents jaunies débordant des babines, coulures de bave
// verdâtre, truffe terne — par-dessus la tête 'rat' partagée, précédent : collier du Pégase),
// pelage hirsute brun-olive terne moucheté (taches + crinière hirsute), pattes et queue nue
// rosâtres (cuir).
export const creature: CreatureDef = {
  name: 'Rat géant',
  plan: 'quadruped',
  quad: {
    sl: 0.62, build: 'rodent', girth: 1.15, bodyLen: 1.08, neckLen: 0.4, neckAngle: -48,
    legLen: 0.3, head: 'rat', headScale: 1.18, tail: 'nue', tailLen: 1.3,
    ears: 'rondes', foot: 'patte', mane: 'hirsute', markings: 'taches',
    deco: {
      // museau malade, authoré dans le repère de l'ART de tête : scale = 1.3 (profil) × 1.18
      // (headScale) = 1.534, rotate(16) comme headProfile 'rat' (gueule x 8..21, truffe (20,10))
      tete: `<g transform="scale(1.534) rotate(16)" data-deco="museau-malade">` +
        // dents proéminentes JAUNIES débordant des babines (rangée sup + incisive inf)
        `<path d="M12 9.8 l1 4.8 l1.7 -4.2 Z M15.4 10.2 l0.9 4.4 l1.6 -3.8 Z M18.6 10 l0.8 3.8 l1.4 -3.3 Z" fill="#ddc476" stroke="#8a7430" stroke-width="0.35"/>` +
        // recolore JAUNI la dent blanche de l'art partagé (même tracé, par-dessus)
        `<path d="M14 13 q-2 4 -4 2" fill="none" stroke="#d3b968" stroke-width="1.2" stroke-linecap="round"/>` +
        // bave VERDÂTRE : écume aux babines, coulures depuis la commissure, gouttes qui pendent
        `<path d="M10 11.2 Q14 13.8 19.4 12.4" stroke="#a8c25e" stroke-width="1.4" fill="none" opacity="0.55" stroke-linecap="round"/>` +
        `<path d="M11.4 12.4 q-0.7 4.6 0.5 7.6 q1.1 -3.6 0.7 -7.1 Z" fill="#96b24c" opacity="0.85"/>` +
        `<path d="M15.4 13.2 q-0.3 3.7 0.8 5.8 q0.8 -2.9 0.4 -5.6 Z" fill="#89a83f" opacity="0.8"/>` +
        `<circle cx="12.1" cy="21.2" r="0.75" fill="#9cba52" opacity="0.85"/><circle cx="16.5" cy="20" r="0.6" fill="#9cba52" opacity="0.8"/>` +
        // truffe TERNE (recouvre le rose propre) + cerne malsain sous l'œil
        `<ellipse cx="20" cy="10" rx="1.7" ry="1.4" fill="#8f8468"/>` +
        `<path d="M13 8.4 q1.6 1.2 3 1" stroke="#7a8f3a" stroke-width="0.8" fill="none" opacity="0.5"/>` +
        `</g>`,
    },
    stored: {
      corps: '#5c543e', corpsO: '#322c1d', corpsH: '#7e7657', // pelage brun-olive terne, malsain
      cheveux: '#37311f', cheveuxO: '#1e1a10', // touffes hirsutes sombres (échine/encolure)
      cuir: '#bb8878', // pattes/queue de chair rosâtre
    },
  },
};
