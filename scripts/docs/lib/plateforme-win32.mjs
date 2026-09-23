// Rendu d'un générateur SOUS win32 (#1801) — module `node --import`, composé par `run()` de
// `scripts/docs/build-all.mjs` dans `NODE_OPTIONS` (`--plateforme win32`, et chaque générateur de
// `--check --tout`). Il se pose APRÈS l'enregistreur de lectures, qui reçoit donc des chemins POSIX,
// et AVANT `tsx/esm`.
//
// Ce que voit le code du dépôt : `node:path` = `path.win32` et `fileURLToPath` en graphie Windows
// (`plateforme-win32-hooks.mjs`), `process.cwd()` sous le lecteur `C:`. Le code de `node_modules` et
// node lui-même voient l'hôte, `process.cwd()` compris : son `path` est celui de l'hôte, et un cwd en
// `C:\` le rendrait incohérent (tsx ne trouvait plus `tsconfig.json`, donc plus son `jsx`). Aucune
// source ne lit le chemin du script dans `argv` (garde `src/point-d-entree-guard.test.ts`).
// Ce qu'il touche : le disque POSIX — toute ENTRÉE de `fs` (chemins en argument) et de
// `child_process` (exécutable, argv absolus, `cwd`) est ramenée en POSIX. La racine du dépôt rendu :
// `WFRP_PLATEFORME_RACINE`, posée par `run()` comme la racine de l'enregistreur. Les SORTIES de `fs` et de
// `child_process` restent celles de l'hôte.
import cp from 'node:child_process'
import fs from 'node:fs'
import { register, syncBuiltinESMExports } from 'node:module'
import { pathToFileURL } from 'node:url'
import { estAbsoluWindows, estModuleDuDepot, urlDuDepot, versPosix, versWindows } from './plateforme-win32-hooks.mjs'

/** Nom → nombre d'arguments-CHEMINS en tête, pour la forme synchrone, à rappel et `fs.promises`. */
const ENTREES_FS = {
  access: 1, appendFile: 1, chmod: 1, chown: 1, copyFile: 2, cp: 2, exists: 1, glob: 1, lchown: 1,
  link: 2, lstat: 1, lutimes: 1, mkdir: 1, mkdtemp: 1, open: 1, opendir: 1, readdir: 1, readFile: 1,
  readlink: 1, realpath: 1, rename: 2, rm: 1, rmdir: 1, stat: 1, statfs: 1, symlink: 2, truncate: 1,
  unlink: 1, utimes: 1, writeFile: 1,
}
const FLUX_FS = { createReadStream: 1, createWriteStream: 1, watch: 1, watchFile: 1, unwatchFile: 1 }

/** Propriétés d'une fonction de `fs` à porter sur son enveloppe (`realpathSync.native`, symboles). */
const PROPRES_NON_PORTEES = new Set(['length', 'name', 'prototype', 'arguments', 'caller'])

function envelopper(originale, nombre) {
  const enveloppe = function (...args) {
    for (let i = 0; i < nombre && i < args.length; i++) args[i] = versPosix(args[i])
    return originale.apply(this, args)
  }
  for (const cle of Reflect.ownKeys(originale)) {
    if (PROPRES_NON_PORTEES.has(cle)) continue
    const valeur = originale[cle]
    enveloppe[cle] = cle === 'native' && typeof valeur === 'function' ? envelopper(valeur, nombre) : valeur
  }
  return enveloppe
}

const envelopperSurPlace = (hote, nom, nombre) => {
  if (typeof hote[nom] === 'function') hote[nom] = envelopper(hote[nom], nombre)
}

for (const [nom, nombre] of Object.entries(ENTREES_FS)) {
  envelopperSurPlace(fs, nom, nombre)
  envelopperSurPlace(fs, `${nom}Sync`, nombre)
  envelopperSurPlace(fs.promises, nom, nombre)
}
for (const [nom, nombre] of Object.entries(FLUX_FS)) envelopperSurPlace(fs, nom, nombre)

const argvPosix = (args) => args.map((a) => (estAbsoluWindows(a) ? versPosix(a) : a))
const optionsPosix = (options) =>
  options && typeof options === 'object' && typeof options.cwd === 'string'
    ? { ...options, cwd: versPosix(options.cwd) }
    : options

for (const nom of ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'fork']) {
  const originale = cp[nom]
  cp[nom] = function (fichier, args, options, ...reste) {
    const executable = estAbsoluWindows(fichier) ? versPosix(fichier) : fichier
    return Array.isArray(args)
      ? originale.call(this, executable, argvPosix(args), optionsPosix(options), ...reste)
      : originale.call(this, executable, optionsPosix(args), options, ...reste)
  }
}
for (const nom of ['exec', 'execSync']) {
  const originale = cp[nom]
  cp[nom] = function (commande, options, ...reste) {
    return originale.call(this, commande, optionsPosix(options), ...reste)
  }
}
syncBuiltinESMExports()

const racine = process.env.WFRP_PLATEFORME_RACINE
if (!racine) throw new Error('plateforme-win32 : WFRP_PLATEFORME_RACINE absent — ce module se compose par run() de scripts/docs/build-all.mjs')
const depot = urlDuDepot(racine)

/** Adresse `file:` du module qui appelle : premier cadre de pile hors de ce fichier et de node. */
function moduleAppelant() {
  const { prepareStackTrace, stackTraceLimit } = Error
  Error.stackTraceLimit = 32
  Error.prepareStackTrace = (_, cadres) => cadres
  try {
    for (const cadre of new Error().stack) {
      const fichier = cadre.getFileName()
      if (!fichier || fichier.startsWith('node:') || fichier === import.meta.url) continue
      return fichier.startsWith('/') ? pathToFileURL(fichier).href : fichier
    }
    return null
  } finally {
    Error.prepareStackTrace = prepareStackTrace
    Error.stackTraceLimit = stackTraceLimit
  }
}

const cwdHote = process.cwd.bind(process)
const chdirHote = process.chdir.bind(process)
process.cwd = () => (estModuleDuDepot(moduleAppelant(), depot) ? versWindows(cwdHote()) : cwdHote())
process.chdir = (dossier) => chdirHote(versPosix(dossier))

register(new URL('plateforme-win32-hooks.mjs', import.meta.url).href, { data: { racine } })
