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
//
// Extension 2026-07-14 (constat utilisateur, verbatim) — « je pensais que tu avais un hook qui te
// forceait a faire une review reversal, elle ne doit clairement pas marcher » puis « Ou alors
// seulement sur les tickets ? » : un commit « ref #N » (rattaché SANS fermer) échappait à tout
// regard adversarial ET n'avançait jamais le compteur de palier. Deux volets : (1) le compteur
// (`.claude/soldes/.compteur`, incrémenté par `scripts/git-hooks/post-commit`) avance désormais sur
// TOUT commit de substance (diff touche `src/**`/`scripts/**`), pas seulement les fermetures ;
// (2) anti-esquive — un commit `ref #N` qui touche `src/**` (≥10 lignes de diff staged) exige lui
// aussi sa réfutation (ligne `REFUTATION:` dans le message, ou fichier `.claude/soldes/ref-<N>.md`).
// Le déclencheur reste le TICKET explicitement rattaché (fermeture ou `ref #N`) — un commit sans
// AUCUN ticket n'entre jamais dans ce mécanisme (périmètre tranché #591, 2026-07-17).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { execSync } from 'node:child_process'

// Message passé par FICHIER (`git commit -F <path>` / `--file <path>` / `--file=<path>`) : le
// driver stdin ne voit que `tool_input.command` — un message packé dans un fichier externe y est
// INVISIBLE, ce qui (a) bloque à tort une fermeture légitime (aucun "corrige #N" vu dans la commande)
// et (b) pire, laisse le closer post-commit (qui LIT le vrai message) fermer un ticket SANS être
// passé par ce contrôle de solde. Fix découvert en production 2026-07-14.
const FILE_FLAG_RE = /(?:^|\s)(?:-F|--file)(=|\s+)("[^"]*"|'[^']*'|\S+)/

/** Chemin du fichier de message porté par `-F <path>` / `--file <path>` / `--file=<path>` dans la
 *  commande, guillemets simples/doubles retirés. `null` si aucun de ces flags n'est présent.
 *  Sémantique git : `-m` et `-F` sont MUTUELLEMENT EXCLUSIFS (git refuse la combinaison) — un
 *  `-m` présent signifie donc qu'aucun vrai flag fichier n'existe, et toute séquence « -F x »
 *  restante n'est que de la PROSE du message lui-même (faux positif vécu : un message -m citant
 *  « via -F et, » a fait chercher le fichier « et, » — fail-closed sur sa propre annonce). */
function fileFlagPath(command) {
  if (!command) return null
  if (MESSAGE_FLAG_RE.test(command)) return null
  const m = FILE_FLAG_RE.exec(command)
  if (!m) return null
  let path = m[2]
  if ((path.startsWith('"') && path.endsWith('"')) || (path.startsWith("'") && path.endsWith("'"))) {
    path = path.slice(1, -1)
  }
  return path
}

/** Texte COMPLET à analyser pour la fermeture/réfutation : la commande elle-même + le contenu du
 *  fichier `-F`/`--file` s'il y en a un (lu via `readFile`, résolu relatif à `cwd`). Le gate « est-ce
 *  un git commit » continue de s'appliquer sur la commande seule (le fichier ne la contient jamais).
 *  `fileError` = chemin illisible (fail-closed : ne JAMAIS retomber en silence sur un -F cassé). */
export function extractMessageSources(command, { readFile = readFileSync, cwd = process.cwd() } = {}) {
  if (!command) return { text: '', fileError: null }
  const path = fileFlagPath(command)
  if (!path) return { text: command, fileError: null }
  try {
    const fileContent = readFile(resolve(cwd, path), 'utf8')
    return { text: `${command}\n${fileContent}`, fileError: null }
  } catch {
    return { text: command, fileError: path }
  }
}

