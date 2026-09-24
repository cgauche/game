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
// Le filtre CUMULÉ se calcule par la MÊME fonction de croissance que le commit (`croissanceDesStocks`,
// par clé et après report de la carte des renommages de la plage, #1806 D5″) : une dette neuve dans X
// qu'une baisse dans Q du même porteur compenserait reste en croissance au cumul, et se refuse.
//
// `RECLASSEMENT: <module> +N — <motif>` (`reclassementCss.mjs`) se juge PAR COMMIT seulement, contre son
// parent (#1806 D3″) : la ligne vit dans UN message et nomme le franchissement de CE commit.
//
// La lib CALCULE ; le VERDICT appartient à l'appelant (le pre-push refuse, la mesure a posteriori
// échoue). Elle reste PURE dans son cœur (`refusDeLaPlage`, `reclassementsDeLaPlage`) : les lectures
// git sont injectées.
import { cheminsDe, lireGit, sortieOuNull } from './gitPorte.mjs'
import { croissanceDesStocks, croissancesNonCouvertes } from './stocksNominatifs.mjs'
import { deplaceLaFrontiere, ecartsDeReclassement, franchisDesCotes, lignesDeReclassement } from './reclassementCss.mjs'
import { coteCss, renommagesDe, sourceGit } from './cssImages.mjs'

/** Le sha nul que git écrit sur stdin du pre-push pour une branche NEUVE. */
export const SHA_NUL = '0'.repeat(40)

/**
 * Refus d'une plage, PUR. `commits` = `[{ sha, message, diff, images }]` dans l'ordre de l'histoire,
 * `cumule` = le diff `<avant>..<apres>` d'un bloc, `imagesCumul` = les lecteurs d'image de ses deux
 * bouts. Chaque `images` porte un `lirePostImage` : `croissanceDesStocks` refuse nommément sinon.
 * @returns {{ sha: string, fichier: string, net: number, declare: number | null, exemples: string[] }[]}
 * @throws {Error} propagé de `croissanceDesStocks` : sans lecteur d'image post, le compte ment.
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

/**
 * Reclassements CSS non déclarés d'une plage, PUR : chaque commit contre son parent (#1806 D3″).
 * `cotes()` rend `{ parent, commit }` (`coteCss`), ou `null` si le commit ne touche pas la frontière ;
 * une image illisible est un refus NOMMÉ par son commit, jamais une levée.
 * @param {{ commits?: { sha: string, message: string, cotes: () => ({ parent: object, commit: object } | null) }[] }} p
 * @returns {({ sha: string, ecarts: ReturnType<typeof ecartsDeReclassement> } | { sha: string, illisible: string })[]}
 */
export function reclassementsDeLaPlage({ commits = [] } = {}) {
  const refus = []
  for (const { sha, message, cotes } of commits) {
    let lus
    try {
      lus = cotes()
    } catch (e) {
      refus.push({ sha, illisible: e.message })
      continue
    }
    const lignes = lignesDeReclassement(message)
    if (!lus && !lignes.length) continue
    const ecarts = ecartsDeReclassement(lus ? franchisDesCotes(lus.parent, lus.commit) : [], lignes)
    if (ecarts.length) refus.push({ sha, ecarts })
  }
  return refus
}

/** Refus lisible : quel commit, quel fichier, de combien, trois exemples, et les deux gestes. */
export function raisonDeRefusDePlage(refus) {
  const lignes = refus.map((r) => {
    const declare = r.declare === null ? '' : ` (le message annonce \`+${r.declare}\`)`;
    return `${r.sha.slice(0, 9)} ${r.fichier} +${r.net} entrée(s)${declare} — ex. ${r.exemples.join(' · ')}`
  })
  return (
    `⛔ STOCK NOMINATIF qui GRANDIT dans la plage poussée : ${lignes.join(' || ')}. Geste : ` +
    '`git rebase -i` pour porter `CLIQUET: <fichier> +N — <motif>` au message du commit fautif, ' +
    "ou retirer l'entrée (un stock nominatif est une DETTE vers zéro, jamais un registre). `+N` " +
    "compte les ENTRÉES du stock — ses éléments —, jamais ce qu'elles dénombrent."
  )
}

