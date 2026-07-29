// Mécanique de scan du garde-fou « exclusivité du seam de jet » (#274, DERNIER verrou du programme
// #276). La porte déclarative
// (`openRoll`, `src/state/rollSeam.ts`) + `TestOutcome.seal(...)` (`src/engine/testOutcome.ts`) sont
// le SEUL chemin scellé pour produire une issue de Test ; un `rollTest(`/`d100(` inline ou un
// `TestOutcome.seal(` hors whitelist forge un jet SANS passer par la policy de surfaçage (M/V/I,
// Décision 3) — exactement le trou que ce garde ferme. Module ESM pur, exécutable par `node` nu —
// mécanique ICI, whitelist EN POLICY dans le test/pre-commit (même patron que `hardcode.mjs`).
//
// Détection par AST (`typescript`, `ts.createSourceFile` — MÊME socle que `battleRngEngineLeak.mjs`/
// `registryIdBranch.mjs`, aucun second socle) : un site est un APPEL, jamais une occurrence textuelle.
// Deux conséquences mesurées (#918 lot B) : les lignes rapportées sont EXACTES (le scan lexical
// précédent supprimait commentaires bloc et imports multi-lignes sans conserver leurs retours-ligne —
// dérive mesurée jusqu'à +662 lignes sur `combatFlow.ts`), et deux FORMES de non-violation sont
// reconnues STRUCTURELLEMENT au lieu d'être portées par une entrée de whitelist :
//
//  (S) POSITION DE SPEC — le site est dans un callback (`resolve`/`reresolve`/`rollActor`/`actorTR`/
//      `foeTR`) d'un objet littéral passé en argument à `makeRollFlow(`/`opposedBinaryFlow(`/
//      `crewRoleFlowSpec(` : c'est le corps même d'une spec de flux, exécutée PAR la fabrique du seam.
//      Reconnu par remontée d'ancêtres AST, jamais par le nom de la fonction englobante.
//  (M) DÉ DE MONDE — un `d100(` (jamais `rollTest(`/`TestOutcome.seal(`, qui restent TOUJOURS des
//      violations hors (S)) dont NI l'instruction NI la FONCTION englobante ne porte de valeur de Test
//      (cf. `TEST_VALUE_STMT_RX`/`TEST_VALUE_BODY_RX`), et dont le résultat est consommé SOIT en
//      comparaison directe à un seuil (`<`/`<=`/`>`/`>=`), SOIT en lookup de table (`findTableEntry(`,
//      en argument direct ou via la liaison `const x = d100(...)` du même corps de fonction) : un
//      pourcentage d'événement, pas un Test — aucune issue à surfacer. La souillure se lit sur la
//      fonction ENTIÈRE parce que la valeur comparée transite par une variable au nom neutre
//      (`const cible = effectiveChar(c, 'ag'); if (d100(rng) <= cible)`) aussi souvent qu'en direct ;
//      lue sur la seule instruction, elle blanchit ce Test et un Test OPPOSÉ maison entier.
//
// ANGLE MORT assumé de (M) : le critère est celui de la CONSOMMATION IMMÉDIATE. Un dé dont le
// résultat transite par un appel intermédiaire (`mutationKindFor(roll)`, `petitePriereAnswered(roll,
// seuil)`) reste une violation — resserrement délibéré : la forme relâchée blanchirait aussi
// `massBattleFlow.ts` (`enemyRoll` passé à `openBattlePending`), qui est le jet de l'ADVERSAIRE d'un
// Test opposé.
//
// ANGLE MORT résiduel de la DÉTECTION (mesuré, fail-open assumé) : un import RENOMMÉ
// (`import { d100 as des } from '../engine/dice'`) échappe au scan — le motif est reconnu par le nom
// APPELÉ, sans résolution de liaison. Aucun site du dépôt n'use de cette forme au 2026-07-29.
import ts from 'typescript';

/** Les 3 motifs de forgeage/roulage bruts d'un Test — PRÉ-FILTRE lexical bon marché (un fichier sans
 *  aucun motif n'est jamais parsé). Tolère les formes que l'AST sait lire mais qu'un `\(` collé
 *  raterait : espace avant la parenthèse, appel générique `rollTest<T>(`, `TestOutcome` et `.seal`
 *  séparés par un retour-ligne. @type {RegExp} */
