// Mécanique de scan des gardes « SOURCE UNIQUE » lues à l'AST (#1440) — TypeScript compiler API,
// jamais une regex de ligne (une recopie multi-ligne échappe à tout motif de ligne) et jamais un
// scan par NOM (une copie s'appelle rarement comme le canon). Deux scans, tous deux par FORME :
//  - `scanUnionRecopies` : les SIX formes sous lesquelles un tuple canon se re-tape (tableau, union
//    de types littéraux, clés d'objet littéral, membres d'un type littéral, `case` d'un `switch`,
//    chaîne de comparaisons `=== 'a' || === 'b'`), moins les DEUX formes que le compilateur borne
//    déjà (sélection zod `.extract` sur un schéma du canon, table `Record<UnionNommée, …>` annotée) ;
//  - `scanChebyshevFormula` : la FORMULE de la distance de Chebyshev, quel que soit le nom qu'on lui
//    donne (`cheb`, `dist`, ou aucun — inline dans un `filter`).
// La lecture du corpus n'est PAS ici : elle vit dans `sourceCorpus.mjs` (`readCorpus`), sa
// mémoïsation chez l'appelant. Ce module reçoit des fichiers `{ rel, text }` et rend des `Finding`.
import ts from 'typescript';

/** AST par FICHIER, keyé sur l'IDENTITÉ de l'objet : un appelant qui mémoïse son corpus ne paie le
 *  parse qu'une fois pour tous ses scans. Rien ne fuit — la carte lâche avec le corpus. */
const AST = new WeakMap();

/** @param {{ rel: string, text: string }} file @returns {ts.SourceFile} */
function ast(file) {
  let sf = AST.get(file);
  if (!sf) {
    sf = ts.createSourceFile(file.rel, file.text, ts.ScriptTarget.Latest, true, file.rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    AST.set(file, sf);
  }
  return sf;
}

/** @param {ts.SourceFile} sf @param {ts.Node} n @returns {number} ligne 1-based */
const lineOf = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

/** Nom d'une clé de propriété (identifiant, chaîne, clé calculée littérale). `null` si dynamique.
 * @param {ts.PropertyName | undefined} name @returns {string | null} */
function keyName(name) {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)) return name.expression.text;
  return null;
}

/** Texte d'un type littéral de chaîne (`'a'` dans une union) ; `null` sinon.
 * @param {ts.TypeNode} t @returns {string | null} */
const litType = (t) => (ts.isLiteralTypeNode(t) && ts.isStringLiteralLike(t.literal) ? t.literal.text : null);

/** SCHÉMAS DÉRIVÉS du canon : les seuls récepteurs dont un `.extract(…)`/`.exclude(…)` SÉLECTIONNE
 *  dans le canon (leurs options SONT le tuple, cf. `src/data/schemas/common.ts`). Un `.extract` posé
 *  sur n'importe quel autre objet ne prouve rien — il ne blanchit donc rien.
 * @type {string[]} */
export const SCHEMAS_DU_CANON = ['availabilitySchema', 'stakeFormSchema', 'harvestRaritySchema'];

/** Le tableau est-il l'argument d'un `.extract(…)`/`.exclude(…)` posé sur un schéma DU CANON ? zod
 *  type cet argument par les options du récepteur : sur un schéma du canon, un palier renommé ne
 *  compile plus. Le récepteur est donc vérifié NOMMÉMENT — sinon n'importe quel
 *  `truc.extract(['Commune', 'Rare'])` se blanchirait tout seul.
 * @param {ts.ArrayLiteralExpression} n @returns {boolean} */
function estSelectionDerivee(n) {
  const p = n.parent;
  if (!p || !ts.isCallExpression(p) || p.arguments[0] !== n) return false;
  const cible = p.expression;
  if (!ts.isPropertyAccessExpression(cible)) return false;
  if (cible.name.text !== 'extract' && cible.name.text !== 'exclude') return false;
  // Récepteur : le schéma nu, ou une chaîne de dérivations qui en part (`x.extract([…]).optional()`).
  let recepteur = cible.expression;
  for (;;) {
    if (ts.isCallExpression(recepteur)) { recepteur = recepteur.expression; continue; }
    if (ts.isPropertyAccessExpression(recepteur)) { recepteur = recepteur.expression; continue; }
    break;
  }
  return ts.isIdentifier(recepteur) && SCHEMAS_DU_CANON.includes(recepteur.text);
}

