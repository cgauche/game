import type { CreatureDef } from '../types';

// Sanglier — fidélité à l'artwork officiel (art-ref/ldb/page318_img7412.png) : robe GRIS-BRUN
// grisonnante et mouchetée (pas un brun sombre uni), tête et hure PÂLES argentées, CRÊTE de soies
// dressées en dents de scie qui court du garrot à la croupe, corps COMPACT et voûté à l'avant-train
// dominant (bosse d'épaule haute, arrière fin), pattes courtes sur petits sabots clairs.
// LDB 78 l.58-61 (Cornes (Défenses), 1m50-1m80 de long, Armure (Peau 1)).
// La crête dorsale vit en `deco.encolure` (repère contre-calculé sur le dos suid × girth ; l'os
// encolure n'a d'art qu'en PROFIL → pas de crête fantôme en face/dos — précédent : TACK du Cheval).
export const creature: CreatureDef = {
  name: "Sanglier",
  plan: 'quadruped',
  quad: {
    sl: 0.84, build: 'suid', girth: 1.42, bodyLen: 0.92, neckLen: 0.3, neckAngle: 0,
    legLen: 0.56, head: 'sanglier', headScale: 1.3, tail: 'fouet', tailLen: 0.75,
    ears: 'pointues', foot: 'sabot', mane: 'hirsute', markings: 'taches',
    deco: {
      // crête de soies dressées garrot→croupe : dents de scie @cheveux (pâles) suivant la ligne
      // de dos suid (bosse d'épaule haute à l'avant, décrue vers l'arrière-train fin)
      encolure: `<g data-deco="crete-soies">` +
        `<path d="M3 -12 L0 -26 L-3.5 -20.5 L-7 -32 L-10.5 -24 L-14 -35 L-17.5 -25.5 L-21 -34 L-24.5 -23 L-28 -29 L-31.5 -15.5 L-35 -21 L-38.5 -11.5 L-42 -15 L-45.5 -7 L-49 -10 L-52.5 -4 L-56 -6.5 L-59 -1.5 L-60 1.5 Q-45 -4 -32 -12 Q-19 -23 -12 -22.5 Q-3 -18.5 3 -8.5 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5" stroke-linejoin="round"/>` +
        // racine sombre de la crête (assise dans la robe) + quelques soies détachées
        `<path d="M2 -10 Q-3 -19 -12 -23 Q-19 -23.5 -31 -13.5 Q-44 -6.5 -59 0" fill="none" stroke="@cheveuxO" stroke-width="1.1" opacity="0.55"/>` +
        `<path d="M-5 -30 l-1.6 -3.4 M-15.5 -33.5 l-1.2 -3.6 M-26 -27.5 l-1.6 -3 M-40 -13.5 l-1.8 -2.6 M-51 -8 l-1.8 -2.2" stroke="@cheveux" stroke-width="0.9" stroke-linecap="round" opacity="0.8"/>` +
        `</g>`,
      // tête pâle grisonnante (artwork : chanfrein et hure argentés) — lavis clair sur le crâne,
      // volontairement centré/doux pour lire dans les trois vues
      tete: `<g data-deco="grison"><ellipse cx="2" cy="-6" rx="8.5" ry="4.5" fill="@corpsH" opacity="0.45"/><path d="M-3 -8 l-1.2 -3 M1 -9 l0 -3.2 M5 -8.5 l1 -3 M8 -7 l1.4 -2.6" stroke="@cheveux" stroke-width="1" stroke-linecap="round" opacity="0.7"/></g>`,
    },
    stored: {
      corps: '#6b5c4a', corpsO: '#332a1e', corpsH: '#98876e', // robe gris-brun grisonnante, mouchetée par markings
      cheveux: '#b7a98d', cheveuxO: '#5a4f3c', // soies PÂLES argentées (crête, hure, épi de nuque)
      cuir: '#96907e', // petits sabots clairs (l'artwork montre des pinces blanchâtres)
    },
  },
};
