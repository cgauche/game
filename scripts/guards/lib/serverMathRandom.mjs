// Mécanique de scan du garde-fou « pas de Math.random pour un secret de room » (CWE-338, verrou
// P1-1) : `server/src/**` émet des secrets de partie (token hôte, token de reprise de siège, code
// de room) — `Math.random()` y est un PRNG non cryptographique, prévisible. La source
// cryptographique (`secureRandom`, `server/src/rand.ts`) doit être la SEULE injectée aux 3 sites
// producteurs de secret ; `roomLogic.ts` reste PUR (signature `rand` en paramètre, testé avec
// `Math.random` pour le déterminisme — les TESTS restent hors périmètre de ce verrou). Module ESM
// pur, exécutable par `node` nu — même patron que `hardcode.mjs`/`inBattleFind.mjs`.

/** Retire commentaires ET imports nommés — mêmes règles que `hardcode.mjs`.
 * @param {string} src @returns {string} */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+['"][^'"]*['"];?/g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

/** @type {RegExp} */
export const MATH_RANDOM_RX = /Math\.random\(/;

/**
 * Scan complet d'un fichier source : chaque ligne portant `Math.random(` (hors commentaires/imports).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanServerMathRandom(relPath, contenu) {
  const findings = [];
  stripComments(contenu)
    .split('\n')
    .forEach((line, i) => {
      if (MATH_RANDOM_RX.test(line)) findings.push({ line: i + 1, detail: line.trim() });
    });
  return findings;
}

/** Compte de sites par fichier (raccourci de `scanServerMathRandom(...).length`).
 * @param {string} relPath @param {string} contenu @returns {number} */
export function countServerMathRandom(relPath, contenu) {
  return scanServerMathRandom(relPath, contenu).length;
}
