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

// ===========================================================================================
// REGISTRE DES CHEMINS DE JET (#1066) — deux familles de plus, MÊME socle AST, MÊME patron
// stock/compte-par-fichier. Le garde ci-dessus ne mord que le roulage BRUT (`rollTest(`/`d100(`/
// `TestOutcome.seal(`) ; deux populations lui échappent par construction :
//   (F) la FABRICATION d'un pending de jet — l'objet qui décrit le jet à venir est monté à la main
//       au call-site au lieu d'être décrit à la porte (`openRoll`) ; le roulage, lui, arrive plus
//       tard et passe par le seam, donc rien ne le signale.
//   (D) le roulage DÉLÉGUÉ AU MOTEUR — `rollSeamExcluded` exempte `src/engine/**` de principe (le
//       moteur reçoit un rng, il ne décide pas du surfaçage) ; un export d'engine dont le corps
//       roule, appelé depuis un flux, rend le CALL-SITE invisible aux deux gardes
//       (`engine/massBattle.ts:124 rollMightTest` → `rollTest`, atteint par
//       `resolveClash` → `massBattleFlow.ts:845`).
// Les listes (stocks + justifications) restent EN POLICY dans `rollSeamWhitelist.mjs`.
// ===========================================================================================

/** Pré-filtre lexical de (F). @type {RegExp} */
export const PENDING_JET_RX = /\bskillValue\s*:/;

/** Le littéral porte-t-il `roll: null` (pending PAS ENCORE roulé) ? */
function hasRollNull(obj) {
  return obj.properties.some((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)
    && p.name.text === 'roll' && p.initializer.kind === ts.SyntaxKind.NullKeyword);
}

/**
 * (F) FABRICATION D'UN PENDING DE JET — un littéral d'objet qui porte `skillValue:` ET (`target:` OU
 * `roll: null`). Signature DISCRIMINANTE mesurée : `skillValue:` seul remonte 200+ faux positifs
 * (paramètres de résolveur, types, patches de champ) ; la conjonction ne retient que les objets qui
 * portent DÉJÀ la cible du jet (`target`, donc la Difficulté appliquée) ou son emplacement de dé
 * vide (`roll: null`) — c'est-à-dire un jet DÉCRIT hors de la porte.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanPendingJetFabrication(relPath, contenu) {
  if (!PENDING_JET_RX.test(contenu)) return [];
  const sf = ts.createSourceFile(
    relPath, contenu, ts.ScriptTarget.Latest, true,
    relPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const findings = [];
  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const names = new Set(node.properties.filter((p) => p.name && ts.isIdentifier(p.name)).map((p) => p.name.text));
      if (names.has('skillValue') && (names.has('target') || hasRollNull(node))) {
        findings.push({
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          detail: [...names].join(','),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  findings.sort((a, b) => a.line - b.line);
  return findings;
}

/** Fonction (déclaration ou `const f = (…) => …`) portée par ce nœud, sinon null.
 *  @returns {{ name: string, body: import('typescript').Node, exported: boolean }|null} */
function functionOf(node) {
  if (ts.isFunctionDeclaration(node) && node.name && node.body) {
    return { name: node.name.text, body: node.body, exported: !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) };
  }
  if (ts.isVariableStatement(node)) {
    const d = node.declarationList.declarations[0];
    if (d && ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
      return { name: d.name.text, body: d.initializer.body, exported: !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) };
    }
  }
  return null;
}

/**
 * (D) partie 1 — DÉRIVE la liste des exports de `src/engine` qui roulent : corps appelant `rollTest(`/
 * `d100(` DIRECTEMENT, puis clôture TRANSITIVE (un export qui appelle un rouleur roule aussi). La
 * transitivité n'est pas un luxe : `resolveClash` ne roule qu'à travers `rollMightTest` — s'arrêter
 * au direct rate exactement le site fondateur du ticket. `rollTest`/`d100` eux-mêmes sont RETIRÉS de
 * la liste : leurs call-sites de `src/state` sont déjà la population du garde d'exclusivité.
 * @param {{ rel: string, text: string }[]} engineFiles
 * @returns {Map<string, { file: string, line: number }>} nom exporté → site de déclaration
 */
