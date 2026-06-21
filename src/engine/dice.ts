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

/** Descripteur de jet de dés en DONNÉE (forme canonique partagée : « NdM(+P ») — `n`d`sides`+`plus`).
 *  Source UNIQUE réutilisée par la Formula `{dice}` (ops), les maladies (incubation/durée) et les
 *  Imparfaites (miscast, qui l'étend d'un `sinPlus`). */
export interface DiceSpec {
  n: number;
  sides: number;
  plus?: number;
}
/** Roule un `DiceSpec` (n dés à `sides` faces + `plus`). PUR (RNG injecté). */
export const rollDice = (dc: DiceSpec, rng: RNG = defaultRNG): number => roll(dc.n, dc.sides, rng) + (dc.plus ?? 0);

/** Évalue une expression de dés signée (« 1d10+15 », « 2d10 », « d10 », « 15 », « 1d6-1 ») → total
 *  tiré. Termes additionnés ; « NdM » roule N dés à M faces (N implicite = 1). PUR (RNG injecté). */
export function rollExpr(expr: string, rng: RNG = defaultRNG): number {
  let total = 0;
  const re = /([+-]?)\s*(?:(\d*)d(\d+)|(\d+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr)) !== null) {
    const sign = m[1] === '-' ? -1 : 1;
    if (m[3] != null) total += sign * roll(m[2] ? parseInt(m[2], 10) : 1, parseInt(m[3], 10), rng);
    else if (m[4] != null) total += sign * parseInt(m[4], 10);
  }
  return total;
}
