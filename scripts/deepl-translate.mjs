#!/usr/bin/env node
/**
 * deepl-translate.mjs — Traduit FIDÈLEMENT des fichiers Markdown (EN -> FR) via l'API DeepL.
 *
 * Pourquoi DeepL et pas un LLM : DeepL traduit LITTÉRALEMENT, il ne reformule ni ne résume.
 * C'est l'outil fidèle qu'un modèle de langage n'est pas.
 *
 * Ce que fait le script : il découpe chaque .md en blocs (séparés par des lignes vides),
 * envoie les blocs de PROSE à DeepL, et laisse INTACTS les tableaux (statblocs) et les blocs
 * de code — pour ne pas casser la mise en forme ni traduire des données de jeu. Il écrit un
 * fichier « <nom>.fr.md » à côté du source (ou dans --out).
 *
 * Prérequis : Node 18+ (fetch natif) + une clé API DeepL dans la variable d'environnement
 * DEEPL_API_KEY (elle finit par « :fx » au tier gratuit).
 *
 * Usage (PowerShell) :
 *   $env:DEEPL_API_KEY = "xxxxxxxx:fx"
 *   node scripts/deepl-translate.mjs "Source/.../12 - Chapter 9 ... .md"                 # un fichier
 *   node scripts/deepl-translate.mjs "Source/Enemy Within Campaign Volume 5 Empire in Ruins"  # un dossier entier (récursif)
 *
 * Options :
 *   --out <dir>   Dossier de sortie (structure miroir). Défaut : à côté de chaque source.
 *   --force       Retraduire même si le .fr.md existe déjà.
 *   --from EN     Langue source (défaut EN).
 *   --to FR       Langue cible (défaut FR).
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'

if (typeof fetch !== 'function') {
  console.error('❌  Node 18+ requis (fetch natif indisponible). Vérifie « node --version ».')
  process.exit(1)
}

const KEY = process.env.DEEPL_API_KEY
if (!KEY) {
  console.error('❌  Clé manquante. Fais :  $env:DEEPL_API_KEY = "ta-cle:fx"  puis relance.')
  process.exit(1)
}
const HOST = KEY.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- arguments ----
const argv = process.argv.slice(2)
const opts = { out: null, force: false, from: 'EN', to: 'FR' }
const positionals = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--out') opts.out = argv[++i]
  else if (a === '--force') opts.force = true
  else if (a === '--from') opts.from = String(argv[++i]).toUpperCase()
  else if (a === '--to') opts.to = String(argv[++i]).toUpperCase()
  else positionals.push(a)
}
if (positionals.length === 0) {
  console.error('Usage : node scripts/deepl-translate.mjs <fichier-ou-dossier> [--out <dir>] [--force] [--from EN] [--to FR]')
  process.exit(1)
}
const targets = positionals

// ---- appels DeepL ----
async function deepl(pathname, body, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${HOST}/v2${pathname}`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if ((res.status === 429 || res.status === 529) && attempt < tries) {
      await sleep(1500 * attempt)
      continue
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`DeepL ${res.status} ${res.statusText} — ${txt.slice(0, 300)}`)
    }
    return res.json()
  }
}

async function getUsage() {
  try {
    const res = await fetch(`${HOST}/v2/usage`, { headers: { Authorization: `DeepL-Auth-Key ${KEY}` } })
    return res.ok ? await res.json() : null // { character_count, character_limit }
  } catch {
    return null
  }
}

async function translateBatch(texts, from, to) {
  if (texts.length === 0) return []
  const json = await deepl('/translate', {
    text: texts,
    source_lang: from,
    target_lang: to,
    preserve_formatting: true,
  })
  return json.translations.map((t) => t.text)
}

// ---- Markdown : découpe + protection des tableaux / code ----
function isProtected(block) {
  const t = block.trim()
  if (!t) return true // vide / séparateur
  if (t.startsWith('```') || t.startsWith('~~~')) return true // bloc de code
  const lines = t.split('\n')
  const tableLike = lines.filter((l) => /^\s*\|.*\|\s*$/.test(l) || /\|\s*:?-{2,}/.test(l))
  if (tableLike.length >= 2 && tableLike.length >= lines.length - 1) return true // tableau (statbloc)
  return false
}

async function translateMarkdown(md, from, to) {
  // Segments alternés : [bloc, séparateur, bloc, séparateur, ...] — on préserve l'espacement exact.
  const segments = md.split(/(\n(?:[ \t]*\n)+)/)
  const indices = []
  segments.forEach((seg, i) => {
    if (i % 2 === 0 && !isProtected(seg)) indices.push(i)
  })

  const MAX_TEXTS = 45
  const MAX_CHARS = 90_000
  let batch = []
  let chars = 0
  const flush = async () => {
    if (!batch.length) return
    const out = await translateBatch(batch.map((i) => segments[i]), from, to)
    batch.forEach((i, k) => { segments[i] = out[k] })
    batch = []
    chars = 0
  }
  for (const i of indices) {
    const len = segments[i].length
    if (batch.length >= MAX_TEXTS || chars + len > MAX_CHARS) await flush()
    batch.push(i)
    chars += len
  }
  await flush()
  return segments.join('')
}

// ---- fichiers ----
function outPathFor(src, root) {
  const base = path.basename(src).replace(/\.md$/i, '') + '.fr.md'
  if (opts.out) {
    const rel = path.relative(root, path.dirname(src))
    return path.join(opts.out, rel, base)
  }
  return path.join(path.dirname(src), base)
}

async function collect(t) {
  if (statSync(t).isFile()) return [t]
  const out = []
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) await walk(p)
      else if (e.isFile() && /\.md$/i.test(e.name) && !/\.fr\.md$/i.test(e.name)) out.push(p)
    }
  }
  await walk(t)
  return out.sort()
}

async function collectAll(list) {
  const items = []
  const seen = new Set()
  for (const t of list) {
    if (!existsSync(t)) {
      console.error(`⚠️   Introuvable, ignoré : ${t}`)
      continue
    }
    const root = statSync(t).isDirectory() ? t : path.dirname(t)
    for (const src of await collect(t)) {
      if (seen.has(src)) continue
      seen.add(src)
      items.push({ src, root })
    }
  }
  return items
}

// ---- main ----
const items = await collectAll(targets)
if (!items.length) {
  console.error('Aucun fichier .md à traduire.')
  process.exit(1)
}

const before = await getUsage()
if (before) {
  console.log(`ℹ️  Quota DeepL : ${before.character_count.toLocaleString('fr')} / ${before.character_limit.toLocaleString('fr')} caractères ce mois.`)
}
console.log(`📄  ${items.length} fichier(s) à traduire (${opts.from} → ${opts.to}).\n`)

let done = 0
let skipped = 0
for (const { src, root } of items) {
  const dest = outPathFor(src, root)
  if (existsSync(dest) && !opts.force) {
    console.log(`⏭️   ${path.basename(dest)} existe déjà (--force pour écraser)`)
    skipped++
    continue
  }
  process.stdout.write(`🔄  ${path.basename(src)} … `)
  try {
    const md = await readFile(src, 'utf8')
    const fr = await translateMarkdown(md, opts.from, opts.to)
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, fr, 'utf8')
    console.log(`✅ → ${path.relative(process.cwd(), dest)}`)
    done++
  } catch (e) {
    console.log(`❌ ${e.message}`)
  }
}

const after = await getUsage()
console.log(`\n✨  Terminé : ${done} traduit(s), ${skipped} ignoré(s).`)
if (after) {
  console.log(`ℹ️  Quota DeepL : ${after.character_count.toLocaleString('fr')} / ${after.character_limit.toLocaleString('fr')} caractères.`)
}