// ── Parsing STRUCTUREL de la ligne de commande (#591 défaut 3) ───────────────────────────────────
// « est-ce un `git commit` ? » ne se décide plus par un grep de sous-chaîne sur la ligne entière
// (un `gh issue create --body "... git commit ..."` la faisait mordre à tort) : on TOKENISE la
// commande (quotes simples/doubles + here-strings PowerShell `@'…'@`/`@"…"@`), on la découpe en
// segments aux enchaînements top-level (`&&`, `;`, `||`, `|`), puis on identifie dans CHAQUE segment
// l'exécutable de tête et sa sous-commande (`git [-C <path>|-c <k=v>|...] commit`).
function tokenizeCommand(command) {
  const tokens = []
  let i = 0
  const n = command.length
  while (i < n) {
    while (i < n && /\s/.test(command[i])) i++
    if (i >= n) break
    if (command[i] === '@' && (command[i + 1] === "'" || command[i + 1] === '"')) {
      const quote = command[i + 1]
      const closer = `${quote}@`
      const end = command.indexOf(closer, i + 2)
      if (end !== -1) {
        tokens.push({ text: command.slice(i + 2, end), op: null })
        i = end + closer.length
        continue
      }
    }
    if (command.startsWith('&&', i)) { tokens.push({ text: '&&', op: '&&' }); i += 2; continue }
    if (command.startsWith('||', i)) { tokens.push({ text: '||', op: '||' }); i += 2; continue }
    if (command[i] === ';') { tokens.push({ text: ';', op: ';' }); i += 1; continue }
    if (command[i] === '|') { tokens.push({ text: '|', op: '|' }); i += 1; continue }
    // MOT (bareword ± span(s) quoté(s) EMBARQUÉS) : le comportement shell réel colle une quote
    // rencontrée en PLEIN MILIEU d'un token à ce MÊME token (`-m"a b c"` → un seul token `-ma b c`,
    // `--message="a b c"` → `--message=a b c`) — jamais une coupure qui laisserait les mots du
    // message fuir en tokens séparés (les mots d'un message multi-mots devenaient alors autant de
    // pathspecs parasites, #591 suite : le filtrage src/ui retombait à néant, JUGE silencieux).
    let buf = ''
    let j = i
    while (j < n) {
      const c = command[j]
      if (/\s/.test(c) || c === ';' || c === '|' || (c === '&' && command[j + 1] === '&')) break
      if (c === '"' || c === "'") {
        const quote = c
        j++
        while (j < n && command[j] !== quote) {
          // Échappement réel `\"`/`\\` seulement — un backslash de chemin Windows (`C:\Program…`)
          // n'est PAS un échappement shell et reste LITTÉRAL (sinon les chemins perdent leurs
          // séparateurs, cassant la reconnaissance de `git.exe` au bout d'un chemin absolu, #591 suite).
          if (quote === '"' && command[j] === '\\' && j + 1 < n && (command[j + 1] === '"' || command[j + 1] === '\\')) {
            buf += command[j + 1]; j += 2; continue
          }
          buf += command[j]; j++
        }
        j++ // saute la quote fermante (si absente — quote non refermée — j a déjà atteint n)
        continue
      }
      buf += c
      j++
    }
    tokens.push({ text: buf, op: null })
    i = j
  }
  return tokens
}

/** Découpe la commande en segments exécutables (aux enchaînements `&&`/`;`/`||`/`|` de premier
 *  niveau — les mêmes marqueurs À L'INTÉRIEUR d'une quote/here-string ont déjà été consommés comme
 *  contenu de token par `tokenizeCommand`, jamais comme séparateur). */
export function splitCommandSegments(command) {
  const segments = []
  let current = []
  for (const tok of tokenizeCommand(command)) {
    if (tok.op) {
      segments.push(current)
      current = []
    } else {
      current.push(tok.text)
    }
  }
  segments.push(current)
  return segments.filter((s) => s.length > 0)
}

const GLOBAL_VALUE_FLAGS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path'])

/** Index du token `commit` dans un segment (`[&] git [flags globales] commit`), `-1` si le segment
 *  n'exécute pas `git commit` (exécutable ≠ git, ou sous-commande ≠ commit). Un token `&` de tête
 *  (call-operator PowerShell : `& "C:\Program Files\Git\git.exe" commit …`) est sauté — le contrôle
 *  d'exécutable porte alors sur le BASENAME (sans extension `.exe`/`.cmd`, insensible à la casse). */
function gitCommitSubcommandIndex(segment) {
  const start = segment[0] === '&' ? 1 : 0
  if (segment.length <= start) return -1
  const exe = segment[start].replace(/\\/g, '/').split('/').pop().replace(/\.(exe|cmd)$/i, '').toLowerCase()
  if (exe !== 'git') return -1
  let idx = start + 1
  while (idx < segment.length) {
    const t = segment[idx]
    if (t.startsWith('-')) {
      if (GLOBAL_VALUE_FLAGS.has(t)) { idx += 2; continue }
      idx += 1
      continue
    }
    break
  }
  return idx < segment.length && segment[idx] === 'commit' ? idx : -1
}

/** `true` si la commande exécute STRUCTURELLEMENT un `git commit` (un segment quelconque, entre
 *  enchaînements) — jamais un grep de sous-chaîne sur la ligne entière (#591 défaut 3). */