/**
 * Lecture d'une plage réelle dans `cwd` et refus qu'elle porte.
 * `avant` nul (branche NEUVE, forme observée sur stdin du hook) → `origin/main` : la plage jugée est
 * ce que la branche ajoute au tronc.
 * `null` = l'OBJET demandé n'existe pas (le contrat des lecteurs d'image) ; une INDISPONIBILITÉ de
 * git est rendue à part (`indisponible`), et l'appelant la NOMME : une plage illisible ne se juge
 * pas, elle se dit.
 * @param {{ cwd?: string, avant: string, apres: string,
 *           git?: (args: string[]) => string | null }} p
 * @returns {{ refus: [], reclassements: [], notes: string[], plage: string, indisponible: string|null, commits?: number }}
 */
export function croissancesDeLaPlage({ cwd = process.cwd(), avant, apres, git } = {}) {
  const pannes = []
  const lire = git ?? ((args, { entree } = {}) => {
    const vu = lireGit(args, { cwd, entree })
    if (!vu.disponible) {
      pannes.push(vu.raison)
      return null
    }
    return sortieOuNull(vu)
  })
  const notes = []
  let base = avant
  if (!base || base === SHA_NUL) {
    base = 'origin/main'
    if (lire(['rev-parse', '--verify', '--quiet', `${base}^{commit}`]) === null) {
      notes.push(`plage inconnue : ni sha distant ni \`origin/main\` — ${apres.slice(0, 9)} seul est jugé`)
      base = `${apres}^`
    }
  }
  const plage = `${base}..${apres}`
  // `--no-merges` : `git show` ne rend aucun diff propre d'une fusion, et la croissance qu'elle
  // porte a déjà été jugée sur le commit d'ORIGINE.
  const liste = lire(['rev-list', '--reverse', '--no-merges', plage])
  if (liste === null) {
    notes.push(`plage \`${plage}\` illisible : rien n'est jugé`)
    return { refus: [], reclassements: [], notes, plage, indisponible: pannes[0] ?? null }
  }
  const shas = liste.split('\n').map((l) => l.trim()).filter(Boolean)
  const commits = shas.map((sha) => {
    const diff = lire(['show', '--format=', '-U0', '--no-renames', sha]) ?? ''
    const source = (arbre) => sourceGit({ cwd, arbre, git: lire })
    return {
      sha,
      message: lire(['show', '-s', '--format=%B', sha]) ?? '',
      diff,
      images: {
        lirePostImage: (f) => lire(['show', `${sha}:${f}`]),
        lirePreImage: (f) => lire(['show', `${sha}^:${f}`]),
        renommages: renommagesDe(lire, [`${sha}^`, sha]),
      },
      cotes: () => (deplaceLaFrontiere({
        chemins: cheminsDe(lire, ['show', '--format=', '--name-only', '--no-renames', sha]),
        nesOuMorts: () => cheminsDe(lire, ['show', '--format=', '--name-only', '--no-renames', '--diff-filter=AD', sha]),
        parent: source(`${sha}^`),
        commit: source(sha),
        racine: cwd,
      }) ? { parent: coteCss(source(`${sha}^`), { racine: cwd }), commit: coteCss(source(sha), { racine: cwd }) } : null),
    }
  })
  const cumule = lire(['diff', '-U0', '--no-renames', `${base}..${apres}`]) ?? ''
  const imagesCumul = {
    lirePostImage: (f) => lire(['show', `${apres}:${f}`]),
    lirePreImage: (f) => lire(['show', `${base}:${f}`]),
    renommages: renommagesDe(lire, [base, apres]),
  }
  return {
    refus: refusDeLaPlage({ commits, cumule, imagesCumul }),
    reclassements: reclassementsDeLaPlage({ commits }),
    notes,
    commits: shas.length,
    plage,
    indisponible: pannes[0] ?? null,
  }
}
