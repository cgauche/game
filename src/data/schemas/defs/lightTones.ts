/**
 * Schéma de `lightTones.json` — TONS de lumière (#1245, L4) : l'APPARENCE d'une source ponctuelle
 * (couleur, part d'intensité, vacillement), résolue au bord du RENDU (`gameIso/stage/stagePointLights.ts`).
 * Le RAYON, lui, reste la seule chose que le moteur connaisse d'une source (LDB 74) — un ton n'a
 * aucune conséquence de règle et n'entre dans aucun calcul de vision.
 *
 * Bornes, et pourquoi elles sont celles-là :
 *  - `color` : `#rrggbb` minuscule, la forme unique du dépôt (cf. `decorPalette.json`) ;
 *  - `intensity` ∈ ]0,1] : c'est un FACTEUR du calage anti-saturation `FLAME_INTENSITY`, jamais une
 *    intensité absolue — au-delà de 1, deux flaques qui se recouvrent écrêteraient en aplat blanc
 *    (le canevas n'a aucun tone mapping) ; à 0, la source serait une lampe éteinte, pas un ton ;
 *  - `flicker.amplitude` ∈ [0,0.5] : le vacillement RETRANCHE (`1 − amplitude × bruit`), donc au-delà
 *    de 0,5 une flamme passerait la moitié du temps sous la moitié de sa flaque — une panne, pas un feu ;
 *  - `flicker.hz` ∈ ]0,8] : au-delà, le battement dépasse ce qu'une frame de 60 Hz échantillonne sans
 *    crénelage temporel (deux points par période au minimum).
 */
import { z } from 'zod';

export const file = 'lightTones.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    color: z.string().regex(/^#[0-9a-f]{6}$/),
    intensity: z.number().gt(0).lte(1),
    flicker: z
      .strictObject({
        amplitude: z.number().min(0).max(0.5),
        hz: z.number().gt(0).max(8),
      })
      .optional(),
  }),
);
