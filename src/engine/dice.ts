/**
 * Générateur aléatoire injectable (seedable) — indispensable pour des tests
 * déterministes et, plus tard, pour une coop réseau reproductible.
 */
export interface RNG {
  /** Entier dans [min, max] inclus. */
  int(min: number, max: number): number;
}

/** RNG déterministe (mulberry32) à partir d'une graine. */
export function makeRNG(seed: number): RNG {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    int(min: number, max: number) {
      return min + Math.floor(next() * (max - min + 1));
    },
  };
}

/** RNG par défaut basé sur Math.random (parties solo non rejouables). */
export const defaultRNG: RNG = {
  int: (min, max) => min + Math.floor(Math.random() * (max - min + 1)),
};

export const d10 = (rng: RNG = defaultRNG) => rng.int(1, 10);
export const d100 = (rng: RNG = defaultRNG) => rng.int(1, 100);
export const roll = (n: number, sides: number, rng: RNG = defaultRNG) => {
  let total = 0;
  for (let i = 0; i < n; i++) total += rng.int(1, sides);
  return total;
};