export function isGitCommitCommand(command) {
  if (!command) return false
  return splitCommandSegments(command).some((segment) => gitCommitSubcommandIndex(segment) !== -1)
}

// Longs à valeur SÉPARÉE (`--message truc`, `-c truc`) : le token suivant est la valeur, jamais un
// pathspec. `-c` reste un flag SIMPLE (config `clé=valeur`) — hors du regroupement court m/F ci-dessous.
const COMMIT_VALUE_FLAGS = new Set([
  '-c', '--author', '--date', '--template', '--fixup', '--squash', '--trailer',
  '--reuse-message', '--reedit-message', '--message', '--file',
])
// Longs à valeur COLLÉE par `=` (`--message=texte`, `--file=chemin`) : la valeur est DÉJÀ dans le
// token, rien à consommer ensuite — et elle n'est jamais elle-même un pathspec.
const LONG_VALUE_FLAG_EQ_RE = /^--(message|file|author|date|template|fixup|squash|trailer|reuse-message|reedit-message)=/
// Shorts POSIX groupés (`-am`, `-cam`, `-sm`…) : `git` accepte l'empilement d'options courtes
// booléennes suivies d'UNE option à valeur — `m` (message) et `F` (file) sont les deux lettres
// courtes à valeur de `git commit`. Capture (flags avant, lettre m/F, RÉSIDU) : résidu vide → la
// valeur est le token SUIVANT (`-am "msg"`) ; résidu non vide → la valeur est GLUÉE au token lui-même
// (`-m"a b c"` tokenisé en un seul token `-ma b c` par `tokenizeCommand` — rien à consommer ensuite).
// Sans cette reconnaissance, le MESSAGE (ou ses mots, avant la fusion de tokenisation) se prenait
// pour un pathspec — le filtrage src/ui retombait à néant, JUGE/anti-esquive restaient muets (#591).
const SHORT_VALUE_FLAG_RE = /^-([a-zA-Z]*)([mF])(.*)$/

/** Glob non résolu (`*`, `?`, `[`) : la garde ne réimplémente pas le matching de pathspec de git —
 *  un pathspec-glob présent invalide le SCOPING ENTIER de la commande (retombe sur l'index complet,
 *  jamais un silence par filtrage résolu à tort en « aucun fichier »). */
