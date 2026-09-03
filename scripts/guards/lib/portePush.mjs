// LA PORTE AU PUSH, VUE COMME DEUX FICHIERS (#1679 L2). Module FEUILLE : il n'importe que Node, et
// c'est sa raison d'être. Le `pre-commit` doit pouvoir REFUSER un arbre qui ne porte pas le
// `pre-push` ; s'il tenait cette liste depuis `pre-push.mjs`, l'arbre sans ce fichier ferait
// planter le hook à l'import (ERR_MODULE_NOT_FOUND, mesuré) — le refus nommé serait inatteignable
// exactement dans le cas qu'il vise.
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Les deux fichiers de la porte au push. UNE liste, deux lecteurs : `pre-commit` et `pre-push`. */
export const FICHIERS_PORTE_AU_PUSH = ['scripts/git-hooks/pre-push', 'scripts/git-hooks/pre-push.mjs']

/** Ceux des fichiers de la porte au push qui MANQUENT dans `racine`. */
export const porteAuPushManquante = (racine) =>
  FICHIERS_PORTE_AU_PUSH.filter((f) => !existsSync(join(racine, f)))
