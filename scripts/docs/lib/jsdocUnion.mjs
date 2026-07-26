// Socle PARTAGÉ des générateurs de doc « vocabulaire » (#298bis) : lecture d'une union discriminée
// TypeScript par AST (`ts.createSourceFile` — jamais de regex sur les accolades, les unions imbriquent
// des littéraux d'objet et des intersections), extraction du JSDoc de chaque membre, et écriture/
// vérification du .md généré. Consommé par scripts/docs/build-effects.mjs (union `Effect` de
// src/state/scene.ts) et scripts/docs/build-vocabulaire.mjs (unions `GameOp` de src/engine/ops.ts,
// `Condition`/`Flow`/`EffectTrigger`/`EffectTargeting` de src/engine/flowCore.ts).
import ts from 'typescript'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

/** Abréviations FR à ne PAS prendre pour une fin de phrase (« ex. », « l. », « p. »… — sinon un
 *  « (ex. » tronque le rôle en pleine parenthèse ouverte). */
export const ABBR = new Set(['ex', 'cf', 'l', 'p', 'ch', 'art', 'etc', 'n', 'vs', 'c'])

/** 1re phrase d'un corps de JSDoc déjà aplati, abréviations FR exclues des coupures. */
export function firstSentence(body) {
  const re = /\.(?=\s|$)/g
  let m
  while ((m = re.exec(body))) {
    const before = body.slice(0, m.index)
    const word = (before.match(/([A-Za-zÀ-ÿ]+)$/) ?? [])[1]?.toLowerCase()
    if (word && ABBR.has(word)) continue
    return body.slice(0, m.index + 1)
  }
  return body
}

