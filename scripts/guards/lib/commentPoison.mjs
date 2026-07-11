// Mécanique de scan du garde-fou commentaires (#136, CLAUDE.md règle 6b/6c).
// Module ESM pur, exécutable par `node` nu (pas de tsx/TS) — consommé par
// src/comment-poison-guard.test.ts ET par un futur hook pre-commit.
// Les listes d'exceptions/baselines restent DONNÉES DE POLICY dans le test (ex. EXCUSE_GUARD_ACTIVE) ;
// ici ne vit QUE la mécanique de détection (extraction de commentaires, familles de regex, matching).

/**
 * @typedef {{ text: string, line: number }} Comment
 * Commentaire extrait, délimiteurs inclus. Les lignes `//` consécutives sur des lignes sources
 * adjacentes sont FUSIONNÉES en un seul commentaire logique (un tag porté sur la ligne suivante
 * neutralise l'excuse de la ligne précédente, comme le lirait un humain).
 */

/**
 * Extrait tous les commentaires (lignes `//` et blocs) d'un source TS/TSX, en ignorant le contenu
 * des chaînes ('…', "…", `…`) — une occurrence dans une chaîne ou un littéral de scénario n'est
 * PAS un commentaire. Heuristique volontairement simple : suffisante pour du TypeScript/TSX
 * standard, pas un vrai lexer.
 * @param {string} src
 * @returns {Comment[]}
 */
export function extractComments(src) {
  const raw = [];
  let i = 0;
  let line = 1;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '\n') {
      line++;
      i++;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      const startLine = line;
      let j = i + 2;
      while (j < n && src[j] !== '\n') j++;
      raw.push({ kind: 'line', text: src.slice(i, j), line: startLine });
      i = j;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const startLine = line;
      let j = i + 2;
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) {
        if (src[j] === '\n') line++;
        j++;
      }
      j = Math.min(j + 2, n);
      raw.push({ kind: 'block', text: src.slice(i, j), line: startLine });
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < n && src[j] !== quote) {
        if (src[j] === '\\') {
          j++;
          if (src[j] === '\n') line++;
          j++;
          continue;
        }
        if (src[j] === '\n') line++;
        j++;
      }
      i = Math.min(j + 1, n);
      continue;
    }
    i++;
  }

  // Fusion des `//` consécutifs (lignes sources adjacentes, sans code entre eux) : un seul
  // commentaire logique — sinon un tag `[entériné …]` posé sur la ligne suivante ne « couvrirait »
  // jamais l'excuse énoncée sur la ligne précédente.
  const merged = [];
  let k = 0;
  while (k < raw.length) {
    const cur = raw[k];
    if (cur.kind === 'line') {
      let text = cur.text;
      let endLine = cur.line;
      let m = k + 1;
      while (m < raw.length && raw[m].kind === 'line' && raw[m].line === endLine + 1) {
        text += '\n' + raw[m].text;
        endLine = raw[m].line;
        m++;
      }
      merged.push({ text, line: cur.line });
      k = m;
    } else {
      merged.push({ text: cur.text, line: cur.line });
      k++;
    }
  }
  return merged;
}

/** Ligne absolue (1-based) d'un index de match DANS `comment.text`.
 * @param {Comment} comment @param {number} matchIndex @returns {number} */
export function matchLine(comment, matchIndex) {
  return comment.line + comment.text.slice(0, matchIndex).split('\n').length - 1;
}

/** Extrait de contexte lisible autour d'un match (une ligne, tronquée).
 * @param {Comment} comment @param {number} matchIndex @returns {string} */
export function excerptAt(comment, matchIndex) {
  const lineStart = comment.text.lastIndexOf('\n', matchIndex) + 1;
  let lineEnd = comment.text.indexOf('\n', matchIndex);
  if (lineEnd < 0) lineEnd = comment.text.length;
  return comment.text.slice(lineStart, lineEnd).trim().slice(0, 140);
}

// ---------------------------------------------------------------------------------------------
// Famille 1 — PIERRE TOMBALE (CLAUDE.md règle 6c). Tolérance ZÉRO, pas d'exception.
// ---------------------------------------------------------------------------------------------

