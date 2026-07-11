/**
 * ATTELAGE GÉNÉRIQUE (`attelage-generique`) — silhouette de REPLI des véhicules terrestres sans art
 * dédié (EDOC 07 « Chargement ») : caisse bâchée + roues + timon, MÊME silhouette que celle portée par
 * `composeLand` avant l'introduction du registre par id (#342). Sert de `FALLBACK` (patron
 * `engin/defs/canon-petit.ts`) tant qu'un id de `vehicles.json` (`charrette`/`diligence`/…) n'a pas son
 * propre fichier `land/defs/<id>.ts`.
 */
import type { LandArtDef } from '../artkit';
import { wheelFace } from '../artkit';

/** Silhouette de PROFIL (regarde à droite) : deux roues, caisse bâchée, timon en flèche vers l'avant.
 *  Coords LOCALES (origine = contact sol au centre, y NÉGATIF vers le haut) — cf. `groundedBody`. */
function profile(): string {
  return '<g>'
    // Timon (brancard) : flèche partant du bas de caisse vers l'avant-droit, au sol.
    + '<path d="M22 -18 L52 -3 L52 -7 L22 -22 Z" fill="@bois" stroke="@boisO" stroke-width="1.4"/>'
    // Châssis : longeron horizontal reliant les deux essieux.
    + '<path d="M-30 -16 L30 -16 L30 -22 L-30 -22 Z" fill="@boisO" stroke="@fer" stroke-width="1.2"/>'
    // Caisse : ridelle latérale (planches) posée sur le châssis.
    + '<path d="M-28 -22 L28 -22 L26 -44 L-26 -44 Z" fill="@bois" stroke="@boisO" stroke-width="1.6"/>'
    + '<line x1="-26" y1="-30" x2="26" y2="-30" stroke="@boisO" stroke-width="1.4" opacity="0.6"/>' // bandeau
    + '<line x1="-10" y1="-23" x2="-10" y2="-43" stroke="@boisO" stroke-width="1" opacity="0.5"/>'
    + '<line x1="10" y1="-23" x2="10" y2="-43" stroke="@boisO" stroke-width="1" opacity="0.5"/>'
    // Bâche : couverture bombée sur des arceaux.
    + '<path d="M-26 -44 Q0 -64 26 -44 L24 -48 Q0 -60 -24 -48 Z" fill="@bache" stroke="@boisO" stroke-width="1.2"/>'
    + '<path d="M-24 -47 Q0 -60 24 -47" stroke="@bache" stroke-width="6" fill="none" opacity="0.85"/>'
    // Roues (côté proche, au sol) : grande à l'arrière, plus petite à l'avant.
    + `<g transform="translate(-18,-15)">${wheelFace(15)}</g>`
    + `<g transform="translate(20,-13)">${wheelFace(13)}</g>`
    + '</g>';
}

export const landArt: LandArtDef = { id: 'attelage-generique', profile };