/** TABLE EXHAUSTIVE keyée par une union NOMMÉE (`const T: Record<Availability, X> = { … }`) : ce ne
 *  sont pas des membres re-tapés mais les clés d'une table que le COMPILATEUR exige complètes — un
 *  palier ajouté, renommé ou retiré du canon casse la compilation de la table. `Record<string, …>`
 *  n'en est pas une (aucune exhaustivité exigée), ni un `as Record<…>` (une assertion ne vérifie pas
 *  les clés manquantes) : seules l'ANNOTATION et le `satisfies` valent verrou.
 * @param {ts.TypeNode | undefined} t @returns {boolean} */
function estRecordDUnionNommee(t) {
  if (!t || !ts.isTypeReferenceNode(t) || !ts.isIdentifier(t.typeName)) return false;
  const nom = t.typeName.text;
  const args = t.typeArguments ?? [];
  if ((nom === 'Partial' || nom === 'Readonly' || nom === 'Required') && args.length === 1) return estRecordDUnionNommee(args[0]);
  if (nom !== 'Record' || args.length !== 2) return false;
  const cle = args[0];
  return ts.isTypeReferenceNode(cle) && ts.isIdentifier(cle.typeName);
}

/** @param {ts.ObjectLiteralExpression} n @returns {boolean} */
function estTableExhaustive(n) {
  const p = n.parent;
  if (!p) return false;
  if (ts.isSatisfiesExpression(p)) return estRecordDUnionNommee(p.type);
  if ((ts.isVariableDeclaration(p) || ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) || ts.isParameter(p)) && p.type) return estRecordDUnionNommee(p.type);
  return false;
}

const LOGIQUES = new Set([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken]);
const EGALITES = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
]);

/** Chaîne de comparaisons `a === 'x' || a === 'y'` : les littéraux comparés par ÉGALITÉ dans tout le
 *  sous-arbre `||`/`&&`. Le nœud n'est traité qu'en TÊTE de chaîne (son parent n'est pas `||`/`&&`).
 * @param {ts.BinaryExpression} n @returns {string[] | null} */
function litterauxDeChaine(n) {
  if (!LOGIQUES.has(n.operatorToken.kind)) return null;
  const p = n.parent;
  if (p && ts.isBinaryExpression(p) && LOGIQUES.has(p.operatorToken.kind)) return null;
  const vus = [];
  /** @param {ts.Node} x */
  const walk = (x) => {
    if (ts.isBinaryExpression(x) && EGALITES.has(x.operatorToken.kind)) {
      for (const cote of [x.left, x.right]) if (ts.isStringLiteralLike(cote)) vus.push(cote.text);
    }
    ts.forEachChild(x, walk);
  };
  walk(n);
  return vus;
}

/**
 * Recopies d'un tuple canon dans UN fichier : ≥2 membres DISTINCTS du canon reproduits ENSEMBLE,
 * sous l'une des six formes scannées — divergente ou non, c'est la duplication qui est la faute et
 * la divergence n'en est que la conséquence tardive.
 * @param {{ rel: string, text: string }} file
 * @param {{ nom: string, membres: readonly string[] }[]} canons
 * @returns {{ line: number, detail: string }[]}
 */