// Bâti via String.fromCharCode (pas un caractère back-tick littéral dans CE fichier) : un back-tick
// littéral serait lu par les outils qui parsent ce module comme un template string et désynchroniserait
// le reste du fichier.
const BT = String.fromCharCode(96);
const CODE_TOMBSTONE_RETIRE_RX = new RegExp(
  '(ancien\\w*|' + BT + '[^' + BT + ']+' + BT + '|«[^»]+»)[\\s\\S]{0,200}?a été (retiré|supprimé|renommé)',
  'i',
);

/** @type {{ rx: RegExp, label: string }[]} */
export const TOMBSTONE_FAMILIES = [
  // NB : l'accord féminin/pluriel du participe passé est couvert par les suffixes optionnels
  // (« e »/« s »), sinon la famille ne matcherait jamais la forme la plus courante.
  //
  // Affinage #136 (post-scan agent, 51 offenders triés à la main) : la famille brute matchait aussi un
  // déplacement PHYSIQUE en jeu/UI, jamais suivi d'un article en vrai tombstone de code (qui cible
  // toujours un module ou un chemin, jamais précédé d'un déterminant). Le lookahead négatif écarte
  // l'article.
  { rx: /déplacée?s? (vers|dans) (?!la\b|le\b|un\b|une\b|les\b)/i, label: 'déplacé(e)(s) vers/dans (code)' },
  { rx: /anciennement/i, label: 'anciennement' },
  { rx: /\bex-[A-Z]/, label: 'ex-Nom' },
  { rx: /désormais (dans|via|par)/i, label: 'désormais dans/via/par' },
  // Affinage #136 : la famille brute matchait aussi le vocabulaire de JEU (un pion d'armure ou une
  // provision quittant l'inventaire EN JEU, pas du code quittant le dépôt). Une vraie pierre tombale de
  // code NOMME l'artefact : le mot "ancien", un identifiant entre back-ticks, ou un nom entre
  // guillemets — on exige l'un des trois à proximité.
  {
    rx: CODE_TOMBSTONE_RETIRE_RX,
    label: 'a été retiré/supprimé/renommé (code)',
  },
  // Affinage #136 : « avant : » nu matchait aussi le vocabulaire de RENDU/JEU (façade, direction, ou un
  // état de PERSONNAGE antérieur à un entraînement). Une vraie pierre tombale de code compare
  // EXPLICITEMENT à l'ancien comportement via une locution dédiée, ou cite la valeur/le message
  // d'avant entre guillemets.
  { rx: /(comme avant\s*:|avant\s*:\s*«)/i, label: 'avant : (comparaison au code)' },
  // #336 : la forme PARENTHÉSÉE « (avant : … » est un état-d'avant encapsulé dans un commentaire de
  // code — la parenthèse est le discriminant qui manquait à l'affinage ci-dessus (zéro faux positif
  // au sweep du 2026-07-11).
  { rx: /\(avant\s*:/i, label: 'avant : (parenthésé — état d’avant)' },
];

/** @param {string} text @returns {string[]} labels des familles matchées */
export function tombstonesIn(text) {
  return TOMBSTONE_FAMILIES.filter((f) => f.rx.test(text)).map((f) => f.label);
}

/**
 * Scan complet d'un fichier source : toutes les pierres tombales trouvées dans ses commentaires.
 * @param {string} relPath chemin relatif (pour le libellé de la trouvaille)
 * @param {string} contenu source complet du fichier
 * @returns {{ line: number, detail: string }[]}
 */
export function scanTombstones(relPath, contenu) {
  const findings = [];
  for (const c of extractComments(contenu)) {
    for (const fam of TOMBSTONE_FAMILIES) {
      const m = fam.rx.exec(c.text);
      if (m) findings.push({ line: matchLine(c, m.index), detail: `[${fam.label}] ${excerptAt(c, m.index)}` });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------------------------
// Famille 2 — commentaire-EXCUSE (CLAUDE.md règle 6b). Un tag `[entériné AAAA-MM-JJ]` dans le MÊME
// commentaire neutralise la détection (décision utilisateur traçable).
// ---------------------------------------------------------------------------------------------

/** Policy PARTAGÉE (test Vitest + hook pre-commit + hook au stylo — une seule source de vérité) :
 *  le volet excuses ne BLOQUE que lorsque le tri utilisateur du stock existant est fait
 *  (tag `[entériné AAAA-MM-JJ]` ou reformulation de chaque occurrence), cf. #136/#177. Le tri est
 *  FAIT (stock reformulé) → `true` : les hooks bloquent l'excuse sans tag et le test Vitest scanne
 *  tout src/**. Une nouvelle excuse sans tag `[entériné]` échoue désormais la CI et le commit. */
export const EXCUSE_GUARD_ACTIVE = true;

// Affinage 2026-07-06 (recensement : 41 faux positifs sur 44 occurrences, même méthode que les
// familles tombstone ci-dessus) : une vraie excuse nomme un artefact de CODE (paramètre, appelant,
// migration) ; le faux positif nomme un artefact de RÈGLE (Round, Test, Action, Sort — capitalisé
// dans les commentaires du repo) ou documente la sémantique null/false d'un champ d'état de partie.
// « pas encore <participe de mécanique de jeu> » et « temporairement <durée d'effet> » sont écartés
// structurellement ; « pour l'instant » reste détecté nu (les vraies excuses du stock l'utilisent).
const GAME_STATE_PARTICIPLE =
  '(lanc|tir[ée]|boug|dépens|défend|résol|jou|commenc|ouvert|agi\\b|explor|entraîn|connu|désign|roul|au niveau|à la mi|de [A-ZÀ-Ý])';
export const EXCUSE_RX = new RegExp(
  "(assume|épargn[ée]\\w*(?!\\w)(?!\\s+(par|pour)\\s)|pour l'instant|pas encore (?!" +
    GAME_STATE_PARTICIPLE +
    ')|(?<!\\b(accordée?s?|prime|insensible)\\s)temporairement(?!\\s+(insensible|accordé|accordée|accordées|prime)))',
  'i',
);
export const ENTERINE_TAG_RX = /\[entériné \d{4}-\d{2}-\d{2}\]/;

/** @param {string} text @returns {RegExpExecArray | null} */
export function untaggedExcuseMatch(text) {
  if (ENTERINE_TAG_RX.test(text)) return null;
  return EXCUSE_RX.exec(text);
}

/**
 * Scan complet d'un fichier source : toutes les excuses non taguées trouvées dans ses commentaires.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanExcuses(relPath, contenu) {
  const findings = [];
  for (const c of extractComments(contenu)) {
    const m = untaggedExcuseMatch(c.text);
    if (m) findings.push({ line: matchLine(c, m.index), detail: excerptAt(c, m.index) });
  }
  return findings;
}

// ---------------------------------------------------------------------------------------------
// Famille 3 — AFFIRMATION-RAW non ancrée (CLAUDE.md règle 6a). Un commentaire qui AFFIRME ce que
// le RAW exige/n'exige pas, sans réf de livre dans le MÊME commentaire, est du poison présumé :
// c'est la classe « bélier » 2026-07-06 (« RAW ne l'exige pas » — faux, ADE II ch.8 exige l'Équipe)
// — la vérité d'une thèse n'est pas machine-vérifiable, son ANCRAGE l'est. Canal ALERTE (jamais
// bloquant) : la session qui l'écrit doit ouvrir le Source et citer, ou reformuler en réf nue.
// ---------------------------------------------------------------------------------------------

/** @type {{ rx: RegExp, label: string }[]} */
export const RAW_CLAIM_FAMILIES = [
  { rx: /\bRAW\s+ne\s+(?:l['']\s?)?\w*\s?\w*(exige|demande|impose|précise|prévoit|couvre|définit|mentionne|chiffre|tranche|marque)\w*\s+(pas|rien|jamais)/i, label: 'RAW ne … pas' },
  { rx: /\b(pas|non|jamais)\s+(exigée?s?|demandée?s?|imposée?s?|prévue?s?|définie?s?|couverte?s?)\s+par\s+le\s+RAW/i, label: 'pas … par le RAW' },
  { rx: /\ble\s+(RAW|livre|Source)\s+n[e'']\s?\w*\s?\w*\s+(pas|rien|jamais)/i, label: 'le RAW/livre ne … pas' },
  { rx: /\bRAW\s+(est\s+)?(muet|silencieux)/i, label: 'RAW muet' },
  { rx: /\b(hors[- ]RAW|non[- ]RAW|pas\s+RAW)\b/i, label: 'hors-RAW nu' },
  { rx: /(laissée?s? au MJ|au choix du MJ|le MJ (décide|tranche|arbitre))/i, label: 'renvoi au MJ' },
];
/** Réf de livre ancrant la thèse au Source (n'importe où dans le MÊME commentaire logique). */
export const BOOK_REF_RX = /\b(LDB|ADE\s*I{1,2}|EDOC?|MDG|AA|ZI|ACE|NADAJ|T2C?|Middenheim)\b\s*(\d+|ch\.?\s*\d+|l\.\s*\d+|p\.?\s*\d+|§)/i;

// ---------------------------------------------------------------------------------------------
// Famille 4 — REVENDICATION D'AUTORITÉ non tracée (credo : « un commentaire-excuse n'est pas une
// autorisation », house-rule = paramétrable/taguée). « Notre arbitrage », « choix de modèle »,
// « décision assumée » : sans TRACE de validation, c'est la justification fallacieuse qui habille
// une implémentation (classe « servir coûte l'Action » 2026-07-06, sœur de la classe « bélier »).
// SEULE trace reconnue (décision utilisateur 2026-07-07 : « je n'accepte aucune justification sans
// la mention explicite [entériné] ») : le tag [entériné AAAA-MM-JJ] — dont l'écriture est elle-même
// gardée par enterine-guard.mjs (dialogue de validation utilisateur). Date, citation, ancrage canon
// ne suffisent PAS : ils datent ou attribuent la décision, ils ne prouvent pas sa validation.
// ---------------------------------------------------------------------------------------------

/** @type {{ rx: RegExp, label: string }[]} */
export const DECISION_CLAIM_FAMILIES = [
  { rx: /\barbitrages?\s+(maison|de design|de modèle|assumée?s?|explicite|utilisateur)/i, label: 'arbitrage X' },
  { rx: /\b(notre|mon)\s+arbitrage/i, label: 'notre arbitrage' },
  { rx: /\bchoix\s+(maison|de design|de modèle|assumée?s?)/i, label: 'choix X' },
  { rx: /\b(décision|parti[- ]pris)\s+(assumée?s?|maison|de design)/i, label: 'décision/parti-pris' },
  { rx: /\bon\s+(a|avait)\s+(choisi|décidé|tranché)/i, label: 'on a décidé' },
];
export const DECISION_TRACE_RX = ENTERINE_TAG_RX;

/**
 * Scan complet d'un fichier : revendications d'autorité SANS trace de validation adjacente.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanDecisionClaims(relPath, contenu) {
  const findings = [];
  for (const c of extractComments(contenu)) {
    for (const fam of DECISION_CLAIM_FAMILIES) {
      const m = fam.rx.exec(c.text);
      if (!m) continue;
      const window = c.text.slice(Math.max(0, m.index - 150), m.index + m[0].length + 150);
      if (DECISION_TRACE_RX.test(window)) continue;
      findings.push({ line: matchLine(c, m.index), detail: `[${fam.label}] ${excerptAt(c, m.index)}` });
    }
  }
  return findings;
}

/**
 * Scan complet d'un fichier : affirmations sur le RAW SANS réf de livre dans le même commentaire.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanRawClaims(relPath, contenu) {
  const findings = [];
  for (const c of extractComments(contenu)) {
    for (const fam of RAW_CLAIM_FAMILIES) {
      const m = fam.rx.exec(c.text);
      if (!m) continue;
      // Ancrage de PROXIMITÉ : une réf de livre ADJACENTE à la thèse (±120 caractères) la rend
      // matériellement vérifiable. Le bloc ENTIER ne suffit pas — l'en-tête du scénario bélier
      // citait ADE II ailleurs, la fausse claim restait non sourcée (angle mort constaté 2026-07-06).
      const window = c.text.slice(Math.max(0, m.index - 120), m.index + m[0].length + 120);
      if (BOOK_REF_RX.test(window)) continue;
      findings.push({ line: matchLine(c, m.index), detail: `[${fam.label}] ${excerptAt(c, m.index)}` });
    }
  }
  return findings;
}
