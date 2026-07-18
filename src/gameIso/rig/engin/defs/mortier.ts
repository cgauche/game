/**
 * MORTIER DE SIÈGE (`mortier`) — tube de fonte court à gueule évasée pointé HAUT (~55°), posé sur un
 * caisson de bois bas SANS grandes roues (réf. art AA 10 p.127 : tube trapu cerclé, bombes rondes au pied).
 * Art de l'engin (3 vues), routé par l'id d'espèce `mortier`. Ce qui le distingue du canon à première
 * vue : l'angle de tir presque vertical + l'affût-caisson au ras du sol.
 */
import { type EnginArtDef } from '../artkit';

function profile(): string {
  // Vue de CÔTÉ : caisson bas ferré, tube COURT et GROS incliné vers le haut-droite, bouche évasée
  // béante en l'air, bouton de culasse niché entre les flasques, coin d'élévation, bombes au sol.
  return '<g>'
    // Caisson (lit de bois bas) + cerclages de fer.
    + '<path d="M-32 -1 L32 -1 L32 -14 L-32 -14 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<line x1="-21" y1="-14" x2="-21" y2="-1" stroke="@fer" stroke-width="2.5"/>'
    + '<line x1="21" y1="-14" x2="21" y2="-1" stroke="@fer" stroke-width="2.5"/>'
    + '<line x1="-32" y1="-8" x2="32" y2="-8" stroke="@boisO" stroke-width="1" opacity="0.6"/>'
    // Flasques (joues) portant les tourillons.
    + '<path d="M-16 -14 L14 -14 L8 -30 L-8 -30 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    // Coin d'élévation glissé sous la culasse.
    + '<path d="M-24 -14 L-8 -14 L-8 -21 Z" fill="@boisO" stroke="@bois" stroke-width="1"/>'
    // Tube TRAPU incliné à ~55° (culasse en bas-gauche, gueule ÉVASÉE en haut-droite).
    + '<path d="M-19.4 -24.1 L9 -68.3 L27 -55.7 L-4.6 -13.9 Z" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<circle cx="-15.4" cy="-14.5" r="5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>' // bouton de culasse
    + '<circle cx="0" cy="-28" r="3.5" fill="@fonteO" stroke="@fer" stroke-width="1"/>' // tourillon
    // Astragales (cerclages de renfort) en travers du tube.
    + '<line x1="6.3" y1="-28.7" x2="-9.3" y2="-39.5" stroke="@fonteH" stroke-width="3"/>'
    + '<line x1="17.2" y1="-43.4" x2="0.8" y2="-54.8" stroke="@fonteH" stroke-width="3"/>'
    // Gueule ÉVASÉE : lèvre renflée + âme noire béante, plein axe.
    + '<g transform="translate(18,-62) rotate(-55)">'
    + '<ellipse rx="4.5" ry="13" fill="@fonte" stroke="@ferH" stroke-width="2"/>'
    + '<ellipse cx="-1" rx="2.8" ry="9" fill="#0c0c10"/>'
    + '</g>'
    // Bombes rondes en attente au pied du caisson.
    + '<circle cx="-40" cy="-5.5" r="5.5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<circle cx="-48" cy="-4.5" r="4.5" fill="@fonteO" stroke="@fer" stroke-width="1.5"/>'
    + '<circle cx="-42" cy="-7.5" r="1.4" fill="@fonteH"/>' // reflet
    + '</g>';
}

function front(): string {
  // Vue de FACE (côté où ça tire) : caisson bas face au spectateur, tube gras qui monte VERS lui,
  // gueule en grosse ellipse noire haut perchée — la « bouche au ciel » doit sauter aux yeux.
  return '<g>'
    // Caisson bas + cerclage.
    + '<path d="M-26 -1 L26 -1 L26 -14 L-26 -14 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<line x1="-26" y1="-7.5" x2="26" y2="-7.5" stroke="@fer" stroke-width="2"/>'
    // Flasques de part et d'autre du tube.
    + '<path d="M-21 -14 L-12 -14 L-10 -27 L-19 -27 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    + '<path d="M21 -14 L12 -14 L10 -27 L19 -27 Z" fill="@bois" stroke="@boisO" stroke-width="1.5"/>'
    // Corps du tube penché vers le spectateur (s'élargit vers la gueule).
    + '<path d="M-10 -16 L10 -16 L13 -42 L-13 -42 Z" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<line x1="-11.5" y1="-30" x2="11.5" y2="-30" stroke="@fonteH" stroke-width="3"/>' // astragale
    // Gueule évasée pointée haut : lèvre + âme béante + reflet.
    + '<ellipse cx="0" cy="-48" rx="15" ry="10" fill="@fonte" stroke="@ferH" stroke-width="2"/>'
    + '<ellipse cx="0" cy="-49" rx="10" ry="6.5" fill="#0c0c10"/>'
    + '<ellipse cx="-3.5" cy="-51" rx="3" ry="2" fill="#26242a"/>'
    // Bombe posée contre le caisson.
    + '<circle cx="-33" cy="-5.5" r="5.5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '</g>';
}

function back(): string {
  // Vue de DOS : culasse ronde vers le spectateur, tube qui fuit en montant (gueule cachée),
  // lumière de mise à feu apparente, bombes au pied.
  return '<g>'
    // Caisson (dos, bois à l'ombre) + cerclage.
    + '<path d="M-26 -1 L26 -1 L26 -14 L-26 -14 Z" fill="@boisO" stroke="@bois" stroke-width="1.5"/>'
    + '<line x1="-26" y1="-7.5" x2="26" y2="-7.5" stroke="@fer" stroke-width="2"/>'
    // Flasques.
    + '<path d="M-21 -14 L-12 -14 L-10 -27 L-19 -27 Z" fill="@boisO" stroke="@bois" stroke-width="1.5"/>'
    + '<path d="M21 -14 L12 -14 L10 -27 L19 -27 Z" fill="@boisO" stroke="@bois" stroke-width="1.5"/>'
    // Haut du tube qui fuit vers le haut/loin, au-dessus de la culasse.
    + '<path d="M-9 -26 L9 -26 L6 -48 L-6 -48 Z" fill="@fonteO" stroke="@fer" stroke-width="1.5"/>'
    + '<ellipse cx="0" cy="-49" rx="6.5" ry="2.5" fill="@fonteO" stroke="@ferH" stroke-width="1.5"/>' // lèvre lointaine
    // Culasse ronde plein cadre + bouton + lumière (mise à feu).
    + '<circle cx="0" cy="-22" r="11" fill="@fonte" stroke="@fer" stroke-width="2"/>'
    + '<circle cx="0" cy="-22" r="4.5" fill="@fonteH" stroke="@fer" stroke-width="1.5"/>' // bouton de culasse
    + '<circle cx="0" cy="-31" r="1.8" fill="#0c0c10"/>' // lumière
    // Bombes au pied.
    + '<circle cx="-33" cy="-5.5" r="5.5" fill="@fonte" stroke="@fer" stroke-width="1.5"/>'
    + '<circle cx="-41" cy="-4.5" r="4.5" fill="@fonteO" stroke="@fer" stroke-width="1.5"/>'
    + '</g>';
}

export const enginArt: EnginArtDef = { id: 'mortier', front, profile, back };
