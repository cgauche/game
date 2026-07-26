// Mécanique de scan du garde-fou « branchement par IDENTITÉ dans du code GÉNÉRIQUE » (#834).
// Doctrine utilisateur (2026-07-26, verbatim) : « "if (id=" n'est jamais une solution. Si je veux
// rajouter d'autres options, je ne veux pas voir une suite d'id. Soit la cadence n'a rien a faire
// dans policy, soit faut lui mettre un flag » — un code qui traite N entrées d'un registre de façon
// uniforme ne teste JAMAIS l'identité d'une entrée : le comportement particulier est un ATTRIBUT
// DÉCLARÉ sur l'entrée, lu comme n'importe quel champ (`def.kind`, `def.options`…).
//
// ⚠ Distincte de `labelLogic.mjs` (logique keyée par LABEL au lieu de l'id) : ici, keyer par id est
// tout aussi fautif — dans un code générique, on ne key pas, on lit un champ.
//
// Module ESM pur, consommé par src/ui/registry-id-branch-guard.test.ts. Le scan parse le fichier avec
// le compilateur TypeScript (`ts.createSourceFile`) : la NATURE de la liaison (valeur reçue/itérée vs
// tenue par le module), l'opérateur et la littéralité de l'opérande se lisent sur l'AST — aucune liste
// de noms d'offenseurs tolérés. En revanche l'EXPRESSION D'IDENTITÉ se reconnaît, elle, à une
// CONVENTION DE NOM (`ID_NAME_RX` : `id`, `xxxId`, `ref`, `xxxRef`) : un registre dont le champ
// d'identité s'appelle autrement échappe au scan. Le critère CONCURRENT « le littéral comparé est-il un
// id réel d'un registre `src/data/*.json` ? » a été MESURÉ et ÉCARTÉ : les 3 656 ids des registres
// partagent leur vocabulaire avec les valeurs de discriminant d'union (`melee`, `atout`, `objet`,
// `actif`…) — 648 sites remontés, quasi tous des `\.kind`/`\.type` légitimes. La vérité des données
// n'est pas un critère de branchement ici : c'est le NOM du champ qui dit « identité ».
// Le détail de ce que la garde ne voit pas est écrit noir sur blanc dans l'en-tête de
// `scanRegistryIdBranch`.
import ts from 'typescript';

/** Dossiers scannés. `src/ui` est le trou d'origine (les deux cas réels y vivent, et `hardcode.mjs`
 *  ne l'a jamais scanné) ; `src/engine`/`src/state` complètent le périmètre des gardes de doctrine ;
 *  `src/gameIso` et `src/data` portent les ROUTAGES D'ART et les registres chargés (le dépôt a déjà
 *  payé un routage d'art d'arme par id) ; `scripts` porte les compilateurs d'authoring, qui écrivent
 *  de la donnée de scène — un branchement par id y produit du contenu non généralisable. */
export const SCAN_DIRS = ['src/ui', 'src/engine', 'src/state', 'src/gameIso', 'src/data', 'scripts'];

/** Extensions scannées : TypeScript du jeu ET JavaScript d'outillage (`scripts/**` est en `.mjs`). */
export const SCAN_EXTS = ['.ts', '.tsx', '.mts', '.mjs', '.js'];

/**
 * Fichiers HORS périmètre, par FORME et non par nom d'offenseur :
 *  - les TESTS (`*.test.ts(x)`) : y comparer un id est la manière normale d'assérer sur une entrée
 *    précise — un test EST spécifique par nature ;
 *  - les MIGRATIONS (`*migration*`) : une migration ponctuelle de données nomme forcément les
 *    entrées de l'état ancien à convertir ; elle est datée, pas un code générique pérenne.
 * @param {string} rel chemin relatif à la racine, séparateurs `/` @returns {boolean}
 */
export function isRegistryIdBranchExcluded(rel) {
  return /\.test\.[cm]?[tj]sx?$/.test(rel) || /migration/i.test(rel);
}

