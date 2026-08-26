/**
 * Vocabulaire FEUILLE partagé par les schémas d'une racine `src/scenes` — les formes que la SCÈNE
 * (`./scene.ts`) et les EFFETS (`./effets.ts`) posent l'une comme l'autre. Un concept = une
 * définition : ce module existe pour qu'aucune des deux ne recopie l'autre (et pour que le cycle
 * `scene ⇄ effets` n'ait pas lieu — la scène porte des Flows, les effets portent des cases).
 */
import { z } from 'zod';
import type { CustomStatblock } from '../../../engine/statblock';

/** `Pt` (`state/path.ts`) — case, `z` = couche d'empilement (absent = base). */
export const ptSchema = z.strictObject({ x: z.number(), y: z.number(), z: z.number().optional() });
/** Bourse (`gold`/`silver`/`brass`) d'un coût ou d'un octroi. */
export const moneySchema = z.strictObject({ gold: z.number().optional(), silver: z.number().optional(), brass: z.number().optional() });
/** CANON de l'arête de mur — arête cardinale N/E, diagonales `\` (NO→SE) et `/` (NE→SO). Source
 *  UNIQUE de l'union : `state/scene.ts` (`WallSide`) et `engine/types.ts` (`WallEdgeSide`) en
 *  DÉRIVENT, l'éditeur en dérive ses options (`wallSideSchema.options`). Garde : `unions-canon.test.ts`. */
export const wallSideSchema = z.enum(['N', 'E', '\\', '/']);
export type WallSide = z.infer<typeof wallSideSchema>;
/** `CustomStatblock` (`engine/statblock.ts`) — profil PNJ/bête custom d'éditeur. */
export const customStatblockSchema = z.custom<CustomStatblock>();
