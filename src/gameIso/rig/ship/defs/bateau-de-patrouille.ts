/**
 * BATEAU DE PATROUILLE (MDG 12 l.91, ~25 m, mixte, Bélier/Renforcé 2/Solide 2) — garde-côte
 * impérial : quille TENDUE (pas de croissant), étrave élancée prolongée d'un éperon de bronze,
 * gaillard d'avant crénelé PRIS dans le contour de coque (poste des arbalétriers), demi-pont
 * arrière à balustrade pour le timonier, préceinte de renfort, 6 avirons par bord, voile carrée
 * à bande impériale, hune de vigie. 3 vues (front / profile / back).
 */
import type { ShipArtDef } from '../artkit';
import { flag, hune, oarBank, pennant, rudder, spar, squareSail, stay } from '../artkit';

function profile(): string {
  return '<g>'
    + oarBank(-24, 14, 6, -6, 6)
    + rudder(-36, -12)
    // Gréement : mât central, hune de vigie, voile de route à bande impériale.
    + spar(-3, -12, -3, -74, 2.6)
    + squareSail(-3, -66, 34, 15, { seams: 1 })
    + '<path d="M-7.5 -64.5 Q-4 -50 -6.5 -33.5 M1.5 -65 Q5 -50 2.5 -33" stroke="@pavillon" stroke-width="2.4" opacity="0.75" fill="none"/>'
    + hune(-3, -71.5)
    + stay(-3, -74, 36, -17) + stay(-3, -74, -34, -19) + stay(-3, -66, 30, -15)
    + pennant(-3, -74, 11)
    // COQUE CONSTRUITE en un seul volume : demi-pont arrière → tonture tendue → gaillard
    // d'avant crénelé → étrave élancée ; quille quasi droite, étambot incliné.
    + '<path d="M-40 -21 L-29 -21 L-29 -13 Q-4 -11.8 22 -13.6 L22 -21 L25.5 -21 L25.5 -18.4 L28.5 -18.4 L28.5 -21 L32 -21 L32 -18.4 L35 -18.4 L35 -21 L38.5 -21 L43.5 -7 L46 -1.5 L46 0.4 Q0 2.2 -34 1 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    + '<path d="M-29 -13 Q-4 -11.8 22 -13.6" fill="none" stroke="@coqueH" stroke-width="1.2"/>'
    // PRÉCEINTE de renfort (Renforcé 2) + virure basse + membrures ferrées.
    + '<path d="M-36 -7.5 L44 -6" fill="none" stroke="@coqueH" stroke-width="1.8" opacity="0.9"/>'
    + '<path d="M-34.5 -3.5 L45 -2.5" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    + '<path d="M-16 -12.2 L-16 0.8 M-2 -11.9 L-2 1.2 M12 -12.6 L12 1" stroke="@matO" stroke-width="1" opacity="0.4"/>'
    // Demi-pont arrière : nez de pont + lisse ajourée du timonier.
    + '<path d="M-40 -13.2 L-29 -13.2" stroke="@coqueO" stroke-width="0.8" opacity="0.6"/>'
    + '<path d="M-40 -18.6 L-29 -18.6" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    // Meurtrières du gaillard (arbalétriers de la patrouille).
    + '<path d="M26.8 -19.8 l0 3 M33.2 -19.8 l0 3" stroke="@coqueO" stroke-width="0.9" opacity="0.7"/>'
    // ÉPERON de bronze à la flottaison, dans l'axe de la quille.
    + '<path d="M45.5 -4 L56 -1.6 L45 0.4 Z" fill="@matO" stroke="@coqueO" stroke-width="0.9"/>'
    + '<path d="M46.5 -3 L53.5 -1.9" stroke="@coqueH" stroke-width="0.9" opacity="0.8"/>'
    // Étendard impérial en tête d'étrave.
    + flag(37, -21, 6.5, 4.5)
    + '</g>';
}