/** Nom d'IDENTITÉ : `id`/`ref` exactement, ou un nom suffixé `Id`/`Ref` (`entityId`, `ruleId`,
 *  `encRef`, `propRef`) — sur-ensemble d'`ID_PARAM_RX` de `labelLogic.mjs`. La casse compte :
 *  `LOCK_NOTE_ID` (constante hurlante) n'est pas l'identité d'une entrée reçue.
 *  `ref` est ajouté parce que le dépôt key massivement par lui (`SceneEntity.ref`, `encRef`,
 *  `propRef`) ; c'est MESURÉ : 2 sites de `\.ref === '…'` sur tout le dépôt, 0 faux positif.
 *  Les noms `key`/`code`/`name` ont été MESURÉS puis ÉCARTÉS : ~50 sites, TOUS des
 *  `KeyboardEvent.key`/`.code` ou des codes errno — une garde qui hurle à tort se fait désactiver.
 *  C'est le SEUL critère de nom du scan, et donc sa principale limite : un champ d'identité baptisé
 *  autrement (`def.key`, `v.when.rule`) n'est pas reconnu. Les ALIAS, eux, sont suivis
 *  par la liaison (`const k = def.id` → kind `IDENTITY`), pas par leur nom. */
const ID_NAME_RX = /^(?:id|ref|\w*Id|\w*Ref)$/;

/** Méthodes d'APPARTENANCE à une collection — `LISTE.includes(id)`, `SET.has(id)`. */
const MEMBERSHIP_METHODS = new Set(['includes', 'has', 'indexOf', 'lastIndexOf']);

/** Méthodes de SÉLECTION d'une collection : leur callback est un PRÉDICAT de recherche, pas un
 *  traitement uniforme. Comparer l'id du paramètre à un littéral y est un LOOKUP PAR ID STABLE
 *  (`skills.find((s) => s.skillId === 'resistance')`) — la forme que la doctrine RECOMMANDE
 *  (résoudre par id, jamais par label), pas un branchement sur une entrée dans du code générique. */
const SELECTION_METHODS = new Set(['find', 'findIndex', 'findLast', 'findLastIndex', 'filter', 'some', 'every']);

/** Opérateurs d'ÉGALITÉ (stricte ou lâche) — seuls opérateurs par lesquels une identité se compare. */
export const EQUALITY_OPS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
]);

/** Littéral de chaîne NON VIDE. La chaîne vide est une SENTINELLE (« pas d'id »), jamais l'identité
 *  d'une entrée : `id === ''` ne branche sur aucune entrée du registre. */
export function isEntryLiteral(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text !== '';
  return false;
}

/** Déballe les enrobages qui ne changent pas la valeur transportée (parenthèses, `as`, `!`, `satisfies`). */
export function unwrap(node) {
  let n = node;
  for (;;) {
    if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n) || ts.isSatisfiesExpression(n)) n = n.expression;
    else break;
  }
  return n;
}

/** Identifiant RACINE d'une chaîne d'accès (`a.b.c[0].id` → `a`), ou null (racine `this`, appel…). */
function rootIdentifier(node) {
  let n = unwrap(node);
  for (;;) {
    if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) n = unwrap(n.expression);
    else break;
  }
  return ts.isIdentifier(n) ? n.text : null;
}

/** Noms liés par un motif de déclaration (identifiant nu ou destructuration, imbriquée comprise). */
export function bindingNames(name, out = []) {
  if (ts.isIdentifier(name)) out.push(name.text);
  else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const el of name.elements) if (ts.isBindingElement(el)) bindingNames(el.name, out);
  }
  return out;
}

/**
 * Nature d'une liaison, seul critère qui distingue le code GÉNÉRIQUE du code spécifique :
 *  - `GENERIC` : valeur que le code REÇOIT sans la choisir — paramètre de fonction/composant (prop
 *    destructurée comprise), paramètre d'un callback de traitement uniforme (`.map`, `.forEach`),
 *    variable d'itération `for … of`/`for … in`, ou variable dérivée d'une telle liaison ;
 *  - `IDENTITY` : variable qui TIENT l'identité d'une entrée générique (`const k = def.id`) — l'alias
 *    est suivi par sa liaison, quel que soit son nom : `k === 'x'` est le même branchement que
 *    `def.id === 'x'`, écrit en deux lignes ;
 *  - `SELECTOR` : paramètre d'un PRÉDICAT de sélection (`SELECTION_METHODS`) — le code y CHERCHE une
 *    entrée, il ne la traite pas uniformément ;
 *  - `VALUE` : liaison de module (const/import/fonction/classe) ou locale sans provenance générique —
 *    ce code-là tient légitimement UNE entrée en main.
 */
const GENERIC = 'generic';
const IDENTITY = 'identity';
const SELECTOR = 'selector';
const VALUE = 'value';

