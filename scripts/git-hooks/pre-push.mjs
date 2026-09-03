// Hook pre-push : la porte AU PUSH (#1679 L2). Elle LIT, elle ne joue rien — régime utilisateur
// 2026-09-01 « suite complète + tsc avant push, pas de push sur CI rouge ».
//
// Quatre refus, tous nommés, sur la TÊTE de chaque ref poussée (l'unité que la CI juge) :
//   1. `origin` ne pointe pas `github.com/cgauche/game` ;
//   2. une gate de `ci.yml` sans justificatif VERT et PROPRE pour le CONTENU poussé
//      (`scripts/guards/lib/justificatif.mjs` ; la commande qui le produit est nommée : `npm run gates`) ;
//   3. push non fast-forward (aucune autorisation d'écraser une histoire poussée) ;
//   4. dernière CI de `main` en échec — dérogation `WFRP_PUSH_SUR_ROUGE=1` + `WFRP_DEROGATION`
//      (raison de 20 caractères au moins), JOURNALISÉE dans
//      `<git-common-dir>/wfrp-justificatifs/derogations.log` et relue par la revue de palier.
//      Ce refus-là vaut pour TOUTE ref, branche de travail comprise : c'est la lettre du régime
//      (« pas de push sur CI rouge »), et un push de branche pendant que main est rouge détourne du
//      seul travail qui compte alors — remettre main au vert.
//
// Le fast-forward ne se juge que contre une ref distante EXISTANTE (une ref neuve n'écrase rien).
//
// STDIN (githooks(5)) : une ligne `<ref locale> <sha local> <ref distante> <sha distant>` par ref.
// `git push --dry-run` joue AUSSI ce hook (mesuré : 2 invocations par push réel, 1 par dry-run) :
// une lecture ne se distingue pas d'un push, la porte juge les deux pareil.
//
// MESURE : `gh` est appelé pour la CI de `main`. En test, `WFRP_GH_STUB=<fichier json>` fournit la
// réponse (même forme que `gh run list --json conclusion,databaseId,headSha`) ; un chemin illisible
// vaut « CI non consultée », le cas hors-ligne.
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { enteteArbre } from '../guards/lib/enteteArbre.mjs'
import {
  cheminJustificatifs,
  cleTree,
  cleTreeComplete,
  gatesRequises,
  lireJustificatif,
  motifDeRefus,
} from '../guards/lib/justificatif.mjs'

const ZERO = '0'.repeat(40)

/** Refs à juger : les suppressions de branche (sha local nul) n'en sont pas. */
export function refsAPousser(stdin) {
  return String(stdin ?? '')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      const [refLocale, shaLocal, refDistante, shaDistant] = l.trim().split(/\s+/)
      return { refLocale, shaLocal, refDistante, shaDistant }
    })
    .filter((r) => r.shaLocal && r.shaLocal !== ZERO)
}

/** Le dépôt de ce projet, en https comme en ssh. */
export const urlOrigineAcceptee = (url) => /github\.com[:/]cgauche\/game(?:\.git)?$/.test(String(url ?? '').trim())

/** Dernière course CI de `main` : `{ courses }` ou `{ indisponible: raison }`. */
export function derniereCourseCi({ cwd = process.cwd(), env = process.env } = {}) {
  if (env.WFRP_GH_STUB) {
    try {
      return { courses: JSON.parse(readFileSync(env.WFRP_GH_STUB, 'utf8')) }
    } catch (e) {
      return { indisponible: e.message }
    }
  }
  const vu = spawnSync(
    'gh',
    ['run', 'list', '--branch', 'main', '--workflow', 'ci.yml', '--limit', '1', '--json', 'conclusion,databaseId,headSha'],
    { cwd, encoding: 'utf8', shell: process.platform === 'win32' },
  )
  if (vu.error) return { indisponible: vu.error.message }
  if (vu.status !== 0) return { indisponible: (vu.stderr || '').trim() || `gh a rendu ${vu.status}` }
  try {
    return { courses: JSON.parse(vu.stdout) }
  } catch (e) {
    return { indisponible: e.message }
  }
}

