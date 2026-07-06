// Mécanique de scan du garde-fou « tout migrer » — réactions de combat hardcodées PAR-NOM
// (État/trait/talent/atout d'arme) plutôt que par DONNÉE (TriggeredEffect/passive). Module ESM
// pur, exécutable par `node` nu — consommé par src/state/combat-hardcode-guard.test.ts ET par un
// futur hook pre-commit. Les BASELINES (nombre de sites tolérés par fichier, gelées au recensement)
// restent DONNÉES DE POLICY dans le test — ici ne vit QUE la mécanique de détection, généralisée à
// TOUT src/engine + src/state (cf. docs/combat-events-coherence.md, Lot 8).

/** Retire commentaires ET imports nommés (les ids/noms en commentaire ou en `import {…}` — y
 *  compris multi-lignes — ne sont PAS du code réactif : seuls les SITES d'appel comptent).
 * @param {string} src @returns {string} */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+['"][^'"]*['"];?/g, '') // imports nommés (multi-lignes)
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

/**
 * Marqueurs réactifs par-nom (code) — motifs TRAIT/TALENT recensés aux Lots 4bis/6 sur
 * state/combat/roundHooks.ts et state/combatFlow.ts, généralisés à tout src/engine + src/state
 * (Lot 8) : une réaction de combat codée PAR-NOM (trait/talent) plutôt que par donnée.
 *
 * NB : le motif `hasCondition(c/target, COND.*)`/`stacks(c, COND.*)` du Lot 4 (engine/conditions.ts)
 * n'est PAS repris ici tel quel : son exclude d'origine (gating de mort/machinerie universelle) est
 * calibré aux formes précises de ce seul fichier — l'étendre tel quel au reste de l'arbre
 * re-flaguerait des gates légitimes ailleurs (ex. combatFlow.ts vérifiant
 * `hasCondition(target, COND.inconscient)` avant `applyZeroWounds`, une garde anti-double-application,
 * pas une réaction par-nom). conditions.ts reste à 0 sous CE regex généralisé (son motif Lot 4 est
 * un sous-ensemble déjà résorbé) — réintroduire le contrôle par État généralisé demanderait de
 * d'abord généraliser SES exclusions machinerie, pas juste dupliquer son regex.
 * @type {RegExp}
 */
export const REACTIVE_RX = /isBestial|id: '(bestial-fire-fear|determination)|hasTraitKey\(|isUnstable|hasPerturbingAura/;

/**
 * Lignes à EXCLURE : déclarations d'import (jamais un site d'appel réactif).
 * @type {RegExp}
 */
export const EXCLUDE_RX = /^\s*import/;

/**
 * Scan complet d'un fichier source : chaque ligne portant un marqueur réactif par-nom (hors
 * lignes exclues), commentaires/imports retirés.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanHardcode(relPath, contenu) {
  const findings = [];
  stripComments(contenu)
    .split('\n')
    .forEach((line, i) => {
      if (REACTIVE_RX.test(line) && !EXCLUDE_RX.test(line)) findings.push({ line: i + 1, detail: line.trim() });
    });
  return findings;
}

/** Compte de sites réactifs par-nom dans un fichier (raccourci de `scanHardcode(...).length`).
 * @param {string} relPath @param {string} contenu @returns {number} */
export function countHardcode(relPath, contenu) {
  return scanHardcode(relPath, contenu).length;
}
