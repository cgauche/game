// Décision « ce chemin lu est-il sous la racine MESURÉE ? » (#1721) — feuille pure, partagée par les
// deux volets de l'enregistreur de lectures (thread principal `enregistreur-lectures.mjs`, thread des
// hooks `enregistreur-hooks.mjs`), qui la portaient chacun en copie.
//
// NTFS est INSENSIBLE À LA CASSE : `c:\…` et `C:\…`, ou un segment dont la casse diffère de celle de
// la racine, désignent le même fichier. Une comparaison d'octets (`abs.startsWith(base + sep)`)
// rejette ces lectures-là, et `docs/.sources-lues.json` perd des sources sans que rien ne le dise.
import fs from 'node:fs'
import path from 'node:path'

/**
 * Forme CANONIQUE d'un chemin : `fs.realpathSync.native` rend la casse telle que le disque la porte
 * et suit jonctions et noms courts 8.3. Un chemin ABSENT du disque (ou illisible) garde sa forme
 * résolue — `path.relative` compare déjà sans la casse sur win32, le repli reste juste.
 *
 * DIRECTION de ce que suivre une jonction change : un fichier lu SOUS la racine par une jonction qui
 * pointe HORS d'elle devient un chemin hors racine — il est compté REJETÉ, pas retenu (mesuré sur une
 * jonction réelle). L'inverse tient aussi : la racine étant canonisée, un chemin atteint par une
 * jonction qui pointe DANS la racine y rentre.
 */
export function canoniser(chemin) {
  const abs = path.resolve(chemin)
  try {
    return fs.realpathSync.native(abs)
  } catch {
    return abs
  }
}

/**
 * Chemin RELATIF POSIX du chemin lu sous la racine, `''` pour la racine elle-même, ou `null` quand
 * il est HORS racine (le seul cas qui compte comme rejet). La racine est attendue déjà canonique
 * (`canoniser` une fois à l'installation) : les deux formes se comparent alors sur la même base.
 * `canoniserChemin` s'injecte pour qu'un appelant qui mesure des milliers de lectures mémorise la
 * canonisation (un `realpathSync.native` est un appel système).
 */
export function relatifSousRacine(racineCanonique, chemin, canoniserChemin = canoniser) {
  const rel = path.relative(racineCanonique, canoniserChemin(chemin))
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null
  return rel.split(path.sep).join('/')
}
