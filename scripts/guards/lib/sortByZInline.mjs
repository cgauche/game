// Mécanique de scan du garde-fou « tri z inline hors composeur canonique » (#302, verrous 2ᵉ vague).
// `sortByZ` (src/gameIso/rig/composite.ts) est la SOURCE UNIQUE du tri peintre intra-corps pour tout
// `compose*` NON-bipède (docstring : « à réutiliser en fin de tout compose* non-bipède au lieu de
// recopier `.sort((a,b) => a.z - b.z)` »). `composeRig.tsx` (le composeur BIPÈDE) et `composite.ts`
// lui-même (le foyer) restent WHITELISTÉS explicitement : ce sont les 2 sites légitimes déjà connus,
// pas des dérives. Module ESM pur, exécutable par `node` nu — même patron que `journalWrite.mjs`.

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
export const SORT_BY_Z_INLINE_RX = /\.sort\(\([^)]*\)\s*=>\s*[^)]*\.z\s*-\s*[^)]*\.z\)/;

/** Fichiers WHITELISTÉS (le foyer + le seul autre composeur légitime, cf. entête). Chemin RELATIF
 *  à la racine, séparateurs `/`.
 * @type {string[]} */
export const SORT_BY_Z_WHITELIST = [
  'src/gameIso/rig/composite.ts',
  'src/gameIso/rig/composeRig.tsx',
];

/**
 * Scan complet d'un fichier source : chaque ligne portant le motif (hors commentaires/imports),
 * SAUF si `relPath` est whitelisté.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanSortByZInline(relPath, contenu) {
  if (SORT_BY_Z_WHITELIST.includes(relPath)) return [];
  const findings = [];
  stripComments(contenu)
    .split('\n')
    .forEach((line, i) => {
      if (SORT_BY_Z_INLINE_RX.test(line)) findings.push({ line: i + 1, detail: line.trim() });
    });
  return findings;
}

/** Compte de sites par fichier (raccourci de `scanSortByZInline(...).length`).
 * @param {string} relPath @param {string} contenu @returns {number} */
export function countSortByZInline(relPath, contenu) {
  return scanSortByZInline(relPath, contenu).length;
}