export function scanUnionRecopies(file, canons) {
  const cibles = canons.map((c) => ({ nom: c.nom, membres: new Set(c.membres) }));
  const present = (m) => file.text.includes(`'${m}'`) || file.text.includes(`"${m}"`) || new RegExp(`(^|[^\\w$.'"])${m}\\s*[:?]`, 'm').test(file.text);
  if (!cibles.some((c) => [...c.membres].filter(present).length >= 2)) return [];
  const sf = ast(file);
  /** @type {{ line: number, detail: string }[]} */
  const findings = [];
  const vus = new Set();
  /** @param {ts.Node} node @param {(string | null)[]} membres @param {string} forme */
  const verdict = (node, membres, forme) => {
    const distincts = new Set(membres.filter((m) => m != null));
    for (const c of cibles) {
      const communs = [...distincts].filter((m) => c.membres.has(m));
      if (communs.length < 2) continue;
      const line = lineOf(sf, node);
      const cle = `${line}|${c.nom}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      findings.push({ line, detail: `${c.nom} recopiée en ${forme} (${communs.map((m) => `'${m}'`).join(', ')})` });
    }
  };
  /** @param {ts.Node} n */
  const walk = (n) => {
    if (ts.isArrayLiteralExpression(n)) {
      if (!estSelectionDerivee(n)) verdict(n, n.elements.filter(ts.isStringLiteralLike).map((e) => e.text), 'tableau');
    } else if (ts.isUnionTypeNode(n)) {
      verdict(n, n.types.map(litType), 'union de types');
    } else if (ts.isObjectLiteralExpression(n)) {
      if (!estTableExhaustive(n)) verdict(n, n.properties.map((p) => keyName(p.name)), 'clés d’objet');
    } else if (ts.isTypeLiteralNode(n)) {
      verdict(n, n.members.map((m) => keyName(m.name)), 'membres de type littéral');
    } else if (ts.isCaseBlock(n)) {
      verdict(n, n.clauses.flatMap((c) => (ts.isCaseClause(c) && ts.isStringLiteralLike(c.expression) ? [c.expression.text] : [])), 'case d’un switch');
    } else if (ts.isBinaryExpression(n)) {
      const lits = litterauxDeChaine(n);
      if (lits) verdict(n, lits, 'chaîne de comparaisons');
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return findings;
}

/** Axes touchés par un côté de soustraction : nom de propriété (`p.x`) ou identifiant nu (`x`).
 * @param {ts.Node} n @returns {Set<string>} */
function axes(n) {
  const out = new Set();
  /** @param {ts.Node} x */
  const walk = (x) => {
    if (ts.isPropertyAccessExpression(x)) out.add(x.name.text);
    else if (ts.isIdentifier(x)) out.add(x.text);
    ts.forEachChild(x, walk);
  };
  walk(n);
  return out;
}

/** `Math.abs(<a> - <b>)` → les axes de la soustraction ; `null` si ce n'en est pas un.
 * @param {ts.Expression} n @returns {Set<string> | null} */
function absDelta(n) {
  if (!ts.isCallExpression(n) || n.arguments.length !== 1) return null;
  const f = n.expression;
  if (!ts.isPropertyAccessExpression(f) || f.name.text !== 'abs' || !ts.isIdentifier(f.expression) || f.expression.text !== 'Math') return null;
  const arg = n.arguments[0];
  if (!ts.isBinaryExpression(arg) || arg.operatorToken.kind !== ts.SyntaxKind.MinusToken) return null;
  return axes(arg);
}

/**
 * La FORMULE de la distance de Chebyshev recopiée INLINE : `Math.max(Math.abs(a.x - b.x),
 * Math.abs(a.y - b.y))` et ses commutations (ordre des axes, ordre des opérandes, opérandes nus ou
 * propriétés). Le NOM n'entre pas dans le scan : `cheb`, `dist`, ou aucun nom du tout, c'est la même
 * recopie du canon `chebyshev` (`src/engine/grid.ts`).
 * @param {{ rel: string, text: string }} file
 * @returns {{ line: number, detail: string }[]}
 */
export function scanChebyshevFormula(file) {
  if (!file.text.includes('Math.abs')) return [];
  const sf = ast(file);
  /** @type {{ line: number, detail: string }[]} */
  const findings = [];
  /** @param {ts.Node} n */
  const walk = (n) => {
    if (ts.isCallExpression(n) && n.arguments.length === 2) {
      const f = n.expression;
      if (ts.isPropertyAccessExpression(f) && f.name.text === 'max' && ts.isIdentifier(f.expression) && f.expression.text === 'Math') {
        const a = absDelta(n.arguments[0]);
        const b = absDelta(n.arguments[1]);
        if (a && b && ((a.has('x') && b.has('y')) || (a.has('y') && b.has('x')))) {
          findings.push({ line: lineOf(sf, n), detail: 'formule de Chebyshev recopiée inline' });
        }
      }
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return findings;
}
