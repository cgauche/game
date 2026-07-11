// Mécanique de scan du garde-fou « exclusivité du seam de jet » (#274, DERNIER verrou du programme
// #276 — `docs/plans/2026-07-10-conception-seam-de-jet.md` Décision 2). La porte déclarative
// (`openRoll`, `src/state/rollSeam.ts`) + `TestOutcome.seal(...)` (`src/engine/testOutcome.ts`) sont
// le SEUL chemin scellé pour produire une issue de Test ; un `rollTest(`/`d100(` inline ou un
// `TestOutcome.seal(` hors whitelist forge un jet SANS passer par la policy de surfaçage (M/V/I,
// Décision 3) — exactement le trou que ce garde ferme. Module ESM pur, exécutable par `node` nu —
// mécanique ICI, whitelist EN POLICY dans le test/pre-commit (même patron que `hardcode.mjs`).

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

/** Les 3 motifs de forgeage/roulage bruts d'un Test — seul le noyau du seam (whitelist #274) peut
 *  les appeler. @type {RegExp} */
export const ROLL_SEAM_RX = /\brollTest\(|\bd100\(|\bTestOutcome\.seal\(/;

/**
 * Scan complet d'un fichier source : chaque ligne portant un motif de roulage/scellement brut (hors
 * commentaires/imports).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanRollSeamExclusivity(relPath, contenu) {
  const findings = [];
  stripComments(contenu)
    .split('\n')
    .forEach((line, i) => {
      if (ROLL_SEAM_RX.test(line)) findings.push({ line: i + 1, detail: line.trim() });
    });
  return findings;
}

/** Compte de sites par fichier (raccourci de `scanRollSeamExclusivity(...).length`).
 * @param {string} relPath @param {string} contenu @returns {number} */
export function countRollSeamExclusivity(relPath, contenu) {
  return scanRollSeamExclusivity(relPath, contenu).length;
}
