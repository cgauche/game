/**
 * BATEAU-TRÉSOR CATHAYEN (MDG, ~130 m, voile) — jonque colossale : quatre voiles LATTÉES en
 * éventail, poupe-pagode à toits retroussés, étrave évasée à l'ŒIL peint, safran profond.
 * Le géant absolu de la toise navale.
 */
import type { ShipArtDef } from '../artkit';
import { junkSail, pennant, spar, stay } from '../artkit';

/** Toit de pagode à arêtes retroussées. */
const pagodaRoof = (cx: number, y: number, hw: number): string =>
  `<path d="M${cx - hw} ${y} Q${cx - hw + 2} ${y - 3.4} ${cx - hw - 2.6} ${y - 5.4} L${cx} ${y - 4.6} L${cx + hw + 2.6} ${y - 5.4} Q${cx + hw - 2} ${y - 3.4} ${cx + hw} ${y} Z" fill="@pavillon" stroke="@coqueO" stroke-width="0.9"/>`;

function profile(): string {
  return '<g>'
    // Safran profond sous la poupe.
    + '<path d="M-50 -12 L-56 -11 L-54.6 1.5 L-49.5 0.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    // Quatre mâts à voiles lattées en éventail (le grand mât au centre-arrière, l'étagement cathayen).
    + spar(-40, -26, -40, -64, 2.2) + junkSail(-40, -60, 30, 12, 7, 4)
    + spar(-13, -18, -13, -96, 2.8) + junkSail(-13, -90, 48, 17, 9, 5)
    + spar(15, -16, 15, -88, 2.6) + junkSail(15, -82, 42, 15, 8, 5)
    + spar(39, -20, 39, -58, 2.2) + junkSail(39, -54, 26, 10, 6, 3)
    + stay(-13, -96, -42, -30) + stay(15, -88, 41, -24) + stay(-13, -96, 16, -22)
    + pennant(-13, -96, 12) + pennant(15, -88, 10) + pennant(-40, -64, 8) + pennant(39, -58, 8)
    // Coque massive : muraille haute, étrave évasée remontante, poupe-château.
    + '<path d="M-50 -26 Q-26 -17 0 -16 Q28 -17 50 -24 L57 -13 L50 -1.6 Q0 3.6 -46 -1.6 Z" fill="@coque" stroke="@coqueO" stroke-width="1.6"/>'
    + '<path d="M-50 -26 Q-26 -17 0 -16 Q28 -17 50 -24 L57 -13" fill="none" stroke="@coqueH" stroke-width="1.4"/>'
    + '<path d="M-48 -18 Q0 -9.5 51 -17.5 M-47 -10 Q0 -3 50 -9.5" fill="none" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>'
    // ŒIL peint de l'étrave (tradition cathayenne).
    + '<circle cx="48" cy="-18.5" r="2.8" fill="@voile" stroke="@coqueO" stroke-width="0.9"/>'
    + '<circle cx="48.8" cy="-18.5" r="1.2" fill="@matO"/>'
    // Poupe-PAGODE : deux étages à toits retroussés.
    + '<rect x="-49" y="-34" width="22" height="8" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + pagodaRoof(-38, -34, 12)
    + '<rect x="-45.5" y="-45" width="15" height="6.6" fill="@coque" stroke="@coqueO" stroke-width="1"/>'
    + pagodaRoof(-38, -45, 8.5)
    + '<path d="M-44 -30 l3 0 m4 0 l3 0 M-42.5 -41.5 l3 0 m4 0 l3 0" stroke="@voileH" stroke-width="1.6"/>' // fenêtres
    + '</g>';
}

export const hullArt: ShipArtDef = { id: 'bateau-tresor-cathayen', profile };