export class Scopes {
  constructor() { this.stack = [new Map()]; }
  push() { this.stack.push(new Map()); }
  pop() { this.stack.pop(); }
  declare(name, kind) { this.stack[this.stack.length - 1].set(name, kind); }
  kindOf(name) {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const k = this.stack[i].get(name);
      if (k) return k;
    }
    return undefined;
  }
}

/** Le nœud fonction est-il le PRÉDICAT d'une méthode de sélection (`xs.find((e) => …)`) ? */
function isSelectionPredicate(fn) {
  const call = fn.parent;
  if (!call || !ts.isCallExpression(call) || call.arguments[0] !== fn) return false;
  const callee = unwrap(call.expression);
  return ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name) && SELECTION_METHODS.has(callee.name.text);
}

/**
 * Expression d'IDENTITÉ d'une entrée reçue : accès `<liaison>.id`/`<liaison>.xxxId`, identifiant
 * `id`/`xxxId` lui-même lié, ou ALIAS d'une telle expression (`const k = def.id` → `k`, kind
 * `IDENTITY`, quel que soit son nom). `allowSelector` distingue les règles : un BRANCHEMENT (égalité,
 * switch) n'est fautif que sur une liaison générique, tandis qu'une LISTE FERMÉE d'ids (appartenance,
 * table littérale) est fautive où qu'elle soit — c'est la liste, pas la position, qui fige le registre.
 * @returns {boolean}
 */
function isEntryIdentity(node, scopes, allowSelector = false) {
  const ok = (name) => {
    const k = scopes.kindOf(name);
    return k === GENERIC || (allowSelector && k === SELECTOR);
  };
  const n = unwrap(node);
  if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.name) && ID_NAME_RX.test(n.name.text)) {
    const root = rootIdentifier(n.expression);
    return !!root && ok(root);
  }
  if (ts.isIdentifier(n) && scopes.kindOf(n.text) === IDENTITY) return true;
  if (ts.isIdentifier(n) && ID_NAME_RX.test(n.text)) return ok(n.text);
  return false;
}

/** Collection FERMÉE de chaînes écrite à la main : `['a','b']`, `new Set(['a','b'])`, ou un
 *  identifiant déclaré avec l'une de ces formes dans le fichier. Une collection CALCULÉE (index
 *  construit, `Object.keys(REGISTRE)`) n'en est pas une : elle SUIT le registre, elle ne le fige pas. */
function isLiteralStringCollection(node, literalCollections) {
  const n = unwrap(node);
  if (ts.isArrayLiteralExpression(n)) return n.elements.length > 0 && n.elements.every((e) => isEntryLiteral(unwrap(e)));
  if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'Set') {
    const arg = n.arguments?.[0];
    return !!arg && isLiteralStringCollection(arg, literalCollections);
  }
  if (ts.isIdentifier(n)) return literalCollections.has(n.text);
  return false;
}

/** Table FERMÉE écrite à la main : littéral d'objet à clés non calculées, ou identifiant qui en tient
 *  un — indexée par l'identité d'une entrée, elle impose d'ajouter une clé à chaque entrée nouvelle. */
function isLiteralRecord(node, literalRecords) {
  const n = unwrap(node);
  if (ts.isObjectLiteralExpression(n)) {
    return n.properties.length > 0 && n.properties.every((p) => (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && !!p.name && !ts.isComputedPropertyName(p.name));
  }
  if (ts.isIdentifier(n)) return literalRecords.has(n.text);
  return false;
}

/**
 * Table EXHAUSTIVE par TYPE : `const T: Record<StepId, X> = {…}` — la clé est une union fermée, le
 * compilateur EXIGE une entrée par membre. Ajouter une option force la table dans le même geste, à
 * la compilation : ce n'est pas la « suite d'id » silencieuse que la doctrine proscrit. Une table
 * `Record<string, X>` (clé OUVERTE) ne porte, elle, aucune garantie — elle dérive en silence.
 * Les enveloppes `Partial<…>`/`Readonly<…>` sont traversées : elles relâchent l'obligation de clé,
 * pas la FERMETURE de l'union — un SQUELETTE `Partial<Record<BoneId, Bone>>` reste indexé par un
 * vocabulaire fermé déclaré en type, pas par l'identité d'une entrée de registre.
 */
function isExhaustiveRecordDecl(decl) {
  let t = decl.type;
  while (t && ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName)
    && (t.typeName.text === 'Partial' || t.typeName.text === 'Readonly') && t.typeArguments?.length === 1) t = t.typeArguments[0];
  if (!t || !ts.isTypeReferenceNode(t) || !ts.isIdentifier(t.typeName) || t.typeName.text !== 'Record') return false;
  const key = t.typeArguments?.[0];
  if (!key) return false;
  return key.kind !== ts.SyntaxKind.StringKeyword && key.kind !== ts.SyntaxKind.NumberKeyword && key.kind !== ts.SyntaxKind.AnyKeyword;
}

