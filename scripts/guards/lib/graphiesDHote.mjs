/**
 * Lectures qui donnent au code du dépôt la graphie de chemin de l'HÔTE, là où le rendu sous win32
 * (`scripts/docs/lib/plateforme-win32.mjs`, #1801) ne peut pas lui substituer celle de Windows :
 * ses hooks de résolution ESM ne voient ni l'initialisation d'`import.meta`, ni le chargeur CJS.
 *
 * La lecture porte sur le CODE seul (`codeSeul` : un commentaire qui cite la forme documente, il
 * n'exécute rien ; une chaîne, elle, est du code). Est une lecture d'hôte :
 *   1. `import.meta.dirname` et `import.meta.filename` — accès par point, `?.`, crochets
 *      (`import.meta['filename']`), ou déstructuration (`{ dirname } = import.meta`) ;
 *   2. l'acquisition de `path` ou `url` (préfixe `node:` et sous-chemins `/posix`, `/win32` compris)
 *      par `require('…')`, `getBuiltinModule('…')`, `createRequire(…)('…')`, ou par un NOM lié
 *      dans le fichier à `createRequire(…)` (`const req = createRequire(…)` puis `req('…')`).
 * N'en sont PAS : `import.meta.url`, `import.meta.main`, `import … from 'node:path'` et
 * `import('node:path')` (hooks ESM), `createRequire(…)('typescript')`.
 * Ces formes se lisent sur le code ENTIER : une lecture coupée par un saut de ligne est détectée, à
 * la ligne où elle commence.
 */
import { codeSeul } from './commentPoison.mjs'

const NOM = String.raw`[A-Za-z_$][\w$]*`
const META = String.raw`\bimport\s*\.\s*meta`
const CHAMP = '(?:dirname|filename)'
const MODULE_DE_CHEMIN = String.raw`(['"\x60])(?:node:)?(?:path|url)(?:/(?:posix|win32))?\1`
/** Argument d'un appel, un niveau de parenthèses imbriquées compris (`createRequire(join(a, b))`). */
const ARGUMENTS = String.raw`\((?:[^()]|\([^()]*\))*\)`

const LECTURES_DE_META = [
  new RegExp(String.raw`${META}\s*(?:\?\.|\.)\s*${CHAMP}\b`, 'g'),
  new RegExp(String.raw`${META}\s*(?:\?\.\s*)?\[\s*(['"\x60])${CHAMP}\1\s*\]`, 'g'),
  new RegExp(String.raw`\{[^{}]*\b${CHAMP}\b[^{}]*\}\s*=\s*${META}\b`, 'g'),
]

const echapper = (s) => s.replace(/[$]/g, '\\$')

/** Noms liés, dans ce fichier, à un `require` fabriqué par `createRequire(…)`. PUR. */
function nomsDeRequire(code) {
  const noms = new Set(['require'])
  const lien = new RegExp(String.raw`\b(?:const|let|var)\s+(${NOM})\s*=\s*(?:${NOM}\s*\.\s*)?createRequire\s*${ARGUMENTS}`, 'g')
  for (const m of code.matchAll(lien)) noms.add(m[1])
  return noms
}

/** Motifs d'acquisition de `path`/`url` hors hooks (règle 2), à jouer sur le code ENTIER. PUR. */
function acquisitionsHorsHooks(code) {
  const lies = [...nomsDeRequire(code)].map(echapper).join('|')
  const appelant = String.raw`(?:(?<![.\w$])(?:${lies})|\bgetBuiltinModule|\bcreateRequire\s*${ARGUMENTS})`
  return [new RegExp(String.raw`${appelant}\s*\(\s*${MODULE_DE_CHEMIN}\s*,?\s*\)`, 'g')]
}

const ligneDe = (code, index) => code.slice(0, index).split('\n').length

/**
 * Lectures d'hôte que le rendu sous win32 ne simule pas, dans une source.
 * @param {string} source texte du fichier
 * @returns {{ ligne: number, extrait: string }[]} `ligne` 1-based, valable pour la source d'origine
 */
export function lecturesDHote(source) {
  const code = codeSeul(source)
  const lignes = code.split(/\r?\n/)
  const trouvees = new Set()
  for (const motif of [...LECTURES_DE_META, ...acquisitionsHorsHooks(code)]) {
    for (const m of code.matchAll(motif)) trouvees.add(ligneDe(code, m.index))
  }
  return [...trouvees].sort((a, b) => a - b).map((ligne) => ({ ligne, extrait: lignes[ligne - 1].trim() }))
}
