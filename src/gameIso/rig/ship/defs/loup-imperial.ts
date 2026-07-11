/**
 * LOUP IMPÉRIAL (MDG, ~55 m, mixte) — galéasse de l'Empire : haut bord PERCÉ de sabords
 * au-dessus d'une batterie d'avirons, trois mâts à voiles RAYÉES, château arrière et éperon.
 * Réf : planche MDG p.098 (en bas à gauche — les voiles à bandes font la signature).
 */
import type { ShipArtDef } from '../artkit';
import { castle, flag, gunports, hune, oarBank, pennant, spar, squareSail, stay } from '../artkit';

/** Voile carrée RAYÉE (bandes verticales @pavillon — la livrée du Loup). */
function stripedSail(cx: number, yTop: number, h: number, hw: number): string {
  let s = squareSail(cx, yTop, h, hw);
  for (let i = 0; i < 3; i++) {
    const x = cx - hw + ((2 * hw) * (2 * i + 1)) / 6;
    s += `<path d="M${x - 2.2} ${yTop + 2} Q${x - 2.2 + h * 0.13} ${yTop + h * 0.55} ${x - 2.2} ${yTop + h - 1.5} L${x + 2.2} ${yTop + h - 1.5} Q${x + 2.2 + h * 0.13} ${yTop + h * 0.55} ${x + 2.2} ${yTop + 2} Z" fill="@pavillon" opacity="0.8"/>`;
  }
  return s;
}

function profile(): string {
  return '<g>'
    + oarBank(-38, 30, 10, -9, 7)
    // Trois mâts, voiles rayées, hunes de combat.
    + spar(-30, -20, -30, -70, 2.4) + stripedSail(-30, -63, 30, 13)
    + spar(-2, -16, -2, -96, 3) + stripedSail(-2, -88, 42, 17) + hune(-2, -92)
    + spar(26, -16, 26, -76, 2.4) + stripedSail(26, -69, 32, 13)
    + stay(-2, -96, -32, -24) + stay(-2, -96, 27, -20) + stay(26, -76, 50, -14)
    + pennant(-2, -96, 12) + pennant(-30, -70, 8) + pennant(26, -76, 8)
    // Haut bord : batterie d'avirons sous rangée de sabords.
    + '<path d="M-52 -22 Q-28 -16 0 -15.4 Q28 -16 52 -20 L48 -1.5 Q0 3 -47 -1.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1.5"/>'
    + '<path d="M-52 -22 Q-28 -16 0 -15.4 Q28 -16 52 -20" fill="none" stroke="@coqueH" stroke-width="1.4"/>'
    + '<path d="M-50 -10 Q0 -5 50 -9.4" fill="none" stroke="@coqueH" stroke-width="1.6" opacity="0.9"/>' // préceinte/apostis
    + gunports(-40, 36, 6, -13, 3)
    // Château arrière + petit gaillard, ÉPERON impérial.
    + castle(-52, -34, -32, -21, 4)
    + castle(38, 52, -28, -19.5, 3)
    + '<path d="M52 -8 L58 -3.4 L51.5 -1 Z" fill="@matO" stroke="@coqueO" stroke-width="1"/>'
    + flag(-50, -32, 8, 5)
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'loup-imperial', profile };
