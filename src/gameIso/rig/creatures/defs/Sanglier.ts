import type { CreatureDef } from '../types';

// Sanglier — fidélité à l'artwork officiel (art-ref/ldb/page318_img7412.png) : robe GRIS-BRUN
// grisonnante et mouchetée (pas un brun sombre uni), tête et hure PÂLES argentées, CRÊTE de soies
// dressées en dents de scie qui court du garrot à la croupe, corps COMPACT et voûté à l'avant-train
// dominant (bosse d'épaule haute, arrière fin), pattes courtes sur petits sabots clairs.
// LDB 78 l.58-61 (Cornes (Défenses), 1m50-1m80 de long, Armure (Peau 1)).
// La crête dorsale vit en `deco.encolure` (repère contre-calculé sur le dos suid × girth ; l'os
// encolure n'a d'art qu'en PROFIL → pas de crête fantôme en face/dos — précédent : TACK du Cheval).
export const creature: CreatureDef = {
  label: "Sanglier",
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
      // tête pâle grisonnante (artwork : hure et chanfrein argentés) — en PROFIL, bande de chanfrein
      // ajustée au crâne (repère deco = art interne ×1.69 tourné de 10° ; œil ~(9.4,5.1), oreilles
      // y≤-8 → la bande passe SOUS les oreilles et AU-DESSUS de l'œil, plus de halo fumeux)
      'tete#profile': `<g data-deco="hure-pale">` +
        `<path d="M-8 -3 Q-5 -9 2 -10 Q9 -9 14 -4 Q19 0 23 6 Q24 9 24 11 Q19 8 15 5 Q8 0 2 -1 Q-4 -1.5 -8 -3 Z" fill="@cheveux" opacity="0.8"/>` +
        `<ellipse cx="-1" cy="-6" rx="6.5" ry="3.5" fill="@cheveux" opacity="0.6"/>` +
        `<path d="M4 -5 Q10 -2 15 2 Q19 5 22 8" fill="none" stroke="@corpsH" stroke-width="1.4" opacity="0.5"/>` +
        `<path d="M-4 -6 l-1 -3 M1 -8 l0.2 -3.2 M6 -7.5 l1 -3 M11 -5 l1.4 -2.6 M16 -1 l1.6 -2.2" stroke="@cheveux" stroke-width="1" stroke-linecap="round" opacity="0.85"/>` +
        `</g>`,
      // face/dos : lavis centré doux (têtes symétriques, pas de chanfrein visible)
      'tete#front': `<g data-deco="grison"><ellipse cx="0" cy="-6" rx="9" ry="5.5" fill="@cheveux" opacity="0.6"/><path d="M-4 -9 l-1.2 -3 M0 -10 l0 -3.2 M4 -9.5 l1 -3" stroke="@cheveux" stroke-width="1" stroke-linecap="round" opacity="0.85"/></g>`,
      'tete#back': `<g data-deco="grison"><ellipse cx="0" cy="-6" rx="9" ry="5.5" fill="@cheveux" opacity="0.6"/></g>`,
      // robe contrastée (artwork : avant-train grisonnant pâle qui dévale vers un arrière-train
      // sombre, flanc moucheté) — repère local du tronc suid, bodyLen 0.92 → x∈[-40,30]
      'tronc#profile': `<g data-deco="robe-grisonnante">` +
        `<path d="M-8 -17 Q3 -26 13 -24 Q22 -21 27 -14 Q29 -8 28 -3 Q20 -9 11 -13 Q1 -16 -8 -13 Z" fill="@cheveux" opacity="0.32"/>` +
        `<path d="M-19 -12 Q-31 -13 -35.5 -10 Q-40 -6 -39.5 -1 Q-40 5 -35 10 Q-30 14 -18 14 Q-22 4 -21 -4 Z" fill="@corpsO" opacity="0.28"/>` +
        `<path d="M-14 -6 l2.4 -1 M-6 -3 l2.4 -1 M2 -6 l2.4 -0.8 M10 -4 l2.4 -0.8 M-10 3 l2.4 -0.8 M0 5 l2.4 -0.8 M-20 1 l2.4 -0.8 M8 5 l2.4 -0.8 M16 -8 l2.4 -0.8" stroke="@corpsH" stroke-width="0.9" stroke-linecap="round" opacity="0.55"/>` +
        `</g>`,
    },
    stored: {
      corps: '#544b3f', corpsO: '#2c251c', corpsH: '#aea489', // robe gris-brun grisonnante, mouchetée par markings
      cheveux: '#c4b89f', cheveuxO: '#5a4f3c', // soies PÂLES argentées (crête, hure, épi de nuque)
      cuir: '#96907e', // petits sabots clairs (l'artwork montre des pinces blanchâtres)
    },
  },
};
