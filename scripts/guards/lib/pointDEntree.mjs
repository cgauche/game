/**
 * Détection écrite À LA MAIN du point d'entrée d'un module (« ce module est-il le script lancé ? »).
 * La réponse unique est celle de la plateforme, `import.meta.main` (Node >= 22.18, `package.json`
 * `engines`) : elle ne compare aucun chemin, et répond donc pareil pour un `argv[1]` relatif, un lien
 * symbolique, la casse d'une lettre de lecteur ou un `.mts` lancé par tsx.
 *
 * La lecture porte sur le CODE seul (`codeSeul` : un commentaire qui CITE l'idiome documente, il
 * n'exécute rien ; une chaîne, elle, est du code). Est une détection :
 *   1. toute LECTURE de l'élément 1 de `argv`, le script lancé, quel que soit l'usage (comparaison,
 *      message, transmission) : `process.argv[1]`, `?.[1]`, `.at(1)`, `.slice(1)[0]`, une
 *      déstructuration qui saute le premier élément (`[, x] = process.argv`,
 *      `{ argv: [, x] } = process`), et les mêmes formes sur un NOM lié dans le fichier à `argv`
 *      (`import { argv } from 'node:process'`, `{ argv } = process`, `const a = process.argv`) ou à
 *      `process` (`import p from 'node:process'`, `import * as p from 'node:process'`). Ces
 *      formes se lisent sur le code ENTIER : une lecture coupée par un saut de ligne est détectée ;
 *   2. `require.main` et `process.mainModule` ;
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
const ELEMENT_1 = String.raw`\s*(?:\?\.\s*)?(?:\[\s*1\s*\]|\.\s*at\s*\(\s*1\s*\)|\.\s*slice\s*\(\s*1\s*\)\s*(?:\?\.\s*)?(?:\[\s*0\s*\]|\.\s*at\s*\(\s*0\s*\)))`
const SAUTE_LE_PREMIER = String.raw`\[\s*,\s*(?:\.\.\.\s*)?${NOM}`
const MODULE_PRINCIPAL = /\brequire\s*\.\s*main\b|\bprocess\s*\.\s*mainModule\b/
const EGALITE = /[!=]==?/
const ALIAS_DE_MAIN = /(?<![=!<>])=\s*import\s*\.\s*meta\s*\.\s*main\b/
const IDENTITE = String.raw`(?:\bimport\s*\.\s*meta\s*\.\s*(?:url|filename)\b|\b__filename\b)`
const IDENTITE_DU_MODULE = new RegExp(IDENTITE)
/** Règle 3 quand l'opérande est l'identité NUE, opérateur et identité sur deux lignes. */
const EGALITE_A_L_IDENTITE = [new RegExp(String.raw`${IDENTITE}\s*[!=]==?`, 'g'), new RegExp(String.raw`[!=]==?\s*${IDENTITE}`, 'g')]

const echapper = (s) => s.replace(/[$]/g, '\\$')

/** Noms liés, dans ce fichier, au module `process` (en plus de `process` lui-même). PUR. */
function nomsDeProcess(code) {
  const noms = new Set(['process'])
  const motifs = [
    new RegExp(String.raw`\bimport\s+(${NOM})\s*(?:,\s*\{[^}]*\})?\s*from\s*${MODULE_PROCESS}`, 'g'),
    new RegExp(String.raw`\bimport\s*\*\s*as\s+(${NOM})\s*from\s*${MODULE_PROCESS}`, 'g'),
    new RegExp(String.raw`\b(?:const|let|var)\s+(${NOM})\s*=\s*require\s*\(\s*${MODULE_PROCESS}\s*\)`, 'g'),
  ]
  for (const motif of motifs) for (const m of code.matchAll(motif)) noms.add(m[1])
  return noms
}

/** Noms liés, dans ce fichier, au tableau `argv` du processus. PUR. */
function nomsDArgv(code, processus) {
  const noms = new Set()
  const alt = [...processus].map(echapper).join('|')
  for (const m of code.matchAll(new RegExp(String.raw`\bimport\s*(?:${NOM}\s*,\s*)?\{([^}]*)\}\s*from\s*${MODULE_PROCESS}`, 'g'))) {
    for (const lien of m[1].matchAll(new RegExp(String.raw`\bargv\b(?:\s+as\s+(${NOM}))?`, 'g'))) noms.add(lien[1] ?? 'argv')
  }
  for (const m of code.matchAll(new RegExp(String.raw`\{([^{}]*)\}\s*=\s*(?:${alt})\b`, 'g'))) {
    for (const lien of m[1].matchAll(new RegExp(String.raw`\bargv\b(?:\s*:\s*(${NOM}))?`, 'g'))) noms.add(lien[1] ?? 'argv')
  }
  for (const m of code.matchAll(new RegExp(String.raw`\b(?:const|let|var)\s+(${NOM})\s*=\s*(?:${alt})\s*\.\s*argv\s*(?:;|\n|$)`, 'g'))) {
    noms.add(m[1])
  }
  return noms
}

/** Motifs de LECTURE de l'élément 1 (règle 1), à jouer sur le code ENTIER. PUR. */
function lecturesDuScriptLance(code) {
  const processus = nomsDeProcess(code)
  const alt = [...processus].map(echapper).join('|')
  const argv = [String.raw`(?:${alt})\s*\.\s*argv`, ...[...nomsDArgv(code, processus)].map(echapper)]
  const tableau = String.raw`(?<![.\w$])(?:${argv.join('|')})\b`
  return [
    new RegExp(`${tableau}${ELEMENT_1}`, 'g'),
    new RegExp(String.raw`${SAUTE_LE_PREMIER}[^\]]*\]\s*=\s*${tableau}`, 'g'),
    new RegExp(String.raw`\bargv\s*:\s*${SAUTE_LE_PREMIER}[^\]]*\][^}]*\}\s*=\s*(?:${alt})\b`, 'g'),
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