export const ROLL_SEAM_RX = /\brollTest\s*[(<]|\bd100\s*\(|\bTestOutcome\s*\.\s*seal\s*\(/;

/** Fabriques dont l'argument objet littéral EST une spec de flux (cf. (S)). @type {Set<string>} */
const SPEC_FACTORIES = new Set(['makeRollFlow', 'opposedBinaryFlow', 'crewRoleFlowSpec']);

/** Propriétés-callbacks d'une spec de flux (cf. (S)). @type {Set<string>} */
const SPEC_CALLBACKS = new Set(['resolve', 'reresolve', 'rollActor', 'actorTR', 'foeTR']);

/** Marqueurs d'une valeur de TEST dans l'INSTRUCTION du dé (disqualifient (M)). @type {RegExp} */
const TEST_VALUE_STMT_RX = /\btestValue\b|\beffectiveChar\b|\bskillValue\b|\bcharacteristics\b|\.sl\b/;

/** Mêmes marqueurs, évalués sur la FONCTION englobante : la valeur comparée au dé transite souvent par
 *  une variable au nom neutre (`const cible = effectiveChar(c, 'ag'); if (d100(rng) <= cible)`) — lue
 *  sur la seule instruction, la souillure blanchirait ce Test, et un Test opposé maison entier.
 *  `.sl` en est EXCLU (et lui seul) : mesuré, il souille par sa seule présence n'importe où dans une
 *  grosse fonction (`runActivityResolver`, 18 000 caractères) et fait basculer 5 dés de monde
 *  légitimes ; sur l'instruction, il reste précis. @type {RegExp} */
const TEST_VALUE_BODY_RX = /\btestValue\b|\beffectiveChar\b|\bskillValue\b|\bcharacteristics\b/;

/** Comparaisons à un seuil (cf. (M)). @type {Set<number>} */
const RELATIONAL = new Set([
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
]);

/** Nom appelé d'une CallExpression (`f(…)`, `f<T>(…)`, `o.f(…)` → `f`). @returns {string|null} */
function calleeName(call) {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}

/** Motif de roulage/scellement porté par ce nœud, sinon null. @returns {string|null} */
function siteKind(node) {
  if (!ts.isCallExpression(node)) return null;
  const e = node.expression;
  if (ts.isIdentifier(e) && (e.text === 'rollTest' || e.text === 'd100')) return e.text;
  if (ts.isPropertyAccessExpression(e) && e.name.text === 'seal'
    && ts.isIdentifier(e.expression) && e.expression.text === 'TestOutcome') return 'TestOutcome.seal';
  return null;
}

/** (S) : site dans un callback de spec d'un objet littéral passé à une fabrique de flux ? Les deux
 *  écritures légales du callback comptent : propriété (`resolve: (p) => …`) et méthode raccourcie
 *  (`resolve(p) { … }`). Un callback DÉPORTÉ (fonction libre référencée, objet construit puis passé)
 *  reste une violation — fail-closed : le scanner ne suit pas les liaisons. */
function inSpecCallback(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (!ts.isPropertyAssignment(n) && !ts.isMethodDeclaration(n)) continue;
    if (!ts.isIdentifier(n.name) || !SPEC_CALLBACKS.has(n.name.text)) continue;
    const obj = n.parent;
    if (!ts.isObjectLiteralExpression(obj)) continue;
    const call = obj.parent;
    if (ts.isCallExpression(call) && call.arguments.includes(obj) && SPEC_FACTORIES.has(calleeName(call))) return true;
  }
  return false;
}

/** Remonte les parenthèses englobantes avant d'examiner le parent. */
function unparenthesizedParent(node) {
  let n = node;
  while (n.parent && ts.isParenthesizedExpression(n.parent)) n = n.parent;
  return { self: n, parent: n.parent };
}

/** Corps de fonction englobant (à défaut, le SourceFile). */
function enclosingBody(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)) return n;
  }
  return node.getSourceFile();
}

/** L'identifiant `name` est-il passé en argument d'un `findTableEntry(` dans `scope` ? */
function feedsTableLookup(scope, name) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isCallExpression(n) && calleeName(n) === 'findTableEntry'
      && n.arguments.some((a) => ts.isIdentifier(a) && a.text === name)) { found = true; return; }
    ts.forEachChild(n, visit);
  };
  visit(scope);
  return found;
}

/** (M) : dé de MONDE — cf. en-tête. Ne s'applique qu'à `d100`. */
function isWorldDie(node, kind, sf) {
  if (kind !== 'd100') return false;
  const stmt = ts.findAncestor(node, ts.isStatement);
  if (stmt && TEST_VALUE_STMT_RX.test(stmt.getText(sf))) return false;
  if (TEST_VALUE_BODY_RX.test(enclosingBody(node).getText(sf))) return false;
  const { self, parent } = unparenthesizedParent(node);
  if (!parent) return false;
  if (ts.isBinaryExpression(parent) && RELATIONAL.has(parent.operatorToken.kind)) return true;
  if (ts.isCallExpression(parent) && calleeName(parent) === 'findTableEntry' && parent.arguments.includes(self)) return true;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) && parent.initializer === self) {
    return feedsTableLookup(enclosingBody(node), parent.name.text);
  }
  return false;
}

/**
 * Scan complet d'un fichier source : chaque APPEL de roulage/scellement brut qui n'est ni en position
 * de spec (S) ni un dé de monde (M).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanRollSeamExclusivity(relPath, contenu) {
  if (!ROLL_SEAM_RX.test(contenu)) return [];
  const sf = ts.createSourceFile(
    relPath, contenu, ts.ScriptTarget.Latest, true,
    relPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const findings = [];
  const visit = (node) => {
    const kind = siteKind(node);
    if (kind && !inSpecCallback(node) && !isWorldDie(node, kind, sf)) {
      findings.push({
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        detail: node.getText(sf).replace(/\s+/g, ' ').trim(),
      });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  findings.sort((a, b) => a.line - b.line);
  return findings;
}
