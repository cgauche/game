// Détecteur de consommateurs PAR CHAMP (#903 — « qui lit le champ `spec` sur une référence de
// dotation ? »). Distinct de `entityConsumers.mjs` (qui répond « qui cite cet ID d'entité »,
// consommé par `build-entity-orphans.mjs`) : ici, la question porte sur un CHAMP d'un TYPE de
// donnée structuré (`TrappingRef.spec`), pas sur un id de catalogue.
//
// DÉFINITION D'UNE LECTURE — un champ `F` d'un type `T` est LU en un site si :
//   (a) un PARAMÈTRE ou une VARIABLE est explicitement ANNOTÉ `T` (texte du type annoté contient
//       `T` en mot entier — couvre `T`, `T[]`, `T | undefined`, `Array<T>`, `Record<string, T>`) ET
//       porte un accès `.F` (ou `['F']` littéral) sur l'identifiant lié, DANS LE CORPS DE LA
//       FONCTION englobante (paramètre) ou du RESTE DU FICHIER (variable de module) ; ou une
//       déstructuration `const { F } = ident` de ce même identifiant dans cette même portée ;
//   (b) un paramètre ou une variable annotée `T` est DÉSTRUCTURÉ DIRECTEMENT (`({ F }: T) => …`) —
//       chaque élément nommé du motif compte comme une lecture immédiate de `F`.
//
// ANGLES MORTS ASSUMÉS (déclarés, pas mesurés à zéro) :
//   - un paramètre de callback SANS annotation explicite, inféré depuis un site d'appel typé
//     (`refs.map(r => r.spec)` où `refs: TrappingRef[]` mais `r` n'est pas annoté) échappe à la
//     détection — nécessiterait un vérificateur de types complet (`ts.Program` + `TypeChecker`),
//     hors périmètre de ce détecteur SYNTAXIQUE ;
//   - la portée d'une VARIABLE de module est le FICHIER ENTIER (pas juste « après sa déclaration »)
//     — un identifiant de MÊME NOM réutilisé pour un type DIFFÉRENT plus loin dans le même fichier
//     compterait à tort comme lecteur (id-collision de nommage, non mesurée) ;
//   - un retour de fonction annoté `T` n'est PAS suivi jusqu'à l'appelant (l'expression retournée
//     est anonyme côté appelant sans réannotation) ;
//   - un spread (`{ ...ref }`) ne cite aucun champ nommé et ne compte donc AUCUNE lecture — correct
//     pour ce détecteur, mais un tel site peut légitimement consommer tous les champs en aval.
import ts from 'typescript'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** Fichiers de PRODUCTION `.ts(x)` sous `dir`, hors `*.test.ts(x)`. */
export function listProdFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) {
      listProdFiles(p, out)
      continue
    }
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue
    out.push(p)
  }
  return out
}

function typeMentions(typeNode, sf, typeName) {
  if (!typeNode) return false
  return new RegExp(`\\b${typeName}\\b`).test(typeNode.getText(sf))
}

function fnBodyAncestor(node) {
  let n = node.parent
  while (n) {
    if (
      ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) ||
      ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n)
    ) {
      return n.body ?? null
    }
    n = n.parent
  }
  return null
}

function collectAccesses(scopeNode, sf, name, fieldSet, hits, relFile) {
  if (!scopeNode) return
  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name) {
      const field = node.name.text
      if (fieldSet.has(field)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
        hits.push({ field, file: relFile, line: line + 1 })
      }
    }
    if (
      ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name &&
      node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression)
    ) {
      const field = node.argumentExpression.text
      if (fieldSet.has(field)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
        hits.push({ field, file: relFile, line: line + 1 })
      }
    }
    if (
      ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) &&
      node.initializer && ts.isIdentifier(node.initializer) && node.initializer.text === name
    ) {
      for (const el of node.name.elements) {
        if (el.dotDotDotToken || !ts.isIdentifier(el.name)) continue
        const field = el.propertyName ? el.propertyName.getText(sf) : el.name.text
        if (fieldSet.has(field)) {
          const { line } = sf.getLineAndCharacterOfPosition(el.getStart(sf))
          hits.push({ field, file: relFile, line: line + 1 })
        }
      }
    }
    node.forEachChild(visit)
  }
  visit(scopeNode)
}

function directDestructureHits(bindingPattern, sf, fieldSet, hits, relFile) {
  for (const el of bindingPattern.elements) {
    if (el.dotDotDotToken || !ts.isIdentifier(el.name)) continue
    const field = el.propertyName ? el.propertyName.getText(sf) : el.name.text
    if (fieldSet.has(field)) {
      const { line } = sf.getLineAndCharacterOfPosition(el.getStart(sf))
      hits.push({ field, file: relFile, line: line + 1 })
    }
  }
}

/**
 * Sites de lecture de `fields` sur le type `typeName`, à travers `files` (chemins absolus,
 * `listProdFiles`). Rend `[{ field, file, line }]` — `file` relatif à `rootDir`.
 */
export function scanFieldReads(typeName, fields, files, rootDir) {
  const fieldSet = new Set(fields)
  const hits = []
  const wordRe = new RegExp(`\\b${typeName}\\b`)
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    if (!wordRe.test(text)) continue
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    const relFile = relative(rootDir, file).split(sep).join('/')

    function visit(node) {
      if ((ts.isParameter(node) || ts.isVariableDeclaration(node)) && node.type && typeMentions(node.type, sf, typeName)) {
        if (ts.isIdentifier(node.name)) {
          const scope = ts.isParameter(node) ? fnBodyAncestor(node) : (fnBodyAncestor(node) ?? sf)
          collectAccesses(scope, sf, node.name.text, fieldSet, hits, relFile)
        } else if (ts.isObjectBindingPattern(node.name)) {
          directDestructureHits(node.name, sf, fieldSet, hits, relFile)
        }
      }
      node.forEachChild(visit)
    }
    visit(sf)
  }
  return hits
}

/** Regroupe des hits `[{field,file,line}]` en `Map<field, hit[]>`, ordre stable = `fields`. */
export function groupByField(fields, hits) {
  const byField = new Map(fields.map((f) => [f, []]))
  for (const h of hits) byField.get(h.field)?.push(h)
  return byField
}