export function engineRollerExports(engineFiles) {
  /** @type {Map<string, { file: string, line: number, calls: Set<string>, exported: boolean }>} */
  const decls = new Map();
  for (const { rel, text } of engineFiles) {
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      const fn = functionOf(node);
      if (fn) {
        const calls = new Set();
        const cv = (x) => { if (ts.isCallExpression(x) && ts.isIdentifier(x.expression)) calls.add(x.expression.text); ts.forEachChild(x, cv); };
        cv(fn.body);
        decls.set(fn.name, { file: rel, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, calls, exported: fn.exported });
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
  }
  const rollers = new Set();
  for (let changed = true; changed;) {
    changed = false;
    for (const [name, d] of decls) {
      if (rollers.has(name)) continue;
      if (d.calls.has('rollTest') || d.calls.has('d100') || [...d.calls].some((c) => rollers.has(c))) { rollers.add(name); changed = true; }
    }
  }
  rollers.delete('rollTest');
  rollers.delete('d100');
  const out = new Map();
  for (const name of [...rollers].sort()) {
    const d = decls.get(name);
    if (d.exported) out.set(name, { file: d.file, line: d.line });
  }
  return out;
}

/**
 * (D) angle mort SURVEILLÉ — noms de fonctions déclarés dans PLUSIEURS fichiers de `src/engine`.
 * `engineRollerExports` indexe à plat (un nom = une entrée) : la DERNIÈRE déclaration lue écrase les
 * précédentes. Conséquence mesurée (mutation #1066) : un homonyme non-rouleur peut faire SORTIR un
 * vrai rouleur de la liste — et avec lui toute sa clôture transitive. Le drapeau `rollsDirectly` est
 * donc lu sur CHAQUE déclaration, pas sur l'index collapsé : sinon la surveillance est aveugle au cas
 * même qu'elle prétend couvrir.
 * @param {{ rel: string, text: string }[]} engineFiles
 * @returns {Map<string, { files: string[], rollsDirectly: boolean }>} nom déclaré 2+ fois → sites
 */
export function engineHomonyms(engineFiles) {
  /** @type {Map<string, { files: Set<string>, rollsDirectly: boolean }>} */
  const byName = new Map();
  for (const { rel, text } of engineFiles) {
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      const fn = functionOf(node);
      if (fn) {
        let rolls = false;
        const cv = (x) => {
          if (ts.isCallExpression(x) && ts.isIdentifier(x.expression)
            && (x.expression.text === 'rollTest' || x.expression.text === 'd100')) rolls = true;
          ts.forEachChild(x, cv);
        };
        cv(fn.body);
        if (!byName.has(fn.name)) byName.set(fn.name, { files: new Set(), rollsDirectly: false });
        const e = byName.get(fn.name);
        e.files.add(rel);
        e.rollsDirectly ||= rolls;
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
  }
  const out = new Map();
  for (const [name, e] of byName) {
    if (e.files.size > 1) out.set(name, { files: [...e.files].sort(), rollsDirectly: e.rollsDirectly });
  }
  return out;
}

/**
 * (D) partie 2 — CALL-SITES d'un rouleur d'engine dans un fichier consommateur. La forme (S)
 * « position de spec » garde son exclusion STRUCTURELLE (le callback `resolve` d'une spec de flux est
 * exécuté PAR la fabrique du seam, que le dé soit brut ou délégué). La forme (M) « dé de monde » ne
 * s'applique pas : elle se lit sur la CONSOMMATION immédiate d'un `d100(`, qu'un helper nommé masque.
 * @param {string} relPath @param {string} contenu @param {Iterable<string>} rollerNames
 * @returns {{ line: number, name: string }[]}
 */
export function scanEngineDelegatedRoll(relPath, contenu, rollerNames) {
  const names = rollerNames instanceof Set ? rollerNames : new Set(rollerNames);
  const sf = ts.createSourceFile(
    relPath, contenu, ts.ScriptTarget.Latest, true,
    relPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const findings = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text) && !inSpecCallback(node)) {
      findings.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, name: node.expression.text });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  findings.sort((a, b) => a.line - b.line);
  return findings;
}
