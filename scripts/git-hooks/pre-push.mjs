// Hook pre-push : la porte AU PUSH (#1679 L2). Elle LIT, elle ne joue rien — régime utilisateur
// 2026-09-01 « suite complète + tsc avant push, pas de push sur CI rouge ».
//
// Cinq refus, tous nommés, sur la TÊTE de chaque ref poussée (l'unité que la CI juge) :
//   1. `origin` ne pointe pas `github.com/cgauche/game` ;
//   2. une gate de `ci.yml` sans justificatif VERT et PROPRE pour le CONTENU poussé
//      (`scripts/guards/lib/justificatif.mjs` ; la commande qui le produit est nommée : `npm run gates`) ;
//   3. push non fast-forward (aucune autorisation d'écraser une histoire poussée) ;
//   4. le REJEU DES MIGRATIONS sur un EXPORT de la tête est rouge (#1613) — le job `migrations` de
//      la CI est le seul step qu'aucun justificatif ne couvre (`JOBS_HORS_JUSTIFICATIF` : rejoué EN
//      PLACE, il réécrit `src/data` et `src/scenes`). Il est donc JOUÉ ici, sur une copie jetable, et
//      seulement si la plage poussée touche ce qu'il mesure — sinon c'est dit et sauté ;
//   5. dernière CI de `main` en échec — dérogation `WFRP_PUSH_SUR_ROUGE=1` + `WFRP_DEROGATION`
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
import { PERIMETRE } from '../migrations/replay.mjs'
import { rejeuSurExport } from '../migrations/replay-head.mjs'
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

/** Chemins dont la présence dans une plage poussée ARME le rejeu des migrations : ce que les
 *  migrations ÉCRIVENT (`PERIMETRE`, importé — jamais recopié) et les migrations elles-mêmes. */
export const CHEMINS_QUI_ARMENT_LE_REJEU = [...PERIMETRE, 'scripts/migrations']

/** La plage touche-t-elle de quoi armer le rejeu ? Comparaison par SEGMENT : `src/database` n'est
 *  pas `src/data`. */
export const armeLeRejeu = (chemins) =>
  chemins.some((chemin) => {
    const c = String(chemin).replace(/\\/g, '/')
    return CHEMINS_QUI_ARMENT_LE_REJEU.some((p) => c === p || c.startsWith(`${p}/`))
  })

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
  /** Rejeux déjà joués, par sha : un push de deux refs sur le MÊME commit (`main` + une étiquette de
   *  travail) ne paie pas deux fois les ~17 s de la porte P1.4.
   *  @type {Map<string, { rouges: string[], chronos: Record<string, number> }>} */
  const rejeuxJoues = new Map()

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
      notes.push(
        `${refDistante} n’existe pas encore côté distant : rien à écraser, fast-forward non jugé — et ` +
          'le rejeu des migrations se juge sur l’arbre ENTIER, donc il est joué',
      )
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

    // REJEU DES MIGRATIONS sur l'export de la tête (#1613). Ce qu'on juge, c'est le CONTENU que la
    // plage apporte : sur une ref distante NEUVE il n'y a pas de plage, et l'arbre ENTIER du sha en
    // tient lieu — tout y arrive côté distant. Conséquence assumée et DITE dans la note : une branche
    // neuve arme toujours le rejeu (l'arbre de ce dépôt porte `src/data`), soit ~17 s au premier push
    // d'une branche ; les suivants ne paient que si la plage touche le périmètre.
    const plage = shaDistant && shaDistant !== ZERO ? `${shaDistant}..${shaLocal}` : null
    const ditPlage = plage ?? `l’arbre entier de ${shaLocal.slice(0, 7)} (ref distante neuve)`
    const touches = (() => {
      try {
        const args = plage ? ['diff', '--name-only', plage] : ['ls-tree', '-r', '--name-only', shaLocal]
        return git(args).split(/\r?\n/).filter(Boolean)
      } catch {
        return null
      }
    })()
    if (touches === null) {
      refus.push(`${refLocale} → ${refDistante} : contenu de ${ditPlage} illisible — rejeu des migrations non jugé`)
    } else if (!armeLeRejeu(touches)) {
      notes.push(`replay sauté : aucun fichier du périmètre des migrations dans ${ditPlage}`)
    } else {
      try {
        // `ecrire: () => {}` : le détail des 88 migrations n'a pas sa place dans un refus de hook —
        // seuls les rouges sont nommés, et le refus renvoie à `npm run migrations:replay:head`.
        const rejeu =
          rejeuxJoues.get(shaLocal) ?? rejeuSurExport({ cwd, sha: shaLocal, ecrire: () => {} })
        rejeuxJoues.set(shaLocal, rejeu)
        if (rejeu.rouges.length) {
          refus.push(`${refLocale} → ${refDistante} : rejeu des migrations ROUGE sur l’export de ${shaLocal.slice(0, 7)}`)
          for (const r of rejeu.rouges) refus.push(`  · ${r}`)
          refus.push('  → rejouer et lire le détail : npm run migrations:replay:head')
        } else {
          notes.push(
            `rejeu des migrations vert sur l’export de ${shaLocal.slice(0, 7)} (${rejeu.chronos.total.toFixed(1)}s)`,
          )
        }
      } catch (e) {
        refus.push(`${refLocale} → ${refDistante} : rejeu des migrations impossible — ${e.message}`)
      }
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
