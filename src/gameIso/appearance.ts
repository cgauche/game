/**
 * Apparence d'une créature par calques. Une apparence = liste ordonnée de
 * calques ; chaque calque a N variantes (fragments SVG en boîte 120×150,
 * pieds en (60,150)). On en tire une par calque (seed) puis on concatène.
 * Le pool discret = 1 calque à N variantes. Le sprite monolithique actuel
 * (creatureSprites.json) reste le fallback — cf. sprites.ts.
 */
import { makeRNG } from '../engine/dice';
import { CREATURE_APPEARANCES } from './creatureAppearances';

export interface AppearanceLayer {
  /** slot logique : 'pose' | 'peau' | 'tete' | 'gear' … (chaîne libre). */
  slot: string;
  /** chaque variante est un fragment SVG (<g>…</g>) dans la boîte 120×150. */
  variants: string[];
}

export interface CreatureAppearance {
  /** clé = nom de créature (= clé bestiaire), ex. 'Mutant'. */
  id: string;
  layers: AppearanceLayer[];
}

/** slot → index de variante forcé (override éditeur). */
export type AppearancePins = Record<string, number>;

/** Hash FNV-1a 32 bits → graine entière stable pour un id de token. */
export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Calques d'une créature enrichie (pour l'inspecteur éditeur). */
export function appearanceLayers(name: string): AppearanceLayer[] {
  return CREATURE_APPEARANCES[name]?.layers ?? [];
}

/**
 * Compose l'inner-SVG d'une créature enrichie. Renvoie `null` si la créature
 * n'a pas d'apparence par calques (le fallback monolithique est appliqué par
 * l'appelant, cf. enemySprite dans sprites.ts).
 */
export function composeAppearance(
  name: string,
  seed: number,
  pins?: AppearancePins,
): string | null {
  const spec = CREATURE_APPEARANCES[name];
  if (!spec) return null;
  const rng = makeRNG(seed || 1);
  let out = '';
  for (const layer of spec.layers) {
    const n = layer.variants.length;
    if (n === 0) continue;
    const pin = pins?.[layer.slot];
    const tirage = rng.int(0, n - 1); // toujours consommé → tirage stable par calque
    const idx = pin != null && pin >= 0 && pin < n ? pin : tirage;
    out += layer.variants[idx];
  }
  return out;
}
