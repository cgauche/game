// Mécanique de scan des gardes « SOURCE UNIQUE » lues à l'AST (#1440) — TypeScript compiler API,
// jamais une regex de ligne : une recopie MULTI-LIGNE (`z.enum([\n 'a',\n 'b'\n])`) échappe à tout
// motif mono-ligne, et c'est exactement la forme qu'un auteur pressé produit. Deux scans, un seul
// lecteur de corpus :
//  - `scanUnionRecopies` : un littéral de TABLEAU ou une union de types littéraux qui reproduit ≥2
//    membres d'un tuple canon (`STAKE_FORMS`, `AVAILABILITIES`…) hors de son foyer ;
//  - `scanDefinitions` : les DÉCLARATIONS d'un nom (fonction, const-fonction, propriété-fonction),
//    pour verrouiller qu'une primitive n'a qu'une définition dans l'arbre.
// Module ESM pur (opère sur du texte source), consommé par les tests de garde.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

/** Corpus `.ts`/`.tsx` sous des dossiers racine, récursif — lecteur PARTAGÉ des gardes AST.
 * @param {string} root racine absolue du projet
 * @param {string[]} dirs dossiers relatifs à `root`
 * @returns {{ rel: string, code: string }[]} chemins relatifs (séparateurs `/`) + contenu */
export function tsSources(root, dirs) {
  /** @type {{ rel: string, code: string }[]} */
  const out = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e)) out.push({ rel: relative(root, p).split('\\').join('/'), code: readFileSync(p, 'utf8') });
    }
  };
  for (const d of dirs) walk(join(root, d));
  return out;
}

/** @param {string} rel @param {string} code @returns {ts.SourceFile} */
const parse = (rel, code) => ts.createSourceFile(rel, code, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

/** @param {ts.SourceFile} sf @param {ts.Node} n @returns {number} ligne 1-based */
const lineOf = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

/** SÉLECTION DÉRIVÉE : le tableau est l'argument d'un `.extract(…)`/`.exclude(…)` posé sur un schéma
 *  du canon (`availabilitySchema.extract(['Limitée', 'Rare'])`). Le compilateur borne cet argument aux
 *  membres du canon : un membre renommé/retiré ne compile plus — c'est une DÉRIVATION verrouillée par
 *  construction, pas une recopie qui divergerait en silence.
 * @param {ts.ArrayLiteralExpression} n @returns {boolean} */
function estSelectionDerivee(n) {
  const p = n.parent;
  return !!p && ts.isCallExpression(p) && p.arguments[0] === n
    && ts.isPropertyAccessExpression(p.expression) && (p.expression.name.text === 'extract' || p.expression.name.text === 'exclude');
}

/**
 * Recopies d'un tuple canon dans UN fichier. Une recopie = un littéral de tableau (`['a','b']`,
 * `z.enum([…])`, `new Set([…])`) ou une union de types littéraux (`'a' | 'b'`) portant ≥2 membres
 * DISTINCTS du canon — divergente ou non : c'est la duplication qui est la faute, la divergence
 * n'en est que la conséquence tardive.
 * @param {string} rel @param {string} code
 * @param {{ nom: string, membres: readonly string[] }[]} canons
 * @returns {{ line: number, detail: string }[]}
 */
export function scanUnionRecopies(rel, code, canons) {
  const cibles = canons.map((c) => ({ nom: c.nom, membres: new Set(c.membres) }));
  if (!cibles.some((c) => [...c.membres].filter((m) => code.includes(`'${m}'`) || code.includes(`"${m}"`)).length >= 2)) return [];
  const sf = parse(rel, code);
  /** @type {{ line: number, detail: string }[]} */
  const findings = [];
  /** @param {ts.Node} node @param {string[]} membres */
  const verdict = (node, membres) => {
    const vus = new Set(membres);
    for (const c of cibles) {
      const communs = [...vus].filter((m) => c.membres.has(m));
      if (communs.length >= 2) findings.push({ line: lineOf(sf, node), detail: `${c.nom} recopiée (${communs.map((m) => `'${m}'`).join(', ')})` });
    }
  };
  /** @param {ts.Node} n */
  const walk = (n) => {
    if (ts.isArrayLiteralExpression(n)) {
      if (!estSelectionDerivee(n)) verdict(n, n.elements.filter(ts.isStringLiteralLike).map((e) => e.text));
    } else if (ts.isUnionTypeNode(n)) {
      verdict(n, n.types.filter((t) => ts.isLiteralTypeNode(t) && ts.isStringLiteralLike(t.literal)).map((t) => /** @type {ts.StringLiteralLike} */ (/** @type {ts.LiteralTypeNode} */ (t).literal).text));
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return findings;
}

/**
 * DÉCLARATIONS d'un nom dans UN fichier : `function nom(…)`, `const nom = (…) => …` / `= function`,
 * `nom(…) {}` de classe, et `nom: (…) => …` en propriété d'objet. Les IMPORTS n'en sont pas (c'est
 * la consommation du canon, précisément ce qu'on veut).
 * @param {string} rel @param {string} code @param {string} nom
 * @returns {{ line: number, detail: string }[]}
 */
export function scanDefinitions(rel, code, nom) {
  if (!code.includes(nom)) return [];
  const sf = parse(rel, code);
  /** @type {{ line: number, detail: string }[]} */
  const findings = [];
  const estFonction = (/** @type {ts.Node | undefined} */ init) => !!init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init));
  /** @param {ts.Node} n */
  const walk = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === nom) findings.push({ line: lineOf(sf, n), detail: `function ${nom}` });
    else if (ts.isMethodDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nom) findings.push({ line: lineOf(sf, n), detail: `méthode ${nom}` });
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nom && estFonction(n.initializer)) findings.push({ line: lineOf(sf, n), detail: `const ${nom} = …` });
    else if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === nom && estFonction(n.initializer)) findings.push({ line: lineOf(sf, n), detail: `propriété ${nom}: …` });
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return findings;
}
