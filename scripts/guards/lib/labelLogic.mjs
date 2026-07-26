// Mécanique de scan du garde-fou « logique par LABEL interdite » (#142, doctrine CLAUDE.md bloc
// agents). Module ESM pur (opère sur du texte source), consommé par
// src/state/label-logic-guard.test.ts ET par le hook pre-commit (scripts/git-hooks/pre-commit.mjs) —
// SOURCE UNIQUE de la composition « map globale de déclarations id-param + résolution du shadowing »
// (`collectIdParamFnsAcrossDirs`/`effectiveIdParamFns` ci-dessous), pour que les deux consommateurs
// ne divergent jamais.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import ts from 'typescript';
// Substrat AST PARTAGÉ (portées, alias, opérateurs d'égalité, littéralité) — SOURCE UNIQUE
// `registryIdBranch.mjs` : le suivi d'alias `const k = def.id` y existe déjà, on l'importe.
import { Scopes, bindingNames, unwrap, isEntryLiteral, EQUALITY_OPS } from './registryIdBranch.mjs';

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

/** PRÉDICAT sur `.label` : `.label` comme ARGUMENT d'un `.test(`/`.exec(` (regex évaluée contre un
 *  label), ou comme RÉCEPTEUR d'une méthode de chaîne prédicative (`.label.startsWith(`/`.endsWith(`/
 *  `.match(`/`.includes(`/`.test(`/`.search(`/`.indexOf(`). Même défaut que `LABEL_EQ_RX` : logique
 *  qui distingue des cas par IDENTITÉ de libellé plutôt que par `id` stable. */
