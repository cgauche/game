// Résolveur de PROSE d'une entrée de donnée : `desc` en clair, ou `descRef` qui ADRESSE le `Source/`.
// FAIL-CLOSED — c'est le résolveur des gardes et des migrations : toute adresse qui ne rend pas
// exactement son texte (section disparue, bornes bougées, empreinte divergente…) LÈVE, jamais un
// texte approchant ni un silence. `desc` et `descRef` sont EXCLUSIFS : les deux ensemble = adresse
// et copie en concurrence, donc levée.
import { resoudreAdresse } from '../../src/data/source/decoupe.ts'
import { lireChapitre } from './lecteur-fs.mjs'

/**
 * Prose d'une entrée.
 * @param {{ desc?: unknown, descRef?: { book: string, ch: string, parts: object[] } }} entree
 * @param {(bookId: string, ch: string) => object|null} lecteur
 * @returns {{ etat: 'inline', md: string } | { etat: 'resolue', md: string, folios: number[] }
 *           | { etat: 'absente' }}
 */
export function resoudreProse(entree, lecteur = lireChapitre) {
  const ref = entree?.descRef
  if (typeof entree?.desc === 'string' && ref) {
    throw new Error(`desc-et-descRef : ${entree.id ?? entree.label ?? '(sans id)'}`)
  }
  if (typeof entree?.desc === 'string') return { etat: 'inline', md: entree.desc }
  if (!ref) return { etat: 'absente' }
  const chapitre = lecteur(ref.book, ref.ch)
  if (!chapitre) throw new Error(`chapitre-introuvable : ${ref.book} ch.${ref.ch}`)
  const res = resoudreAdresse(chapitre, ref)
  if (res.error) throw new Error(`${res.error} : ${res.detail}`)
  return { etat: 'resolue', md: res.md, folios: res.folios }
}
