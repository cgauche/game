// LES LIENS D'UN DOCUMENT MARKDOWN — définition UNIQUE de « ce lien désigne un fichier du dépôt ».
//
// Un lien se juge sur ce qu'il DÉSIGNE, pas sur la façon dont il s'écrit : la forme DOMINANTE des
// liens entre pages sœurs est le frère NU `](combat.md)`, sans `./`.
//
// Est JUGEABLE tout lien dont la cible est un chemin du dépôt, résolu depuis le DOSSIER de la page :
// le chemin explicitement relatif (`./`, `../`, toute extension) et le frère NU vers un `.md`. Un
// frère nu d'une AUTRE extension ne l'est pas : `](x)` est aussi bien une ancre de rendu qu'un
// fichier, et la garde ne devine pas.
// Un lien ÉCRIT DANS DU CODE n'est un lien pour aucun rendu : le bloc clôturé comme le SPAN en ligne
// (`` `](x.md)` ``) sont des exemples de syntaxe — la garde ne les juge pas (#1824).
// N'est PAS jugeable : l'URL d'un schéma (`http:`, `mailto:`), le chemin absolu (`/x`), l'ancre
// seule (`](#titre)`) — aucun des trois ne désigne un fichier voisin. L'ancre seule entre dans le
// rendu sous `{ ancresSeules: true }` : elle ne désigne aucun fichier, mais elle désigne une ancre
// de la page COURANTE, et c'est ce que juge `scripts/raw/check-ancres.mjs` (#1824).
// La cible est nettoyée de son ancre et de sa chaîne de requête ; l'ANCRE, elle, est rendue à part
// (`ancre`, URL-décodée, `null` quand le lien n'en porte pas).

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

/** Un SPAN de code en ligne : une suite de backticks, son contenu, la même suite — sans franchir la
 *  fin de ligne, qu'aucun span du corpus ne franchit. */
const SPAN_EN_LIGNE = /(`+)([^`\n]*)\1/g

/** Neutralise le contenu des spans de code EN LIGNE en PRÉSERVANT longueurs, index et lignes : le
 *  contenu devient des espaces, les backticks restent. @returns {string} */
function sansCodeEnLigne(texte) {
  return String(texte).replace(SPAN_EN_LIGNE, (_m, backticks, dedans) => backticks + ' '.repeat(dedans.length) + backticks)
}

/** Tout lien Markdown `](cible)` du texte qu'on lui donne. */
const LIEN_RE = /\]\(([^)\s]+)\)/g
/** Une cible qui commence par un schéma (`http:`, `mailto:`, `file:`) n'est pas un chemin du dépôt. */
const SCHEMA_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/

/** L'ancre d'un lien tel qu'il est ÉCRIT, URL-décodée, ou `null` s'il n'en porte pas. Une ancre que
 *  le décodage refuse (échappement tronqué) se rend telle qu'écrite : c'est elle que le rapport
 *  doit nommer. */
function ancreDuLien(ecrit) {
  const coupe = ecrit.indexOf('#')
  if (coupe < 0) return null
  const brute = ecrit.slice(coupe + 1).replace(/\?.*$/, '')
  try { return decodeURIComponent(brute) } catch { return brute }
}

/**
 * Les liens JUGEABLES d'une page Markdown : blocs de code retirés, cible nettoyée de son ancre.
 * L'`index` est celui de la cible dans le texte SANS blocs de code — le compte de lignes y est
 * préservé, donc la ligne rapportée reste celle du document.
 * @param {string} texte contenu de la page
 * @param {{ ancresSeules?: boolean }} [options] `ancresSeules` admet le lien `](#titre)`, rendu avec
 *   une `cible` VIDE — la page courante
 * @returns {{ texteScanne: string, liens: Array<{ cible: string, ecrit: string, ancre: string|null, index: number }> }}
 */
export function liensJugeables(texte, { ancresSeules = false } = {}) {
  const texteScanne = sansCodeEnLigne(sansBlocsDeCode(texte))
  const liens = []
  for (const m of texteScanne.matchAll(LIEN_RE)) {
    const ecrit = m[1]
    const cible = ecrit.replace(/[#?].*$/, '')
    const ancre = ancreDuLien(ecrit)
    if (!cible) {
      if (ancresSeules && ancre) liens.push({ cible, ecrit, ancre, index: m.index })
      continue
    }
    if (SCHEMA_RE.test(cible) || cible.startsWith('/')) continue
    const relatifExplicite = cible.startsWith('./') || cible.startsWith('../')
    if (!relatifExplicite && !cible.endsWith('.md')) continue
    liens.push({ cible, ecrit, ancre, index: m.index })
  }
  return { texteScanne, liens }
}