export const LABEL_PREDICATE_RX = /\.test\([^)]*\.label\b|\.label\.(?:match|includes|startsWith|endsWith|test|search|indexOf)\(/;

/** `switch` sur `.label` : un aiguillage par libellé est la même famille de logique-par-label qu'une
 *  carte `BY_LABEL`, juste écrite en `switch`. */
export const LABEL_SWITCH_RX = /switch\s*\([^)]*\.label\b/;

/** DÉRIVATION D'IDENTITÉ depuis un libellé : `slugId(x.label)` (#637). Re-dériver un `id` à partir du
 *  `.label` (affichage multilangue) au runtime couple l'identité à la langue — une traduction change
 *  l'id, cassant lookups/références/sauvegardes. L'`id` est explicite et OBLIGATOIRE sur l'entité,
 *  jamais dérivé. Vise `.label` SEULEMENT (pas `.name` : la conversion d'un fragment TEXTE saisi en
 *  éditeur — `slugId(p.name)` d'un `splitLabel` — est la couture label→id d'authoring tolérée). */
export const SLUG_FROM_LABEL_RX = /slugId\s*\(\s*[\w.]+\.label\b/;

/** Champs d'AFFICHAGE d'une entité : `label` ET `name` (#598 — `Weapon.name`/`ItemInstance.name`/
 *  `Combatant.name` sont des libellés). ⚠ `name` est AMBIGU dans ce dépôt : `ConditionInstance.name`
 *  et l'instance de maladie portent un **id** sous ce nom (dette #598, résorbée par le renommage
 *  `name`→`id`) — d'où le baseline nommé côté test, JAMAIS un élargissement aveugle. */
const DISPLAY_FIELD = '(?:label|name)';

/** Champ d'affichage interpolé dans un littéral de gabarit qui sert de **CLÉ** (`key: \`x:${w.name}\``).
 *  C'est la forme qui a laissé vivre `weapon:${weapon.name}` (#598) : la garde `.label` d'origine ne
 *  voyait ni `name`, ni la construction de clé par template. On ne vise QUE la construction d'identité
 *  (`key` en propriété ou en affectation) — les ~700 interpolations d'AFFICHAGE (`${c.name} touche…`)
 *  restent hors de portée, la lecture d'un libellé pour l'afficher étant précisément son usage légitime. */
export const DISPLAY_KEY_TEMPLATE_RX = new RegExp('\\bkey\\s*[:=]\\s*`[^`]*\\$\\{[^}]*\\.' + DISPLAY_FIELD + '\\b');

/** Champ d'affichage d'une entité en INDEX de LECTURE : `manualOpen[cl.name]`, `NAME_TO_GROUP[w.name]`.
 *  Le `[` doit suivre un réceptacle (identifiant/`)`/`]`) — un littéral de TABLEAU (`[v.id, v.label]`,
 *  paire d'un `Object.fromEntries`) n'est pas une indexation. */
const DISPLAY_INDEX_RX = new RegExp('[\\w)\\]]\\[[^\\]]*\\.' + DISPLAY_FIELD + '\\b[^\\]]*\\]');

/** …mais une ÉCRITURE d'index (`m[x.label] = v`, `acc[it.name] ??= …`) CONSTRUIT un index par texte —
 *  la conversion label→id tolérée (CLAUDE.md) ; seule la LECTURE (une décision) est visée. */
const INDEX_WRITE_RX = /\]\s*(?:\?\?|\|\||&&|[-+*/%])?=[^=]/;

/** Méthodes d'INTERROGATION d'une collection — `set`/`add` en sont volontairement ABSENTS : REMPLIR un
 *  index depuis du texte est la couture tolérée ; INTERROGER une collection avec le libellé d'une entité
 *  qu'on tient (donc dont on a l'`id`) est la faute. */
const LOOKUP_CALL_RX = /\.(?:has|get|delete)\(/g;

/**
 * `.label`/`.name` d'une entité passé en CLÉ d'interrogation — `owned.has(x.label)`,
 * `idx.get(concreteLabel(e.label, s))` (#602). L'argument est délimité par COMPTAGE de parenthèses :
 * sans ça, `byId.get(id)?.label` (résolution d'un libellé APRÈS un lookup PAR ID — lecture d'affichage
 * légitime, ~50 sites) serait flaguée à tort.
 * @param {string} line @returns {boolean}
 */
export function hasDisplayLookupKey(line) {
  const FIELD_RX = new RegExp('\\.' + DISPLAY_FIELD + '\\b');
  for (const m of line.matchAll(LOOKUP_CALL_RX)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < line.length && depth > 0; i++) {
      if (line[i] === '(') depth++;
      else if (line[i] === ')') depth--;
    }
    if (FIELD_RX.test(line.slice(start, depth === 0 ? i - 1 : line.length))) return true;
  }
  return false;
}

/** Champ d'affichage comme CLÉ DE COLLECTION (#602) : interrogation `has`/`get`/`delete`, ou LECTURE
 *  d'index. @param {string} line @returns {boolean} */
export function hasDisplayCollectionKey(line) {
  return hasDisplayLookupKey(line) || (DISPLAY_INDEX_RX.test(line) && !INDEX_WRITE_RX.test(line));
}

/**
 * Scan complet d'un fichier source : toute logique par label — carte `BY_LABEL`/`byLabel`, comparaison
 * d'égalité sur `.label`, PRÉDICAT sur `.label` (regex/méthode de chaîne), `switch` sur `.label`, ou
 * champ d'AFFICHAGE (`label`/`name`) interpolé dans une CLÉ (`DISPLAY_KEY_TEMPLATE_RX`, #598), ou
 * champ d'affichage servant de CLÉ DE COLLECTION (`hasDisplayCollectionKey`, #602) — ligne par ligne,
 * commentaires retirés.
 *
 * Frontière de la règle #602 (doctrine, pas liste d'exceptions) : CONSTRUIRE un index depuis du texte
 * (`.set(x.label, …)`, `m[x.label] = …`) est la conversion label→id TOLÉRÉE ; INTERROGER une collection
 * (`has`/`get`/`delete`, lecture d'index) avec le libellé d'une entité qu'on tient — donc dont on a
 * l'`id` — est la faute. Une résolution de texte HUMAIN entrant (auto-liage de prose, import de
 * statbloc) se déclare par une fonction dont le paramètre EST du texte, et ne lit alors aucun `.label`.
 *
 * LIMITE CONNUE (heuristique volontairement précise plutôt qu'à faux positifs, cf. #142) : ce scan est
 * SYNTACTIQUE — il ne détecte que les sites où `.label` est TEXTUELLEMENT adjacent à l'opérateur/la
 * méthode incriminée. Un prédicat testé contre une VARIABLE qui *tient* un label sans que `.label`
 * apparaisse sur la même ligne (ex. `const lbl = x.label; regex.test(lbl)`) échappe au scan — à
 * détecter par revue de code, pas par cette garde mécanique.
 *
 * Chaque finding porte sa `rule` : les règles `.label` HISTORIQUES (#142) valent `label-logic` et
 * restent à TOLÉRANCE ZÉRO ; la règle `display-key` (#598, champ d'affichage interpolé en CLÉ) est
 * distinguée pour que l'appelant puisse lui adosser un baseline SANS relâcher les premières.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string, rule: 'label-logic' | 'display-key' }[]}
 */
export function scanLabelLogic(relPath, contenu) {
  const findings = [];
  const body = stripComments(contenu);
  body.split('\n').forEach((line, i) => {
    const labelLogic =
      BY_LABEL_RX.test(line) ||
      LABEL_EQ_RX.test(line) ||
      LABEL_PREDICATE_RX.test(line) ||
      LABEL_SWITCH_RX.test(line) ||
      SLUG_FROM_LABEL_RX.test(line);
    // Une ligne qui viole les DEUX est rapportée sous `label-logic` (la règle la plus stricte prime,
    // sinon un baseline `display-key` amnistierait au passage une vraie logique-par-label).
    if (labelLogic) findings.push({ line: i + 1, detail: line.trim(), rule: 'label-logic' });
    else if (hasDisplayCollectionKey(line)) findings.push({ line: i + 1, detail: line.trim(), rule: 'collection-key' });
    else if (DISPLAY_KEY_TEMPLATE_RX.test(line)) findings.push({ line: i + 1, detail: line.trim(), rule: 'display-key' });
  });
  return findings;
}

// ── Libellés HORS du champ `label` (#142 LOT 7) ─────────────────────────────────────────────────
// Les règles ci-dessus ne voient un libellé que s'il est porté par un champ nommé `label`/`name`.
// Le dépôt en porte ailleurs : `reach` (« Très longue »), `loc` (« Tête »), `tier` (« Bronze »),
// `availability` (« Exotique »), `statut` (« réfuté »)… — c'est par `reach` que `weapon.reach ===
// 'Très longue'` a vécu dans `src/engine` sans qu'aucune garde ne le voie. Le critère ne porte donc
// plus sur le NOM du champ mais sur la FORME du LITTÉRAL comparé : un id de ce dépôt est un slug
// ASCII minuscule (`tres-longue`, `disc`, `melee`) ; une majuscule initiale, un accent ou une espace
// signent un texte destiné à l'œil humain, donc multilangue, donc interdit en logique.

/** Champs d'un nœud/événement DOM dont le vocabulaire est une norme W3C (`KeyboardEvent.key`/`.code`
 *  — `'Enter'`, `'ArrowLeft'`, `'KeyE'` ; `Element.tagName` — `'INPUT'`), pas de la donnée d'entité :
 *  aucune traduction ne les change, aucun id ne peut les remplacer. MESURÉ sur
 *  src/engine+state+gameIso+ui : 40 des 47 comparaisons à littéral de libellé du rendu/UI sont ces
 *  trois champs, AUCUNE n'est de la donnée de jeu — même mesure et même verdict que `ID_NAME_RX` de
 *  `registryIdBranch.mjs`, qui a écarté `key`/`code` pour la même raison. */
const DOM_VOCAB_FIELDS = new Set(['key', 'code', 'tagName']);

/** Le littéral est-il un TEXTE D'AFFICHAGE plutôt qu'un id ? Les ids de ce dépôt sont des slugs
 *  ASCII minuscules (`tres-longue`, `mains-nues`, `disc`) — la convention est tenue par les
 *  registres et par `slugId`. Une MAJUSCULE INITIALE, un ACCENT ou une ESPACE ne peuvent donc pas
 *  appartenir à un id : c'est du libellé. Le critère est structurel (forme du texte), pas une liste.
 *  @param {string} text @returns {boolean} */
export function isLabelLiteral(text) {
  if (text.length < 2) return false;
  return /^\p{Lu}/u.test(text) || /[À-ɏ]/.test(text) || /\s/.test(text);
}

/** Nom de propriété (identifiant, littéral de chaîne, ou clé calculée) — ou null si indéchiffrable. */
function propName(name) {
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

/** L'expression LIT-ELLE un champ d'entité (hors champs d'événement DOM) ? `w.reach`, `it.loc`,
 *  `a.b.statut` — le nom du champ n'est PAS un critère d'inclusion (c'est précisément le trou qu'on
 *  ferme) ; il ne sert qu'à écarter les deux champs d'événement DOM. */
function readsEntityField(node) {
  const n = unwrap(node);
  if (!ts.isPropertyAccessExpression(n) || !ts.isIdentifier(n.name)) return false;
  return !DOM_VOCAB_FIELDS.has(n.name.text);
}

/** Valeur de champ TENUE PAR UNE VARIABLE (`const band = w.reach;` puis `band === 'Très longue'`) —
 *  le troisième angle mort déclaré par l'en-tête de `scanLabelLogic` (scan ligne à ligne). La
 *  mécanique de suivi d'alias est celle de `registryIdBranch.mjs` (`Scopes`/`bindingNames`/`unwrap`,
 *  qui suit déjà `const k = def.id`), IMPORTÉE et non recopiée. */
const FIELD_HOLDER = 'field-holder';

/** L'expression est-elle une valeur de champ d'entité, directement ou par alias ? */
function holdsFieldValue(node, scopes) {
  const n = unwrap(node);
  if (ts.isIdentifier(n)) return scopes.kindOf(n.text) === FIELD_HOLDER;
  return readsEntityField(n);
}

/** Table dont les clés sont des LIBELLÉS (`{ Tête: […], Bras: […] }`, `{ 'Très longue': 2 }`) : ce
 *  n'est pas un `Record` keyé par id, c'est un INDEX DE LIBELLÉS — il fige une langue dans la logique
 *  et se casse à la première traduction. Deux clés minimum (une table d'une entrée ne démontre aucun
 *  vocabulaire), TOUTES à majuscule initiale, et AU MOINS UNE portant un ACCENT ou une ESPACE — ce
 *  qu'aucun identifiant TypeScript ne peut porter. Sans cette dernière condition, MESURÉ : trois
 *  tables légitimes remontent à tort sur src/engine+state (un espace de noms d'ids `{ Flexible:
 *  'flexible' }`, un registre d'événements `{ TILE_CLICK: … }`, une table de codes clavier DOM) —
 *  leurs clés sont des NOMS TS en ASCII, pas les libellés eux-mêmes. Faux négatif assumé en retour :
 *  un vocabulaire de libellés entièrement sans accent ni espace (`{ Bronze: 0, Argent: 1 }`) reste
 *  indiscernable d'un espace de noms — la garde s'abstient plutôt que d'accuser à tort. */
function isLabelKeyedRecord(node) {
  const n = unwrap(node);
  if (!ts.isObjectLiteralExpression(n) || n.properties.length < 2) return false;
  const names = [];
  for (const p of n.properties) {
    if (!ts.isPropertyAssignment(p) && !ts.isShorthandPropertyAssignment(p)) return false;
    if (!p.name || ts.isComputedPropertyName(p.name)) return false;
    const name = propName(p.name);
    if (name == null) return false;
    names.push(name);
  }
  return names.every((s) => /^\p{Lu}/u.test(s) || /[À-ɏ]/.test(s) || /\s/.test(s))
    && names.some((s) => /[À-ɏ]/.test(s) || /\s/.test(s));
}

/**
 * Scan STRUCTUREL (AST) des libellés portés par un champ AUTRE que `label`/`name`. Trois formes :
 *  - `label-literal`  : `w.reach === 'Très longue'`, `t.availability !== 'Exotique'` — égalité entre
 *                       une valeur de champ (ou son alias) et un littéral de LIBELLÉ ;
 *  - `label-switch`   : `switch (w.reach) { case 'Très longue': … }` — même aiguillage, en `switch` ;
 *  - `label-record`   : `const T = { Tête: […], Bras: […] }` — table indexée par des libellés.
 *
 * FRONTIÈRE (par FORME, aucune liste de noms) — ne lèvent PAS : un discriminant d'union en slug
 * ASCII (`area.kind === 'disc'`, `w.type === 'melee'`), une comparaison à une VARIABLE
 * (`a.reach === b.reach`), un champ d'ÉVÉNEMENT DOM (`e.key === 'Enter'`), le RENDU d'un libellé
 * (`{item.label}`) — seule une DÉCISION prise sur le texte est visée.
 *
 * CE QUE CE SCAN NE VOIT PAS (faux négatifs assumés, mesurés) : un libellé tenu par un PARAMÈTRE de
 * fonction (`function q(av: Availability) { if (av === 'Commune') … }`) — la provenance du texte
 * n'est pas lisible sans vérificateur de types ; un libellé ENTIÈREMENT en slug ASCII minuscule
 * (aucun n'existe : un libellé français porte accent, majuscule ou espace) ; un prédicat qui n'est
 * pas une égalité (`.startsWith('Très')`).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string, rule: 'label-literal' | 'label-switch' | 'label-record' }[]}
 */
export function scanLabelLiteralCompare(relPath, contenu) {
  const kind = relPath.endsWith('.tsx') ? ts.ScriptKind.TSX
    : /\.[cm]?js$/.test(relPath) ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(relPath, contenu, ts.ScriptTarget.Latest, true, kind);
  const lines = contenu.split('\n');
  const findings = [];
  const seen = new Set();
  const scopes = new Scopes();

  const report = (node, rule) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    const key = `${line}:${rule}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ line, detail: (lines[line - 1] || '').trim(), rule });
  };

  const visit = (node) => {
    if (ts.isFunctionLike(node) || ts.isBlock(node) || ts.isCaseBlock(node) || ts.isModuleBlock(node)) {
      scopes.push();
      ts.forEachChild(node, visit);
      scopes.pop();
      return;
    }
    if (ts.isVariableDeclarationList(node)) {
      for (const d of node.declarations) {
        const holder = !!d.initializer && holdsFieldValue(d.initializer, scopes);
        for (const n of bindingNames(d.name)) scopes.declare(n, holder ? FIELD_HOLDER : 'value');
        if (d.initializer && isLabelKeyedRecord(d.initializer)) report(d, 'label-record');
      }
    }
    if (ts.isBinaryExpression(node) && EQUALITY_OPS.has(node.operatorToken.kind)) {
      const l = unwrap(node.left);
      const r = unwrap(node.right);
      if ((holdsFieldValue(l, scopes) && isEntryLiteral(r) && isLabelLiteral(r.text))
        || (holdsFieldValue(r, scopes) && isEntryLiteral(l) && isLabelLiteral(l.text))) report(node, 'label-literal');
    }
    if (ts.isSwitchStatement(node) && holdsFieldValue(node.expression, scopes)
      && node.caseBlock.clauses.some((c) => ts.isCaseClause(c) && isEntryLiteral(unwrap(c.expression)) && isLabelLiteral(unwrap(c.expression).text))) {
      report(node, 'label-switch');
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sf, visit);
  findings.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
  return findings;
}

/**
 * STOCK d'ANCIEN COMPORTEMENT, par fichier (patron `*Stock.mjs` du dépôt) : les vocabulaires de
 * LIBELLÉS encore employés comme logique, à la pose de la règle (2026-07-26, #142 LOT 7). Ce ne sont
 * pas des exemptions — aucun de ces sites n'est légitime : ce sont des AXES entiers qui restent à
 * migrer vers des ids (Disponibilité Commune/Limitée/Rare/Exotique, Statut social Bronze/Argent/Or,
 * récolte Rareté/Danger/Conservation, statut d'indice révélé/réfuté). Le compte est PAR FICHIER
 * (jamais `fichier:ligne` : la ligne dérive à chaque commit voisin et le cliquet crierait à faux).
 *
 * CLIQUET STRICT, dans les DEUX sens : un compte SUPÉRIEUR échoue (dette neuve), un compte
 * INFÉRIEUR échoue aussi (dette soldée → l'entrée se met à jour, ou disparaît, dans le MÊME geste).
 * Un fichier absent du stock est à tolérance ZÉRO. La migration d'un axe se solde en retirant ses
 * entrées, jamais en gonflant un nombre.
 * @type {Readonly<Record<string, number>>}
 */
export const LABEL_LITERAL_STOCK = {
  // Axe Disponibilité (LDB 59) — `Availability` EST le libellé ; `src/engine/disponibilite.ts` porte
  // le type, la table ET le prédicat `isTradable` (source unique de la comparaison aux 4 classes),
  // ses consommateurs suivent.
  'src/engine/activities.ts': 3,
  'src/engine/disponibilite.ts': 1,
  'src/ui/MerchantPanel.tsx': 1,
  // Axes de récolte (Rareté / Danger / Taille / Conservation) — quatre vocabulaires FR en clés de table.
  'src/engine/harvest.ts': 5,
  // Axe Statut social (Bronze/Argent/Or) — `Status.tier` porte le libellé, lu du texte des carrières.
  'src/engine/creation.ts': 2,
  'src/engine/social.ts': 2,
  'src/ui/creator/CharacterCreator.tsx': 2,
  // Statut d'un indice de campagne (révélé/réfuté) — porté par la donnée de scène et les sauvegardes.
  'src/state/clues.ts': 2,
  'src/state/combatEffects.ts': 1,
  'src/ui/CarnetScreen.tsx': 3,
  // Libellés SENTINELLES d'éditeur (« Profil personnalisé », « Carte du monde ») — le défaut se
  // reconnaît au texte affiché faute de drapeau sur l'entité.
  'src/ui/editor/StatblockEditor.tsx': 1,
  'src/ui/editor/WorldMapEditor.tsx': 1,
};

/** Écarts au stock pour un jeu de comptes MESURÉS (`fichier` → nombre de findings) : chaque écart est
 *  une phrase prête à afficher. `measured` ne contient que les fichiers scannés — les fichiers du
 *  stock absents de `measured` ne sont donc PAS jugés (scan partiel du hook pre-commit).
 *  @param {Map<string, number>|Record<string, number>} measured @returns {string[]} */
export function labelLiteralStockDrift(measured) {
  const entries = measured instanceof Map ? [...measured] : Object.entries(measured);
  const out = [];
  for (const [rel, n] of entries) {
    const stock = LABEL_LITERAL_STOCK[rel] ?? 0;
    if (n > stock) out.push(`${rel} : ${n} logique(s) par LIBELLÉ, stock = ${stock} — migrer vers un id STABLE (le libellé est de l'AFFICHAGE).`);
    else if (n < stock) out.push(`${rel} : ${n} logique(s) par LIBELLÉ, stock = ${stock} — dette SOLDÉE, mettre LABEL_LITERAL_STOCK à jour dans le même geste.`);
  }
  return out;
}

/** Découpe une liste de PARAMÈTRES de déclaration sur les VIRGULES de premier niveau — profondeur
 *  `(){}[]`/générique `<>` comptée (types génériques `Map<string, T>` fréquents en signature),
 *  jamais une virgule à l'intérieur d'un objet/tableau/callback/liste de types imbriquée. Profondeur
 *  JAMAIS négative (clampée à 0) : un `>` SANS `<` ouvrant préalable — la flèche `=>` d'un paramètre
 *  typé callback (`(cb: () => void, id: string)`) en contient un — ne doit pas faire déraper le
 *  compteur pour le reste de la chaîne (sans quoi la virgule qui suit ne serait plus vue comme
 *  top-level, #142 LOT 6).
 *  @param {string} s @returns {string[]} */
function splitTopLevel(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{' || ch === '<') depth++;
    else if ((ch === ')' || ch === ']' || ch === '}' || ch === '>') && depth > 0) depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}

/** Découpe une liste d'ARGUMENTS d'appel sur les virgules de premier niveau — profondeur `(){}[]`
 *  SEULEMENT, `<`/`>` ignorés (contrairement à `splitTopLevel`) : un opérateur de comparaison parmi
 *  les arguments (`f(a < b, sb.label, d)`) ne doit pas être pris pour l'ouverture d'un générique et
 *  casser tout le découpage qui suit — un générique explicite en position d'ARGUMENT d'appel est
 *  rarissime dans ce dépôt ; l'ignorer ici est le compromis qui couvre le cas réel (#142 LOT 6).
 *  @param {string} s @returns {string[]} */
function splitCallArgs(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}

/** Index de la parenthèse FERMANTE correspondant à celle ouverte en `openIdx` (inclus), par
 *  comptage de profondeur — gère callbacks/génériques/objets imbriqués dans une liste de
 *  paramètres ou d'arguments SANS troncature prématurée (contrairement à un `[^)]*` naïf, qui
 *  s'arrête à la première `)` rencontrée, même celle d'un callback interne).
 *  @param {string} s @param {number} openIdx @returns {number} index de la ')' fermante, ou -1. */
function matchClosingParen(s, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Convertit un INDEX dans `body` en numéro de ligne 1-based. @param {string} body
 *  @param {number} index @returns {number} */
function lineOf(body, index) {
  return body.slice(0, index).split('\n').length;
}

/** Un paramètre de déclaration nommé `id`, OU dont le nom se TERMINE par `Id` (`creatureId`,
 *  `entityId`, `refId`…) — un identifiant au même titre que `id` (#142 LOT 6) : la doctrine
 *  (CLAUDE.md, IDs internes) ne réserve pas le suffixe au seul nom `id`. */
const ID_PARAM_RX = /^\s*(?:id|\w+Id)\s*(?::|$)/;

/** Mots-clés de contrôle/déclaration qui précèdent parfois `nom(` sans que `nom` soit une
 *  déclaration de méthode — exclus de la détection « méthode nue » de `findDeclarationHeads`
 *  (ils sont soit déjà couverts par la tête `function`, soit jamais des identifiants de fonction). */
const METHOD_HEAD_EXCLUDED = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'new', 'await', 'yield',
  'void', 'delete', 'in', 'of', 'async', 'do', 'else', 'try', 'with', 'class', 'const', 'let', 'var',
]);

/** Repère toutes les TÊTES de déclaration `nom(...)` d'un corps — fonction nommée (`function foo`,
 *  `async function foo`), const/let fléchée (`const foo = (...) =>`, `async`, générique `<T>`), et
 *  méthode de CLASSE ou d'OBJET LITTÉRAL (`foo(id: string) { … }`, raccourci sans `function`) —
 *  mécanique COMMUNE à `collectIdParamFunctions` et `collectDeclaredNames` (#142 LOT 6).
 *  Une tête « nue » (`nom(` sans mot-clé de déclaration devant) n'est retenue QUE si elle est
 *  suivie, après un type de retour éventuel, d'un `{` : c'est ce qui distingue une VRAIE
 *  déclaration (méthode/fonction, qui ouvre un CORPS) d'un simple APPEL — `foo(id);`, `if (foo(id))
 *  {` sont suivis d'un `;`/`)`, jamais directement d'un `{`.
 *  LIMITE ASSUMÉE : les signatures sans corps (méthodes d'`interface`/`type`, surcharges) sont hors
 *  de portée — elles ne fournissent aucun CODE dont le paramètre serait analysable de toute façon.
 *  @param {string} body @returns {{name: string, paramsInner: string}[]} */
function findDeclarationHeads(body) {
  const heads = [];
  const seenAt = new Set();
  const push = (name, openIdx) => {
    if (seenAt.has(openIdx)) return;
    const closeIdx = matchClosingParen(body, openIdx);
    if (closeIdx < 0) return;
    seenAt.add(openIdx);
    heads.push({ name, paramsInner: body.slice(openIdx + 1, closeIdx) });
  };

  const FN_HEAD_RX = /(?:function\s+(\w+)\s*(?:<[^>]*>)?\s*\(|(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?(?:<[^>]*>\s*)?\()/g;
  let m;
  while ((m = FN_HEAD_RX.exec(body))) {
    const name = m[1] || m[2];
    if (name) push(name, m.index + m[0].length - 1);
  }

  const METHOD_HEAD_RX = /(?<![.\w$])(\w+)\s*(?:<[^>]*>)?\s*\(/g;
  while ((m = METHOD_HEAD_RX.exec(body))) {
    const name = m[1];
    if (METHOD_HEAD_EXCLUDED.has(name) || seenAt.has(m.index + m[0].length - 1)) continue;
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = matchClosingParen(body, openIdx);
    if (closeIdx < 0) continue;
    let j = closeIdx + 1;
    while (j < body.length && /\s/.test(body[j])) j++;
    if (body[j] === ':') {
      // type de retour éventuel — avance jusqu'au `{`/`;`/`=`/`,` de premier niveau qui suit. `{`
      // N'EST PAS compté comme ouvrant (contrairement à `(`/`[`/`<`) : c'est le marqueur d'ARRÊT
      // recherché (début du corps) — un type de retour EXCEPTIONNEL en littéral d'objet
      // (`(): { a: string } { … }`) reste géré correctement malgré tout, puisque ce `{` de type
      // fait alors, lui aussi, foi de « corps suit » (limite assumée, sans impact fonctionnel).
      j++;
      let depth = 0;
      while (j < body.length) {
        const c = body[j];
        if (c === '<' || c === '(' || c === '[') depth++;
        else if (c === '>' || c === ')' || c === ']') {
          if (depth === 0) break;
          depth--;
        } else if (depth === 0 && (c === '{' || c === ';' || c === '=' || c === ',')) break;
        j++;
      }
    }
    while (j < body.length && /\s/.test(body[j])) j++;
    if (body[j] !== '{') continue;
    push(name, openIdx);
  }
  return heads;
}

/** Déclarations de fonction (`function foo(...)`, `const foo = (...) =>`, méthode de classe/objet
 *  littéral) portant un paramètre `id`/`*Id` — collecte GLOBALE nom→index positionnel, cinquième
 *  forme du garde-fou #142 : une résolution PAR ID n'a pas besoin de s'appeler `*ById`
 *  (`bodyShapeOf(id: string)` en est un exemple réel, #142 LOT 5) — seul le PARAMÈTRE `id`/`*Id`
 *  fait foi, structurel, jamais un grep du nom de la fonction.
 * @param {string} contenu @returns {Map<string, number>} */
export function collectIdParamFunctions(contenu) {
  const body = stripComments(contenu);
  const map = new Map();
  for (const { name, paramsInner } of findDeclarationHeads(body)) {
    if (map.has(name)) continue;
    const idx = splitTopLevel(paramsInner).findIndex((p) => ID_PARAM_RX.test(p));
    if (idx >= 0) map.set(name, idx);
  }
  return map;
}

/** Tous les NOMS de fonction déclarés dans un fichier (même mécanique de déclaration que
 *  `collectIdParamFunctions`, paramètre `id` ou pas) — sert à détecter le SHADOWING local d'un nom
 *  global court (`toggle`, `set`…) : un fichier qui déclare SA PROPRE fonction homonyme sans paramètre
 *  `id` masque, pour SES appels, l'entrée globale sans rapport d'un autre fichier (#142 LOT 5, faux
 *  positif constaté : `SessionEndModal.tsx` déclare `toggle(id, key)`, `CharacterCreator.tsx` sa
 *  PROPRE `toggle(label)` — son appel `toggle(s.label)` vise la locale, pas l'homonyme).
 * @param {string} contenu @returns {Set<string>} */
export function collectDeclaredNames(contenu) {
  const body = stripComments(contenu);
  const names = new Set();
  for (const { name } of findDeclarationHeads(body)) names.add(name);
  return names;
}

/** Méthode d'INTERROGATION de collection dont le nom court collisionne, MESURÉ sur src/engine+state+
 *  gameIso+ui (#142 LOT 6bis), avec des déclarations homonymes sans rapport ailleurs dans le corpus :
 *  `set` SEUL — désactiver toute la liste (blacklist vidée) produit 5 faux positifs sur le corpus réel,
 *  TOUS dus à `set` (`set((s) => …)` du store Zustand ×3, `teamOf.set(x.label, …)`/`m.set(all[i].label, …)`
 *  = Map ×2) ; aucun autre nom (`has`/`get`/`delete`/`add`/`push`/`toggle`…) n'en produit UN SEUL. Élargir
 *  au-delà de `set` AVEUGLE en retour de vraies déclarations à paramètre `id` (mesuré, LOT 6bis) :
 *  `crewedWeapon.ts has(#0)`, `devtools.ts find(#0)`, `validateScene.ts add(#2)`,
 *  `quadSkeleton.ts set(#0)`, `SeaActivitiesModal.tsx set(#0)`, `SessionEndModal.tsx toggle(#0)`.
 *  `set` reste blacklisté malgré ce coût (2 sites ci-dessus aveuglés) car SANS information de TYPE, rien
 *  ne distingue structurellement `teamOf.set(x.label, …)` (Map, hors sujet) de `quadSkeleton.ts`
 *  `set(id)` (déclaration réelle) — même receveur inconnu. */
const COLLECTION_METHOD_NAMES = new Set(['set']);

/** L'argument (déjà découpé) désigne-t-il un `.label`, MODULO les enrobages qui ne changent pas
 *  l'IDENTITÉ de la valeur transportée : repli `??`/`||`, assertion de type `as …`, non-null `!`,
 *  coercion `String(...)`, interpolation SEULE dans un gabarit (`` `${x.label}` ``), ou chaînage
 *  d'une méthode de chaîne PURE sur `.label` (`.toLowerCase()`, `.trim()`…). L'ALIASING
 *  (`const n = x.label; f(n)`) et tout flux inter-variables ne sont PAS traités : une regex ne suit
 *  pas une variable à travers ses affectations — le faire semblant produirait de faux négatifs
 *  invisibles, pire qu'une limite assumée (#142 LOT 6).
 *  @param {string} arg @returns {boolean} */
function isLabelArg(arg) {
  let a = arg.trim();
  const fallback = a.match(/^([\s\S]+?)\s*(?:\?\?|\|\|)\s*[\s\S]+$/);
  if (fallback) a = fallback[1].trim();
  a = a.replace(/\s+as\s+[\w.<>[\], ]+$/, '').trim();
  a = a.replace(/!+$/, '').trim();
  const coerced = a.match(/^String\(\s*([\s\S]+?)\s*\)$/);
  if (coerced) a = coerced[1].trim();
  const tpl = a.match(/^`\$\{\s*([\s\S]+?)\s*\}`$/);
  if (tpl) a = tpl[1].trim();
  if (/\.label\s*$/.test(a)) return true;
  return /\.label\.(?:toLowerCase|toUpperCase|trim|trimStart|trimEnd|normalize)\(\s*\)\s*$/.test(a);
}

/**
 * `.label` passé en ARGUMENT, à la position du paramètre `id`, d'un appel à une fonction connue de
 * `idParamFns` (collectée par `collectIdParamFunctions` sur le CORPUS entier — déclaration et appel
 * peuvent vivre dans des fichiers différents). Le corps est scanné en ENTIER (pas ligne par ligne)
 * pour couvrir les appels MULTILIGNE ; l'argument est délimité par COMPTAGE de parenthèses
 * (`matchClosingParen`) puis découpé par `splitCallArgs`, robuste aux `<`/`>` de comparaison parmi
 * les arguments : `bodyShapeOf(sb.label)` matche (arg 0 = paramètre `id`, `.label` passé où une
 * résolution attend un id STABLE) ; `bodyShapeOf(creature.id)` ne matche pas (l'argument est `.id`,
 * pas `.label`). Couvre aussi les enrobages triviaux (`??`, `as`, `!`, template, `String(...)`,
 * méthode de chaîne pure — `isLabelArg`) et les appels de MÉTHODE dont le nom n'est pas une méthode
 * de collection connue (`COLLECTION_METHOD_NAMES` — `set` SEUL, mesuré #142 LOT 6bis).
 * @param {string} relPath @param {string} contenu @param {Map<string, number>} idParamFns
 * @returns {{ line: number, detail: string, rule: 'label-as-id-arg' }[]}
 */
export function scanLabelAsIdArg(relPath, contenu, idParamFns) {
  const findings = [];
  const body = stripComments(contenu);
  const lines = body.split('\n');
  // `(?:(\w+)\.)?` = receveur optionnel d'un appel de méthode (`teamOf.set(`, `helpers.bodyShapeOf(`) —
  // seul le nom de méthode (dernier segment) est confronté à `idParamFns`/`COLLECTION_METHOD_NAMES`.
  const CALL_RX = /(?<![.\w])(?:(\w+)\.)?(\w+)\s*\(/g;
  let m;
  while ((m = CALL_RX.exec(body))) {
    const fnName = m[2];
    // `COLLECTION_METHOD_NAMES` exclut AUSSI l'appel NU (sans receveur) : ces noms courts sont des
    // PARAMÈTRES ubiquitaires (le `set` de Zustand `(set, get) => ({...})`) que `collectDeclaredNames`
    // ne peut pas voir comme un SHADOWING (ce n'est pas une déclaration, c'est un paramètre de
    // closure) — une déclaration homonyme RÉELLE ailleurs dans le corpus (`const set = (id, x, z) =>
    // …` d'un helper de rig, #142 LOT 6) collisionnerait sinon avec CHAQUE `set(...)` de tout le
    // store. Limite DOCUMENTÉE et mesurée : ces noms restent hors de portée, receveur ou pas.
    if (COLLECTION_METHOD_NAMES.has(fnName)) continue;
    const idx = idParamFns.get(fnName);
    if (idx === undefined) continue;
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = matchClosingParen(body, openIdx);
    if (closeIdx < 0) continue;
    const inner = body.slice(openIdx + 1, closeIdx);
    const arg = splitCallArgs(inner)[idx];
    if (arg && isLabelArg(arg)) {
      const line = lineOf(body, m.index);
      findings.push({ line, detail: (lines[line - 1] || '').trim(), rule: 'label-as-id-arg' });
    }
  }
  return findings;
}

/** `.ts`/`.tsx` sous des dossiers racine, récursif — même marche que le scan de corpus des gardes.
 *  @param {string[]} dirs (absolus, ou relatifs à `root` si `root` fourni via `isAbsolute`)
 *  @returns {string[]} chemins absolus */
function listTsFiles(dirs) {
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e)) files.push(p);
    }
  };
  for (const d of dirs) walk(d);
  return files;
}

/** Exclusion PARTAGÉE du scan de corpus (déclaration ET appel) : fichiers de TEST, et
 *  `src/data/index.ts` (couture label→id tolérée au CHARGEMENT, hors périmètre du garde-fou).
 *  @param {string} rel chemin relatif à la racine du projet, séparateurs `/` @returns {boolean} */
export function isCorpusExcluded(rel) {
  return /\.test\.[tj]sx?$/.test(rel) || rel === 'src/data/index.ts';
}

/** Map GLOBALE nom→index-paramètre-`id`, collectée en lisant le DISQUE sous `dirs` (déclaration et
 *  appel peuvent vivre dans des fichiers différents, cf. `collectIdParamFunctions`) — SOURCE UNIQUE
 *  de cette composition (parcours + lecture + fusion), consommée à l'identique par
 *  `label-logic-guard.test.ts` ET par le hook pre-commit (#142 LOT 6bis), sans copie.
 *  @param {string} root racine absolue du projet @param {string[]} dirs dossiers (absolus ou relatifs à `root`)
 *  @returns {Map<string, number>} */
export function collectIdParamFnsAcrossDirs(root, dirs) {
  const map = new Map();
  const absDirs = dirs.map((d) => (isAbsolute(d) ? d : join(root, d)));
  for (const f of listTsFiles(absDirs)) {
    const rel = relative(root, f).split('\\').join('/');
    if (isCorpusExcluded(rel)) continue;
    for (const [name, idx] of collectIdParamFunctions(readFileSync(f, 'utf8'))) if (!map.has(name)) map.set(name, idx);
  }
  return map;
}

/** Map EFFECTIVE (locale + globale) pour un fichier donné : un nom d'ID_PARAM_FNS global MASQUÉ par
 *  une déclaration homonyme LOCALE (shadowing, `collectDeclaredNames`) cède la place à la locale —
 *  composition PARTAGÉE, même raison d'être que `collectIdParamFnsAcrossDirs` ci-dessus (#142 LOT 6bis).
 *  @param {string} contenu @param {Map<string, number>} globalIdParamFns @returns {Map<string, number>} */
export function effectiveIdParamFns(contenu, globalIdParamFns) {
  const local = collectIdParamFunctions(contenu);
  const localNames = collectDeclaredNames(contenu);
  const eff = new Map(local);
  for (const [name, idx] of globalIdParamFns) if (!localNames.has(name)) eff.set(name, idx);
  return eff;
}


/** Dossiers TOLÉRANCE ZÉRO (`src/engine`, `src/state`) — SOURCE UNIQUE, consommée à l'identique par
 *  `label-logic-guard.test.ts` ET par le hook pre-commit (défaut constaté : liste dupliquée en dur
 *  aux deux endroits, divergente silencieusement au premier ajout d'un seul côté). */
export const STRICT_DIRS = ['src/engine', 'src/state'];

/** Dossiers RATCHET à exceptions justifiées (`src/gameIso`, `src/ui`, #289) — même source unique. */
export const RATCHET_DIRS = ['src/gameIso', 'src/ui'];

/** Exceptions JUSTIFIÉES du ratchet (#289) — `fichier:ligne` (relatif à `src/`) → justification.
 *  SOURCE UNIQUE (`label-logic-guard.test.ts` et le hook pre-commit la consomment TOUS DEUX, sans
 *  copie) : une entrée périmée (site déplacé/assaini) doit être retirée des DEUX consommateurs à la
 *  fois, jamais resynchronisée à la main de chaque côté. */
export const RATCHET_EXCEPTIONS = {
  'gameIso/rig/parts/equipment.ts:23':
    "isShield (fallback de RENDU rig) — détecte un bouclier d'abord par la Qualité Protectrice ; " +
    "repli texte sur x.label pour un objet custom/legacy dépourvu de cette Qualité. Classification " +
    "VISUELLE (quel gabarit dessiner), pas une FK de logique métier — aucune régression possible.",
  'ui/gallery/DesignGallery.tsx:12':
    "Galerie design DEV (référence de goût in-app, HORS gameplay) : `activeId` = le spécimen sélectionné, " +
    "identifié par son label faute d'autre identité (entrée de démo interne). Sélection d'UI d'outil dev, " +
    "pas une FK de logique métier — aucune régression jouable. Exposée par #608 (le champ etait `name`).",
  'ui/gallery/DesignGallery.tsx:28':
    'Même galerie DEV (classe active du bouton de liste, même comparaison) — même justification que :12.',
};

/** Résout le `shortKey` (`fichier:ligne` relatif à `src/`) d'un finding porté par un chemin `src/…`
 *  — même calcul que `label-logic-guard.test.ts` (ratchet) et le hook pre-commit.
 *  @param {{ rel: string, line: number }} finding @returns {string} */
export function ratchetShortKey(finding) {
  return `${finding.rel.replace(/^src\//, '')}:${finding.line}`;
}
