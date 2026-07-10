// Garde « docs vivantes » — les références vivantes (docs/*.md, hors docs/plans/ & docs/raw/) ne
// doivent jamais mentir. Deux vérifications déterministes, exit 1 avec la liste fichier:ligne sinon :
//   1. CHEMINS  — tout `src/…` / `scripts/…` cité existe sur le disque (fichier, dossier ou glob).
//   2. SYMBOLES — tout appel de fonction backtiqué (`nomCamel(` / `NomPascal(`) se retrouve dans src/.
// Un métavariable `<…>` qui suit un chemin le tronque au dossier (ex. `src/ui/jetProps/<hook>.tsx`
// → on valide `src/ui/jetProps/`). Re-run : node scripts/docs/check-doc-refs.mjs (npm run docs:check).
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DOCS_DIR = 'docs'
const SRC_DIR = 'src'

// --- index des identifiants présents dans src/ (= « grep dans src/ ») ---
function walk(dir, exts, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    let s; try { s = statSync(p) } catch { continue }
    if (s.isDirectory()) { if (e !== 'node_modules') walk(p, exts, acc) }
    else if (exts.some((x) => e.endsWith(x))) acc.push(p)
  }
  return acc
}
const SRC_IDENTS = new Set()
for (const f of walk(SRC_DIR, ['.ts', '.tsx', '.js', '.mjs', '.mts', '.json', '.css'])) {
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(/[A-Za-z_$][\w$]*/g)) SRC_IDENTS.add(m[0])
}

const isDir = (p) => { try { return statSync(p).isDirectory() } catch { return false } }

/** Un chemin cité existe-t-il ? (fichier, dossier, ou glob `*` dont le dossier parent existe & matche). */
function pathExists(tok) {
  if (tok.includes('*')) {
    const slash = tok.lastIndexOf('/')
    const dir = tok.slice(0, slash) || '.'
    if (!isDir(dir)) return false
    const rx = new RegExp('^' + tok.slice(slash + 1).replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$')
    try { return readdirSync(dir).some((n) => rx.test(n)) } catch { return false }
  }
  return existsSync(tok)
}

const problems = [] // { file, line, kind, tok }
const lineAt = (text, index) => text.slice(0, index).split('\n').length

// readdirSync(DOCS_DIR) est NON récursif : ne liste que les fichiers .md à plat dans docs/. Les
// sous-dossiers (docs/plans/, docs/raw/, docs/decisions/…) sont donc déjà hors périmètre par
// construction — docs/plans/ (snapshots datés) et docs/decisions/ (export d'issues GitHub, corps
// citant des chemins historiques ayant le droit d'être morts) n'ont pas besoin d'exclusion explicite.
for (const file of readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'))) {
  const rel = `${DOCS_DIR}/${file}`
  const text = readFileSync(join(DOCS_DIR, file), 'utf8')

  // 1. CHEMINS src/… ou scripts/…
  const pathRe = /\b(?:src|scripts)\/[A-Za-z0-9_./*-]+/g
  let m
  while ((m = pathRe.exec(text))) {
    let tok = m[0].replace(/\.+$/, '') // point de fin de phrase
    // métavariable `<…>` juste après → chemin tronqué : on valide le dossier parent.
    if (text[m.index + m[0].length] === '<') tok = tok.includes('/') ? tok.slice(0, tok.lastIndexOf('/') + 1) : tok
    if (!pathExists(tok)) problems.push({ file: rel, line: lineAt(text, m.index), kind: 'chemin mort', tok })
  }

  // 2. SYMBOLES — appels de fonction backtiqués (`nomCamel(` / `NomPascal(`), mixte-casse only.
  const codeRe = /`([^`\n]+)`/g
  while ((m = codeRe.exec(text))) {
    const span = m[1]
    for (const c of span.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
      const id = c[1]
      if (!/[a-z]/.test(id) || !/[A-Z]/.test(id)) continue // exige camelCase/PascalCase (ex. `applyOps`, pas `t`/`MAX`)
      if (!SRC_IDENTS.has(id)) {
        const line = lineAt(text, m.index) + span.slice(0, c.index).split('\n').length - 1
        problems.push({ file: rel, line, kind: 'symbole absent', tok: `${id}()` })
      }
    }
  }
}

// 3. TABLE « Primitives partagées » (CLAUDE.md, racine du dépôt — hors docs/) : chaque symbole
// backtiqué de la colonne « Primitive (source unique) » doit résoudre à un EXPORT réel de src/ —
// cause-racine des fantômes historiques (ex. `inBattle` cité alors que le fichier n'exportait que
// `inBattleId`, `ParticipantRow` jamais exporté nulle part). Vérifié contre l'EXPORT global de src/
// (pas juste la colonne « Fichier » de la ligne : la prose y cite légitimement des primitives
// AUXILIAIRES/consommatrices qui vivent dans leur PROPRE fichier — `ForceDoorModal`/`CharFrame`/
// `ResilienceButton`… ; une carte symbole→fichier-de-la-ligne stricte re-déclencherait ces faux positifs).
const CLAUDE_MD = 'CLAUDE.md'
if (existsSync(CLAUDE_MD)) {
  const text = readFileSync(CLAUDE_MD, 'utf8')
  const lines = text.split('\n')
  const headerIdx = lines.findIndex((l) => /^\|\s*Besoin\s*\|\s*Primitive/.test(l))
  if (headerIdx >= 0) {
    const EXPORTED_SYMS = new Set()
    for (const f of walk(SRC_DIR, ['.ts', '.tsx', '.mjs', '.mts'])) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g)) EXPORTED_SYMS.add(m[1])
      for (const m of src.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) EXPORTED_SYMS.add(m[1])
      for (const m of src.matchAll(/export\s*\{([^}]*)\}/g))
        for (const part of m[1].split(','))
          if (part.trim()) EXPORTED_SYMS.add((part.split(/\s+as\s+/).pop() ?? part).trim())
    }
    // Corps du tableau : toute ligne `| … |` qui suit le header/séparateur, jusqu'à la 1re ligne non-tableau.
    for (let i = headerIdx + 2; i < lines.length; i++) {
      const row = lines[i]
      if (!row.startsWith('|')) break
      const cols = row.split('|').map((c) => c.trim())
      const primitiveCol = cols[2] ?? ''
      for (const span of primitiveCol.matchAll(/`([^`\n]+)`/g)) {
        if (/\.(ts|tsx|mjs|mts)\b/.test(span[1])) continue // mention de FICHIER (ex. `seaVoyageFlow.ts`), pas un symbole
        for (const c of span[1].matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
          const id = c[1]
          if (!/[a-z]/.test(id) || !/[A-Z]/.test(id)) continue // camelCase/PascalCase only (cf. check 2)
          if (!EXPORTED_SYMS.has(id))
            problems.push({ file: CLAUDE_MD, line: i + 1, kind: 'primitive fantôme (aucun export src/)', tok: `${id}` })
        }
      }
    }
  }
}

if (problems.length) {
  console.error(`docs:check — ${problems.length} référence(s) morte(s) :`)
  for (const p of problems.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line))
    console.error(`  ${p.file}:${p.line}  [${p.kind}]  ${p.tok}`)
  process.exit(1)
}
console.log(`docs:check — OK (${readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md')).length} docs vivantes, chemins & symboles vérifiés)`)
