/**
 * CHARIOT LÉGER (`chariot-leger`, `vehicles.json` — LDB 70 p.306) — variante de TAILLE du chariot
 * de fret (art PARTAGÉ, `_chariot-shapes.ts`, #642) : caisse profonde bâchée sur arceaux, quatre
 * roues (petites à l'avant, grandes à l'arrière), timon en flèche pour attelage double.
 */
import type { LandArtDef } from '../artkit';
import { chariotFront, chariotProfile, chariotBack } from './_chariot-shapes';

export const landArt: LandArtDef = { id: 'chariot-leger', front: chariotFront, profile: chariotProfile, back: chariotBack };
