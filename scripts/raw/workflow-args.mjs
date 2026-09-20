// PROJECTION du registre des livres vers les `args` d'un workflow d'extraction Atlas.
// Un script `*.workflow.js` est un corps d'`AsyncFunction` : ni `import`, ni accès fichier — il ne
// peut donc pas lire `src/data/books.json`. Le registre lui ENTRE par le global `args` (#1825 : le
// code ne nomme AUCUN livre ; un livre de plus est UNE entrée de `books.json`, zéro ligne ici).
//   node scripts/raw/workflow-args.mjs <coeur> --avec-supplements|--coeur-seul --domaines a,b
// Forme rendue : `{ coeur, supplements, domaines: [{ cle, titre }], lot: [cle], livres: [{ ab, dir, coeur, language }] }`.
// `domaines` est la CARTE du cœur, projetée de `scripts/raw/domaines.json` (le workflow s'en sert
// pour tenir chaque domaine dans son périmètre) ; `lot` est ce que CE run traite, déclaré par
// l'appelant — un lot deviné relâcherait des agents sur des domaines que personne n'a demandés.
// PÉRIMÈTRE d'un cœur — ce que le registre SAIT, ce qu'il ne sait PAS :
//   · il SAIT l'APPARTENANCE d'un livre à un corps de règles (champ `coeur` ; `livresDeCoeur`,
//     `_lib.mjs`, rend les livres qui en portent un) ;
//   · il ne sait RIEN de la COMPATIBILITÉ d'un SUPPLÉMENT (`coeur` absent) avec un cœur donné.
// Un supplément n'est donc ni inclus ni exclu par défaut : l'appelant DÉCLARE son choix
// (`supplements`), le résultat le PORTE, et le rapport du run le dit. Aucun défaut n'est offert —
// un défaut trancherait, en silence, une règle de jeu qui n'appartient pas au code.
// `coeursDuRegistre` vit dans `_lib.mjs`, avec la lecture du registre : c'est la MÊME population
// qui ouvre les dossiers de l'Atlas (`pagesDeLAtlas`) et les périmètres d'extraction.
import { REGISTRE_LIVRES, coeursDuRegistre, domainesDe, estLivreExtrait } from './_lib.mjs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const CHOIX = { '--avec-supplements': true, '--coeur-seul': false }
const CHOIX_DITS = Object.keys(CHOIX).join(' | ')

/**
 * Le périmètre d'extraction d'UN cœur. LÈVE en NOMMANT la cause — un périmètre silencieusement vide
 * ferait survoler des livres entiers sans qu'aucun rapport ne le dise, et un `supplements` deviné
 * trancherait une règle de jeu.
 * @param {string} coeur clé `coeur` de `src/data/books.json`
 * @param {{ supplements: boolean, lot: string[], registre?: Array<object>, registreDomaines?: object }} options
 *   `supplements` et `lot` OBLIGATOIRES
 * @returns {{ coeur: string, supplements: boolean, domaines: Array<{ cle: string, titre: string }>, lot: string[], livres: Array<{ ab: string, dir: string, coeur: string|null, language: string }> }}
 */
export function perimetreDeCoeur(coeur, options = {}) {
  const { supplements, lot, registre = REGISTRE_LIVRES, registreDomaines } = options
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
  const domaines = domainesDe(coeur, registreDomaines)
  const clesDites = domaines.map((d) => d.cle).join(', ')
  if (!Array.isArray(lot) || !lot.length)
    throw new Error(
      'workflow-args: `lot` de domaines non déclaré — le lot que CE run traite ne se devine pas : '
      + `déclarer \`lot: ['<cle>', …]\` (option \`--domaines a,b\` en ligne de commande) ; domaines du cœur « ${coeur} » : ${clesDites}`)
  const inconnues = lot.filter((c) => !domaines.some((d) => d.cle === c))
  if (inconnues.length)
    throw new Error(
      `workflow-args: domaine(s) « ${inconnues.join(', ')} » inconnu(s) du cœur « ${coeur} » `
      + `— domaines déclarés : ${clesDites}`)
  return {
    coeur,
    supplements,
    domaines,
    lot: [...lot],
    livres: retenus.map((b) => ({ ab: b.abbr, dir: b.dir, coeur: b.coeur ?? null, language: b.language })),
  }
}

const DRAPEAU_LOT = '--domaines'
const USAGE = `usage: node scripts/raw/workflow-args.mjs <coeur> ${CHOIX_DITS} ${DRAPEAU_LOT} <cle,cle…>`

function main() {
  const [, , demande, ...reste] = process.argv
  try {
    const drapeau = reste.find((a) => Object.hasOwn(CHOIX, a))
    if (!drapeau)
      throw new Error(`workflow-args: drapeau de suppléments absent ou inconnu (${reste.join(' ') || 'aucun'}) — exigé : ${CHOIX_DITS}`)
    const i = reste.indexOf(DRAPEAU_LOT)
    const brut = i >= 0 ? reste[i + 1] : reste.find((a) => a.startsWith(`${DRAPEAU_LOT}=`))?.slice(DRAPEAU_LOT.length + 1)
    const lot = (brut ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    console.log(JSON.stringify(perimetreDeCoeur(demande, { supplements: CHOIX[drapeau], lot }), null, 2))
  } catch (e) {
    console.error(String(e.message ?? e))
    console.error(USAGE)
    process.exitCode = 1
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