/** Pré-passe : noms déclarés dans le fichier qui tiennent une collection/table FERMÉE de littéraux.
 *  La pré-passe est à plat (tout le fichier) alors que l'usage, lui, est porté : un même nom peut
 *  désigner une table littérale dans une fonction et une valeur CALCULÉE dans une autre
 *  (`const sk = {…}` d'un côté, `const sk = buildSkeleton(p)` de l'autre). Un nom AMBIGU est donc
 *  retiré des deux jeux : la garde ne peut pas prouver que le site indexé fige quoi que ce soit. */
function collectLiteralHolders(sf) {
  const collections = new Set();
  const records = new Set();
  const computed = new Set(); // noms déclarés au moins une fois avec une valeur NON littérale
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const name = node.name.text;
      if (isLiteralStringCollection(node.initializer, collections)) collections.add(name);
      else if (isLiteralRecord(node.initializer, records) && !isExhaustiveRecordDecl(node)) records.add(name);
      else computed.add(name);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  for (const name of computed) { collections.delete(name); records.delete(name); }
  return { collections, records };
}

/**
 * Scan STRUCTUREL d'un fichier source. Quatre formes :
 *  - `id-equality`   : `def.id === 'fortune-mid-session'`, `id !== 'combat-cadence'` — sur une
 *                      liaison GÉNÉRIQUE (entrée reçue, itérée, ou prop de composant) ;
 *  - `id-switch`     : `switch (entry.id) { case 'a': … }`, même condition de liaison ;
 *  - `id-membership` : `['a','b'].includes(r.id)`, `SET_EN_DUR.has(x.id)` ;
 *  - `id-record`     : `TABLE_LITTÉRALE[def.id]` — table fermée indexée par l'identité d'une entrée.
 *
 * FRONTIÈRE (raisonnée, pas une liste d'exceptions) — ne lèvent PAS :
 *  - un `.id` comparé à une VARIABLE (`r.id === selectedId`) : sélection, pas branchement en dur ;
 *  - la lecture d'un CHAMP DÉCLARÉ (`def.kind === 'flag'`) : c'est la forme SAINE recherchée ;
 *  - un PRÉDICAT DE SÉLECTION (`skills.find((s) => s.skillId === 'resistance')`) : lookup par id
 *    stable, forme recommandée par la doctrine — la réaction PAR-NOM d'entité relève, elle, de la
 *    garde `hardcode.mjs` (`hasTalent`/`hasTraitKey`/`hasCondition` à argument littéral) ;
 *  - une entrée tenue par une constante de MODULE (`FORTUNE.id === x`) : code non générique ;
 *  - `id === ''` (sentinelle de vide) ;
 *  - les TESTS et les MIGRATIONS (`isRegistryIdBranchExcluded`).
 *
 * CE QUE LA GARDE NE VOIT PAS (évasions MESURÉES, chacune à une ligne d'écriture ; faux NÉGATIFS
 * assumés plutôt que bruit — une garde qui hurle partout se fait désactiver) :
 *  - un champ d'identité hors convention de nom : `def.key === 'x'`, `v.when.rule === 'x'` — seuls
 *    `id`/`xxxId`/`ref`/`xxxRef` sont reconnus (`ID_NAME_RX`) ;
 *  - un renommage à la destructuration : `function Row({ id: ruleKey })` — la liaison porte le
 *    nouveau nom, la convention est perdue ;
 *  - un test qui n'est pas une ÉGALITÉ : `def.id.startsWith('combat-')`, `.match(/…/)` ;
 *  - une entrée reçue par un flux qu'aucune liaison locale ne trahit : l'analyse est LEXICALE
 *    (portées et liaisons du seul fichier), sans vérificateur de types ;
 *  - un nom déclaré DEUX fois dans le fichier, une fois littéral et une fois calculé : le nom devient
 *    ambigu et sort des jeux de la pré-passe (cf. `collectLiteralHolders`) — la table littérale
 *    de MÊME NOM n'est plus vue. Faux négatif préféré à l'accusation à tort.
 * Est en revanche SUIVI l'ALIAS d'identité (`const k = def.id; k === 'x'`, `switch (k)`), évasion la
 * plus probable en pratique : la liaison hérite le kind `IDENTITY`, indépendamment de son nom.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string, rule: 'id-equality'|'id-switch'|'id-membership'|'id-record' }[]}
 */
