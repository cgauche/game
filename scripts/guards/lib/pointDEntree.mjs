/**
 * Détection écrite À LA MAIN du point d'entrée d'un module (« ce module est-il le script lancé ? »).
 * La réponse unique est celle de la plateforme, `import.meta.main` (Node >= 22.18, `package.json`
 * `engines`) : elle ne compare aucun chemin, et répond donc pareil pour un `argv[1]` relatif, un lien
 * symbolique, la casse d'une lettre de lecteur ou un `.mts` lancé par tsx.
 *
 * Est une détection à la main, sur le CODE seul (`codeSeul` : un commentaire qui CITE l'idiome
 * documente, il n'exécute rien), toute ligne qui :
 *   - consulte `require.main` ou `process.mainModule` ;
 *   - lit le script lancé (`process.argv[1]`, `process.argv.at(1)`, `argv[1]` quand `argv` vient de
 *     `node:process`) ET le compare (`===`, `!==`, `.endsWith(`…) ou le normalise en chemin/URL
 *     (`resolve(`, `pathToFileURL(`…) ;
 *   - LIE le script lancé à un nom (`const x = process.argv[1]`, `[, x] = process.argv`), ce qui
 *     déporterait la comparaison hors de la ligne ;
 *   - compare l'identité du module (`import.meta.url`, `import.meta.filename`, `__filename`) à quoi
 *     que ce soit (`===`, `.endsWith(`, `argv.includes(`…).
 * Un `argv[1]` qui ne fait qu'ÊTRE AFFICHÉ (message d'usage) ou transmis n'est pas une détection.
 */
import { codeSeul } from './commentPoison.mjs'

const SCRIPT_LANCE = String.raw`(?:\?\.)?\s*(?:\[\s*1\s*\]|\.at\(\s*1\s*\))`
const PROCESS_ARGV_1 = new RegExp(String.raw`\bprocess\s*\.\s*argv\s*${SCRIPT_LANCE}`)
const ARGV_1_NU = new RegExp(String.raw`(?<![.\w$])argv\s*${SCRIPT_LANCE}`)
const DESTRUCTURATION = /\[\s*,\s*[\w$]+[^\]]*\]\s*=\s*process\s*\.\s*argv\b/
const LIAISON = new RegExp(String.raw`(?<![=!<>])=\s*(?:process\s*\.\s*)?argv\s*${SCRIPT_LANCE}\s*(?:;|$|\?\?|\|\|)`)
const ARGV_DE_PROCESS =
  /import\s*\{[^}]*\bargv\b[^}]*\}\s*from\s*['"](?:node:)?process['"]|\{[^}]*\bargv\b[^}]*\}\s*=\s*process\b/
const COMPARE_OU_NORMALISE =
  /[!=]==?|\.(?:endsWith|startsWith|includes)\s*\(|\b(?:resolve|pathToFileURL|fileURLToPath|realpathSync|basename|normalize)\s*\(|\bnew\s+URL\s*\(/
const COMPARAISON = /[!=]==?|\.(?:endsWith|startsWith|includes)\s*\(/
const MODULE_PRINCIPAL = /\brequire\s*\.\s*main\b|\bprocess\s*\.\s*mainModule\b/
const IDENTITE_DU_MODULE = /\bimport\s*\.\s*meta\s*\.\s*(?:url|filename)\b|\b__filename\b/

/**
 * Détections du point d'entrée écrites à la main dans une source.
 * @param {string} source texte du fichier
 * @returns {{ ligne: number, extrait: string }[]} `ligne` 1-based, valable pour la source d'origine
 */
export function detectionsDePointDEntree(source) {
  const code = codeSeul(source)
  const argvDeProcess = ARGV_DE_PROCESS.test(code)
  const trouvees = []
  code.split(/\r?\n/).forEach((ligne, i) => {
    const litLeScriptLance = PROCESS_ARGV_1.test(ligne) || (argvDeProcess && ARGV_1_NU.test(ligne))
    if (
      MODULE_PRINCIPAL.test(ligne) ||
      DESTRUCTURATION.test(ligne) ||
      (litLeScriptLance && LIAISON.test(ligne)) ||
      (litLeScriptLance && COMPARE_OU_NORMALISE.test(ligne)) ||
      (IDENTITE_DU_MODULE.test(ligne) && COMPARAISON.test(ligne))
    ) {
      trouvees.push({ ligne: i + 1, extrait: ligne.trim() })
    }
  })
  return trouvees
}
