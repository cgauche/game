/**
 * Schéma de `renduMonte.json` — réglages MAISON du rendu du couple monté (non-règles), consommé par
 * `src/gameIso/rig/quadruped/harnais/index.ts` (`DEFAUT_HARNAIS_MONTE`).
 */
import { z } from 'zod';

export const file = 'renduMonte.json';
export const famille = 'config';

export const schema = z.strictObject({
  /** Id d'un set d'équipement du registre `src/gameIso/rig/quadruped/harnais/`, apposé à une monture
   *  PORTÉE dont le record ne déclare aucun `appearance.harnais` (LDB 08 l.557 ; ADE I 07 l.48). Un
   *  `harnais` déclaré par le record ou par un override d'instance PRIME. */
  harnaisParDefaut: z.string(),
});
