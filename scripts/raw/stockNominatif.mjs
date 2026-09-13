// Primitives PARTAGÉES des stocks NOMINATIFS de `scripts/raw` (#1711) : une ENTRÉE par SITE, les
// deux sens en échec (site NEUF à corriger ou à déclarer, entrée SOLDÉE à retirer). Forme du stock :
// `{ quoi, entrees: [{ famille?, fichier, ref, occurrence, lot, date }] }` — celle de
// `reconciliation-stock.json`. Le calcul d'écart vit dans `guards/lib/stock.mjs` (`ecartsDeStock`),
// le REMÈDE ici, le PLAFOND dans le test de chaque garde.
// Une entrée qui NOMME un fichier est vue par la porte de plage (`croissanceDesStocks` de
// `guards/lib/stocksNominatifs.mjs`) : l'ajouter est une croissance à porter au message par
// `CLIQUET:`. Un compte relevé dans un fichier de compte, lui, est net 0 à cette porte.
// Consommateurs : `check-code-refs.mjs` (dead-code-refs, empty-line-code-refs),
// `citation-graphy-guard.mjs` (graphy), `reanchor.mjs` (reanchor-low), `check-refs.mjs` (dead-refs).
import { readFileSync } from 'node:fs'
import { ecartsDeStock } from '../guards/lib/stock.mjs'

/** CLÉ NOMINATIVE d'une entrée ou d'un site : la famille quand la garde en distingue, le fichier, la
 *  réf, et l'OCCURRENCE (ordinal du site parmi ses homonymes). Même clé des deux côtés de
 *  `ecartsDeStock`.
 *  Ce que la clé EXCLUT : la ligne du FICHIER PORTEUR (celle où le site est écrit) — elle dérive à
 *  chaque édition du fichier et rendrait la moitié du stock périmée à chaque commit.
 *  Ce que la clé INCLUT, sur les volets à RÉF CITÉE (`reanchor-low`, `dead-refs`, `empty-line`,
 *  `dead-code-refs`) : la ligne citée dans `Source/` (`LDB 07 l.43`), qui est l'identité même du site
 *  et reste stable hors ré-extraction. Une RÉ-EXTRACTION Marker fait dériver ces lignes (CLAUDE.md
 *  § Sources VF) — c'est l'événement pour lequel `reanchor.mjs` existe : le stock se renouvelle alors
 *  EN BLOC (N périmées + N neuves pour zéro dette de plus) et se déclare comme tel. */
export const cleDeSite = (e) => [e.famille ?? '', e.fichier, e.ref, e.occurrence].join(' :: ')

/** La clé d'une entrée, ou l'entrée elle-même en JSON compact quand cette clé ne NOMME rien. Une
 *  entrée sans `fichier` ni `ref` (faute de saisie, champ renommé, entrée bidon) rend une clé réduite
 *  à ses séparateurs (` ::  ::  :: `) : le refus désigne alors une entrée que le lecteur ne peut pas
 *  retrouver dans son stock. Le JSON de l'entrée est ce qui la localise. */
const cleOuEntree = (cle, entree) => (entree?.fichier || entree?.ref ? cle : JSON.stringify(entree))

/**
 * Sites OBSERVÉS → entrées NOMINALES. L'occurrence est l'ordinal du site parmi ceux qui partagent la
 * même (famille, fichier, réf), dans l'ordre du balayage.
 * ANGLE MORT DIT : quand un fichier porte DEUX fois la même réf et que la PREMIÈRE se corrige, la
 * seconde descend de l'occurrence 2 à la 1 — l'écart rend alors une périmée ET une neuve pour un seul
 * geste. Le cliquet reste juste (le solde doit se déclarer), sa phrase est seulement plus bavarde.
 * MÊME ANGLE MORT PAR RÉ-ORDINALISATION : l'ordinal suit l'ORDRE DU BALAYAGE, donc insérer un
 * paragraphe AVANT une réf homonyme dans le même fichier échange les ordinaux de deux sites pourtant
 * inchangés — une paire neuve/périmée fantasme un geste qui n'a pas eu lieu. Portée mesurée le
 * 2026-09-12 : latent sur `reanchor-low` (21 entrées, toutes à l'occurrence 1) ; atteignable sur
 * `empty-line-code-refs` (occurrence 2) et `graphy` (jusqu'à 8), qui portent des homonymes.
 * @param {{ file: string, ref: string }[]} sites @param {{ famille?: string }} [p]
 */
export function sitesEnEntrees(sites, { famille } = {}) {
  const vus = new Map()
  return sites.map(({ file, ref }) => {
    const k = [famille ?? '', file, ref].join(' :: ')
    const occurrence = (vus.get(k) ?? 0) + 1
    vus.set(k, occurrence)
    return { famille, fichier: file, ref, occurrence }
  })
}

/** Contenu JSON d'un fichier de stock, ou `{}` s'il est ABSENT (mode ZÉRO-TOLÉRANCE : rien de toléré,
 *  l'écart fait le reste). Lecteur partagé : `reconcile.mjs` en tire ses `trous`. */
export function lireStockJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return {}
    throw err
  }
}

/** Les ENTRÉES d'un fichier de stock (fichier absent, ou stock vide : aucune entrée). */
export function readStock(path) {
  return lireStockJson(path).entrees ?? []
}

/**
 * VERDICT d'un volet à stock nominatif : les deux sens, en phrases prêtes à afficher. Le calcul est
 * celui de `ecartsDeStock` ; ce qui vit ici est le REMÈDE — ce que le lecteur doit faire de chaque
 * ligne. Le PLAFOND n'y est pas : il vit dans le test de la garde.
 * ANGLE MORT DIT, À LA PORTE DE PLAGE : un ÉCHANGE EN PLACE à total constant — réécrire le `fichier`
 * ou la `ref` d'une entrée existante pour couvrir un site neuf pendant qu'un autre est soldé, dans le
 * MÊME commit — rend `[]` à `croissanceDesStocks` : le stock ne peut pas CROÎTRE ainsi, mais ce solde
 * et ce neuf ne se déclarent pas. Cette garde-ci, elle, les voit toujours (la clé a changé des deux
 * côtés) : c'est la SUITE qui tient ce cas, pas la porte de plage.
 * @param {{ sites: {file: string, ref: string}[], stock: object[], famille?: string, ou?: string }} p
 *   `ou` nomme le fichier de stock dans le remède.
 */
export function ecartDuVolet({ sites, stock, famille, ou }) {
  return ecartsDeStock({
    observe: sitesEnEntrees(sites, { famille }),
    stock,
    cle: cleDeSite,
    remede: {
      neuve: (k) => `${k} — site NEUF : corriger la réf, ou déclarer une entrée dans ${ou} et la porter au message par \`CLIQUET:\`.`,
      perimee: (k, e) => `${cleOuEntree(k, e)} — entrée SOLDÉE : le site a disparu, retirer cette entrée de ${ou}.`,
    },
  })
}
