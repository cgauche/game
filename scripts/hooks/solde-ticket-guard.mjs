// Hook PreToolUse(Bash|PowerShell) : demande utilisateur 2026-07-14 (verbatim) — « J'en ai marre
// que tu donne un ticket a un agent, commit et consigne les résultats dans le ticket tout en le
// fermant, et oubliant que potentiellement il n'a pas bien fait son boulot ou qu'il a detecter un
// problème qu'il a consiédéré comme hors périmetre et que tu n'as pas mis dans un nouveau ticket ».
// La FERMETURE d'un ticket au commit devient mécaniquement impossible sans un SOLDE écrit
// (`.claude/soldes/<N>.md`) : preuve de vérification orchestrateur + disposition de chaque reste.
//
// Extension même jour (verbatim) — « De la même maniere, apres un certain nombre de ticket fermé,
// il faudrait lancer une review adversarial. Ou a chaque ticket ... c'est peut etre la même régle
// finalement. A toi de voir » : arbitrage orchestrateur — LES DEUX niveaux dans le MÊME hook.
// (1) chaque solde porte sa propre réfutation adversariale (verdict CONFIRMÉ/PARTIEL/RÉFUTÉ) ;
// (2) tous les `PALIER` tickets fermés, une revue adversariale de PALIER (cumul) est exigée avant
// toute nouvelle fermeture.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

// Motif de fermeture repris du closer post-commit (`scripts/git-hooks/post-commit`) : mêmes
// mots-clefs, mais capturés ICI sur le texte ENTIER de la commande (couvre les here-strings/heredocs
// `git commit -m "$(cat <<EOF ... EOF)"` où le message est packé dans la commande shell elle-même).
const CLOSE_KEYWORD_RE = /(corrige|fixe?s?|closes?|ferme)\s+#(\d+)/gi

/** Numéros de ticket que la commande FERME, dédupliqués/triés. `[]` si la commande n'est pas un
 *  `git commit`, ou si aucun mot-clef de fermeture n'apparaît. */
export function extractClosedIssues(command) {
  if (!command || !/git\s+commit\b/i.test(command)) return []
  const nums = new Set()
  for (const m of command.matchAll(CLOSE_KEYWORD_RE)) nums.add(Number(m[2]))
  return [...nums].sort((a, b) => a - b)
}

