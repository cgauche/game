/**
 * CHARIOT MOYEN (`chariot-moyen`, `vehicles.json` — EDOC compagnon p.27) — variante de TAILLE du
 * chariot de fret (art PARTAGÉ, `_chariot-shapes.ts`, #642) : caisse profonde bâchée sur arceaux,
 * quatre roues (petites à l'avant, grandes à l'arrière), timon en flèche pour attelage double.
 */
import type { LandArtDef } from '../artkit';
import { chariotFront, chariotProfile, chariotBack } from './_chariot-shapes';

export const landArt: LandArtDef = { id: 'chariot-moyen', front: chariotFront, profile: chariotProfile, back: chariotBack };
