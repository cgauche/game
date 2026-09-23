/**
 * Détection écrite À LA MAIN du point d'entrée d'un module (« ce module est-il le script lancé ? »).
 * La réponse unique est celle de la plateforme, `import.meta.main` (Node >= 22.18, `package.json`
 * `engines`) : elle ne compare aucun chemin, et répond donc pareil pour un `argv[1]` relatif, un lien
 * symbolique, la casse d'une lettre de lecteur ou un `.mts` lancé par tsx.
 *
 * La lecture porte sur le CODE seul (`codeSeul` : un commentaire qui CITE l'idiome documente, il
 * n'exécute rien ; une chaîne, elle, est du code). Est une détection :
 *   1. la LECTURE de l'élément 1 de `argv`, le script lancé, quel que soit l'usage (comparaison,
 *      message, transmission) : `process.argv[1]`, `?.[1]`, `.at(1)`, `.slice(1)[0]`,
 *      `.slice(1, 2)[0]`, `.slice(1).shift()`, une déstructuration qui saute le premier élément
 *      (`[, x] = process.argv`, `{ argv: [, x] } = process`) ou qui lit le premier de `.slice(1)`
 *      (`[x] = process.argv.slice(1)`). `process` s'y lit aussi `globalThis.process`,
 *      `global.process`, `require('node:process')`, et `argv` s'y lit aussi `['argv']`. Mêmes formes
 *      sur un NOM lié dans le fichier à `argv` (`import { argv } from 'node:process'`,
 *      `{ argv } = process`, `{ argv } = require('node:process')`, `a = process.argv`, déclaré seul
 *      ou dans une liste `const a = process.argv, b = 2`) ou à `process` (`import p from
 *      'node:process'`, `import * as p from 'node:process'`, `p = require('node:process')`,
 *      `p = globalThis.process`). Ces formes se lisent sur le code ENTIER : une lecture coupée par un
 *      saut de ligne est détectée. HORS de portée : l'alias d'un alias (`const b = a`), un tableau
 *      dérivé lu plus loin (`const reste = process.argv.slice(1)` puis `reste[0]`), une tranche
 *      lue par sa fin (`.slice(1, 2).pop()`, `.slice(1, 2).at(-1)`), un nom de propriété calculé
 *      (`process[cle]`) ;
 *   2. `require.main`, `process.mainModule` et, en CommonJS, `module.parent` — pas leur forme
 *      indexée par une chaîne (`require['main']`) ;
 *   3. sur une même ligne, l'identité du module (`import.meta.url`, `import.meta.filename`,
 *      `__filename`) et une comparaison d'ÉGALITÉ (`===`, `!==`, `==`, `!=`), ou son passage à
 *      `argv.includes(`/`argv.indexOf(` ; et, sur le code ENTIER, l'identité NUE opérande d'une
 *      égalité dont l'opérateur est sur une autre ligne ;
 *   4. `import.meta.main` LIÉ à un nom (`const principal = import.meta.main`) : un seul terme, lu
 *      là où il décide (`if (import.meta.main)`).
 * N'en sont PAS : `import.meta.url.startsWith('file:')`, `.includes('/node_modules/')`, un
 * `basename(import.meta.filename)` dans un message — ni égalité, ni `argv`.
 */
import { codeSeul } from './commentPoison.mjs'

const NOM = String.raw`[A-Za-z_$][\w$]*`
const MODULE_PROCESS = String.raw`['"](?:node:)?process['"]`
const PROCESS_GLOBAL = String.raw`(?:(?:globalThis|global)\s*(?:\?\.|\.)\s*)?process|require\s*\(\s*${MODULE_PROCESS}\s*\)`
const MEMBRE_ARGV = String.raw`\s*(?:(?:\?\.|\.)\s*argv(?![\w$])|(?:\?\.\s*)?\[\s*(?:'argv'|"argv"|\x60argv\x60)\s*\])`
const TRANCHE_1 = String.raw`\.\s*slice\s*\(\s*1\s*(?:,[^)]*)?\)`
const ELEMENT_1 = String.raw`\s*(?:\?\.\s*)?(?:\[\s*1\s*\]|\.\s*at\s*\(\s*1\s*\)|${TRANCHE_1}\s*(?:\?\.\s*)?(?:\[\s*0\s*\]|\.\s*at\s*\(\s*0\s*\)|\.\s*shift\s*\(\s*\)))`
const SAUTE_LE_PREMIER = String.raw`\[\s*,\s*(?:\.\.\.\s*)?${NOM}`
const LIT_LE_PREMIER = String.raw`\[\s*(?:\.\.\.\s*)?${NOM}`
const FIN_DE_TERME = String.raw`(?![\w$])(?!\s*(?:[.[(]|\?\.))`
const MODULE_PRINCIPAL = /\brequire\s*\.\s*main\b|\bprocess\s*\.\s*mainModule\b|(?<![.\w$])module\s*\.\s*parent\b/
const EGALITE = /[!=]==?/
const ALIAS_DE_MAIN = /(?<![=!<>])=\s*import\s*\.\s*meta\s*\.\s*main\b/
const IDENTITE = String.raw`(?:\bimport\s*\.\s*meta\s*\.\s*(?:url|filename)\b|\b__filename\b)`
const IDENTITE_DU_MODULE = new RegExp(IDENTITE)
/** Règle 3 quand l'opérande est l'identité NUE, opérateur et identité sur deux lignes. */
const EGALITE_A_L_IDENTITE = [new RegExp(String.raw`${IDENTITE}\s*[!=]==?`, 'g'), new RegExp(String.raw`[!=]==?\s*${IDENTITE}`, 'g')]