const VERIFIE_RE = /VERIFIE\s*:\s*(.+)/i
const MIN_VERIFIE_LEN = 40
// La section s'arrête au prochain titre, à la première ligne VIDE (le pied du fichier — date,
// notes — vit après un blanc), ou à la fin du fichier.
const RESTES_RE = /##\s*Restes\s*\n([\s\S]*?)(?:\n\s*\n|\n##|$)/i
const DISPOSITION_RE = /^-\s*.+->\s*(#\d+|corrigé dans ce commit|RAS\s*:\s*\S.*)\s*$/iu
const REFUTATION_RE = /##\s*R[ée]futation\s*\n([\s\S]*?)(?:\n\s*\n|\n##|$)/i
const VERDICT_RE = /verdict\s*:\s*([A-Za-zÀ-ÖØ-öø-ÿ]+)/i
const MIN_REFUTATION_LEN = 40
const PALIER = 10
const MIN_REVUE_PALIER_LEN = 80

/** `CONFIRMÉ`/`confirme`/`CONFIRME` → `CONFIRME` (compare sans accent, insensible à la casse). */
function normalizeVerdict(word) {
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
}

/** Longueur de texte hors la ligne `verdict: …` elle-même (mesure la SYNTHÈSE, pas le mot-clef). */
function lenWithoutVerdictLine(text) {
  return text.replace(VERDICT_RE, '').trim().length
}

/** Section `## Réfutation` d'un solde : présence, verdict reconnu, longueur de synthèse.
 *  `refuted: true` si le verdict est RÉFUTÉ — porte alors sa propre entrée dans `problems`
 *  (« un ticket réfuté ne se ferme pas »), le solde est TOUJOURS non conforme dans ce cas. */
function checkRefutationSection(content) {
  const problems = []
  const m = REFUTATION_RE.exec(content)
  if (!m) {
    problems.push('section "## Réfutation" absente (verdict adversarial obligatoire)')
    return { problems, refuted: false }
  }
  const body = m[1]
  const vMatch = VERDICT_RE.exec(body)
  if (!vMatch) {
    problems.push('ligne "verdict: CONFIRMÉ|PARTIEL|RÉFUTÉ" absente dans "## Réfutation"')
    return { problems, refuted: false }
  }
  const verdict = normalizeVerdict(vMatch[1])
  if (!['CONFIRME', 'PARTIEL', 'REFUTE'].includes(verdict)) {
    problems.push(`verdict "${vMatch[1]}" non reconnu dans "## Réfutation" (attendu CONFIRMÉ/PARTIEL/RÉFUTÉ)`)
    return { problems, refuted: false }
  }
  const descLen = lenWithoutVerdictLine(body)
  if (descLen < MIN_REFUTATION_LEN) {
    problems.push(`"## Réfutation" trop maigre (${descLen} car. hors verdict, ${MIN_REFUTATION_LEN} requis — qui a attaqué quoi, sur le diff/DoD du ticket)`)
  }
  const refuted = verdict === 'REFUTE'
  if (refuted) problems.push('verdict RÉFUTÉ : un ticket réfuté ne se ferme pas')
  return { problems, refuted }
}

/** Valide le CONTENU d'un solde (PUR, testable indépendamment du filesystem/de la date système).
 *  `today` = date du jour en `YYYY-MM-DD`. */
export function validateSolde(content, today) {
  if (!content) return { ok: false, problems: ['fichier absent'], refuted: false }

  const problems = []

  const vMatch = VERIFIE_RE.exec(content)
  if (!vMatch) {
    problems.push('ligne "VERIFIE:" absente')
  } else if (vMatch[1].trim().length < MIN_VERIFIE_LEN) {
    problems.push(`"VERIFIE:" trop court (${vMatch[1].trim().length} car., ${MIN_VERIFIE_LEN} requis — décrire concrètement la vérification faite)`)
  }

  const restesMatch = RESTES_RE.exec(content)
  if (!restesMatch) {
    problems.push('section "## Restes" absente')
  } else {
    const body = restesMatch[1].trim()
    if (body !== 'RAS') {
      const lines = body.split('\n').map((l) => l.trim()).filter(Boolean)
      if (lines.length === 0) {
        problems.push('section "## Restes" vide (attendu "RAS" ou des items "- <reste> -> <disposition>")')
      }
      for (const [i, line] of lines.entries()) {
        if (!DISPOSITION_RE.test(line)) {
          problems.push(`item sans disposition valide dans "## Restes" (ligne ${i + 1} du bloc) : "${line}" — attendu "-> #N" / "-> corrigé dans ce commit" / "-> RAS : <justification>"`)
        }
      }
    }
  }

  const { problems: refutationProblems, refuted } = checkRefutationSection(content)
  problems.push(...refutationProblems)

  if (!content.includes(today)) {
    problems.push(`date du jour (${today}) absente du fichier — solde réchauffé refusé`)
  }

  return { ok: problems.length === 0, problems, refuted }
}

/** Valide `.claude/soldes/revue-palier.md` (revue adversariale de PALIER, cumul de fermetures). */
export function validateRevuePalier(content, today) {
  if (!content) return { ok: false, problems: ['fichier absent'] }
  const problems = []
  if (!VERDICT_RE.test(content)) {
    problems.push('ligne "verdict: …" absente')
  }
  const descLen = lenWithoutVerdictLine(content)
  if (descLen < MIN_REVUE_PALIER_LEN) {
    problems.push(`synthèse trop maigre (${descLen} car. hors verdict, ${MIN_REVUE_PALIER_LEN} requis — revue du CUMUL des fermetures)`)
  }
  if (!content.includes(today)) {
    problems.push(`date du jour (${today}) absente du fichier`)
  }
  return { ok: problems.length === 0, problems }
}

/**
 * Décision du hook (PURE, testable). `readSolde(n)` renvoie le contenu de `.claude/soldes/<n>.md`
 * ou `null`/`''` s'il est absent. `counter` = valeur courante de `.claude/soldes/.compteur` (tickets
 * fermés depuis la dernière revue de palier). `readRevuePalier()` renvoie le contenu de
 * `.claude/soldes/revue-palier.md` ou `null`.
 * @returns {{ reason: string } | null} — non-null = `deny`, null = silence.
 */
export function evaluate({ command, today, readSolde, counter = 0, readRevuePalier = () => null }) {
  const issues = extractClosedIssues(command)
  if (issues.length === 0) return null

  if (counter >= PALIER) {
    const { ok, problems } = validateRevuePalier(readRevuePalier(), today)
    if (!ok) {
      return {
        reason:
          `⚠ Palier de ${PALIER} tickets fermés atteint : revue adversariale de PALIER exigée avant ` +
          `toute nouvelle fermeture — ${problems.join(' ; ')}. Écrire .claude/soldes/revue-palier.md ` +
          `(ligne "verdict: CONFIRMÉ|PARTIEL|RÉFUTÉ", ≥${MIN_REVUE_PALIER_LEN} caractères de synthèse sur ` +
          `le CUMUL des ${PALIER} dernières fermetures, date du jour).`,
      }
    }
  }

  const failures = []
  for (const n of issues) {
    const { ok, problems } = validateSolde(readSolde(n), today)
    if (!ok) failures.push({ n, problems })
  }
  if (failures.length === 0) return null

  const detail = failures.map(({ n, problems }) => `#${n} (.claude/soldes/${n}.md) — ${problems.join(' ; ')}`).join(' | ')
  return {
    reason:
      `⚠ Fermeture de ticket au commit sans SOLDE conforme : ${detail}. Écrire (ou compléter) le fichier ` +
      `avec une ligne "VERIFIE: <ce que l'orchestrateur a concrètement vérifié, ≥${MIN_VERIFIE_LEN} caractères>", ` +
      `une section "## Restes" ("RAS" seul, ou des items "- <reste signalé par l'agent> -> <#N nouveau ticket | ` +
      `corrigé dans ce commit | RAS : justification>"), une section "## Réfutation" (ligne "verdict: ` +
      `CONFIRMÉ|PARTIEL|RÉFUTÉ", ≥${MIN_REFUTATION_LEN} caractères — qui a attaqué quoi sur le diff/DoD), et ` +
      `la date du jour (demande 2026-07-14).`,
  }
}

/** Lecture du solde d'un ticket depuis le disque, racine du dépôt = `cwd`. `null` si absent/illisible. */
export function readSoldeFile(n) {
  try { return readFileSync(resolve('.claude/soldes', `${n}.md`), 'utf8') } catch { return null }
}

/** Lecture du compteur de palier depuis le disque. `0` si absent/illisible/non numérique. */
export function readCounterFile() {
  try {
    const raw = readFileSync(resolve('.claude/soldes/.compteur'), 'utf8').trim()
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch { return 0 }
}

/** Lecture de la revue de palier depuis le disque. `null` si absente/illisible. */
export function readRevuePalierFile() {
  try { return readFileSync(resolve('.claude/soldes/revue-palier.md'), 'utf8') } catch { return null }
}

// ── Driver stdin (n'exécute QUE lancé en direct, jamais à l'import du module de test) ─────────────
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  let raw = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) raw += chunk
  let command = ''
  try { command = String(JSON.parse(raw)?.tool_input?.command ?? '') } catch { /* stdin illisible → silence */ }
  // Date LOCALE (pas UTC) : un solde écrit après minuit heure locale porte la date locale.
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const decision = evaluate({
    command,
    today,
    readSolde: readSoldeFile,
    counter: readCounterFile(),
    readRevuePalier: readRevuePalierFile,
  })
  if (decision) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: decision.reason,
      },
    }))
  }
  process.exit(0)
}
