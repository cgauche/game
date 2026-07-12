import type { CreatureDef } from '../types';

// Chien de guerre — fidélité à l'artwork officiel (art-ref/ldb/page317_img7361.png) : DOGUE
// massif et musculeux, pas un chien courant. build 'feline' = poitrail PROFOND + taille creusée
// + arrière-main ronde et musclée, membres plus épais que 'canine' ; tête 'ours' = crâne LARGE,
// museau COURT écrasé, gueule ouverte à crocs (le rictus du molosse — 'loup' lisait museau fin
// pointu) ; petites oreilles rondes. Le HARNAIS COMPLET de l'artwork vit dans `deco` (précédent :
// collier doré du Pégase) : plastron d'épaule riveté @accent posé SOUS la zone que la tête (z7)
// masque (tout y<-2 du tronc avant est invisible au rendu), caparaçon de cuir du dos à liseré
// d'acier + chaînes, plaque de croupe SEGMENTÉE en lames, sangles bouclées de ventre, gorgerin
// d'acier à la base du cou + collier à pointes + plaque à tête de mort. girth 1.52 = masse du dogue.
export const creature: CreatureDef = {
  name: "Chien",
  plan: 'quadruped',
  quad: {
    sl: 0.8, build: 'feline', girth: 1.52, bodyLen: 0.92, neckLen: 0.36, neckAngle: -6,
    legLen: 0.48, head: 'ours', headScale: 1.05, tail: 'fouet', tailLen: 0.9, ears: 'rondes',
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
        // plaque de croupe SEGMENTÉE : lames d'acier imbriquées rivetées (le disque nu lisait « ovale »)
        `<path d="M-26 -13.5 Q-35.5 -12.5 -38.8 -5 Q-39.2 1.8 -33 3.8 Q-26.8 3.8 -24.8 -2 Q-24.3 -9 -26 -13.5 Z" fill="@accent" stroke="@accentO" stroke-width="0.7"/>` +
        `<path d="M-37.6 -7.6 Q-31 -9.8 -25 -8.8 M-38.9 -2.4 Q-31.6 -4.6 -24.6 -3.5" stroke="@accentO" stroke-width="0.55" fill="none"/>` +
        `<path d="M-35.3 -10 Q-30.8 -11.4 -26.4 -10.9" stroke="@accentH" stroke-width="1.1" fill="none" opacity="0.75"/>` +
        `<circle cx="-34.6" cy="-8" r="0.6" fill="@accentH"/><circle cx="-28" cy="-9.6" r="0.6" fill="@accentH"/><circle cx="-35.4" cy="-3.4" r="0.6" fill="@accentH"/><circle cx="-27.6" cy="-4.6" r="0.6" fill="@accentH"/><circle cx="-33.2" cy="1.4" r="0.6" fill="@accentH"/><circle cx="-27.4" cy="0.4" r="0.6" fill="@accentH"/>` +
        // sangle de passage (derrière l'épaule) + boucle
        `<path d="M11 -5 L14 -5 Q15 4 12.5 11 L9.5 11 Q12 4 11 -5 Z" fill="@cuir" stroke="#0e0b07" stroke-width="0.5"/>` +
        `<rect x="10.6" y="1.5" width="3.4" height="3.4" rx="0.6" fill="@accent" stroke="@accentO" stroke-width="0.4"/>` +
        // sangle de ventre arrière + clou
        `<path d="M-24.5 0 L-21.5 -0.5 Q-20 5.5 -21.5 10 L-24.5 10 Q-23 5 -24.5 0 Z" fill="@cuir" stroke="#0e0b07" stroke-width="0.5"/>` +
        `<circle cx="-22.8" cy="4.8" r="0.9" fill="@accent" stroke="@accentO" stroke-width="0.35"/>` +
        // PLASTRON d'épaule : dôme riveté DESCENDU sur l'épaule/le poitrail VISIBLE (l'ancien,
        // à y -17..2, vivait sous la tête z7 → invisible au rendu) + plaque de bras
        `<path d="M10.5 -10.5 Q21 -13.5 26.5 -6.5 Q28.5 1.5 23.5 7.5 Q16 10.5 11.5 4.5 Q9 -3.5 10.5 -10.5 Z" fill="@accent" stroke="@accentO" stroke-width="0.7"/>` +
        `<path d="M12.8 -7 Q19.5 -9.8 24.5 -4.5" stroke="@accentH" stroke-width="1.4" fill="none" opacity="0.8"/>` +
        `<circle cx="12" cy="-7.5" r="0.6" fill="@accentH" stroke="@accentO" stroke-width="0.25"/><circle cx="18" cy="-11" r="0.6" fill="@accentH" stroke="@accentO" stroke-width="0.25"/><circle cx="24.7" cy="-6.5" r="0.6" fill="@accentH" stroke="@accentO" stroke-width="0.25"/><circle cx="26.6" cy="-0.5" r="0.6" fill="@accentH" stroke="@accentO" stroke-width="0.25"/><circle cx="22" cy="6.2" r="0.6" fill="@accentH" stroke="@accentO" stroke-width="0.25"/><circle cx="12.4" cy="2.5" r="0.6" fill="@accentH" stroke="@accentO" stroke-width="0.25"/>` +
        `<path d="M14.5 7 Q20.5 6 23.5 10 Q23 14 18.5 15 Q14.5 13.5 14 10 Q14 8 14.5 7 Z" fill="@accent" stroke="@accentO" stroke-width="0.6"/>` +
        `<circle cx="18.8" cy="10.6" r="0.7" fill="@accentH"/>` +
        `</g>`,
      // GORGERIN d'acier à la BASE du cou (l'ancien collier à y -9..-1 vivait sous la tête z7 →
      // invisible) + collier à pointes au-dessus + plaque à tête de mort sur la gorge
      encolure: `<g data-deco="collier">` +
        `<path d="M-8.6 -3 l-3.8 -0.4 l3.4 -2.4 Z M9.4 -3.6 l3.8 -0.8 l-3.2 -2.4 Z M-3.4 -4.2 l1.2 -3.4 l1.7 3.1 Z M2.2 -4 l1.3 -3.3 l1.6 3.2 Z" fill="@accent" stroke="@accentO" stroke-width="0.35"/>` +
        `<path d="M-9.4 -0.4 Q0 2 9.8 -1 L9 -5 Q0 -2.6 -8.8 -5.2 Z" fill="@cuir" stroke="#0e0b07" stroke-width="0.6"/>` +
        `<circle cx="-4.5" cy="-2.6" r="0.8" fill="@accentH"/><circle cx="0.5" cy="-1.4" r="0.8" fill="@accentH"/><circle cx="5.5" cy="-2.2" r="0.8" fill="@accentH"/>` +
        `<path d="M-9.8 1 Q0 3.8 10.2 0.6 L11 5.6 Q0 9.4 -10.4 6.4 Z" fill="@accent" stroke="@accentO" stroke-width="0.6"/>` +
        `<path d="M-7.6 3.4 Q0 5.8 8 3.6" stroke="@accentH" stroke-width="1.1" fill="none" opacity="0.75"/>` +
        `<circle cx="-7.4" cy="4.6" r="0.55" fill="@accentH"/><circle cx="-2.4" cy="5.9" r="0.55" fill="@accentH"/><circle cx="2.8" cy="5.8" r="0.55" fill="@accentH"/><circle cx="8" cy="4.3" r="0.55" fill="@accentH"/>` +
        `<rect x="4.6" y="2.6" width="5.2" height="6" rx="1.2" fill="@accent" stroke="@accentO" stroke-width="0.5"/>` +
        `<circle cx="7.2" cy="5" r="1.6" fill="#efe6cf"/><circle cx="6.5" cy="4.8" r="0.45" fill="#241c14"/><circle cx="7.9" cy="4.8" r="0.45" fill="#241c14"/><path d="M6.6 6.2 h1.3 M6.8 6.9 h0.9" stroke="#241c14" stroke-width="0.4"/>` +
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
