// Générateur du BLOC des cœurs de `docs/raw/00-index.md` (#1825) : la liste des cœurs de règles est
// DÉRIVÉE du registre des livres (`src/data/books.json`, champ `coeur`) — jamais écrite à la main.
// Un cœur de plus au registre est une ligne de plus ici, sans qu'aucun doc ne se resaisisse.
// Le reste de la page est MANUSCRIT : seul le bloc entre marqueurs est réécrit (patron `injecte` de
// `scripts/docs/build-all.mjs`).
// Re-run : node scripts/raw/build-atlas-index.mjs (`--check` : compare sans écrire, exit 1 si périmé).
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { booksDe, coeursDe, coeursDuRegistre, livresDeCoeur, pagesDeLAtlas, REGISTRE_LIVRES } from './_lib.mjs'

export const RAWDIR = 'docs/raw'
export const INDEX_PATH = join(RAWDIR, '00-index.md')
export const DEBUT = '<!-- ATLAS-COEURS:DEBUT -->'
export const FIN = '<!-- ATLAS-COEURS:FIN -->'
/** Acceptation DÉCLARÉE à la couture : toute page de cœur, pour COMPTER ce que le cœur porte. */
export const CLASSES = ['fiche', 'catalogue', 'auteur', 'epreuve']

/**
 * Les lignes du bloc : un cœur, son index, ses livres de cœur. PUR vis-à-vis de l'écriture.
 * Un cœur du registre SANS dossier sur disque est DIT tel quel : un lien vers une page absente
 * mentirait, et le taire cacherait un cœur déclaré au registre.
 */
export function lignesDesCoeurs(rawDir = RAWDIR, registre = REGISTRE_LIVRES) {
  const pages = pagesDeLAtlas(rawDir, { classes: CLASSES, registre, absent: 'vide' })
  // UN registre de bout en bout : les sigles se lisent sur le registre REÇU, jamais sur le global —
  // un registre injecté rendrait sinon les sigles d'un autre.
  const coeurs = coeursDe(registre)
  const livresDuRegistre = livresDeCoeur(booksDe(registre), coeurs)
  const lignes = []
  for (const coeur of coeursDuRegistre(registre)) {
    const siennes = pages.filter((p) => p.coeur === coeur)
    const livres = livresDuRegistre.filter(([abbr]) => coeurs.get(abbr) === coeur).map(([abbr]) => abbr)
    const sigles = livres.length ? ` — livre(s) de cœur : ${livres.join(', ')}` : ''
    const index = siennes.find((p) => p.nom === '00-index.md')
    lignes.push(index
      ? `- [\`${coeur}/\`](${index.relatif})${sigles}`
      : `- \`${coeur}/\` — dossier à créer${sigles}`)
  }
  return lignes
}

/** Le contenu de l'index, bloc des cœurs réécrit entre ses marqueurs. LÈVE si un marqueur manque. */
export function injecter(contenu, lignes) {
  const debut = contenu.indexOf(DEBUT)
  const fin = contenu.indexOf(FIN)
  if (debut === -1 || fin === -1 || fin < debut)
    throw new Error(`build-atlas-index: marqueurs « ${DEBUT} » … « ${FIN} » introuvables ou inversés dans ${INDEX_PATH}`)
  return contenu.slice(0, debut) + DEBUT + '\n' + lignes.join('\n') + '\n' + contenu.slice(fin)
}

function main() {
  const check = process.argv.includes('--check')
  const contenu = readFileSync(INDEX_PATH, 'utf8')
  const attendu = injecter(contenu, lignesDesCoeurs())
  if (contenu === attendu) {
    console.log(`build-atlas-index — OK (bloc des cœurs à jour dans ${INDEX_PATH})`)
    return
  }
  if (check) {
    console.error(`build-atlas-index — ${INDEX_PATH} PÉRIMÉ : relancer \`node scripts/raw/build-atlas-index.mjs\` et committer.`)
    process.exit(1)
  }
  writeFileSync(INDEX_PATH, attendu, 'utf8')
  console.log(`build-atlas-index — bloc des cœurs réécrit dans ${INDEX_PATH}`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
