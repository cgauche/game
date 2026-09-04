// STOCKS NOMINATIFS SUR UNE PLAGE de commits — la porte a posteriori du PUSH.
//
// Le garde au commit et la mesure du DERNIER commit ne voient qu'une tête : sur un push en lot,
// tout commit qui n'est pas la tête est invisible, et la croissance de `429b9a1a2` a traversé les
// deux portes six heures après leur pose (revue de palier n°2, 2026-09-03). Cette lib juge la PLAGE
// réellement poussée.
//
// DEUX NIVEAUX, tous deux nécessaires (discriminés par sonde le 2026-09-03) :
//   · PAR COMMIT, parce que `CLIQUET: <fichier> +N — <motif>` vit dans UN message : jugée en cumulé,
//     une plage de deux commits cliquetés `+2` et `+2` demanderait un cliquet `+4` qu'aucun message
//     ne porte — faux rouge ;
//   · FILTRE CUMULÉ, parce qu'un stock ajouté puis RETIRÉ dans la même plage ne grandit rien :
//     jugée par commit seule, la plage refuserait un travail dont le solde est nul — faux rouge.
// Donc : les croissances non couvertes se lèvent PAR COMMIT, et l'on n'en retient que les fichiers
// dont la croissance CUMULÉE sur toute la plage reste positive.
//
// La lib CALCULE ; le VERDICT appartient à l'appelant (le pre-push refuse, la mesure a posteriori
// échoue). Elle reste PURE dans son cœur (`refusDeLaPlage`) : les lectures git sont injectées.
import { execFileSync } from 'node:child_process'
import { croissanceDesStocks, croissancesNonCouvertes } from './stocksNominatifs.mjs'

/** Le sha nul que git écrit sur stdin du pre-push pour une branche NEUVE. */
export const SHA_NUL = '0'.repeat(40)

/**
 * Refus d'une plage, PUR. `commits` = `[{ sha, message, diff, images? }]` dans l'ordre de l'histoire,
 * `cumule` = le diff `<avant>..<apres>` d'un bloc, `imagesCumul` = les lecteurs d'image de ses deux
 * bouts.
 * @returns {{ sha: string, fichier: string, net: number, declare: number | null, exemples: string[] }[]}
 */
export function refusDeLaPlage({ commits = [], cumule = '', imagesCumul } = {}) {
  const enCroissance = new Set(croissanceDesStocks(cumule, imagesCumul).map((c) => c.fichier))
  const refus = []
  for (const { sha, message, diff, images } of commits) {
    for (const c of croissancesNonCouvertes({ diff, message }, images)) {
      if (!enCroissance.has(c.fichier)) continue
      refus.push({ sha, fichier: c.fichier, net: c.net, declare: c.declare, exemples: c.exemples })
    }
  }
  return refus
}

/** Refus lisible : quel commit, quel fichier, de combien, trois exemples, et les deux gestes. */
export function raisonDeRefusDePlage(refus) {
  const lignes = refus.map((r) => {
    const declare = r.declare === null ? '' : ` (le message annonce \`+${r.declare}\`)`;
    return `${r.sha.slice(0, 9)} ${r.fichier} +${r.net}${declare} — ex. ${r.exemples.join(' · ')}`
  })
  return (
    `⛔ STOCK NOMINATIF qui GRANDIT dans la plage poussée : ${lignes.join(' || ')}. Geste : ` +
    '`git rebase -i` pour porter `CLIQUET: <fichier> +N — <motif>` au message du commit fautif, ' +
    "ou retirer l'entrée (un stock nominatif est une DETTE vers zéro, jamais un registre)."
  )
}

/**
 * Lecture d'une plage réelle dans `cwd` et refus qu'elle porte.
 * `avant` nul (branche NEUVE, forme observée sur stdin du hook) → `origin/main` : la plage jugée est
 * ce que la branche ajoute au tronc.
 * @param {{ cwd?: string, avant: string, apres: string,
 *           git?: (args: string[]) => string | null }} p
 * @returns {{ refus: [], notes: string[] }}
 */
export function croissancesDeLaPlage({ cwd = process.cwd(), avant, apres, git } = {}) {
  const lire = git ?? lecteurGit(cwd)
  const notes = []
  let base = avant
  if (!base || base === SHA_NUL) {
    base = 'origin/main'
    if (lire(['rev-parse', '--verify', '--quiet', `${base}^{commit}`]) === null) {
      notes.push(`plage inconnue : ni sha distant ni \`origin/main\` — ${apres.slice(0, 9)} seul est jugé`)
      base = `${apres}^`
    }
  }
  const liste = lire(['rev-list', '--reverse', '--no-merges', `${base}..${apres}`])
  if (liste === null) {
    notes.push(`plage \`${base}..${apres}\` illisible : rien n'est jugé`)
    return { refus: [], notes }
  }
  const shas = liste.split('\n').map((l) => l.trim()).filter(Boolean)
  const commits = shas.map((sha) => ({
    sha,
    message: lire(['show', '-s', '--format=%B', sha]) ?? '',
    diff: lire(['show', '--format=', '-U0', '--no-renames', sha]) ?? '',
    images: {
      lirePostImage: (f) => lire(['show', `${sha}:${f}`]),
      lirePreImage: (f) => lire(['show', `${sha}^:${f}`]),
    },
  }))
  const cumule = lire(['diff', '-U0', '--no-renames', `${base}..${apres}`]) ?? ''
  const imagesCumul = {
    lirePostImage: (f) => lire(['show', `${apres}:${f}`]),
    lirePreImage: (f) => lire(['show', `${base}:${f}`]),
  }
  return { refus: refusDeLaPlage({ commits, cumule, imagesCumul }), notes, commits: shas.length }
}

/** Lecteur git par défaut : `null` sur échec (un commit absent n'est pas une erreur de la porte).
 *  Les commits de FUSION sont hors plage (`--no-merges`) — `git show` n'en rend aucun diff, et la
 *  croissance qu'ils portent a été jugée sur le commit d'ORIGINE. */
function lecteurGit(cwd) {
  return (args) => {
    try {
      return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
    } catch { return null }
  }
}
