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
 * Marqueurs réactifs par-nom, famille TRAIT/TALENT — recensés aux Lots 4bis/6 sur
 * state/combat/roundHooks.ts et state/combatFlow.ts, généralisés à tout src/engine + src/state
 * (Lot 8) : une réaction de combat codée PAR-NOM (trait/talent) plutôt que par donnée.
 * @type {RegExp}
 */
export const TRAIT_TALENT_RX = /isBestial|id: '(bestial-fire-fear|determination)|hasTraitKey\(|isUnstable|hasPerturbingAura/;

/**
 * Marqueurs réactifs par-nom, famille PAR-ÉTAT — motif du Lot 4 (`hasCondition(_, COND.*)` /
 * `stacks(_, COND.*)`), généralisé À TOUT l'arbre (Lot 8, issue #160). Var libre (`\w+`) : plus
 * seulement `c`/`target`. Toute lecture d'un État en INTERROGATION nominative est candidate ;
 * les GATES/mesures de machinerie universelle en sont retranchés par `MACHINERY_RX` (ci-dessous),
 * PAS par une entrée nominative d'entité (COND.hemorragique/aTerre/surpris…).
 * @type {RegExp}
 */
export const PER_ETAT_RX = /hasCondition\(\w+, ?COND\.|stacks\(\w+, ?COND\./;

/**
 * Lignes à EXCLURE inconditionnellement : déclarations d'import (jamais un site d'appel réactif).
 * @type {RegExp}
 */
export const EXCLUDE_RX = /^\s*import/;

/**
 * EXCLUSIONS de MACHINERIE (généralisation de l'exclude Lot 4 d'engine/conditions.ts, issue #160) —
 * appliquées AUX SEULES lectures PAR-ÉTAT. Chaque terme est une RÈGLE d'arène universelle ou une
 * INSTRUMENTATION, JAMAIS un nom d'État/trait/talent éditable : une lecture d'État qui matche décrit
 * un GATE (mort, action/mouvement, géométrie, contrôle) ou une MESURE/journalisation, pas la
 * réaction propre d'une entité (celle-ci est en donnée — etats.json). Familles :
 *  - mort & cycle de vie (LDB 18) : isOutOfAction/inDeathCondition/applyZeroWounds/aaDeathByCriticalCount/
 *    usesSuddenDeath/criticalWounds/roundsAtZero/outOfRencontre/.dead + le gate 0 PB `wounds.current <= 0`
 *    (BORNÉ à `<= 0` — surtout PAS `wounds.current` nu : un `wounds.current -= …` par-nom DOIT rester signalé) ;
 *  - gating d'Action/Mouvement/Engagement : canTakeAction/isEngaged/controlsCombatant/movementUsed ;
 *  - géométrie (allonge / balayage des surdimensionnés) : sizeGap / `return reach` ;
 *  - coutures de contrôle/capacité : hasActiveCapability / pilotedByHuman ;
 *  - transition d'État par la machinerie : removeCondition ;
 *  - instrumentation : capture d'un compte d'États dans un local (`const/let X = stacks(`) pour un delta ;
 *  - journal seul : la lecture ne nourrit qu'une ligne de log (log.push( / .log( / `return tr(`) ;
 *  - SÉLECTEURS d'ouverture de combat / doctrine IA (l'État Surpris lu comme SIGNAL d'initiative) :
 *    `return 'ambush'|'assault'|'combat'|'embuscade'`.
 * Toute NOUVELLE lecture par-État qui n'est aucune de ces machineries = réaction par-nom → signalée.
 * @type {RegExp}
 */
export const MACHINERY_RX = new RegExp([
  'isOutOfAction', 'inDeathCondition', 'applyZeroWounds', 'aaDeathByCriticalCount', 'usesSuddenDeath',
  'criticalWounds', 'roundsAtZero', 'outOfRencontre', '\\.dead\\b', 'wounds\\.current\\s*<=\\s*0',
  'canTakeAction', 'isEngaged', 'controlsCombatant', 'movementUsed',
  'sizeGap', '\\breturn reach\\b', 'hasActiveCapability', 'pilotedByHuman', 'removeCondition',
  '\\b(?:const|let)\\s+\\w+\\s*=\\s*stacks\\([^)]*\\);?\\s*$', 'log\\.push\\(', '\\.log\\(', '\\breturn tr\\(',
  "return '(?:ambush|assault|combat|embuscade)'",
].join('|'));

/**
 * Scan complet d'un fichier source : chaque ligne portant un marqueur réactif par-nom (hors
 * lignes exclues), commentaires/imports retirés. Une lecture PAR-ÉTAT (et par-État SEULE) qui est
 * de la machinerie/instrumentation universelle (`MACHINERY_RX`) est un GATE, pas une réaction —
 * retranchée. La famille TRAIT/TALENT n'est JAMAIS retranchée par la machinerie (baselines inchangées).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanHardcode(relPath, contenu) {
  const findings = [];
  stripComments(contenu)
    .split('\n')
    .forEach((line, i) => {
      if (EXCLUDE_RX.test(line)) return;
      const trait = TRAIT_TALENT_RX.test(line);
      const etat = PER_ETAT_RX.test(line);
      if (!trait && !etat) return;
      if (etat && !trait && MACHINERY_RX.test(line)) return; // gate/mesure d'arène — pas une réaction par-nom
      findings.push({ line: i + 1, detail: line.trim() });
    });
  return findings;
}

/** Compte de sites réactifs par-nom dans un fichier (raccourci de `scanHardcode(...).length`).
 * @param {string} relPath @param {string} contenu @returns {number} */
export function countHardcode(relPath, contenu) {
  return scanHardcode(relPath, contenu).length;
}
