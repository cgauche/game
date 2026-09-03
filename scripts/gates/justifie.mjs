#!/usr/bin/env node
// ENVELOPPE DE GATE (#1679 L2) : `node scripts/gates/justifie.mjs <gate> [--capture <fichier>] --
// <cmd> [args…]`. Joue la commande TELLE QUELLE (sortie relayée, code de sortie propagé) et, AU VERT
// SEULEMENT, enregistre le justificatif de `<gate>` pour le contenu de HEAD.
//
// Le nom de gate n'est pas décoratif : c'est celui que `gatesRequises` lit dans `ci.yml` (`npm run
// <x>` → `<x>`), donc celui que le pre-push exige. Un rouge n'écrit RIEN — un justificatif ne se
// construit jamais à partir d'un code de sortie supposé.
//
// UNE COMMANDE JOUÉE HORS D'ICI N'ÉCRIT RIEN : `npm run typecheck:brut` (le corps, sans enveloppe)
// tourne et ne laisse aucun justificatif — c'est `npm run typecheck` / `npm run gates` qui en posent
// un. Le refus du pre-push nomme toujours la commande qui produit ce qui lui manque.
//
// SEULS `npm` et `node` sont lançables ici : un outil nu serait résolu par le PATH, où npm empile les
// `node_modules/.bin` de tous les arbres ANCÊTRES (#1679 L1c) — les gates passent donc par un script
// de `package.json`, qui lui-même passe par `scripts/lancer-local.mjs`.
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { ecrireJustificatif } from '../guards/lib/justificatif.mjs'
import { codeEnfant } from '../test/partition.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Découpe `<gate> [--capture <fichier>] -- <cmd> [args…]`, ou `null` si la forme n'est pas tenue. */
export function separerInvocation(argv) {
  const coupure = argv.indexOf('--')
  if (coupure < 1) return null
  const [gate, ...options] = argv.slice(0, coupure)
  const [cmd, ...args] = argv.slice(coupure + 1)
  if (!gate || !cmd) return null
  const i = options.indexOf('--capture')
  const capture = i >= 0 ? options[i + 1] : undefined
  return { gate, capture, cmd, args }
}

const invocation = separerInvocation(process.argv.slice(2))
if (!invocation) {
  console.error('[gate] usage : node scripts/gates/justifie.mjs <gate> [--capture <fichier>] -- <cmd> [args…]')
  process.exit(2)
}
const { gate, capture, cmd, args } = invocation
if (cmd !== 'npm' && cmd !== 'node') {
  console.error(
    `[gate] commande refusée : ${cmd} — une gate se joue par « npm run <script> » (le script passe ` +
      'par scripts/lancer-local.mjs), jamais par un outil nu résolu sur le PATH',
  )
  process.exit(2)
}

const enfant = spawnSync(cmd === 'node' ? process.execPath : cmd, args, {
  cwd: RACINE,
  stdio: 'inherit',
  shell: cmd === 'npm' && process.platform === 'win32',
})
const code = enfant.error ? 1 : codeEnfant(enfant.status, enfant.signal)
if (enfant.error) console.error(`[gate] lancement de ${cmd} impossible : ${enfant.error.message}`)

// L'écriture du justificatif est de la COMPTABILITÉ : son échec (git indisponible une seconde,
// disque plein) ne change pas le verdict de la gate, qui vient d'être mesuré. Il est DIT, et le
// pre-push refusera faute de justificatif — jamais un vert de gate travesti en rouge, ni l'inverse.
if (code === 0) {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: RACINE, encoding: 'utf8' }).trim()
    const { fichier, cleTree, salis } = ecrireJustificatif({ cwd: RACINE, gate, sha, capture })
    console.error(
      `[gate] ${gate} VERTE sur ${sha.slice(0, 7)} (contenu ${cleTree.slice(0, 12)}` +
        `${salis.length ? `, arbre SALE : ${salis.length} chemin(s) au périmètre` : ''}) → ${fichier}`,
    )
  } catch (e) {
    console.error(`[gate] ${gate} VERTE, justificatif NON écrit : ${e.message} — rejoue la gate avant de pousser`)
  }
}
process.exit(code)
