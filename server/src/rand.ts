/**
 * Source aléatoire CRYPTOGRAPHIQUE (CWE-338) pour les 3 sites `server/src` qui émettent un
 * secret de partie (token hôte, token de reprise de siège, code de room) — `Math.random()` est
 * prévisible (PRNG non cryptographique), un attaquant qui l'observe/le devine prend le contrôle
 * total de la partie (hôte) ou usurpe un siège. `crypto.getRandomValues` est natif à workerd
 * (Web Crypto API standard, disponible aussi bien dans le Worker en prod qu'en Node ≥19 pour les
 * tests) — pas de dépendance ajoutée.
 * Signature `() => number` dans `[0, 1)`, compatible `rand` de `roomLogic.ts` (module PUR, testé
 * avec `Math.random` pour le déterminisme — hors périmètre de ce verrou).
 */
export function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}
