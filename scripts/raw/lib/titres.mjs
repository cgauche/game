// TITRES d'un texte extrait : le déballage des `<sup>` et LE prédicat d'OUVERTURE (#1739).
// Feuillet PUR — aucun accès disque, aucun registre : il se charge tel quel par Node nu comme par
// vitest, et c'est ce qui permet à ses TROIS consommateurs de partager UNE définition — le découpeur
// d'un livre neuf, le re-coupeur des `.md` en service (`couperAuxTitres`, `lib/marker-pages.mjs`)
// et la garde de format (`scripts/raw/check-source-format.mjs`).
//
// GRAIN (#1739, `docs/ajouter-un-livre-source.md`) : un fichier de `Source/` porte UNE section et
// OUVRE sur le titre que sa LISTE DE DÉCOUPE déclare (`scripts/raw/decoupes/<id>.json`, champ
// `ouverture`).
import { translitterer } from '../../source/nom-ascii.mjs'

/** `<sup>h</sup>` en TÊTE de ligne (ou après `#+ ` / `- `) devant un titre en gras : icône de rang,
 *  supprimée avec son contenu et l'espace qui suit. Cette position SEULE — ailleurs, `h` est du texte. */
const SUP_RANG = /^(#{1,6} |- )?<sup>h<\/sup> (?=\*\*)/gm

/** `<sup>0</sup>` : puce d'item (glyphe de police symbole), supprimée avec son contenu et
 *  l'espace qui suit s'il y en a un, à TOUTE position. */
const SUP_PUCE = /<sup>0<\/sup> ?/g

/**
 * Déballe le HTML `<sup>` d'une extraction Marker — et RIEN d'autre.
 *
 * CONSIGNE (source de la règle) — Mesure game-01 (session #1388, 2026-09-14) sur le corpus VF
 * suivi : `grep -rhoE "<sup>[^<]*</sup>" Source` = 196 sites, ZÉRO vrai exposant. Classes :
 * (a) lettrines et petites capitales — `<sup>s</sup>'ils`, `<sup>M</sup>'en parlez pas`,
 * `# <sup>L</sup><sup>A</sup> <sup>T</sup>OU<sup>R</sup>` = CONTENU, déballer ;
 * (b) `<sup>à</sup>` dans des titres (24) = contenu, déballer ;
 * (c) `<sup>\*</sup>`/`<sup>\*\*</sup>` (27) — et `<sup>\*\*\*</sup>` (CRB 5e : 2 sites, tables
 * d'armes p.301 et 303) = appels de note, déballer ;
 * (d) `<sup>1</sup>`…`<sup>10</sup>` devant `**Marque de …**` (VDM, ~50) = numéro de rangée d'une
 * table 1d10 aplatie en prose, déballer ;
 * (e) `<sup>h</sup>` (86 : Aux Armes 4 fichiers, Mer des Griffes 2, VDM 10 ; CRB 5e : 36 sur
 * 80 pages) TOUJOURS en tête de ligne devant un titre de carrière en gras
 * (`#### <sup>h</sup> **Hanté – Bronze 1**`, `- <sup>h</sup> **Recruit Brass 5**`) = icône de rang
 * (glyphe de police symbole), SUPPRIMER avec son contenu et l'espace qui suit, uniquement à cette
 * position (début de ligne, ou après `#+ ` ou `- `, suivi de ` **`) ;
 * (f) `<sup>0</sup>` (30 occurrences sur 25 lignes : ZI ch.14 = 20 lignes, EDOC ch.16 = 5 ;
 * `grep -rl '<sup>0</sup>' Source` ne rend que ces deux fichiers) = PUCE d'item. Mesure au PDF
 * (pypdf, `scripts/raw/lib/pdf-extract.py`, 2026-09-14) : le flux texte porte un `0` ISOLÉ dans
 * une police symbole, servant de MARQUEUR d'item — ZI p.125 (index pypdf) : `SECRETS … Vous
 * commencez avec 1d10 pistoles d'argent en plus par secret supplémentaire choisi.\n 0 Grand
 * secret : vous êtes un pacifiste convaincu…` (case à cocher devant chaque Secret des prétirés) ;
 * EDOC p.115 : `Si d'autres halflings le découvraient, Harbull serait rejeté.\n 0 Harbull
 * considère Malmir comme une âme sœur…` (ornement devant chaque paragraphe de PNJ). C'est un
 * GLYPHE, pas du texte — même classe que l'icône de rang (e) : SUPPRIMER avec son contenu et
 * l'espace qui suit, à TOUTE position (aucun vrai exposant zéro dans le corpus, cf. mesure
 * ci-dessus) : `…sans jamais attaquer. <sup>0</sup> Vous appartenez…` laisse UN seul espace,
 * `- <sup>0</sup> **Grand secret :**` donne `- **Grand secret :**` ;
 * (g) `<sup>~</sup>` (1 site, `Source/WH - V4 - Le zoo imperial/01 - TROIS EXPEDITIONS.md:7` :
 * `<sup>~</sup> UN RAPPORT ~ DU SCRIBE`) = CONTENU, déballer : au PDF (ZI p.7) le flux texte lit
 * `– EN QUÊTE DE –` puis `~ UN RAPPORT ~DU SCRIBE`, le tilde est un CARACTÈRE du texte (ornement
 * typographique, dont le second `~` est sorti nu chez Marker).
 *
 * Après passage : zéro `<sup>` résiduel — la gate `raw:check-source-format` (famille
 * `html-residuel`) compte le HTML résiduel de `Source/`.
 * Ce que ce déballage laisse VOLONTAIREMENT : les ancres `<span id="page-K-0"></span>` (substrat de
 * `anchor-fill`/`folio-bootstrap`, qui y posent `data-folio` — NE PAS les retirer) et les `<br>` de
 * cellules (structure de table, lue par la gate `raw:check-source-tables`).
 * @param {string} texte @returns {string}
 */
export function deballerSup(texte) {
  return texte.replace(SUP_RANG, (_m, prefixe) => prefixe || '')
    .replace(SUP_PUCE, '')
    .replace(/<sup>([^<]*)<\/sup>/g, '$1')
}

/* ─── LE PRÉDICAT D'OUVERTURE ──────────────────────────────────────────────────────── */

/** Ligne de titre ATX, ancres de page déjà retirées — elles préfixent le texte de leur ligne comme
 *  elles précèdent le `#` (`04 - Introduction.md` l.5 : `# <span id="page-5-0"></span>• **X** •`). */
const LIGNE_DE_TITRE = /^\s*(#{1,6})\s+(.*)$/
/** Balise `<span>` (ancre de page) : hors du texte du titre, aux deux positions où elle se pose. */
const SPAN = /<\/?span[^>]*>/g
/** Run GRAS d'une ligne de titre. */
const GRAS = /\*\*([^*]+)\*\*/g

/**
 * SUITE DE MOTS d'un texte, à la translittération que `nomAscii` impose aux noms de fichier
 * (`scripts/source/nom-ascii.mjs`, table FERMÉE). Casse et ponctuation ignorées, MOTS conservés :
 * c'est une suite, jamais un préfixe — `APPENDIX III` ≠ `APPENDIX I`, `SKILLS AND TALENTS` ≠
 * `SKILLS`.
 * @param {string} texte @returns {string[]}
 */
export const motsDe = (texte) =>
  translitterer(String(texte ?? '')).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

/**
 * Les LECTURES possibles d'une ligne de titre, ou `[]` si ce n'est pas un titre. Une ligne de titre
 * d'extraction mêle le titre et le MOBILIER de sa page — onglet au chiffre romain du chapitre
 * (`# **POISONS** V`), ornements de fer (`# • **CONSUMER GUIDE** •`). Le mobilier est HORS du gras
 * quand la ligne en porte ; il l'entoure sinon. D'où TROIS lectures, jamais un rognage :
 * la ligne ENTIÈRE, les runs GRAS joints, et le RESTE hors gras.
 * @param {string} ligne @returns {string[]}
 */
export function lecturesDeTitre(ligne) {
  const m = LIGNE_DE_TITRE.exec(deballerSup(String(ligne ?? '').replace(SPAN, '')))
  if (!m) return []
  const contenu = m[2].replace(/#+\s*$/, '').trim()
  const gras = [...contenu.matchAll(GRAS)].map((g) => g[1])
  const nu = (s) => s.replace(/[*_`]/g, ' ')
  return [nu(contenu), gras.join(' '), nu(contenu.replace(GRAS, ' '))]
}

/** Cette ligne est-elle une ligne de TITRE ? (le rang `#` ne se juge pas : Marker le pose au hasard
 *  du corps de police, `#### **PROSTHETICS**` porte une section comme `# **MAGICAL ITEMS**`.) */
export const estLigneDeTitre = (ligne) => lecturesDeTitre(ligne).length > 0

/**
 * LE PRÉDICAT : cette ligne OUVRE-t-elle sur ce titre ? Vrai dès qu'UNE des lectures de la ligne
 * rend exactement la suite de mots de l'ouverture attendue. SEULE définition du dépôt — la coupe et
 * la garde la partagent, et rien d'autre ne compare un titre.
 * @param {string} ligne @param {string} ouverture @returns {boolean}
 */
export function ouvreSur(ligne, ouverture) {
  const cible = motsDe(ouverture)
  if (!cible.length) return false
  const attendu = cible.join(' ')
  return lecturesDeTitre(ligne).some((l) => motsDe(l).join(' ') === attendu)
}
