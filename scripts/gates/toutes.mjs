#!/usr/bin/env node
// `npm run gates` (#1679 L2) — joue, DANS L'ORDRE DE `ci.yml`, chaque gate dont le justificatif
// manque, est rouge ou fut pris sur un arbre sale, et s'arrête au premier rouge. C'est la
// commande que le refus du pre-push nomme : le régime « suite complète + tsc avant push » a un prix,
// et ce prix s'imprime ici, gate par gate.
//
// L'ARBRE DOIT ÊTRE PROPRE AVANT LE PREMIER SPAWN : une gate jouée sur un arbre sale ne justifie
// rien (le pre-push la refusera), et la découvrir après dix minutes de gates est le pire moment.
//
// `--tout` rejoue tout, justificatif ou pas (mesure du coût plein) ; `--liste` n'imprime que le plan
// (ce qui serait joué, et pourquoi) sans rien jouer.
//
// Chaque gate passe par `scripts/gates/justifie.mjs`, jamais par la commande nue : c'est lui qui
// écrit le justificatif au vert, et lui seul. Quand un script `<gate>:brut` existe, c'est LUI qui est
// joué : sans quoi `npm run <gate>` rentrerait dans une deuxième enveloppe et écrirait deux fois.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { enteteArbre } from '../guards/lib/enteteArbre.mjs'
import {
  cleTree,
  gatesRequises,
  lireJustificatif,
  motifDeRefus,
  perimetreSale,
} from '../guards/lib/justificatif.mjs'
import { codeEnfant } from '../test/partition.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))
const TOUT = process.argv.includes('--tout')
const LISTE = process.argv.includes('--liste')

process.stderr.write(`[gates] ${enteteArbre(RACINE)}\n`)

const salis = perimetreSale({ cwd: RACINE })
if (salis.length && !LISTE) {
  process.stderr.write(
    `[gates] REFUS — l'arbre porte ${salis.length} chemin(s) non committé(s) au périmètre de la clé :\n` +
      `${salis.map((s) => `  ${s}`).join('\n')}\n` +
      `[gates] committer d'abord : une gate jouée sur cet arbre ne justifiera aucun push.\n`,
  )
  process.exit(1)
}

const scripts = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8')).scripts ?? {}
const cle = cleTree('HEAD', { cwd: RACINE })
const gates = gatesRequises({ cwd: RACINE })
process.stderr.write(`[gates] ${gates.length} gate(s) lues dans ci.yml · contenu ${cle.slice(0, 12)}\n`)

const debutTotal = Date.now()
let code = 0
for (const gate of gates) {
  const vue = lireJustificatif({ cwd: RACINE, cleTree: cle, gate: gate.nom })
  const motif = motifDeRefus(vue, gate)
  if (!TOUT && !motif) {
    process.stderr.write(`[gates] ${gate.nom} — déjà justifiée sur ce contenu\n`)
    continue
  }
  process.stderr.write(`[gates] ${gate.nom} — ${TOUT ? 'rejeu demandé' : motif}\n`)
  if (LISTE) continue
  const commande = scripts[`${gate.nom}:brut`] ? `npm run ${gate.nom}:brut` : gate.commande
  const debut = Date.now()
  const enfant = spawnSync(
    process.execPath,
    [join(RACINE, 'scripts', 'gates', 'justifie.mjs'), gate.nom, '--', ...commande.split(' ')],
    { cwd: RACINE, stdio: 'inherit' },
  )
  const secondes = ((Date.now() - debut) / 1000).toFixed(1)
  code = enfant.error ? 1 : codeEnfant(enfant.status, enfant.signal)
  process.stderr.write(`[gates] ${gate.nom} — exit ${code} en ${secondes} s\n`)
  if (code !== 0) break
}
process.stderr.write(`[gates] total ${((Date.now() - debutTotal) / 1000).toFixed(1)} s · exit ${code}\n`)
process.exit(code)
