// Garde « docs vivantes » — les références vivantes (docs/*.md, hors docs/plans/ & docs/raw/) ne
// doivent jamais mentir. Deux vérifications déterministes, exit 1 avec la liste fichier:ligne sinon :
//   1. CHEMINS  — tout `src/…` / `scripts/…` cité existe sur le disque (fichier, dossier ou glob).
//   2. SYMBOLES — tout appel de fonction backtiqué (`nomCamel(` / `NomPascal(`) se retrouve dans src/.
//   3. SENS INVERSE — tout chemin `docs/….md` cité par src/ ou scripts/ existe sur le disque.
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
      // Découpe GFM : un `\|` échappé est du CONTENU (ex. une union TS `number \| null`), pas une
      // frontière de colonne — un split naïf décale les colonnes et fait lire de la PROSE comme des
      // symboles de primitive.
      const cols = row.split(/(?<!\\)\|/).map((c) => c.trim())
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

// 4. Catalogue atomique CSS (docs/charte-ui.md, section « Couche atomique — catalogue »), les DEUX
// sens :
//   4a. chaque classe backtiquée `.foo` de la section doit exister comme sélecteur réel dans
//       src/ui/styles/*.css — sinon la doc ment (classe fantôme).
//   4b. chaque classe CANONIQUE (sélecteur de PREMIER NIVEAU, ni pseudo/combinateur/parenthèse) de
//       la zone PARTAGÉE de `src/ui/styles/components.css` doit être citée dans la section — sinon
//       la doc devient incomplète en silence. Zone PARTAGÉE = tout le fichier AVANT le premier bloc
//       de domaine (repéré par le marqueur `DOMAIN_MARKER` ci-dessous, cf. le propre commentaire de
//       section du CSS) ; le fichier place systématiquement ses sections « 1 écran » en QUEUE. La
//       liste de classes est DÉRIVÉE du CSS (parsing des sélecteurs), jamais d'une liste en dur ici.
const CHARTE_MD = 'docs/charte-ui.md'
const COMPONENTS_CSS = 'src/ui/styles/components.css'
const DOMAIN_MARKER = 'ÉCRAN-HUB DE VOYAGE' // 1er bloc de CSS propre-à-un-écran dans components.css
if (existsSync(CHARTE_MD)) {
  const text = readFileSync(CHARTE_MD, 'utf8')
  const lines = text.split('\n')
  const startIdx = lines.findIndex((l) => l.trim() === '## Couche atomique — catalogue')
  if (startIdx >= 0) {
    let endIdx = lines.findIndex((l, i) => i > startIdx && /^## /.test(l))
    if (endIdx < 0) endIdx = lines.length
    const section = lines.slice(startIdx, endIdx).join('\n')

    const CSS_TEXT = walk('src/ui/styles', ['.css']).map((f) => readFileSync(f, 'utf8')).join('\n')

    // Faux positifs à écarter : extensions de fichier (`CLAUDE.md`…) et motifs jocker cités comme
    // ANTI-exemples exprès NON catalogués (`.voyage-*`, `.char-card*`…, cf. prose de la section).
    const FILE_EXTS = new Set(['md', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'mts', 'cjs', 'json', 'css'])
    const seen = new Set()
    const codeRe2 = /`([^`\n]+)`/g
    let mm
    while ((mm = codeRe2.exec(section))) {
      for (const c of mm[1].matchAll(/\.[A-Za-z][\w-]*/g)) {
        const cls = c[0]
        if (mm[1][c.index + cls.length] === '*') continue // motif jocker anti-exemple (`.voyage-*`)
        if (seen.has(cls) || FILE_EXTS.has(cls.slice(1))) continue
        seen.add(cls)
        const rx = new RegExp('\\' + cls + '(?![\\w-])')
        if (!rx.test(CSS_TEXT)) {
          const line = startIdx + lineAt(section, mm.index)
          problems.push({ file: CHARTE_MD, line, kind: 'classe cataloguée absente du CSS', tok: cls })
        }
      }
    }

    // 4b. sens inverse — classes canoniques de components.css (zone partagée) absentes du catalogue.
    if (existsSync(COMPONENTS_CSS)) {
      const cssFull = readFileSync(COMPONENTS_CSS, 'utf8')
      const domainAt = cssFull.indexOf(DOMAIN_MARKER)
      const sharedCss = (domainAt >= 0 ? cssFull.slice(0, domainAt) : cssFull).replace(/\/\*[\s\S]*?\*\//g, '')

      // Premier sélecteur simple d'une liste de sélecteurs (avant tout combinateur hors parenthèses)
      // — exclut les classes NESTED (`.tabs .tab-btn`, `.stat-chip > .sc-label`…) : celles-là sont
      // des sous-parties documentées EN PLUS de leur classe racine, pas des primitives autonomes.
      const firstCompound = (sel) => {
        let depth = 0
        for (let i = 0; i < sel.length; i++) {
          const c = sel[i]
          if (c === '(') depth++
          else if (c === ')') depth--
          else if (depth === 0 && /[\s>+~]/.test(c)) return sel.slice(0, i)
        }
        return sel
      }
      const canonicalClasses = new Set()
      let buf = ''
      for (const ch of sharedCss) {
        if (ch === '{') {
          const sel = buf.trim(); buf = ''
          if (sel && !sel.startsWith('@')) {
            for (const part of sel.split(',')) {
              const compound = firstCompound(part.trim()).replace(/\([^)]*\)/g, '')
              for (const c of compound.matchAll(/\.[A-Za-z][\w-]*/g)) canonicalClasses.add(c[0])
            }
          }
        } else if (ch === '}') buf = ''
        else buf += ch
      }
      for (const cls of canonicalClasses) {
        const rx = new RegExp('\\' + cls + '(?![\\w-])')
        if (!rx.test(section))
          problems.push({ file: CHARTE_MD, line: startIdx + 1, kind: 'classe canonique components.css absente du catalogue', tok: cls })
      }
    }
  }
}

// 5. SENS INVERSE — le code cite la doc. Tout chemin `docs/….md` écrit dans un commentaire ou une
// chaîne de `src/**` / `scripts/**` doit exister sur le disque : une doc supprimée laisse sinon des
// renvois pendants qu'AUCUNE garde ne voit (les sens 1-4 ne lisent que `docs/*.md` et CLAUDE.md).
// Exclusion STRUCTURELLE unique : `docs/plans/…` a sa propre garde dédiée
// (`scripts/docs/check-plans-anchors.mjs`, sens 2 & 3, avec ses exemptions de fixtures au SITE) —
// le doubler ici ne ferait que rejouer ses faux positifs.
const DOC_REF_RE = /\bdocs\/[A-Za-z0-9_./-]*\.md\b/g
// Exemptions AU SITE (fichier|jeton), jamais au fichier entier : un chemin écrit dans un dépôt
// JETABLE monté par un test n'a pas vocation à exister dans celui-ci.
const DOC_REF_SITES_EXEMPTS = new Set([
  'scripts/docs/check-plans-anchors.test.mjs|docs/note.md', // fixture du dépôt jetable de la garde des plans
])
// Ce fichier-ci est hors du sens 5 : il ÉNONCE les jetons exemptés ci-dessus (même patron que
// `FICHIERS_DE_LA_GARDE` dans check-plans-anchors.mjs), il ne les cite pas comme documentation.
const DOC_REF_SELF = 'scripts/docs/check-doc-refs.mjs'
for (const f of [...walk(SRC_DIR, ['.ts', '.tsx', '.js', '.mjs', '.mts', '.json', '.css']),
                 ...walk('scripts', ['.ts', '.tsx', '.js', '.mjs', '.mts', '.json', '.css'])]) {
  const rel = f.replace(/\\/g, '/')
  if (rel === DOC_REF_SELF) continue
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(DOC_REF_RE)) {
    const site = `${rel}|${m[0]}`
    if (m[0].startsWith('docs/plans/') || DOC_REF_SITES_EXEMPTS.has(site)) continue
    if (!existsSync(m[0]))
      problems.push({ file: rel, line: lineAt(text, m.index), kind: 'doc citée mais absente', tok: m[0] })
  }
}

if (problems.length) {
  console.error(`docs:check — ${problems.length} référence(s) morte(s) :`)
  for (const p of problems.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line))
    console.error(`  ${p.file}:${p.line}  [${p.kind}]  ${p.tok}`)
  process.exit(1)
}
console.log(`docs:check — OK (${readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md')).length} docs vivantes, chemins & symboles vérifiés)`)