const echapper = (s) => s.replace(/[$]/g, '\\$')
const alias = (source) => new RegExp(String.raw`(?<![.\w$])(${NOM})\s*=\s*(?:${source})${FIN_DE_TERME}`, 'g')

/** Motif des expressions valant le module `process` dans ce fichier. PUR. */
function processDe(code) {
  const noms = new Set()
  const motifs = [
    new RegExp(String.raw`\bimport\s+(${NOM})\s*(?:,\s*\{[^}]*\})?\s*from\s*${MODULE_PROCESS}`, 'g'),
    new RegExp(String.raw`\bimport\s*\*\s*as\s+(${NOM})\s*from\s*${MODULE_PROCESS}`, 'g'),
    alias(PROCESS_GLOBAL),
  ]
  for (const motif of motifs) for (const m of code.matchAll(motif)) noms.add(m[1])
  return [PROCESS_GLOBAL, ...[...noms].map(echapper)].join('|')
}

/** Noms liés, dans ce fichier, au tableau `argv` du processus. PUR. */
function nomsDArgv(code, processus) {
  const noms = new Set()
  for (const m of code.matchAll(new RegExp(String.raw`\bimport\s*(?:${NOM}\s*,\s*)?\{([^}]*)\}\s*from\s*${MODULE_PROCESS}`, 'g'))) {
    for (const lien of m[1].matchAll(new RegExp(String.raw`\bargv\b(?:\s+as\s+(${NOM}))?`, 'g'))) noms.add(lien[1] ?? 'argv')
  }
  for (const m of code.matchAll(new RegExp(String.raw`\{([^{}]*)\}\s*=\s*(?:${processus})(?![\w$])`, 'g'))) {
    for (const lien of m[1].matchAll(new RegExp(String.raw`\bargv\b(?:\s*:\s*(${NOM}))?`, 'g'))) noms.add(lien[1] ?? 'argv')
  }
  for (const m of code.matchAll(alias(String.raw`(?:${processus})${MEMBRE_ARGV}`))) noms.add(m[1])
  return noms
}

/** Motifs de LECTURE de l'élément 1 (règle 1), à jouer sur le code ENTIER. PUR. */
function lecturesDuScriptLance(code) {
  const processus = processDe(code)
  const argv = [String.raw`(?:${processus})${MEMBRE_ARGV}`, ...[...nomsDArgv(code, processus)].map(echapper)]
  const tableau = String.raw`(?<![.\w$])(?:${argv.join('|')})(?![\w$])`
  return [
    new RegExp(`${tableau}${ELEMENT_1}`, 'g'),
    new RegExp(String.raw`${SAUTE_LE_PREMIER}[^\]]*\]\s*=\s*${tableau}`, 'g'),
    new RegExp(String.raw`${LIT_LE_PREMIER}[^\]]*\]\s*=\s*${tableau}\s*(?:\?\.\s*)?${TRANCHE_1}`, 'g'),
    new RegExp(String.raw`\bargv\s*:\s*${SAUTE_LE_PREMIER}[^\]]*\][^}]*\}\s*=\s*(?:${processus})(?![\w$])`, 'g'),
  ]
}

const ligneDe = (code, index) => code.slice(0, index).split('\n').length

/**
 * Détections du point d'entrée écrites à la main dans une source.
 * @param {string} source texte du fichier
 * @returns {{ ligne: number, extrait: string }[]} `ligne` 1-based, valable pour la source d'origine
 */
export function detectionsDePointDEntree(source) {
  const code = codeSeul(source)
  const lignes = code.split(/\r?\n/)
  const trouvees = new Set()
  for (const motif of [...lecturesDuScriptLance(code), ...EGALITE_A_L_IDENTITE]) {
    for (const m of code.matchAll(motif)) trouvees.add(ligneDe(code, m.index))
  }
  lignes.forEach((ligne, i) => {
    if (
      MODULE_PRINCIPAL.test(ligne) ||
      ALIAS_DE_MAIN.test(ligne) ||
      (IDENTITE_DU_MODULE.test(ligne) && (EGALITE.test(ligne) || /\bargv\s*\.\s*(?:includes|indexOf)\s*\(/.test(ligne)))
    ) {
      trouvees.add(i + 1)
    }
  })
  return [...trouvees].sort((a, b) => a - b).map((ligne) => ({ ligne, extrait: lignes[ligne - 1].trim() }))
}