/** Corps APLATI du DERNIER bloc `/** … *​/` d'un fragment de source (`null` si aucun). */
export function jsdocBody(between) {
  const matches = [...between.matchAll(/\/\*\*[\s\S]*?\*\//g)]
  if (!matches.length) return null
  return matches[matches.length - 1][0]
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 1re phrase du dernier JSDoc d'un fragment (rôle affiché en table). */
export function jsdocRole(between) {
  const body = jsdocBody(between)
  return body == null ? null : firstSentence(body)
}

/** Charge un fichier source et rend `{ text, sf }`. */
export function loadSource(path) {
  const text = readFileSync(path, 'utf8')
  return { text, sf: ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true) }
}

/** Alias de type NOMMÉ d'un fichier (fail-fast : un vocabulaire renommé doit casser bruyamment). */
export function findAlias(sf, name, tool, path) {
  let found
  sf.forEachChild((node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === name) found = node
  })
  if (!found) {
    console.error(`${tool} — type alias « ${name} » introuvable dans ${path}`)
    process.exit(1)
  }
  return found
}

/** JSDoc porté par la DÉCLARATION d'alias elle-même (préambule du vocabulaire), corps aplati —
 *  lu dans la trivia de tête de la déclaration (`getFullStart` → `getStart`). */
export function aliasDoc(text, alias, sf) {
  return jsdocBody(text.slice(alias.getFullStart(), alias.getStart(sf)))
}

/**
 * Membres d'une union discriminée, avec leur JSDoc.
 * `discriminant` : nom de la propriété littérale qui NOMME le membre (`type`, `op`, `kind`).
 * Options :
 *  - `allowLiterals` : un membre `'foo'` (littéral de chaîne) est accepté et nommé `foo` ;
 *  - `fallbackRole`  : rôle attribué à un membre qui est une simple RÉFÉRENCE de type sans JSDoc.
 * Rend `[{ name, fieldGroups, role }]` — les formes en double (même `name`) sont FUSIONNÉES,
 * `fieldGroups` accumulant chaque forme.
 */
export function readUnionMembers(sf, text, alias, discriminant, tool, opts = {}) {
  const union = alias.type
  if (!ts.isUnionTypeNode(union)) {
    console.error(`${tool} — « ${alias.name.text} » n'est pas une union`)
    process.exit(1)
  }

  const readTypeLiteral = (member, prevEnd) => {
    let name = null
    const fields = []
    for (const prop of member.members) {
      if (!ts.isPropertySignature(prop)) continue
      const pname = prop.name.getText(sf)
      if (pname === discriminant && prop.type && ts.isLiteralTypeNode(prop.type) && ts.isStringLiteral(prop.type.literal)) {
        name = prop.type.literal.text
        continue
      }
      fields.push(pname + (prop.questionToken ? '?' : ''))
    }
    if (!name) {
      if (opts.allowLiterals && fields.length) return { name: `{ ${fields[0]} … }`, fields: fields.slice(1) }
      console.error(`${tool} — membre de l'union sans propriété « ${discriminant} » littérale (autour de ${text.slice(prevEnd, prevEnd + 40)}…)`)
      process.exit(1)
    }
    return { name, fields }
  }

  const rows = []
  let prevEnd = union.types.pos
  for (const member of union.types) {
    const between = text.slice(prevEnd, member.getStart(sf))
    const role = jsdocRole(between)
    const inner = ts.isParenthesizedTypeNode(member) ? member.type : member
    if (ts.isIntersectionTypeNode(inner)) {
      // `({ type: '…'; … } & Spec)` : le littéral porte le discriminant, les autres membres (référence
      // de type) sont notés en champ « spread » `...Nom`.
      const literal = inner.types.find((t) => ts.isTypeLiteralNode(t))
      if (!literal) {
        console.error(`${tool} — intersection sans littéral discriminant (autour de ${text.slice(prevEnd, prevEnd + 40)}…)`)
        process.exit(1)
      }
      const { name, fields } = readTypeLiteral(literal, prevEnd)
      for (const t of inner.types) {
        if (t === literal) continue
        if (ts.isTypeReferenceNode(t)) fields.push(`...${t.typeName.getText(sf)}`)
      }
      rows.push({ name, fieldGroups: [fields], role })
    } else if (ts.isTypeLiteralNode(inner)) {
      const { name, fields } = readTypeLiteral(inner, prevEnd)
      rows.push({ name, fieldGroups: [fields], role })
    } else if (opts.allowLiterals && ts.isLiteralTypeNode(inner) && ts.isStringLiteral(inner.literal)) {
      rows.push({ name: inner.literal.text, fieldGroups: [], role })
    } else if (ts.isTypeReferenceNode(inner)) {
      rows.push({ name: inner.typeName.getText(sf), fieldGroups: [], role: role ?? opts.fallbackRole ?? null })
    } else {
      console.error(`${tool} — membre d'union non supporté (kind ${ts.SyntaxKind[member.kind]})`)
      process.exit(1)
    }
    prevEnd = member.getEnd()
  }

  // Fusion des formes en double (ex. `setTime` : `phase` OU `hour`+`minute?` ; `rollTable` : `rows`
  // INLINE OU `tableId`) en UNE ligne.
  const merged = []
  const byName = new Map()
  for (const r of rows) {
    if (byName.has(r.name)) {
      const existing = byName.get(r.name)
      existing.fieldGroups.push(...r.fieldGroups)
      if (!existing.role && r.role) existing.role = r.role
    } else {
      const copy = { name: r.name, fieldGroups: [...r.fieldGroups], role: r.role }
      byName.set(r.name, copy)
      merged.push(copy)
    }
  }
  return { rows: merged, rawCount: union.types.length }
}

/** Rendu des champs d'une ligne : formes séparées par ` \| ` (échappé pour la table Markdown). */
export function renderFields(fieldGroups) {
  const nonEmpty = fieldGroups.filter((g) => g.length)
  if (!nonEmpty.length) return '—'
  return nonEmpty.map((g) => g.map((f) => `\`${f}\``).join(', ')).join(' \\| ')
}

/**
 * Écrit le .md — ou, en mode `--check` (chaîné dans `npm run docs:check`), régénère en mémoire,
 * compare au committé et sort en erreur ACTIONNABLE. Jamais d'écriture en mode `--check`.
 * C'est la garde d'exhaustivité : une entrée ajoutée à l'union sans régénération = CI rouge.
 */
export function emitOrCheck({ out, path, check, staleMsg, rerunMsg, okMsg, writeMsg }) {
  if (check) {
    const current = existsSync(path) ? readFileSync(path, 'utf8') : null
    if (current !== out) {
      console.error(staleMsg)
      console.error(rerunMsg)
      process.exit(1)
    }
    console.log(okMsg)
  } else {
    writeFileSync(path, out)
    console.log(writeMsg)
  }
}