const PATHSPEC_GLOB_RE = /[*?[]/

/** Pathspecs (chemins positionnels) portés par un `git commit`, extraits de sa STRUCTURE : tout
 *  token du segment qui n'est ni un flag connu ni la valeur d'un flag qui en attend une (séparée OU
 *  collée par `=`/glue court, `--`…) est un pathspec — qu'il précède ou suive le séparateur `--`.
 *  `[]` si la commande n'est pas un `git commit`, si elle ne porte aucun pathspec, OU si un pathspec
 *  porte un glob non résolu — dans tous ces cas le diff STAGÉ ENTIER reste la portée (jamais un
 *  scoping mal résolu qui tairait la garde). */
export function extractCommitPathspecs(command) {
  if (!command) return []
  for (const segment of splitCommandSegments(command)) {
    const subIdx = gitCommitSubcommandIndex(segment)
    if (subIdx === -1) continue
    const paths = []
    for (let k = subIdx + 1; k < segment.length; k++) {
      const t = segment[k]
      if (t === '--') continue
      if (t.startsWith('--')) {
        if (LONG_VALUE_FLAG_EQ_RE.test(t)) continue // valeur collée par `=` : rien à consommer
        if (COMMIT_VALUE_FLAGS.has(t)) k += 1 // valeur séparée (token suivant)
        continue
      }
      if (t.startsWith('-')) {
        if (COMMIT_VALUE_FLAGS.has(t)) { k += 1; continue } // `-c` : valeur séparée
        const m = SHORT_VALUE_FLAG_RE.exec(t)
        if (m) {
          if (m[3] === '') k += 1 // résidu vide : valeur SÉPARÉE (token suivant)
          // résidu non vide : valeur GLUÉE, déjà dans le token — rien à consommer
        }
        continue
      }
      paths.push(t)
    }
    return paths.some((p) => PATHSPEC_GLOB_RE.test(p)) ? [] : paths
  }
  return []
}

// Motif de fermeture repris du closer post-commit (`scripts/git-hooks/post-commit`) : mêmes
// mots-clefs, mais capturés ICI sur le texte ENTIER de la commande (couvre les here-strings/heredocs
// `git commit -m "$(cat <<EOF ... EOF)"` où le message est packé dans la commande shell elle-même,
// ET le texte étendu par `extractMessageSources` quand le message est passé par `-F`).
const CLOSE_KEYWORD_RE = /(corrige|fixe?s?|closes?|ferme)\s+#(\d+)/gi

/** Numéros de ticket que la commande FERME, dédupliqués/triés. `[]` si la commande n'est pas un
 *  `git commit`, ou si aucun mot-clef de fermeture n'apparaît. */
export function extractClosedIssues(command) {
  if (!command || !isGitCommitCommand(command)) return []
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

/** Racine du dépôt, ancrée sur l'EMPLACEMENT de ce script (jamais `process.cwd()` — un hook lancé
 *  avec un cwd différent de la racine doit quand même trouver `.claude/soldes/`). */
export function repoRoot(scriptUrl = import.meta.url) {
  return join(dirname(fileURLToPath(scriptUrl)), '..', '..')
}

/** Lecture du solde d'un ticket depuis le disque, racine du dépôt = emplacement du script. `null`
 *  si absent/illisible. */
export function readSoldeFile(n, scriptUrl = import.meta.url) {
  try { return readFileSync(join(repoRoot(scriptUrl), '.claude/soldes', `${n}.md`), 'utf8') } catch { return null }
}

/** Lecture du compteur de palier depuis le disque. `0` si absent/illisible/non numérique. */
export function readCounterFile(scriptUrl = import.meta.url) {
  try {
    const raw = readFileSync(join(repoRoot(scriptUrl), '.claude/soldes/.compteur'), 'utf8').trim()
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch { return 0 }
}

/** Lecture de la revue de palier depuis le disque. `null` si absente/illisible. */
export function readRevuePalierFile(scriptUrl = import.meta.url) {
  try { return readFileSync(join(repoRoot(scriptUrl), '.claude/soldes/revue-palier.md'), 'utf8') } catch { return null }
}

// ── Anti-esquive (extension 2026-07-14, périmètre tranché #591) ────────────────────────────────────
// Un commit `ref #N`/`refs #N` (rattaché SANS fermer), qui touche `src/**` pour un diff STAGED de
// substance, doit lui aussi porter sa réfutation — sinon la fermeture reste le SEUL chemin regardé
// et « ref #N » devient l'esquive mécanique. Un commit SANS aucun ticket (ni fermeture, ni `ref #N`)
// reste hors du déclencheur : le mécanisme REFUTATION ne porte que sur le ticket EXPLICITEMENT
// rattaché (#591).
const REF_KEYWORD_RE = /\brefs?\s+#(\d+)/gi
const REFUTATION_LINE_RE = /REFUTATION\s*:\s*(.+)/i
const MIN_REFUTATION_LINE_LEN = 40
const SUBSTANTIVE_MIN_LINES = 10

/** Numéros de ticket que la commande RATTACHE sans fermer (`ref #N`/`refs #N`), dédupliqués/triés. */
export function extractRefIssues(command) {
  if (!command || !isGitCommitCommand(command)) return []
  const nums = new Set()
  for (const m of command.matchAll(REF_KEYWORD_RE)) nums.add(Number(m[1]))
  return [...nums].sort((a, b) => a - b)
}

/** `true` si le message porte une ligne "REFUTATION: <...>" d'au moins `MIN_REFUTATION_LINE_LEN`
 *  caractères après le mot-clef. */
function hasInlineRefutation(command) {
  const m = REFUTATION_LINE_RE.exec(command)
  return !!m && m[1].trim().length >= MIN_REFUTATION_LINE_LEN
}

/** Valide un fichier `.claude/soldes/ref-<N>.md` : seule la section "## Réfutation" (même gabarit
 *  que les soldes de fermeture) est exigée — pas de VERIFIE/Restes, ce n'est pas une fermeture. */
export function validateRefFile(content) {
  if (!content) return { ok: false, problems: ['fichier absent'] }
  const { problems } = checkRefutationSection(content)
  return { ok: problems.length === 0, problems }
}

/**
 * Décision anti-esquive (PURE, testable). `stagedTouchesSrc`/`stagedTotalLines` = état du diff
 * STAGED (`git diff --cached`), injectés par le driver. `readRefFile(n)` lit
 * `.claude/soldes/ref-<n>.md` (ou `null`).
 * @returns {{ reason: string } | null} — non-null = `deny`, null = silence.
 */
export function evaluateAntiEsquive({ command, stagedTouchesSrc, stagedTotalLines, readRefFile = () => null }) {
  if (!command || !isGitCommitCommand(command)) return null
  if (!stagedTouchesSrc) return null
  if (typeof stagedTotalLines === 'number' && stagedTotalLines < SUBSTANTIVE_MIN_LINES) return null

  // Une fermeture est déjà couverte par `evaluate()` (solde complet, réfutation comprise) — pas de
  // double exigence ici.
  if (extractClosedIssues(command).length > 0) return null

  if (hasInlineRefutation(command)) return null

  const refIssues = extractRefIssues(command)
  // Aucun ticket rattaché (ni fermeture, ni `ref #N`) : hors du déclencheur (#591).
  if (refIssues.length === 0) return null

  const failures = []
  for (const n of refIssues) {
    const { ok, problems } = validateRefFile(readRefFile(n))
    if (!ok) failures.push({ n, problems })
  }
  if (failures.length === 0) return null
  const detail = failures.map(({ n, problems }) => `#${n} (.claude/soldes/ref-${n}.md) — ${problems.join(' ; ')}`).join(' | ')
  return {
    reason:
      `⚠ Commit "ref #N" (src/** touché, ≥${SUBSTANTIVE_MIN_LINES} lignes de diff staged) sans réfutation : ${detail}. ` +
      `Ajouter une ligne "REFUTATION: <qui a attaqué quoi, ≥${MIN_REFUTATION_LINE_LEN} caractères>" dans le ` +
      `message de commit, ou écrire .claude/soldes/ref-<N>.md avec une section "## Réfutation" conforme ` +
      `(verdict + synthèse — extension anti-esquive 2026-07-14).`,
  }
}

// ── JUGE adversarial (extension du mécanisme REFUTATION, générale à tout domaine) ──────────────────
// EXACTEMENT le même déclencheur qu'`evaluateAntiEsquive` (#591 : un `ref #N` rattaché sans fermer,
// jamais un commit sans ticket du tout, jamais une fermeture — déjà couverte par sa propre section
// "## Réfutation" à verdict) : un `ref #N` qui touche `src/**` en substance doit en plus porter la
// preuve qu'un agent juge adversarial est passé sur le diff. Si le diff touche `src/ui/**`, une
// preuve DISTINCTE de jugement sur captures (JUGE-VISION) est exigée en plus.
const JUGE_LINE_RE = /\bJUGE\s*:\s*(.+)/i
const MIN_JUGE_LINE_LEN = 40
const JUGE_VISION_LINE_RE = /\bJUGE-VISION\s*:\s*(.+)/i
const MIN_JUGE_VISION_LINE_LEN = 40
const JUGE_SECTION_RE = /##\s*Juge\s*\n([\s\S]*?)(?:\n\s*\n|\n##|$)/i
const JUGE_VISION_SECTION_RE = /##\s*Juge-Vision\s*\n([\s\S]*?)(?:\n\s*\n|\n##|$)/i

/** `true` si le message porte une ligne "JUGE: <...>" d'au moins `MIN_JUGE_LINE_LEN` caractères
 *  après le mot-clef (n'accroche jamais "JUGE-VISION:", le tiret casse le motif `JUGE\s*:`). */
function hasInlineJuge(command) {
  const m = JUGE_LINE_RE.exec(command)
  return !!m && m[1].trim().length >= MIN_JUGE_LINE_LEN
}

/** `true` si le message porte une ligne "JUGE-VISION: <...>" d'au moins `MIN_JUGE_VISION_LINE_LEN`
 *  caractères après le mot-clef. */
function hasInlineJugeVision(command) {
  const m = JUGE_VISION_LINE_RE.exec(command)
  return !!m && m[1].trim().length >= MIN_JUGE_VISION_LINE_LEN
}

/** Section nommée générique (`## <label>`) : présence + longueur minimale du corps. */
function checkNamedSection(content, sectionRe, minLen, label) {
  const problems = []
  const m = sectionRe.exec(content ?? '')
  if (!m) {
    problems.push(`section "## ${label}" absente`)
    return { problems }
  }
  const body = m[1].trim()
  if (body.length < minLen) {
    problems.push(`"## ${label}" trop maigre (${body.length} car., ${minLen} requis)`)
  }
  return { problems }
}

/** Valide un fichier `.claude/soldes/ref-<N>.md` pour sa section "## Juge" (symétrie exacte de
 *  `validateRefFile`, mécanisme distinct — n'exige pas de "## Réfutation"). */
export function validateJugeFile(content) {
  if (!content) return { ok: false, problems: ['fichier absent'] }
  const { problems } = checkNamedSection(content, JUGE_SECTION_RE, MIN_JUGE_LINE_LEN, 'Juge')
  return { ok: problems.length === 0, problems }
}

/** Valide un fichier `.claude/soldes/ref-<N>.md` pour sa section "## Juge-Vision". */
export function validateJugeVisionFile(content) {
  if (!content) return { ok: false, problems: ['fichier absent'] }
  const { problems } = checkNamedSection(content, JUGE_VISION_SECTION_RE, MIN_JUGE_VISION_LINE_LEN, 'Juge-Vision')
  return { ok: problems.length === 0, problems }
}

/**
 * Décision JUGE (PURE, testable). Même périmètre de déclenchement qu'`evaluateAntiEsquive` (silence
 * sur les fermetures, déjà couvertes par leur propre solde ; silence aussi sur un commit sans AUCUN
 * ticket rattaché — #591). `stagedTouchesUi` = le diff staged touche `src/ui/**` (tests compris).
 * @returns {{ reason: string } | null} — non-null = `deny`, null = silence.
 */
export function evaluateJuge({ command, stagedTouchesSrc, stagedTotalLines, stagedTouchesUi, readRefFile = () => null }) {
  if (!command || !isGitCommitCommand(command)) return null
  if (!stagedTouchesSrc) return null
  if (typeof stagedTotalLines === 'number' && stagedTotalLines < SUBSTANTIVE_MIN_LINES) return null
  if (extractClosedIssues(command).length > 0) return null

  const refIssues = extractRefIssues(command)
  // Aucun ticket rattaché (ni fermeture, ni `ref #N`) : hors du déclencheur (#591).
  if (refIssues.length === 0) return null

  const needsVision = !!stagedTouchesUi

  const jugeSatisfied =
    hasInlineJuge(command) ||
    (refIssues.length > 0 && refIssues.every((n) => validateJugeFile(readRefFile(n)).ok))
  const visionSatisfied =
    !needsVision ||
    hasInlineJugeVision(command) ||
    (refIssues.length > 0 && refIssues.every((n) => validateJugeVisionFile(readRefFile(n)).ok))

  if (jugeSatisfied && visionSatisfied) return null

  const missing = []
  if (!jugeSatisfied) {
    missing.push(
      `ligne "JUGE: <qui a jugé quoi, verdict — ≥${MIN_JUGE_LINE_LEN} caractères>" (ou section ` +
      `"## Juge" dans .claude/soldes/ref-<N>.md)`,
    )
  }
  if (!visionSatisfied) {
    missing.push(
      `ligne "JUGE-VISION: <captures jugées — ≥${MIN_JUGE_VISION_LINE_LEN} caractères>" (ou section ` +
      `"## Juge-Vision" dans .claude/soldes/ref-<N>.md) — src/ui/** touché`,
    )
  }

  return {
    reason:
      `⚠ Commit touchant src/** (≥${SUBSTANTIVE_MIN_LINES} lignes de diff staged) sans juge ` +
      `adversarial : ajouter ${missing.join(' et ')} dans le message de commit (extension juge du ` +
      `garde de solde).`,
  }
}

// ── --amend sans message explicite (message hérité invisible au contrôle) ──────────────────────────
const AMEND_RE = /--amend\b/
const MESSAGE_FLAG_RE = /(?:^|\s)(?:-m\b|--message\b)/

/**
 * `git commit --amend` sans `-m`/`-F` hérite du message du commit précédent — invisible à ce hook
 * (et au closer post-commit) puisque ni la commande ni un fichier lisible ne le portent. Deny
 * PRUDENT si le diff staged touche `src/**` ; silence sinon (les règles maison découragent déjà
 * l'amend, mais un amend sans substance src ne mérite pas un blocage).
 * @returns {{ reason: string } | null}
 */
export function evaluateAmendInvisible({ command, stagedTouchesSrc }) {
  if (!command || !isGitCommitCommand(command)) return null
  if (!AMEND_RE.test(command)) return null
  if (MESSAGE_FLAG_RE.test(command) || FILE_FLAG_RE.test(command)) return null
  if (!stagedTouchesSrc) return null
  return {
    reason:
      `⚠ Commit --amend sans message explicite (-m/-F) : le message hérité est invisible au ` +
      `contrôle de solde (src/** touché) — re-committer avec -m (ou -F sur un fichier lisible) ` +
      `pour que la fermeture/réfutation reste contrôlable.`,
  }
}

/** Lecture d'un fichier de réfutation `ref-<n>` depuis le disque, racine du dépôt = emplacement du
 *  script. `null` si absent/illisible. */
export function readRefFile(n, scriptUrl = import.meta.url) {
  try { return readFileSync(join(repoRoot(scriptUrl), '.claude/soldes', `ref-${n}.md`), 'utf8') } catch { return null }
}

// ── Répertoire CIBLE du commit (fix #587) ──────────────────────────────────────────────────────────
// Le hook tourne dans le cwd du process (le dépôt de la SESSION) ; une commande qui `cd` dans un
// AUTRE dépôt (worktree) avant `git commit` doit faire lire ses états git (manifest stagé, diff
// staged) DANS CE RÉPERTOIRE, pas celui de la session — sinon un manifest propre dans le worktree
// est jugé contre l'arbre principal encore sale (démontré empiriquement, #587). Seules les lectures
// d'état GIT du commit sont concernées : les soldes (`.claude/soldes/*.md`) restent lus côté SESSION
// par design (ils y vivent, pas dans le worktree).
const CD_RE = /(?:^|&&|;|\|)\s*cd\s+("[^"]*"|'[^']*'|\S+)/i
const GIT_DASH_C_RE = /git\s+-C\s+("[^"]*"|'[^']*'|\S+)/i

function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  return s
}

/** Répertoire dans lequel le `git commit` de la commande s'exécute réellement : premier `cd <path>`
 *  du pipeline, ou `git -C <path>`, résolu contre `cwd` (le cwd du process hook). `cwd` inchangé si
 *  ni l'un ni l'autre n'est présent (comportement d'origine hors worktree). */
export function extractTargetDir(command, cwd = process.cwd()) {
  if (!command) return cwd
  const gitC = GIT_DASH_C_RE.exec(command)
  if (gitC) return resolve(cwd, stripQuotes(gitC[1]))
  const cd = CD_RE.exec(command)
  if (cd) return resolve(cwd, stripQuotes(cd[1]))
  return cwd
}

// ── Manifest RAW (prévention #434/#487) ────────────────────────────────────────────────────────────
// Le manifest éditorial `src/data/raw.manifest.json` porte les dettes/blocages des topics `(non
// implémenté)` (`ticket: "#N"` / `bloque: "…#N…"`). Fermer #N tout en le laissant dans le manifest
// laisse un topic marqué « dette : #N » dans les fiches générées, et l'issue fermée à tort — la
// régénération (`raw:implemente`) et le retrait d'entrée doivent aller dans le MÊME commit. Le contrôle
// lit la version STAGÉE du manifest (celle qui va être committée), pas le disque de travail.
const RAW_MANIFEST_PATH = 'src/data/raw.manifest.json'
const MANIFEST_TICKET_RE = /#(\d+)/g

/** Tickets `#N` référencés par le CONTENU (stagé) du manifest RAW. `null`/vide → ensemble vide. */
export function manifestTickets(manifestContent) {
  const nums = new Set()
  if (!manifestContent) return nums
  for (const m of manifestContent.matchAll(MANIFEST_TICKET_RE)) nums.add(Number(m[1]))
  return nums
}

/**
 * Décision « fermeture d'un ticket encore présent dans le manifest RAW stagé » (PURE, testable).
 * `readStagedManifest()` renvoie la version STAGÉE de `src/data/raw.manifest.json` (ou `null`).
 * Une fermeture de #N dont l'entrée manifest n'a PAS été retirée dans le même commit = deny.
 * @returns {{ reason: string } | null}
 */
export function evaluateManifestClosure({ command, readStagedManifest = () => null }) {
  const issues = extractClosedIssues(command)
  if (issues.length === 0) return null
  const tickets = manifestTickets(readStagedManifest())
  const stuck = issues.filter((n) => tickets.has(n))
  if (stuck.length === 0) return null
  const list = stuck.map((n) => `#${n}`).join(', ')
  return {
    reason:
      `⚠ Fermeture de ${list} alors que ce(s) ticket(s) figure(nt) encore dans ${RAW_MANIFEST_PATH} ` +
      `(version stagée) — un topic resterait marqué « dette : #N » dans les fiches générées, l'issue ` +
      `fermée à tort. Retirer l'entrée manifest de ${list} et relancer \`npm run raw:implemente\` dans ` +
      `le MÊME commit (régénère le champ Implémente), puis re-committer.`,
  }
}

/** Lecture de la version STAGÉE (index git) de `src/data/raw.manifest.json`, dans `dir` (répertoire
 *  cible du commit, fix #587 — défaut `cwd` du process, comportement inchangé hors worktree).
 *  `null` si absente/illisible. */
export function readStagedManifestFile(dir = process.cwd()) {
  try { return execSync(`git show :${RAW_MANIFEST_PATH}`, { encoding: 'utf8', cwd: dir }) } catch { return null }
}

/** `true` si `path` est COUVERT par le pathspec `ps` (chemin identique, ou `path` sous le dossier
 *  `ps`) — normalise les antislashs Windows et les `./` de tête. */
function pathMatchesPathspec(path, ps) {
  const norm = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')
  const np = norm(path)
  const nps = norm(ps)
  if (!nps) return false
  return np === nps || np.startsWith(`${nps}/`)
}

/** Analyse du diff STAGED (`git diff --cached --numstat`) : touche-t-il `src/**` ? `src/ui/**` ?
 *  combien de lignes (insertions+suppressions) au total ? Fichiers binaires (`-\t-\t<path>`)
 *  comptés 0 ligne mais peuvent toucher `src/**`. `''`/erreur git → aucune touche, 0 ligne
 *  (silence, jamais un deny par accident hors dépôt).
 *
 * `pathspecs` (#591 défaut 1, arbre PARTAGÉ) : si la commande `git commit` porte des pathspecs
 * explicites (`git commit -- <paths>` ou chemins positionnels), seuls les fichiers du diff STAGÉ qui
 * matchent ces pathspecs sont regardés — jamais l'INDEX GLOBAL, qui peut porter le lot d'une AUTRE
 * session cohabitant sur le même arbre. `[]` (par défaut, ou commit sans pathspec) = portée
 * INCHANGÉE : l'index entier. */
export function analyzeStagedDiff(raw, pathspecs = []) {
  let touchesSrc = false
  let touchesUi = false
  let totalLines = 0
  const scoped = pathspecs.length > 0
  for (const line of String(raw ?? '').split('\n')) {
    if (!line.trim()) continue
    const [ins, del, ...pathParts] = line.split('\t')
    const path = pathParts.join('\t')
    if (scoped && !pathspecs.some((ps) => pathMatchesPathspec(path, ps))) continue
    totalLines += (Number.parseInt(ins, 10) || 0) + (Number.parseInt(del, 10) || 0)
    if (/^src\//.test(path)) touchesSrc = true
    if (/^src\/ui\//.test(path)) touchesUi = true
  }
  return { touchesSrc, touchesUi, totalLines }
}

/** Lecture du diff STAGED brut (`git diff --cached --numstat`), dans `dir` (répertoire cible du
 *  commit, fix #587 — défaut `cwd` du process, comportement inchangé hors worktree). */
export function readStagedDiffStat(dir = process.cwd()) {
  try { return execSync('git diff --cached --numstat', { encoding: 'utf8', cwd: dir }) } catch { return '' }
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
  const targetDir = extractTargetDir(command, process.cwd())
  const { touchesSrc, touchesUi, totalLines } = analyzeStagedDiff(readStagedDiffStat(targetDir), extractCommitPathspecs(command))

  const { text, fileError } = extractMessageSources(command)
  if (fileError) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `⚠ Message de commit en fichier illisible pour le contrôle de solde (-F/--file "${fileError}") ` +
          `— utiliser -m ou un chemin lisible (fail-closed : pas de fermeture ni de réfutation invisibles).`,
      },
    }))
    process.exit(0)
  }

  const decision = evaluate({
    command: text,
    today,
    readSolde: readSoldeFile,
    counter: readCounterFile(),
    readRevuePalier: readRevuePalierFile,
  })
  const antiEsquive = evaluateAntiEsquive({
    command: text,
    stagedTouchesSrc: touchesSrc,
    stagedTotalLines: totalLines,
    readRefFile,
  })
  const juge = evaluateJuge({
    command: text,
    stagedTouchesSrc: touchesSrc,
    stagedTotalLines: totalLines,
    stagedTouchesUi: touchesUi,
    readRefFile,
  })
  const amendInvisible = evaluateAmendInvisible({ command, stagedTouchesSrc: touchesSrc })
  const manifestClosure = evaluateManifestClosure({ command: text, readStagedManifest: () => readStagedManifestFile(targetDir) })
  const reasons = [decision, antiEsquive, juge, amendInvisible, manifestClosure].filter(Boolean).map((d) => d.reason)
  if (reasons.length > 0) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reasons.join(' || '),
      },
    }))
  }
  process.exit(0)
}
