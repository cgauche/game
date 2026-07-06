// Mécanique de scan du garde-fou « logique par LABEL interdite » (#142, doctrine CLAUDE.md bloc
// agents). Module ESM pur, exécutable par `node` nu — consommé par
// src/state/label-logic-guard.test.ts ET par un futur hook pre-commit.

/** Retire les commentaires de bloc et de ligne (pas les chaînes).
 * @param {string} src @returns {string} */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

/** Carte par label : constante hurlante `XXX_BY_LABEL`/`XXXBYLABEL`, ou fonction/variable `byLabel`. */
export const BY_LABEL_RX = /(BY_?LABEL|byLabel)/;

/** Comparaison D'ÉGALITÉ sur `.label`, dans un sens ou l'autre. Le membre en face de `.label` doit
 *  être un accès `mot(.mot)*` COLLÉ (pas d'appel/parenthèse/optional-chaining entre les deux) : ça
 *  exclut `find((x) => x.id === id)?.label` (extraction d'AFFICHAGE après un lookup PAR ID), qui
 *  n'est pas une comparaison mais une résolution de libellé légitime. */
export const LABEL_EQ_RX = /\.label\s*===|===\s*[\w.]+\.label\b/;

/**
 * Scan complet d'un fichier source : toute logique par label (carte `BY_LABEL`/`byLabel` ou
 * comparaison d'égalité sur `.label`), ligne par ligne, commentaires retirés.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanLabelLogic(relPath, contenu) {
  const findings = [];
  const body = stripComments(contenu);
  body.split('\n').forEach((line, i) => {
    if (BY_LABEL_RX.test(line) || LABEL_EQ_RX.test(line)) findings.push({ line: i + 1, detail: line.trim() });
  });
  return findings;
}
