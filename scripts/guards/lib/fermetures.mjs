// GRAMMAIRE UNIQUE des fermetures de ticket portées par un TEXTE : quels numéros un message de commit
// (ou une commande `git commit` déroulée) FERME. Un seul module la définit, et tous ses lecteurs la
// consomment — la porte de commit (`scripts/hooks/solde-ticket-guard.mjs`), le closer de publication
// (`scripts/ops/fermer-depuis-main.mjs`), la mesure des fermetures non citées, les cliquets et l'objet
// de faits de palier. Deux graphies pour un même concept rendent des ensembles différents pour un même
// message : un solde exigé au commit ne ferme alors pas son ticket à la publication.
// PUR : aucune lecture de git, aucun accès disque.

/** Les verbes de fermeture, insensibles à la casse, chacun collé à son `#<numéro>`. Une instance NEUVE
 *  par lecture : un motif global porte un `lastIndex` mutable que deux lecteurs se partageraient.
 *  `fixe` et `fixs` n'en sont PAS : ce sont des mots de prose française, et `fixe #939` dans le corps
 *  de `df1507439` (« durci de fixe #939 ») serait lu comme une fermeture — le closer fermerait #939. */
export const motifFermeture = () => /(corrige|fix(?:es)?|closes?|ferme)\s+#(\d+)/gi

/**
 * Numéros de ticket qu'un texte ferme, dans l'ordre d'apparition, dédupliqués. PUR.
 *
 * Ce que cette grammaire NE lit PAS, et qui se sait :
 *   - `resolves`/`resolved`/`fixed`/`closed` sont REJETÉS ici alors que GitHub, lui, ferme l'issue
 *     au push sur la branche par défaut sur ces mots : un `fixed #8` ferme donc côté GitHub sans
 *     qu'aucun solde ait été exigé au commit. Asymétrie de ce dépôt, énoncée, pas corrigée ici ;
 *   - un `#N` nu jamais précédé d'un verbe n'est pas lu (`corrige #12, #13` ferme {12}) : un
 *     mot-clef PAR ticket, la forme que la porte de commit exige depuis toujours ;
 *   - un texte qui RECOPIE le message d'un autre commit ferme ce que cette recopie nomme : la
 *     lecture porte sur du texte, jamais sur une provenance.
 *
 * @param {string} texte
 * @returns {string[]} numéros CANONIQUES : les zéros de tête sont absorbés (`#0012` → `12`), sans
 *   quoi un même ticket porterait deux clés selon le lecteur — la porte compare des nombres, le
 *   closer et les cliquets des chaînes (noms de `.claude/soldes/<N>.md`, numéros de l'API).
 */
export function numerosFermes(texte) {
  const vus = new Set()
  for (const m of String(texte ?? '').matchAll(motifFermeture())) vus.add(String(Number(m[2])))
  return [...vus]
}

/** Les verbes de RATTACHEMENT (`ref #N`/`refs #N`) : un commit qui CITE un ticket sans le fermer.
 *  Même hôte que la fermeture, et pour la même raison — deux graphies pour un concept rendent deux
 *  ensembles : la porte de commit exigeait un solde sur un `refs #N` que le pilotage de publication
 *  n'aurait pas vu. Une instance NEUVE par lecture (`lastIndex` mutable d'un motif global).
 *
 *  Le motif capture la CHAÎNE ENTIÈRE (`refs #A #B #C`, `refs #A, #B`) : c'est la graphie dominante
 *  du dépôt (72 des 300 derniers sujets de commit). Chaque correspondance porte donc N numéros, que
 *  ses lecteurs extraient par `#\d+` — jamais un seul groupe. La FERMETURE, elle, garde sa grammaire
 *  documentée « un mot-clef PAR ticket » (en-tête de ce fichier). */
export const motifRattachement = () => /\brefs?\s+#\d+(?:\s*,?\s*#\d+)*/gi

/** Numéros CANONIQUES portés par une correspondance de rattachement (`refs #1699 #1388` → `['1699',
 *  '1388']`), zéros de tête absorbés, dans l'ordre d'apparition. PURE. */
export const numerosDeLaChaine = (chaine) => [...String(chaine ?? '').matchAll(/#(\d+)/g)].map((m) => String(Number(m[1])))

/**
 * Numéros de ticket qu'un texte CITE — rattachés ∪ fermés —, dans l'ordre d'apparition,
 * dédupliqués, zéros de tête absorbés. PUR. Même contrat de sortie que `numerosFermes` : des
 * chaînes canoniques, jamais des nombres.
 *
 * Ce que la grammaire ne lit pas se lit chez `numerosFermes` et vaut ici, à une réserve près : la
 * CHAÎNE de rattachement est lue en entier (`refs #1699 #1388` rend `['1699','1388']`), tandis
 * qu'un `#N` nu SANS chaîne ouverte n'est jamais cité (`voir #1736` rend `[]`).
 * @param {string} texte @returns {string[]}
 */
export function numerosCites(texte) {
  const t = String(texte ?? '')
  const trouves = []
  for (const m of t.matchAll(motifRattachement()))
    for (const [i, numero] of numerosDeLaChaine(m[0]).entries()) trouves.push({ rang: (m.index ?? 0) + i / 1000, numero })
  for (const m of t.matchAll(motifFermeture())) trouves.push({ rang: m.index ?? 0, numero: String(Number(m[2])) })
  trouves.sort((a, b) => a.rang - b.rang)
  return [...new Set(trouves.map((t2) => t2.numero))]
}
