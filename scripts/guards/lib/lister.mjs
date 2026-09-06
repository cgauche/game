// Lecteur de disque à ORDRE TOTAL — source UNIQUE des listings de répertoire des générateurs de
// dérivés et des libs qu'ils atteignent (#1679 L3b, incident #1620). Deux fonctions, aucune option
// de comparateur : l'ordre est une PROPRIÉTÉ du lecteur, pas une décision de chaque site.
//
// Pourquoi ici et pas dans chaque générateur : un doc dérivé généré sous Windows peut différer de sa
// régénération sur le runner Linux — NTFS rend un listing trié sans tenir compte de la casse, ext4
// rend l'ordre d'un hash — et le rouge de CI est alors MUET (le `.md` committé est simplement
// périmé). L'ordre des racines décide de l'ordre des sites cités par un rapport : sans ordre total,
// le même dépôt rend deux `.md` différents selon la machine.

import { lstatSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Comparateur d'ORDRE TOTAL : unités de code UTF-16 (`<`/`>`), soit exactement l'ordre de `.sort()`
 *  sans comparateur. Jamais `localeCompare` : son verdict dépend de la locale et de l'ICU du
 *  processus — même classe de rouge que l'ordre du système de fichiers, sur des chaînes.
 *  EMPLOI : chemins, identifiants, clés — tout ce qui n'est pas lu comme du texte par un humain.
 *  @type {(a: string, b: string) => number} */
export const parUnitesDeCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/** Clé de comparaison d'un LIBELLÉ : accents déposés (NFD puis marques retirées) et casse repliée.
 *  Déterministe sans ICU — `normalize`/`toLowerCase` ne consultent aucune locale. */
const cle = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Comparateur d'ORDRE TOTAL pour un LIBELLÉ LU PAR UN HUMAIN (titre de section, concept français,
 *  nom d'entité, nom d'export d'un index) : alphabétique accents et casse IGNORÉS, puis — pour que
 *  l'ordre reste TOTAL — départage par unités de code brutes (« Béni » vs « beni »).
 *  EMPLOI : la table d'un doc que quelqu'un PARCOURT de l'œil. Un chemin ou une clé prend
 *  `parUnitesDeCode` — y replier la casse rendrait deux chemins distincts égaux à la première passe.
 *  @type {(a: string, b: string) => number} */
export const parLibelle = (a, b) => parUnitesDeCode(cle(a), cle(b)) || parUnitesDeCode(a, b)

/**
 * Noms des enfants DIRECTS de `dir`, triés par unités de code.
 * @param {string} dir
 * @param {{ absent?: 'lever' | 'vide' }} [options] `absent: 'vide'` rend `[]` quand le dossier
 *   n'existe pas (ENOENT) ou n'est pas un dossier (ENOTDIR) ; toute AUTRE erreur lève (une lecture
 *   refusée n'est pas un dossier vide).
 * @returns {string[]}
 */
export function listerDossier(dir, { absent = 'lever' } = {}) {
  let noms
  try {
    noms = readdirSync(dir)
  } catch (err) {
    if (absent === 'vide' && (err?.code === 'ENOENT' || err?.code === 'ENOTDIR')) return []
    throw err
  }
  return noms.map(String).sort()
}

/**
 * Chemins RELATIFS POSIX des FICHIERS sous `dir`, à toute profondeur : dossiers parcourus dans
 * l'ordre trié ET résultat trié (le tri final décide, la marche ne fait que le rendre lisible).
 * Le type d'une entrée se lit par `lstatSync`, comme le `Dirent.isDirectory()` que cette fonction
 * remplace : un LIEN SYMBOLIQUE n'est jamais descendu, et un lien vers un fichier est rendu tel quel.
 * Une entrée dont `lstatSync` échoue (lien mort, course) est SAUTÉE — jamais une marche interrompue.
 * @param {string} dir
 * @param {{ filtre?: (rel: string) => boolean, descendre?: (rel: string) => boolean,
 *           absent?: 'lever' | 'vide' }} [options] `filtre` retient les FICHIERS, `descendre`
 *   autorise l'entrée dans un DOSSIER — les deux reçoivent le chemin relatif POSIX.
 * @returns {string[]}
 */
export function listerArbre(dir, { filtre, descendre, absent = 'lever' } = {}) {
  const out = []
  const marcher = (rel) => {
    for (const nom of listerDossier(rel ? join(dir, rel) : dir, { absent })) {
      const enfant = rel ? `${rel}/${nom}` : nom
      let st
      try { st = lstatSync(join(dir, enfant)) } catch { continue }
      if (st.isDirectory()) {
        if (!descendre || descendre(enfant)) marcher(enfant)
      } else if (!filtre || filtre(enfant)) out.push(enfant)
    }
  }
  marcher('')
  return out.sort()
}
