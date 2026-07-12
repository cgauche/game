// QUARANTAINE d'import « rng vivant → résolveur moteur » (#370, ronde 2 du seam de jet). Le garde
// d'exclusivité (`rollSeamExclusivity.mjs`, #274) exempte TOUT `src/engine/**` au motif que « le
// moteur pur REÇOIT un rng sans jamais décider du surfaçage — c'est l'APPELANT (state/) qui choisit
// modale/MJ/inline ». Ce motif suppose que l'appelant, lui, PASSE PAR le seam (`openRoll`) — mais un
// flux state/** peut contourner l'hypothèse en appelant DIRECTEMENT un résolveur moteur importé
// (`../engine/...`) avec un rng VIVANT (`battleRng()`) au call-site : le résolveur roule ET décide de
// l'issue (Test opposé/étendu), sans jamais passer par la policy M/V/I. C'est EXACTEMENT le trou
// exploité par `tavernFlow.playTavernGame` → `resolveTavernGame(..., battleRng())` avant #370 — la
// classe, pas le cas : tout AUTRE flux state/** qui ferait la même chose doit être rouge ICI.
//
// Détection : repère les IMPORTS nommés depuis un module `engine/` (fonctions de résolution
// potentiellement « roule + décide »), puis les SITES D'APPEL de ces noms — au niveau du FICHIER
// entier (pas de la ligne) : si le même fichier appelle AUSSI `battleRng` quelque part (même via un
// rng hoisté dans une variable avant d'être repassé au résolveur), c'est la COEXISTENCE des deux qui
// est la violation, peu importe la ligne. Un fichier state/** NON listé dans la whitelist
// (`battleRngEngineLeakWhitelist.mjs`) qui matche est un flux qui a contourné le seam. Module ESM pur
// (node nu), même patron que `weatherTestModQuarantine.mjs`/`batchNavalQuarantine.mjs`.

/** Retire commentaires (mais PAS les imports : on les parse avant). @param {string} src @returns {string} */
function stripCommentsOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

/** Échappe un nom pour usage en RegExp littérale. @param {string} s @returns {string} */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Collecte les noms importés depuis un module dont le chemin contient `engine/`, RESTREINTS au
 * PATRON `resolveXxx` (convention du dépôt pour un résolveur de CONFRONTATION complète — Test opposé/
 * étendu, gagnant/DR : `resolveTavernGame`, `resolveMelee`, `resolveCasting`… — jamais une primitive
 * `rollXxx`/`testValue`/`effectiveChar` qui ne fait QUE lire une valeur). Restreindre au patron
 * `resolve*` est ce qui rend le scan PRÉCIS (zéro faux positif sur les lectures de valeur qui
 * partagent juste la ligne d'un `battleRng()` voisin).
 * @param {string} contenu @returns {string[]}
 */
export function collectEngineImportNames(contenu) {
  const names = [];
  const rx = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = rx.exec(contenu)) !== null) {
    if (!/engine\//.test(m[2])) continue;
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '').trim();
      if (name && /^resolve[A-Z]/.test(name)) names.push(name);
    }
  }
  return names;
}

/**
 * Scan complet d'un fichier, à l'échelle du FICHIER (pas de la ligne) : si le fichier appelle AU
 * MOINS UNE FOIS `battleRng` (n'importe où — y compris hoisté dans une variable réutilisée plus
 * loin) ET appelle AU MOINS UNE FOIS un nom importé d'`engine/` au patron `resolveXxx`, chaque site
 * d'appel `resolveXxx(` est une violation — la coexistence des deux capacités dans le même fichier
 * est le signal, pas leur ligne commune (le hoisting `const rng = battleRng(); resolveX(rng)`
 * contourne sinon la détection).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, name: string, detail: string }[]}
 */
export function scanBattleRngEngineLeak(relPath, contenu) {
  const engineNames = collectEngineImportNames(contenu);
  if (engineNames.length === 0) return [];
  const stripped = stripCommentsOnly(contenu);
  if (!/\bbattleRng\s*\(/.test(stripped)) return [];
  const findings = [];
  const lines = stripped.split('\n');
  for (const name of engineNames) {
    const callRx = new RegExp(`\\b${escapeRegex(name)}\\s*\\(`);
    lines.forEach((line, i) => {
      if (/^\s*import/.test(line)) return;
      if (callRx.test(line)) {
        findings.push({ line: i + 1, name, detail: line.trim() });
      }
    });
  }
  return findings;
}
