// Garde STRUCTURELLE #415 : tout timer RÉEL qui mute l'état passe par `scheduleCombatTimer`/
// `scheduleFlowTimer` (`src/state/combatTimers.ts`) — un `setTimeout`/`setInterval` NU ailleurs sous
// `src/state` est INEXPRIMABLE. Module ESM pur (node nu), patron `weatherTestModQuarantine.mjs`.

/** Retire le CONTENU des commentaires bloc `/* … *\/` puis ligne `// …`, en préservant les `\n`
 *  (les numéros de ligne restent alignés sur l'original). */
function stripComments(content) {
  const noBlock = content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlock.replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Détecte un appel `setTimeout(`/`setInterval(` dans le CODE (pas les commentaires) : NU, OU via
 *  l'objet global (`window.`/`globalThis.`/`self.`/`global.`) — ces deux formes sont de VRAIS
 *  timers non tracés. Ignore les méthodes d'un objet quelconque (`foo.setTimeout(`), les références
 *  de TYPE (`ReturnType<typeof setTimeout>`) et `clearTimeout`/`clearInterval`.
 *  @param {string} content @returns {{ line: number, call: string }[]} */
export function scanNakedTimers(content) {
  const stripped = stripComments(content);
  const rx = /(?<![.\w$])(?:(?:window|globalThis|self|global)\s*\.\s*)?(setTimeout|setInterval)\s*\(/g;
  const findings = [];
  let m;
  while ((m = rx.exec(stripped)) !== null) {
    const line = stripped.slice(0, m.index).split('\n').length;
    findings.push({ line, call: m[1] });
  }
  return findings;
}

/** Dossier scanné, POSIX relatif à la racine du repo. */
export const SCAN_DIR = 'src/state';

/** Le SEUL fichier autorisé à porter un `setTimeout` nu : c'est le wrapper. */
export const ALLOWED = ['src/state/combatTimers.ts'];
