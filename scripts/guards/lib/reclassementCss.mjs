// L'ÉVÉNEMENT DE FRONTIÈRE du stock CSS (#1806, grief 1 de la revue de palier du 2026-09-20) : une
// revendication ARMÉE (`revendicationsArmees`, `cssCouches.mjs`) retire de
// `CSS_IDENTITE_ECRAN_RATCHET` / `CSS_ESPACEMENT_RATCHET` tous les sites de son module sans toucher
// une ligne de CSS (`41aa406d5` : `combat-console.css`, 255 sites). La baisse est légale — c'est la
// frontière A1 —, mais elle se DIT : `RECLASSEMENT: <module> +N — <motif #ticket>`, au PRIX de
// l'intervalle (`prixDuReclassement`, `cssCouches.mjs`) : les sites que la frontière a réellement fait
// sortir du stock, jamais davantage. UNE ligne par module dans un message ; la somme des lignes égale
// le prix, et chaque ligne reste sous le N de son module (`ecartDeReclassement`).
//
// Le discriminant est la FRONTIÈRE lue dans chaque image — manifeste (`css`) et `FEUILLES_PARTAGEES`
// (texte de `cssCouches.mjs`) —, jamais le libellé `nature` qu'un commit écrit lui-même.
//
// FRONTIÈRE : cette lib CALCULE ; le VERDICT appartient aux appelants — le garde de solde au commit
// (`scripts/hooks/solde-ticket-guard.mjs`), la porte de plage au push (`plageStock.mjs`).
import {
  CHEMIN_COUCHES, CHEMIN_MANIFESTE, feuillesPartageesDe, manifesteDe, prixDuReclassement,
} from './cssCouches.mjs'
import { MOTIF_MIN, declarationsDuMessage } from './stocksNominatifs.mjs'

/** Le mot-clé de la ligne de message. */
const MOT_RECLASSEMENT = 'RECLASSEMENT'

/** Un motif de reclassement nomme le ticket qui le porte. */
const TICKET = /#\d+/

/** Le côté d'une image de commit, lu par son lecteur : manifeste, feuilles partagées, texte. */
const coteDuLecteur = (lire) => ({
  manifeste: manifesteDe(lire(CHEMIN_MANIFESTE)),
  partagees: feuillesPartageesDe(lire(CHEMIN_COUCHES)),
  lire,
})

/**
 * Le PRIX d'un intervalle lu par ses deux lecteurs d'image (`prixDuReclassement`).
 * @param {{ lirePreImage: (f: string) => string | null, lirePostImage: (f: string) => string | null }} images
 * @param {Iterable<string>} touches les chemins que l'intervalle modifie
 * @throws {Error} manifeste ou `cssCouches.mjs` illisible à l'un des bouts.
 */
export function prixDesImages(images, touches) {
  return prixDuReclassement(coteDuLecteur(images.lirePreImage), coteDuLecteur(images.lirePostImage), touches)
}

/** Les lignes `RECLASSEMENT:` d'un message dont le motif porte son `#<ticket>`. */
export const lignesDeReclassement = (message) =>
  declarationsDuMessage(message, MOT_RECLASSEMENT).filter((d) => TICKET.test(d.motif))

/**
 * L'ÉCART entre un prix et les lignes qui le déclarent, ou `null` s'il est couvert : la somme des
 * lignes des modules armés égale le prix, chaque module porte au plus UNE ligne, et chaque ligne
 * reste sous le N de son module. Un seul module armé : sa ligne porte donc exactement le prix.
 * @param {ReturnType<typeof prixDuReclassement>} prix @param {{ fichier: string, n: number }[]} lignes
 * @returns {{ prix: number, declare: number, modules: { module: string, n: number, declarees: number[] }[] } | null}
 */
export function ecartDeReclassement(prix, lignes) {
  if (!prix.revendications.length) return null
  const modules = prix.revendications.map((r) => ({
    module: r.module,
    n: r.n,
    declarees: lignes.filter((d) => d.fichier === r.module).map((d) => d.n),
  }))
  const declare = modules.reduce((s, m) => s + m.declarees.reduce((a, n) => a + n, 0), 0)
  const couvert = declare === prix.n && modules.every((m) => m.declarees.length <= 1 && (m.declarees[0] ?? 0) <= m.n)
  return couvert ? null : { prix: prix.n, declare, modules }
}

/**
 * L'écart d'un COMMIT, en liste (vide = couvert).
 * @param {{ message: string }} p @param {Parameters<typeof prixDesImages>[0]} images
 * @param {Iterable<string>} touches
 */
export function reclassementsNonDeclares({ message }, images, touches) {
  const ecart = ecartDeReclassement(prixDesImages(images, touches), lignesDeReclassement(message))
  return ecart ? [ecart] : []
}

/** Ce qu'un module armé a reçu du message, en clair. */
const ceQueDitLeModule = (m) => {
  if (m.declarees.length === 0) return `${m.module} (N ${m.n}, aucune ligne)`
  if (m.declarees.length > 1) return `${m.module} (N ${m.n}, ${m.declarees.length} lignes ${m.declarees.map((n) => `+${n}`).join(', ')} — une seule par module)`
  return `${m.module} (N ${m.n}, +${m.declarees[0]})`
}

/**
 * Refus lisible : où (commit, plage, ou rien), le PRIX mesuré, la somme annoncée, ce que chaque module
 * armé a reçu, et le geste. Une image illisible (`illisible`) est dite par son commit.
 * @param {({ prix: number, declare: number, modules: { module: string, n: number, declarees: number[] }[], sha?: string, plage?: string } | { sha: string, illisible: string })[]} reclassements
 */
export function raisonDeRefusDeReclassement(reclassements) {
  const lignes = reclassements.map((r) => {
    const ou = r.plage ? `plage ${r.plage} ` : r.sha ? `${r.sha.slice(0, 9)} ` : ''
    if ('illisible' in r) return `${ou}injugeable : ${r.illisible}`
    return `${ou}${r.prix} site(s) sortent du stock CSS, les lignes en annoncent ${r.declare} — ${r.modules.map(ceQueDitLeModule).join(', ')}`
  })
  const geste = reclassements.some((r) => r.sha || r.plage)
    ? '`git rebase -i` pour porter au message du commit fautif'
    : 'porter au message'
  return (
    `⛔ RECLASSEMENT CSS non déclaré : ${lignes.join(' || ')}. Une revendication ARMÉE — module neuf au ` +
    `manifeste (${CHEMIN_MANIFESTE}) ou à \`FEUILLES_PARTAGEES\` (${CHEMIN_COUCHES}), ou module exempté ` +
    `à 0 site à la base (\`revendicationsArmees\`) — sort des sites du stock (xxi) : la frontière de sa ` +
    `mesure se déplace. Si elle est délibérée, ${geste} \`RECLASSEMENT: <module> +N — <motif>\` (motif ` +
    `d’au moins ${MOTIF_MIN} caractères, portant son \`#<ticket>\`), UNE ligne par module : la somme des ` +
    '`+N` égale les sites sortis du stock, chacun au plus le N de son module.'
  )
}
