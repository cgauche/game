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
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { separerInvocation } from '../guards/lib/invocation.mjs'
import { ecrireJustificatif } from '../guards/lib/justificatif.mjs'
import { execFileResilient } from '../guards/lib/spawnResilient.mjs'
import { codeEnfant } from '../test/partition.mjs'

// L'arbre SUR LEQUEL la gate est mesurée. `npm run gates` le pose (`WFRP_GATES_RACINE`) : l'enveloppe
// est un OUTIL, elle peut vivre ailleurs que l'arbre jugé — c'est ce qui rend la politique d'arrêt
// des lanes mesurable sur un dépôt jetable, sans jamais écrire de justificatif dans le dépôt réel.
const RACINE = process.env.WFRP_GATES_RACINE ?? fileURLToPath(new URL('../..', import.meta.url))

const invocation = separerInvocation(process.argv.slice(2), { options: ['--capture'] })
if (!invocation) {
  console.error('[gate] usage : node scripts/gates/justifie.mjs <gate> [--capture <fichier>] -- <cmd> [args…]')
  process.exit(2)
}
const { positionnel: gate, options: { capture }, reste: [cmd, ...args] } = invocation
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
// `git rev-parse` passe par le rejeu de `spawnResilient` : sous quatre lanes, le loader Windows a
// refusé de le démarrer (3221225794) et `typecheck` est sorti VERT en 155,8 s SANS justificatif —
// une gate payée qui ne justifie aucun push (mesuré le 2026-09-04).
if (code === 0) {
  try {
    const sha = execFileResilient('git', ['rev-parse', 'HEAD'], { cwd: RACINE, encoding: 'utf8' }, {
      site: `justifie.mjs/${gate}`,
    }).trim()
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