/** Verdict COMPLET du hook : `{ refus: [], notes: [] }`. Aucune sortie, aucun code — testable. */
export function jugerPush({ cwd, stdin, env = process.env }) {
  // stderr IGNORÉ : une commande git qui échoue ici a déjà son refus nommé ; son `fatal:` brut sur
  // la sortie d'erreur du hook ne ferait que masquer le motif.
  const git = (args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  const refus = []
  const notes = []

  const origine = (() => {
    try {
      return git(['remote', 'get-url', 'origin'])
    } catch {
      return ''
    }
  })()
  if (!urlOrigineAcceptee(origine))
    refus.push(`origin = « ${origine || '(absent)'} » : ce hook ne connaît que github.com/cgauche/game`)

  let gates = []
  try {
    gates = gatesRequises({ cwd })
  } catch (e) {
    refus.push(e.message)
  }

  for (const { refLocale, shaLocal, refDistante, shaDistant } of refsAPousser(stdin)) {
    const cles = { cleTree: cleTree(shaLocal, { cwd }), cleComplete: cleTreeComplete(shaLocal, { cwd }) }
    const vues = gates.map((g) => ({ gate: g, vue: lireJustificatif({ cwd, cleTree: cles.cleTree, gate: g.nom }) }))
    const manques = vues.map(({ gate, vue }) => motifDeRefus(vue, gate, cles)).filter(Boolean)
    if (manques.length) {
      refus.push(`${refLocale} → ${refDistante} : ${manques.length}/${gates.length} gate(s) sans justificatif sur ce contenu`)
      for (const m of manques) refus.push(`  · ${m}`)
      refus.push('  → tout produire d’un coup : npm run gates')
    } else {
      const shas = [...new Set(vues.map(({ vue }) => vue.sha))]
      if (!shas.includes(shaLocal))
        notes.push(
          `justificatif de ${shas.map((s) => s.slice(0, 7)).join(', ')} réutilisé pour ${shaLocal.slice(0, 7)} ` +
            '(contenu identique — pour chaque gate, sur le périmètre qui la gouverne)',
        )
    }

    // Fast-forward : il ne se juge QUE contre une ref distante EXISTANTE. Une ref neuve
    // (`shaDistant` nul) ne peut écraser aucune histoire — la comparer à `origin/main` refusait
    // toute branche de travail partie d'un point ancien (mesuré).
    if (!shaDistant || shaDistant === ZERO) {
      notes.push(`${refDistante} n’existe pas encore côté distant : rien à écraser, fast-forward non jugé`)
    } else {
      const ancetre = spawnSync('git', ['merge-base', '--is-ancestor', shaDistant, shaLocal], {
        cwd,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      if (ancetre.status !== 0)
        refus.push(
          `push non fast-forward vers ${refDistante} : ${shaDistant.slice(0, 7)} n’est pas un ancêtre de ${shaLocal.slice(0, 7)}`,
        )
    }
  }

  const ci = derniereCourseCi({ cwd, env })
  if (ci.indisponible) {
    notes.push(`CI de main non consultée : ${ci.indisponible}`)
  } else {
    const course = (ci.courses ?? [])[0]
    if (course && course.conclusion === 'failure') {
      const dit = `CI de main en ÉCHEC — run ${course.databaseId} sur ${String(course.headSha ?? '').slice(0, 7)}`
      const raison = String(env.WFRP_DEROGATION ?? '')
      if (env.WFRP_PUSH_SUR_ROUGE === '1' && raison.trim().length >= 20) {
        notes.push(`${dit} — DÉROGATION journalisée : ${raison.trim()}`)
        try {
          appendFileSync(
            join(cheminJustificatifs({ cwd }), 'derogations.log'),
            `${new Date().toISOString()}\t${git(['rev-parse', 'HEAD'])}\t${raison.trim()}\n`,
          )
        } catch (e) {
          notes.push(`journal de dérogation non écrit : ${e.message}`)
        }
      } else {
        refus.push(dit)
        refus.push(
          '  → corriger main, ou déroger EXPLICITEMENT : WFRP_PUSH_SUR_ROUGE=1 WFRP_DEROGATION="<raison de 20 caractères au moins>"',
        )
      }
    }
  }

  return { refus, notes }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const cwd = process.cwd()
  const stdin = (() => {
    try {
      return readFileSync(0, 'utf8')
    } catch {
      return ''
    }
  })()
  const { refus, notes } = jugerPush({ cwd, stdin })
  for (const n of notes) process.stderr.write(`[pre-push] ${n}\n`)
  if (refus.length) {
    process.stderr.write(`[pre-push] ${enteteArbre(cwd)}\n`)
    process.stderr.write(`pre-push REFUSÉ :\n${refus.map((r) => (r.startsWith('  ') ? r : `  ${r}`)).join('\n')}\n`)
    process.exit(1)
  }
  process.stderr.write(`[pre-push] ${refsAPousser(stdin).length} ref(s) jugée(s) — porte franchie\n`)
}