export function scanRegistryIdBranch(relPath, contenu) {
  const kind = relPath.endsWith('.tsx') ? ts.ScriptKind.TSX
    : /\.[cm]?js$/.test(relPath) ? ts.ScriptKind.JS // outillage `scripts/**` (.mjs) : même AST, sans annotations
      : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(relPath, contenu, ts.ScriptTarget.Latest, true, kind);
  const { collections, records } = collectLiteralHolders(sf);
  const lines = contenu.split('\n');
  const findings = [];
  const scopes = new Scopes();
  const seen = new Set();

  const report = (node, rule) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    const key = `${line}:${rule}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ line, detail: (lines[line - 1] || '').trim(), rule });
  };

  /** Déclare les liaisons d'une liste de variables : `IDENTITY` si l'initialiseur EST l'identité d'une
   *  entrée générique (`const k = def.id`), GÉNÉRIQUE s'il dérive d'une valeur déjà générique
   *  (`const cur = entries[i]`, `const { id } = def`), VALEUR sinon. */
  const declareVarList = (list, forcedKind) => {
    for (const d of list.declarations) {
      let kind = forcedKind ?? VALUE;
      if (!forcedKind && d.initializer) {
        const root = rootIdentifier(d.initializer);
        if (root && scopes.kindOf(root) === GENERIC) kind = GENERIC;
        if (isEntryIdentity(d.initializer, scopes)) kind = IDENTITY;
      }
      for (const n of bindingNames(d.name)) scopes.declare(n, kind);
    }
  };

  const visit = (node) => {
    if (ts.isFunctionLike(node)) {
      const paramKind = isSelectionPredicate(node) ? SELECTOR : GENERIC;
      scopes.push();
      for (const p of node.parameters) for (const n of bindingNames(p.name)) scopes.declare(n, paramKind);
      ts.forEachChild(node, visit);
      scopes.pop();
      return;
    }
    if (ts.isBlock(node) || ts.isCaseBlock(node) || ts.isModuleBlock(node)) {
      scopes.push();
      ts.forEachChild(node, visit);
      scopes.pop();
      return;
    }
    if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
      scopes.push();
      if (ts.isVariableDeclarationList(node.initializer)) declareVarList(node.initializer, GENERIC);
      ts.forEachChild(node, visit);
      scopes.pop();
      return;
    }
    if (ts.isVariableDeclarationList(node)) declareVarList(node);
    if (ts.isFunctionDeclaration(node) && node.name) scopes.declare(node.name.text, VALUE);
    if (ts.isClassDeclaration(node) && node.name) scopes.declare(node.name.text, VALUE);
    if (ts.isImportSpecifier(node) && ts.isIdentifier(node.name)) scopes.declare(node.name.text, VALUE);
    if (ts.isImportClause(node) && node.name && ts.isIdentifier(node.name)) scopes.declare(node.name.text, VALUE);

    if (ts.isBinaryExpression(node) && EQUALITY_OPS.has(node.operatorToken.kind)) {
      const l = unwrap(node.left);
      const r = unwrap(node.right);
      if ((isEntryIdentity(l, scopes) && isEntryLiteral(r)) || (isEntryIdentity(r, scopes) && isEntryLiteral(l))) report(node, 'id-equality');
    }
    if (ts.isSwitchStatement(node) && isEntryIdentity(node.expression, scopes)
      && node.caseBlock.clauses.some((c) => ts.isCaseClause(c) && isEntryLiteral(unwrap(c.expression)))) {
      report(node, 'id-switch');
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.name)
      && MEMBERSHIP_METHODS.has(node.expression.name.text) && node.arguments.length > 0
      && isEntryIdentity(node.arguments[0], scopes, true) && isLiteralStringCollection(node.expression.expression, collections)) {
      report(node, 'id-membership');
    }
    if (ts.isElementAccessExpression(node) && isEntryIdentity(node.argumentExpression, scopes, true)
      && isLiteralRecord(node.expression, records)) {
      report(node, 'id-record');
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sf, visit);
  findings.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
  return findings;
}

/** Compte de branchements par identité dans un fichier. @param {string} rel @param {string} contenu @returns {number} */
export function countRegistryIdBranch(rel, contenu) {
  return scanRegistryIdBranch(rel, contenu).length;
}
