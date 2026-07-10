// Mécanique de scan du garde-fou « recherche de combattant EN COMBAT par id » (#279, F1 du
// programme structurel #276). Le motif `X.combatants.find((c) => c.id === expr)` (n'importe quel
// receveur `X` : `battle`, `get().battle`, `s.battle`, une variable locale…) réinvente
// `inBattleId(battle, id)` (`src/state/combatOrParty.ts`). Module ESM pur, exécutable par `node`
// nu — consommé par `src/state/in-battle-find-guard.test.ts` ET par un futur hook pre-commit.
// Même patron que `hardcode.mjs` (mécanique de détection ici, BASELINES en policy dans le test).

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

/**
 * Motif du find-par-id EN COMBAT : `.combatants.find((c) => c.id === …)` — capture tout receveur
 * (`battle.`, `get().battle?.`, `s.battle.`, une variable locale déjà = `battle`…). Matche AUSSI
 * les prédicats composés (`c.id === X && …`) : ce sont des sites APPARENTÉS (pas migrables tels
 * quels vers `inBattleId` seul) mais RESTENT de la réinvention du même concept — comptés, pas exclus.
 * @type {RegExp}
 */
export const IN_BATTLE_FIND_RX = /\.combatants\.find\(\s*\(?\w+\)?\s*=>\s*\w+\.id\s*===/;

/**
 * Scan complet d'un fichier source : chaque ligne portant le motif (hors commentaires/imports).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanInBattleFind(relPath, contenu) {
  const findings = [];
  stripComments(contenu)
    .split('\n')
    .forEach((line, i) => {
      if (IN_BATTLE_FIND_RX.test(line)) findings.push({ line: i + 1, detail: line.trim() });
    });
  return findings;
}

/** Compte de sites par fichier (raccourci de `scanInBattleFind(...).length`).
 * @param {string} relPath @param {string} contenu @returns {number} */
export function countInBattleFind(relPath, contenu) {
  return scanInBattleFind(relPath, contenu).length;
}
