// PROJECTION du registre des livres vers les `args` d'un workflow d'extraction Atlas.
// Un script `*.workflow.js` est un corps d'`AsyncFunction` : ni `import`, ni accès fichier — il ne
// peut donc pas lire `src/data/books.json`. Le registre lui ENTRE par le global `args` (#1825 : le
// code ne nomme AUCUN livre ; un livre de plus est UNE entrée de `books.json`, zéro ligne ici).
//   node scripts/raw/workflow-args.mjs <coeur> --avec-supplements|--coeur-seul
// Forme rendue : `{ coeur, supplements, livres: [{ ab, dir, coeur, language }] }`.
// PÉRIMÈTRE d'un cœur — ce que le registre SAIT, ce qu'il ne sait PAS :
//   · il SAIT l'APPARTENANCE d'un livre à un corps de règles (champ `coeur` ; `livresDeCoeur`,
//     `_lib.mjs`, rend les livres qui en portent un) ;
//   · il ne sait RIEN de la COMPATIBILITÉ d'un SUPPLÉMENT (`coeur` absent) avec un cœur donné.
// Un supplément n'est donc ni inclus ni exclu par défaut : l'appelant DÉCLARE son choix
// (`supplements`), le résultat le PORTE, et le rapport du run le dit. Aucun défaut n'est offert —
// un défaut trancherait, en silence, une règle de jeu qui n'appartient pas au code.
// `coeursDuRegistre` vit dans `_lib.mjs`, avec la lecture du registre : c'est la MÊME population
// qui ouvre les dossiers de l'Atlas (`pagesDeLAtlas`) et les périmètres d'extraction.
import { REGISTRE_LIVRES, coeursDuRegistre, estLivreExtrait } from './_lib.mjs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const CHOIX = { '--avec-supplements': true, '--coeur-seul': false }
const CHOIX_DITS = Object.keys(CHOIX).join(' | ')

/**
 * Le périmètre d'extraction d'UN cœur. LÈVE en NOMMANT la cause — un périmètre silencieusement vide
 * ferait survoler des livres entiers sans qu'aucun rapport ne le dise, et un `supplements` deviné
 * trancherait une règle de jeu.
 * @param {string} coeur clé `coeur` de `src/data/books.json`
 * @param {{ supplements: boolean, registre?: Array<object> }} options `supplements` OBLIGATOIRE
 * @returns {{ coeur: string, supplements: boolean, livres: Array<{ ab: string, dir: string, coeur: string|null, language: string }> }}
 */
export function perimetreDeCoeur(coeur, options = {}) {
  const { supplements, registre = REGISTRE_LIVRES } = options
  const connus = coeursDuRegistre(registre)
  const dits = connus.length ? connus.join(', ') : '(aucun)'
  if (typeof coeur !== 'string' || !coeur)
    throw new Error(`workflow-args: cœur demandé absent ou non textuel — cœurs du registre : ${dits}`)
  if (!connus.includes(coeur))
    throw new Error(`workflow-args: aucun livre de cœur « ${coeur} » au registre des livres — cœurs du registre : ${dits}`)
  if (typeof supplements !== 'boolean')
    throw new Error(
      'workflow-args: `supplements` non déclaré — le registre ne dit RIEN de la compatibilité '
      + `d'un supplément avec le cœur « ${coeur} » : déclare \`supplements: true\` (le cœur ET tous les `
      + 'suppléments du registre) ou `supplements: false` (les livres de ce cœur SEULS)',
    )
  const retenus = registre.filter((b) =>
    estLivreExtrait(b) && (b.coeur === coeur || (supplements && (b.coeur ?? null) === null)))
  const sansLangue = retenus.filter((b) => !b.language)
  if (sansLangue.length)
    throw new Error(
      `workflow-args: ${sansLangue.length} livre(s) du périmètre sans champ \`language\` (${sansLangue.map((b) => b.abbr).join(', ')}) — `
      + 'la langue des citations ne se devine pas : renseigner `language` dans `src/data/books.json`',
    )
  return {
    coeur,
    supplements,
    livres: retenus.map((b) => ({ ab: b.abbr, dir: b.dir, coeur: b.coeur ?? null, language: b.language })),
  }
}

function main() {
  const [, , demande, drapeau] = process.argv
  try {
    if (!Object.hasOwn(CHOIX, drapeau ?? ''))
      throw new Error(`workflow-args: drapeau de suppléments absent ou inconnu (${drapeau ?? 'aucun'}) — exigé : ${CHOIX_DITS}`)
    console.log(JSON.stringify(perimetreDeCoeur(demande, { supplements: CHOIX[drapeau] }), null, 2))
  } catch (e) {
    console.error(String(e.message ?? e))
    console.error(`usage: node scripts/raw/workflow-args.mjs <coeur> ${CHOIX_DITS}`)
    process.exitCode = 1
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
