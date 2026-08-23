#!/usr/bin/env node
// Lanceur de `npm test` : DEUX processus Vitest concurrents, l'un pour les fichiers `node`,
// l'autre pour les fichiers `@vitest-environment jsdom`.
//
// Mesure de référence — 2026-08-23, dos à dos sur arbre identique, 16 cœurs : mono 127,5 s →
// split 97,8 s (−23 %), mêmes 1 451 fichiers. La parité porte sur les FICHIERS : sous
// `isolate:false` le groupement change, et un flake d'ordre (`bascule-de-vue`) change de verdict.
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import {
  argumentsEnfant,
  codeAgrege,
  codeEnfant,
  partitionner,
  repartitionWorkers,
  cotesRequis,
  separerArguments,
  cheminsGlobSuspects,
} from './partition.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))
const VITEST = path.join(RACINE, 'node_modules/vitest/vitest.mjs')
// Atelier jetable, un dossier par processus lanceur (deux runs concurrents ne se recouvrent pas) :
// hors de l'arbre versionné, mais SOUS le projet — les configs générées y résolvent
// `vite`/`@vitejs/plugin-react` par remontée normale de `node_modules`.
const ATELIERS = path.join(RACINE, 'node_modules/.vitest-split')
const ATELIER = path.join(ATELIERS, String(process.pid))

// Windows refuse d'effacer un fichier encore tenu par un enfant fraîchement tué : l'échec de
// suppression se signale sur stderr, il ne change pas le verdict de la suite.
const supprimer = (cible) => {
  try {
    fs.rmSync(cible, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } catch (e) {
    process.stderr.write(`[test] suppression de ${cible} impossible : ${e.message}\n`)
  }
}

const estVivant = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Ateliers des lanceurs morts (suppression refusée sur le coup, machine éteinte en plein run) :
 *  le lanceur suivant les balaie, ceux des lanceurs vivants restent intacts. */
const balayerAteliersMorts = () => {
  for (const nom of fs.existsSync(ATELIERS) ? fs.readdirSync(ATELIERS) : []) {
    const pid = Number(nom)
    if (!Number.isInteger(pid) || pid === process.pid || estVivant(pid)) continue
    supprimer(path.join(ATELIERS, nom))
  }
}

const posix = (p) => p.split(path.sep).join('/')

const ARGV = process.argv.slice(2)
const { filtres, mono } = separerArguments(ARGV, (t) => fs.existsSync(path.resolve(RACINE, t)))

/** Lancement à un seul processus Vitest : machine sous le seuil de partage, drapeau global à un
 *  seul processus, ou filtre qui ne touche qu'un côté. */
function lancementUnique(args) {
  const p = spawn(process.execPath, [VITEST, 'run', ...args], { cwd: RACINE, stdio: 'inherit' })
  const relais = (s) => p.kill(s)
  process.on('SIGINT', relais)
  process.on('SIGTERM', relais)
  return new Promise((res) => {
    p.on('error', (e) => {
      process.stderr.write(`[test] lancement de Vitest impossible : ${e.message}\n`)
      res(1)
    })
    p.on('close', (code, signal) => res(codeEnfant(code, signal)))
  })
}

async function principal() {
  const cpus = os.availableParallelism?.() ?? os.cpus().length
  const workers = repartitionWorkers(cpus)
  if (mono || !workers.split) return lancementUnique(ARGV)

  balayerAteliersMorts()
  fs.mkdirSync(ATELIER, { recursive: true })

  // Énumération par Vitest lui-même (1,0 s mesuré) : les `include`/`exclude` de vite.config.ts
  // ne sont recopiés nulle part.
  const liste = path.join(ATELIER, 'fichiers.json')
  const inventaire = spawnSync(process.execPath, [VITEST, 'list', '--filesOnly', `--json=${liste}`], {
    cwd: RACINE,
    encoding: 'utf8',
  })
  if (inventaire.status !== 0) {
    process.stderr.write(inventaire.stdout + inventaire.stderr)
    return inventaire.status ?? 1
  }
  const fichiers = JSON.parse(fs.readFileSync(liste, 'utf8')).map((e) => e.file)
  const partition = partitionner(fichiers, (f) => fs.readFileSync(f, 'utf8'))

  const cotes = cotesRequis(filtres, partition, RACINE)
  const suspects = cheminsGlobSuspects(fichiers)
  if (cotes.length < 2 || suspects.length) {
    if (suspects.length) {
      process.stderr.write(
        `[split] chemin à métacaractère de glob, partage impossible : ${suspects[0]}\n`,
      )
    }
    return lancementUnique(ARGV)
  }

  const debut = Date.now()
  const enfants = []

  const lancer = (cote) => {
    const inclus = partition[cote].map((f) => posix(path.relative(RACINE, f)))
    const config = path.join(ATELIER, `vitest.${cote}.config.ts`)
    fs.writeFileSync(
      config,
      `// Généré par scripts/test/run.mjs à chaque lancement — jamais édité, jamais committé.\n` +
        `import base from ${JSON.stringify(posix(path.join(RACINE, 'vite.config.ts')))};\n` +
        // `mergeConfig` CONCATÈNE les `include` (mesuré 2026-08-23) : l'étalement explicite est
        // le seul moyen de REMPLACER la liste du fichier de base.
        `export default { ...base, root: ${JSON.stringify(posix(RACINE))}, ` +
        `test: { ...base.test, include: ${JSON.stringify(inclus)} } };\n`,
    )
    const p = spawn(process.execPath, argumentsEnfant(VITEST, config, workers[cote], ARGV), {
      cwd: RACINE,
    })
    enfants.push(p)
    const prefixer = (flux, sortie) => {
      let reste = ''
      flux.setEncoding('utf8')
      flux.on('data', (d) => {
        const lignes = (reste + d).split('\n')
        reste = lignes.pop()
        for (const l of lignes) sortie.write(`[${cote}] ${l}\n`)
      })
      flux.on('end', () => {
        if (reste) sortie.write(`[${cote}] ${reste}\n`)
      })
    }
    prefixer(p.stdout, process.stdout)
    prefixer(p.stderr, process.stderr)
    return new Promise((res) => {
      p.on('error', (e) => {
        process.stderr.write(`[${cote}] lancement de Vitest impossible : ${e.message}\n`)
        for (const frere of enfants) if (frere !== p) frere.kill()
        res({ cote, code: 1 })
      })
      p.on('close', (code, signal) => res({ cote, code: codeEnfant(code, signal) }))
    })
  }

  const relais = (s) => enfants.forEach((p) => p.kill(s))
  process.on('SIGINT', relais)
  process.on('SIGTERM', relais)

  const resultats = await Promise.all(cotes.map(lancer))
  const real = ((Date.now() - debut) / 1000).toFixed(1)
  const synthese = resultats.map((r) => `${r.cote}: exit ${r.code}`).join(' · ')
  process.stdout.write(`${synthese} · real ${real}s\n`)
  return codeAgrege(resultats.map((r) => r.code))
}

let code
try {
  code = await principal()
} finally {
  supprimer(ATELIER)
}
process.exit(code)
