/**
 * Schéma de `decorPalette.json` — palette de tons NOMMÉS (bois/terre/or/sang/pierre/os/feuillage/azur/
 * arcane/pourpre/patine/ombre/blanc + groupe `villageois*`), consommée par `catalog/decorPalette.ts`
 * (`export const P: Record<DecorTone, string> = raw`, `DecorTone = keyof typeof raw`). Un objet PLAT
 * clé→couleur : pas de forme fixe de clés (le nombre de tons par famille grandit librement), donc
 * `z.record` plutôt qu'un `strictObject` énumérant chaque ton.
 */
import { z } from 'zod';

export const file = 'decorPalette.json';

/** Valeurs observées : hex 3/6/8 chiffres (`#fff`, `#5a4a33`, `#94908648` — 8 chiffres = alpha RVBA). */
export const schema = z.record(z.string(), z.string());

export type DecorPaletteData = z.infer<typeof schema>;