function front(): string {
  return '<g>'
    // Voile pleine face (vent portant), bande impériale, mât et vigie par-dessus.
    + squareSail(0, -64, 32, 15, { seams: 1 })
    + '<path d="M-5 -62.5 Q-4.5 -48 -5 -33.5 M5 -62.5 Q4.5 -48 5 -33.5" stroke="@pavillon" stroke-width="2.4" opacity="0.75" fill="none"/>'
    + spar(0, -8, 0, -72, 2.4)
    + hune(0, -69.5)
    + stay(0, -72, -13, -16) + stay(0, -72, 13, -16)
    + pennant(0, -72, 9)
    // Avirons en éventail des deux bords.
    + '<g stroke="@mat" stroke-width="1.3" stroke-linecap="round"><line x1="-9" y1="-7.5" x2="-20" y2="0.5"/><line x1="-9.5" y1="-6" x2="-22" y2="2"/><line x1="-9.5" y1="-4.5" x2="-21" y2="3.5"/><line x1="9" y1="-7.5" x2="20" y2="0.5"/><line x1="9.5" y1="-6" x2="22" y2="2"/><line x1="9.5" y1="-4.5" x2="21" y2="3.5"/></g>'
    // Coque de POINTE vue par l'étrave : parapet crénelé du gaillard INTÉGRÉ au volume.
    + '<path d="M-8.5 -19.5 L-5.5 -19.5 L-5.5 -17.2 L-1.7 -17.2 L-1.7 -19.5 L1.7 -19.5 L1.7 -17.2 L5.5 -17.2 L5.5 -19.5 L8.5 -19.5 L10.5 -9.5 Q10.5 -2.5 4.5 0.8 L-4.5 0.8 Q-10.5 -2.5 -10.5 -9.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    // Barre d'étrave axiale + préceinte ceinturant l'avant.
    + '<path d="M0 -19.5 L0 -1.2" stroke="@coqueH" stroke-width="1.8"/>'
    + '<path d="M-10.4 -8.5 Q0 -5.8 10.4 -8.5" fill="none" stroke="@coqueH" stroke-width="1.4"/>'
    + '<path d="M-9.6 -4 Q0 -1.8 9.6 -4" fill="none" stroke="@coqueO" stroke-width="0.7" opacity="0.5"/>'
    // ÉPERON pointé sur le spectateur, à la flottaison.
    + '<path d="M-3.4 -1 L3.4 -1 L0 3.2 Z" fill="@matO" stroke="@coqueO" stroke-width="0.9"/>'
    // Étendard impérial en tête d'étrave.
    + flag(0, -19.5, 6, 4)
    + '</g>';
}

function back(): string {
  return '<g>'
    // Voile vue de dos (même silhouette carrée), mât, vigie, flamme.
    + squareSail(0, -64, 32, 15, { seams: 1 })
    + '<path d="M-5 -62.5 Q-4.5 -48 -5 -33.5 M5 -62.5 Q4.5 -48 5 -33.5" stroke="@pavillon" stroke-width="2.4" opacity="0.75" fill="none"/>'
    + spar(0, -8, 0, -72, 2.4)
    + hune(0, -69.5)
    + stay(0, -72, -13, -17) + stay(0, -72, 13, -17)
    + pennant(0, -72, 9)
    // Avirons trailés des deux bords.
    + '<g stroke="@mat" stroke-width="1.3" stroke-linecap="round"><line x1="-9.5" y1="-7" x2="-21" y2="1.5"/><line x1="-10" y1="-5.5" x2="-22" y2="3"/><line x1="9.5" y1="-7" x2="21" y2="1.5"/><line x1="10" y1="-5.5" x2="22" y2="3"/></g>'
    // POUPE pleine : tableau arrondi sous le demi-pont du timonier.
    + '<path d="M-9.5 -18.5 L9.5 -18.5 L10.8 -9 Q10.8 -2 4.5 1 L-4.5 1 Q-10.8 -2 -10.8 -9 Z" fill="@coque" stroke="@coqueO" stroke-width="1.4"/>'
    // Balustrade du demi-pont (lisse + chandeliers).
    + '<path d="M-9.5 -21.5 L9.5 -21.5" stroke="@mat" stroke-width="1.4"/>'
    + '<path d="M-9.5 -18.5 l0 -3 M-4.8 -18.5 l0 -3 M0 -18.5 l0 -3 M4.8 -18.5 l0 -3 M9.5 -18.5 l0 -3" stroke="@mat" stroke-width="1.1"/>'
    // Bordages du tableau + préceinte.
    + '<path d="M-10.4 -13 L10.4 -13 M-9.8 -3.8 L9.8 -3.8" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    + '<path d="M-10.7 -8.3 L10.7 -8.3" stroke="@coqueH" stroke-width="1.6" opacity="0.9"/>'
    // SAFRAN d'étambot centré, ferrures apparentes.
    + '<path d="M-1.8 -10 L1.8 -10 L2.4 2.5 L-2.4 2.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + '<path d="M-1.9 -6.8 L1.9 -6.8 M-2.1 -1.8 L2.1 -1.8" stroke="@matO" stroke-width="0.9"/>'
    // Étendard impérial au couronnement.
    + flag(6.5, -21.5, 6, 4)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'bateau-de-patrouille', profile, front, back };
