// LES LIENS D'UN DOCUMENT MARKDOWN — définition UNIQUE de « ce lien désigne un fichier du dépôt ».
//
// Un lien se juge sur ce qu'il DÉSIGNE, pas sur la façon dont il s'écrit : la forme DOMINANTE des
// liens entre pages sœurs est le frère NU `](combat.md)`, sans `./`.
//
// Est JUGEABLE tout lien dont la cible est un chemin du dépôt, résolu depuis le DOSSIER de la page :
// le chemin explicitement relatif (`./`, `../`, toute extension) et le frère NU vers un `.md`. Un
// frère nu d'une AUTRE extension ne l'est pas : `](x)` est aussi bien une ancre de rendu qu'un
// fichier, et la garde ne devine pas.
// N'est PAS jugeable : l'URL d'un schéma (`http:`, `mailto:`), le chemin absolu (`/x`), l'ancre
// seule (`](#titre)`) — aucun des trois ne désigne un fichier voisin.
// L'ancre et la chaîne de requête sont RETIRÉES de la cible avant résolution.

/** Retire les blocs de code clôturés en PRÉSERVANT le compte de lignes. @returns {string} */
export function sansBlocsDeCode(texte) {
  let dansBloc = false
  return String(texte)
    .split('\n')
    .map((ligne) => {
      if (/^\s*```/.test(ligne)) { dansBloc = !dansBloc; return '' }
      return dansBloc ? '' : ligne
    })
    .join('\n')
}

/** Tout lien Markdown `](cible)` du texte qu'on lui donne. */
const LIEN_RE = /\]\(([^)\s]+)\)/g
/** Une cible qui commence par un schéma (`http:`, `mailto:`, `file:`) n'est pas un chemin du dépôt. */
const SCHEMA_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/

/**
 * Les liens JUGEABLES d'une page Markdown : blocs de code retirés, cible nettoyée de son ancre.
 * L'`index` est celui de la cible dans le texte SANS blocs de code — le compte de lignes y est
 * préservé, donc la ligne rapportée reste celle du document.
 * @param {string} texte contenu de la page
 * @returns {{ texteScanne: string, liens: Array<{ cible: string, ecrit: string, index: number }> }}
 */
export function liensJugeables(texte) {
  const texteScanne = sansBlocsDeCode(texte)
  const liens = []
  for (const m of texteScanne.matchAll(LIEN_RE)) {
    const ecrit = m[1]
    const cible = ecrit.replace(/[#?].*$/, '')
    if (!cible || SCHEMA_RE.test(cible) || cible.startsWith('/')) continue
    const relatifExplicite = cible.startsWith('./') || cible.startsWith('../')
    if (!relatifExplicite && !cible.endsWith('.md')) continue
    liens.push({ cible, ecrit, index: m.index })
  }
  return { texteScanne, liens }
}
