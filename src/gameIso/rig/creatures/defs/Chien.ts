import type { CreatureDef } from '../types';

// Chien de guerre — fidélité à l'artwork officiel (art-ref/ldb/page317_img7361.png) : DOGUE
// massif et musculeux, pas un chien courant. build 'feline' = poitrail PROFOND + taille creusée
// + arrière-main ronde et musclée, membres plus épais que 'canine' ; tête 'ours' = crâne LARGE,
// museau COURT écrasé, gueule ouverte à crocs (le rictus du molosse — 'loup' lisait museau fin
// pointu) ; petites oreilles rondes. Le HARNAIS COMPLET de l'artwork vit dans `deco` (précédent :
// collier doré du Pégase) : plastron d'épaule riveté @accent, caparaçon de cuir du dos à liseré
// d'acier + chaînes, sangles bouclées de ventre, collier à pointes + plaque à tête de mort.
export const creature: CreatureDef = {
  name: "Chien",
  plan: 'quadruped',
  quad: {
    sl: 0.8, build: 'feline', girth: 1.38, bodyLen: 0.92, neckLen: 0.36, neckAngle: -6,
    legLen: 0.48, head: 'ours', headScale: 1.15, tail: 'fouet', tailLen: 0.9, ears: 'rondes',
    foot: 'patte', mane: 'sans', ridge: 'sans', markings: 'sans',
    deco: {
      // repère local du tronc (profil) : +x = avant, dos y≈-19, ventre y≈+10 (bodyLen 0.92)
      tronc: `<g data-deco="harnais">` +
        // caparaçon de cuir garrot→hanche
        `<path d="M14 -18.5 Q-4 -21 -24 -16.5 Q-27 -8 -25 -1.5 Q-6 -7 13 -5.5 Q15.5 -12 14 -18.5 Z" fill="@cuir" stroke="#0e0b07" stroke-width="0.6"/>` +
        // liseré d'acier du bord bas + rivets du caparaçon
        `<path d="M-25 -1.5 Q-6 -7 13 -5.5 L12.6 -3.2 Q-6 -4.6 -24.4 0.7 Z" fill="@accent" stroke="@accentO" stroke-width="0.4"/>` +
        `<circle cx="-18" cy="-13" r="0.7" fill="@accentH"/><circle cx="-10" cy="-15" r="0.7" fill="@accentH"/><circle cx="-2" cy="-16" r="0.7" fill="@accentH"/><circle cx="6" cy="-15.5" r="0.7" fill="@accentH"/>` +
        // chaînes en travers de la croupe
        `<path d="M-8 -14 Q-16 -10 -23 -4 M-4 -13 Q-13 -8 -21 -1" stroke="@accentH" stroke-width="0.8" stroke-dasharray="1.2 1.6" fill="none" opacity="0.9"/>` +
        // plaque de croupe : cuir + disque d'acier riveté
        `<path d="M-27 -13 Q-36 -12 -39 -5 Q-39 2 -33 4 Q-26.5 4 -24.5 -2 Q-24 -9 -27 -13 Z" fill="@cuir" stroke="#0e0b07" stroke-width="0.6"/>` +
        `<circle cx="-31.5" cy="-4" r="4.6" fill="@accent" stroke="@accentO" stroke-width="0.6"/>` +
        `<path d="M-34.5 -6 Q-31.5 -8 -28.8 -5.8" stroke="@accentH" stroke-width="1.1" fill="none" opacity="0.8"/>` +
        `<circle cx="-31.5" cy="-4" r="0.7" fill="@accentH"/>` +
        // sangle de passage (derrière l'épaule) + boucle
        `<path d="M11 -5 L14 -5 Q15 4 12.5 11 L9.5 11 Q12 4 11 -5 Z" fill="@cuir" stroke="#0e0b07" stroke-width="0.5"/>` +
        `<rect x="10.6" y="1.5" width="3.4" height="3.4" rx="0.6" fill="@accent" stroke="@accentO" stroke-width="0.4"/>` +
        // sangle de ventre arrière + clou
        `<path d="M-24.5 0 L-21.5 -0.5 Q-20 5.5 -21.5 10 L-24.5 10 Q-23 5 -24.5 0 Z" fill="@cuir" stroke="#0e0b07" stroke-width="0.5"/>` +
        `<circle cx="-22.8" cy="4.8" r="0.9" fill="@accent" stroke="@accentO" stroke-width="0.35"/>` +
        // PLASTRON d'épaule : grande plaque bombée rivetée + plaque de bras
        `<path d="M15 -17 Q26 -18 29.5 -10 Q30.5 -2 25 2.5 Q17.5 4.5 13.5 -1 Q12 -10 15 -17 Z" fill="@accent" stroke="@accentO" stroke-width="0.7"/>` +
        `<path d="M17 -13.5 Q24 -15 27.5 -9" stroke="@accentH" stroke-width="1.4" fill="none" opacity="0.8"/>` +
        `<circle cx="16.5" cy="-13" r="0.6" fill="@accentH" stroke="@accentO" stroke-width="0.25"/><circle cx="22" cy="-16" r="0.6" fill="@accentH" stroke="@accentO" stroke-width="0.25"/><circle cx="27.5" cy="-12.5" r="0.6" fill="@accentH" stroke="@accentO" stroke-width="0.25"/><circle cx="28.6" cy="-5" r="0.6" fill="@accentH" stroke="@accentO" stroke-width="0.25"/><circle cx="24" cy="1" r="0.6" fill="@accentH" stroke="@accentO" stroke-width="0.25"/><circle cx="16" cy="-3.5" r="0.6" fill="@accentH" stroke="@accentO" stroke-width="0.25"/>` +
        `<path d="M18 1.8 Q24 0.8 26.5 5 Q26 9.5 21 10.5 Q16.5 9 16.5 5 Q16.8 2.8 18 1.8 Z" fill="@accent" stroke="@accentO" stroke-width="0.6"/>` +
        `<circle cx="21.5" cy="5.8" r="0.7" fill="@accentH"/>` +
        `</g>`,
      // collier à pointes + plaque à tête de mort, juste sous le crâne (tête à y≈-10.8)
      encolure: `<g data-deco="collier">` +
        `<path d="M-8.8 -6.5 l-3.6 -0.6 l3.4 -2.2 Z M9.6 -7 l3.6 -1 l-3.2 -2.2 Z M-3.5 -7.6 l1.2 -3.2 l1.6 2.9 Z M2 -7.4 l1.3 -3.1 l1.5 3 Z" fill="@accent" stroke="@accentO" stroke-width="0.35"/>` +
        `<path d="M-9.5 -4 Q0 -1.5 10 -4.5 L9.2 -8.5 Q0 -6 -8.8 -8.8 Z" fill="@cuir" stroke="#0e0b07" stroke-width="0.6"/>` +
        `<circle cx="-4.5" cy="-6" r="0.8" fill="@accentH"/><circle cx="0.5" cy="-4.8" r="0.8" fill="@accentH"/><circle cx="5.5" cy="-5.6" r="0.8" fill="@accentH"/>` +
        `<path d="M6.5 -3.8 l0.9 2.4" stroke="@cuir" stroke-width="1" stroke-linecap="round"/>` +
        `<rect x="5" y="-1.6" width="5.2" height="6" rx="1.2" fill="@accent" stroke="@accentO" stroke-width="0.5"/>` +
        `<circle cx="7.6" cy="0.8" r="1.6" fill="#efe6cf"/><circle cx="6.9" cy="0.6" r="0.45" fill="#241c14"/><circle cx="8.3" cy="0.6" r="0.45" fill="#241c14"/><path d="M7 2 h1.3 M7.2 2.7 h0.9" stroke="#241c14" stroke-width="0.4"/>` +
        `</g>`,
    },
    stored: {
      corps: '#8a5f3a', corpsO: '#3e2c1a', corpsH: '#b48a58', // robe fauve/brune de l'artwork
      cheveux: '#4a3320', cheveuxO: '#241708', // poil hérissé de nuque/crâne (le hérissement du molosse)
      accent: '#98a0a8', // acier du harnais (plastron, liserés, pointes du collier)
      cuir: '#241c14', // sangles, caparaçon, coussinets
    },
  },
};
