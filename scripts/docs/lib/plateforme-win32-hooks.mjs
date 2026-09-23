// Volet « hooks de modules » du rendu sous win32 (#1801) — enregistré par `plateforme-win32.mjs`.
// Pour un module DU DÉPÔT (`estModuleDuDepot`), `node:path` se résout en `path.win32` et `node:url`
// en un `fileURLToPath` qui rend la graphie Windows : c'est ce que ce code reçoit d'un hôte win32.
// Les modules de `node_modules` et node lui-même gardent leur `path` : ils ne sont pas jugés ici.
// La RACINE du dépôt rendu est celle que `run()` donne au générateur (`initialize`).
//
// Ce module est aussi importé depuis le thread principal (le `node:url` de remplacement y prend
// `versWindows` / `versPosix`) : il n'a donc AUCUN effet de bord à l'import.
import path from 'node:path'
import url from 'node:url'

/** Lecteur des chemins absolus rendus sous win32. */
const LECTEUR = 'C:'

/** Chemin absolu POSIX → sa graphie Windows (`/a/b` → `C:\a\b`) ; tout le reste passe tel quel. */
export const versWindows = (chemin) =>
  typeof chemin === 'string' && chemin.startsWith('/') ? `${LECTEUR}${chemin.replaceAll('/', '\\')}` : chemin

/** `true` si `chemin` est un absolu Windows (`C:\…`, `C:/…`). */
export const estAbsoluWindows = (chemin) => typeof chemin === 'string' && /^[A-Za-z]:[\\/]/.test(chemin)

/** Chemin en graphie Windows (absolu ou relatif) → le chemin POSIX que le disque porte. */
export const versPosix = (chemin) => {
  if (typeof chemin !== 'string') return chemin
  const s = chemin.replaceAll('\\', '/')
  return /^[A-Za-z]:\//.test(s) ? s.slice(LECTEUR.length) : s
}

/** URL `file:` du dossier racine du dépôt rendu, barre finale comprise. */
export const urlDuDepot = (racine) => url.pathToFileURL(path.join(racine, '/')).href

/** `true` si l'adresse (URL `file:`) est celle d'un module du dépôt, hors `node_modules`. */
export const estModuleDuDepot = (adresse, depot) =>
  typeof adresse === 'string' && adresse.startsWith(depot) && !adresse.includes('/node_modules/')

let depot = null

export function initialize({ racine }) {
  depot = urlDuDepot(racine)
}

const moduleDeSource = (source) => `data:text/javascript,${encodeURIComponent(source)}`

/** Noms exportables d'un module builtin, hors ceux que le remplaçant redéfinit. */
const nomsExportes = (objet, redefinis = []) =>
  Object.keys(objet).filter((k) => !redefinis.includes(k) && /^[A-Za-z_$][\w$]*$/.test(k))

const PATH_WIN32 = moduleDeSource(
  `import p from 'node:path'\nexport default p.win32\nexport const { ${nomsExportes(path.win32).join(', ')} } = p.win32\n`,
)

const URL_WIN32 = moduleDeSource(
  [
    `import u from 'node:url'`,
    `import { versWindows, versPosix } from ${JSON.stringify(import.meta.url)}`,
    'export const fileURLToPath = (x, o) => versWindows(u.fileURLToPath(x, o))',
    'export const pathToFileURL = (x, o) => u.pathToFileURL(versPosix(x), o)',
    `export const { ${nomsExportes(url, ['fileURLToPath', 'pathToFileURL']).join(', ')} } = u`,
    'export default { ...u, fileURLToPath, pathToFileURL }',
    '',
  ].join('\n'),
)

const REMPLACANTS = new Map([
  ['node:path', PATH_WIN32],
  ['path', PATH_WIN32],
  ['node:url', URL_WIN32],
  ['url', URL_WIN32],
])

export async function resolve(specificateur, contexte, suivant) {
  const remplacant = REMPLACANTS.get(specificateur)
  if (remplacant && estModuleDuDepot(contexte.parentURL, depot)) return { url: remplacant, shortCircuit: true }
  return suivant(specificateur, contexte)
}
