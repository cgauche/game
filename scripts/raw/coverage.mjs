// Registre de couverture de l'Atlas RAW — le backbone de « l'Atlas remplace la source ».
// Déterministe : pour chaque chapitre des 15 livres autorisés, vérifie s'il est CITÉ (`ABBR NN l.`)
// par au moins une fiche docs/raw/*.md. Un chapitre non cité = trou (à couvrir ou à marquer hors-règle).
// #454 défaut A/7 : granularité SECTION (H2) en sus du chapitre — un chapitre à sujets multiples peut
// être ✅ au total (une section porte l'essentiel des refs) tout en enfouissant une section SANS AUCUNE
// réf. `sectionsOf`/`refSpansFor`/`annotateSections` sont PURES (testées) ; seule `classify` touche le
// disque (chapterFile). Re-run après chaque domaine pour voir les trous se réduire à zéro.
// ⚠ Mesure H2 SEULE, PARTIELLE (angle mort documenté dans la ligne de résumé émise) : les livres qui
// structurent leurs chapitres en H3 (LDB, MCLB) en ressortent quasi vides, et un chapitre crédité par
// CATALOGUE ne détaille jamais ses sections ici. Refonte de la mesure (granularité H3, distinction
// fiche/catalogue, zéro masquage silencieux) : ticket **#604**.
// Sortie : docs/raw/coverage.md
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS, esc, chapterFile, folioSpan } from './_lib.mjs'
const rawDir = 'docs/raw'
// Chapitres HORS-RÈGLE (exclus du dénominateur) : section MJ/cadre du LDB (terrain/politique/colonies/
// sites = direction de jeu, pas des règles PC) + front-matter (index/intro/préface) de tout livre.
// Conservateur : on ne tague QUE le clairement-non-règle, pour ne jamais masquer un vrai trou de règle.
// Livres d'AVENTURE purs : leurs chapitres-règles sont couverts (✅/catalogue) ; tout chapitre restant = scénario.
const SCENARIO_BOOKS = new Set(['EDO', 'MSR', 'PDT', 'ACE', 'AU1', 'NADJ'])
// #454 juge (défaut 1) : sous-ensemble des livres ci-dessus qui sont des CAMPAGNES PURES (jamais de
// règle, même dans un chapitre ✅ — le crédit vient d'une rencontre ponctuelle qui APPELLE une règle
// définie ailleurs, pas d'un contenu de règle propre au chapitre). Sert UNIQUEMENT à ventiler l'affichage
// des trous section-granulaires (bruit de scénario vs candidats trous de règle) — n'affecte PAS
// `skipHoles`/HORS_REGLE (mécanisme de masquage des chapitres non crédités, inchangé). ACE et NADJ en
// sont EXCLUS malgré leur présence dans `SCENARIO_BOOKS` : ce sont des livres MIXTES (ACE porte l'Annexe I
// de règles, NADJ porte les jeux de taverne — cf. NADJ 16 ci-dessous) où un trou de section peut cacher
// une vraie règle, jamais du bruit pur.
export const SCENARIO_PUR = new Set(['EDO', 'MSR', 'PDT', 'AU1'])
// Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes).
const HORS_REGLE = new Set([
  'LDB 52', 'LDB 53', 'LDB 54', 'LDB 55', 'LDB 56',
  'ADE I 1', 'ADE I 2', 'ADE I 3', 'ADE I 4', 'ADE I 5', 'ADE I 6',
  'ADE II 5', 'ADE II 6', 'ADE II 7',
  'MCLB 1', 'MCLB 2', 'MCLB 3', 'MCLB 5', 'MCLB 6',
  'EDOC 2', 'EDOC 3', 'EDOC 5', 'EDOC 10', 'EDOC 11', 'EDOC 13', 'EDOC 14', 'EDOC 15', 'EDOC 16',
  'MSRC 2', 'MSRC 3', 'MSRC 5', 'MSRC 6', 'MSRC 8', 'MSRC 10', 'MSRC 11', 'MSRC 17', 'MSRC 18', 'MSRC 19',
  'MDG 1', 'MDG 3', 'MDG 4', 'MDG 5', 'MDG 6', 'MDG 8', // gazetteer côtier (cadre, pas de règles) ; 2/7/9-16 = règles
])
const isFrontMatter = (t) => /^index$|^introduction|avant-?propos|préface|^preface|^sommaire|^\*+$/i.test(t.trim())

// --- Granularité SECTION (H2), PURE (#454 défaut A/7) ---

// Nettoie un titre de heading Markdown brut (span d'ancre folio, gras) → texte comparable.
function cleanTitle(t) {
  return t.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '').replace(/\*\*/g, '').trim()
}

// Découpe le texte d'un fichier-chapitre en sections H2 : `[{ title, lo, hi, enfoui, isIntro }]`
// (`lo`/`hi` = lignes 1-based, `hi` EXCLUSIF). `enfoui` : le titre porte l'ornement `•` (marque d'un
// titre de CHAPITRE dans la source — normalement rendu en H1) ET ce heading n'est PAS le premier du
// fichier (le premier heading orné = le titre du CHAPITRE COURANT lui-même, faux positif ; validé
// sur `ADE I 02/03/05/06/07/08`, `ADE II 01/03/04/08/09` : tous à la ligne 3-5 du fichier).
// ⚠ Un H2 enfoui n'est PAS une section sœur de celles qui suivent : c'est un titre de CHAPITRE
// rétrogradé, donc les H2 normaux qui le suivent lui appartiennent (ce sont SES sous-sections), au
// même titre que « Le dressage » appartient à « LE COMBAT MONTÉ » (H1). Sa plage s'étend jusqu'au
// PROCHAIN H2 enfoui du fichier (nouveau chapitre embarqué), ou à défaut jusqu'à la fin du fichier —
// jamais juste jusqu'au prochain H2 littéral (mesuré : `AA 09 l.191` réduit à 4 lignes de titre au
// lieu des ~311 lignes réelles avant #454 juge, absorbant à tort 10 sous-sections comme sœurs).
export function sectionsOf(text) {
  const lines = text.split('\n')
  const headingRe = /^(#{1,6})\s*(.*)$/
  let firstHeadingLine = null
  const h2s = []
  lines.forEach((l, i) => {
    const m = headingRe.exec(l)
    if (!m) return
    if (firstHeadingLine == null) firstHeadingLine = i + 1
    if (m[1].length === 2) h2s.push({ line: i + 1, title: cleanTitle(m[2]) })
  })
  const eof = lines.length + 1
  const sections = []
  if (h2s.length && h2s[0].line > 1) {
    sections.push({ title: '(intro)', lo: 1, hi: h2s[0].line, enfoui: false, isIntro: true })
  }
  const isEnfoui = (h) => /•/.test(h.title) && h.line !== firstHeadingLine
  let k = 0
  while (k < h2s.length) {
    const h = h2s[k]
    if (isEnfoui(h)) {
      let j = k + 1
      while (j < h2s.length && !isEnfoui(h2s[j])) j++
      const hi = j < h2s.length ? h2s[j].line : eof
      sections.push({ title: h.title, lo: h.line, hi, enfoui: true, isIntro: false })
      k = j
    } else {
      const hi = k + 1 < h2s.length ? h2s[k + 1].line : eof
      sections.push({ title: h.title, lo: h.line, hi, enfoui: false, isIntro: false })
      k++
    }
  }
  if (!sections.length) sections.push({ title: '(intégral)', lo: 1, hi: eof, enfoui: false, isIntro: true })
  return sections
}

// Plages de ligne `{ lo, hi, file }` de toutes les refs `ABBR NN l.X[suffixe]` ET `ABBR NN p.folio[suffixe]`
// (#606 : la graphie folio, gelee par #585, etait invisible ici) d'un chapitre, dans DOCS.
// ⚠ N'utilise PAS `span()` de `_lib.mjs` : cette derniere reduit un suffixe `+N+M` (points DISCRETS,
// « et aussi l.N, l.M ») a une bbox `[X, max(N,M)]` — correct pour son usage (borne « dans le
// chapitre »), mais ici cette bbox fabrique un FAUX chevauchement de section (mesure : `AA 09
// l.157+228` couvrait a tort 4 sections entre l.157 et l.228 qui ne contiennent RIEN de ces deux
// points). On emet un span PAR POINT DISCRET (`+N` = son propre point) ; seul `-N` reste un
// intervalle continu — meme granularite appliquee aux refs folio, converties en lignes via
// `folioSpan` (accès disque UNIQUEMENT si des refs `p.` sont presentes dans `docs`). `stats`
// (optionnel, `{ ignoredFolios }`) accumule les folios ignores proprement (ancre absente,
// ambigue, ou resolue vers un AUTRE chapitre — jamais un throw, #606).
export function refSpansFor(ab, nn, docs, stats) {
  const reLine = new RegExp(`\\b${esc(ab)} 0*${Number(nn)} l\\.(\\d+)((?:[-+]\\d+)*)`, 'g')
  const rePage = new RegExp(`\\b${esc(ab)} 0*${Number(nn)} p\\.(\\d+)((?:[-+]\\d+)*)`, 'g')
  const spans = []
  for (const d of docs) {
    reLine.lastIndex = 0
    let m
    while ((m = reLine.exec(d.text))) {
      const line = Number(m[1]); const suffix = m[2]
      const range = suffix.match(/^-(\d+)/)
      if (range) { spans.push({ lo: line, hi: Number(range[1]), file: d.file }); continue }
      spans.push({ lo: line, hi: line, file: d.file })
      for (const p of (suffix.match(/\+(\d+)/g) || [])) {
        const n = Number(p.slice(1))
        spans.push({ lo: n, hi: n, file: d.file })
      }
    }
    rePage.lastIndex = 0
    while ((m = rePage.exec(d.text))) {
      const resolved = folioSpan(ab, nn, m[1], m[2])
      if (!resolved) { if (stats) stats.ignoredFolios = (stats.ignoredFolios || 0) + 1; continue }
      spans.push({ lo: resolved[0], hi: resolved[1], file: d.file })
    }
  }
  return spans
}

// Annote chaque section (hors intro) de son nombre de refs qui la recoupent → `{ ...section, refs }`.
export function annotateSections(sections, spans) {
  return sections.filter((s) => !s.isIntro).map((s) => {
    const refs = spans.filter((sp) => sp.lo < s.hi && sp.hi >= s.lo).length
    return { ...s, refs }
  })
}

// Classe un chapitre : ✅ couvert (propriétaire ≥3 refs ligne, OU catalogue au chapitre) · 🟡 effleuré (1-2) · ⬜ trou (0).
// `sections` : détail section-granulaire (trous ET chapitres enfouis), calculé quel que soit le mark
// chapitre — un chapitre ✅ (des refs abondantes ailleurs) peut enfouir une section SANS AUCUNE réf ;
// c'est exactement le défaut A (#454) : ne JAMAIS gater le détail par le mark chapitre.
function classify(ab, nn, skipHoles, docs, catalogCh) {
  // (l|p) : les deux graphies canoniques de citation d'un chapitre comptent pour sa couverture (#606)
  const re = new RegExp(`\\b${esc(ab)} 0*${Number(nn)} (?:l|p)\\.`, 'g')
  let total = 0, owner = '', ownerN = 0
  for (const d of docs) {
    const n = (d.text.match(re) || []).length
    total += n
    if (n > ownerN) { ownerN = n; owner = d.file }
  }
  const cat = catalogCh.has(`${ab} ${Number(nn)}`)
  if (cat && ownerN < 3) owner = owner || 'catalogue-*.md'
  const mark = (ownerN >= 3 || cat) ? '✅' : total > 0 ? '🟡' : '⬜'

  let holes = [], enfoui = []
  const folioStats = { ignoredFolios: 0 }
  const info = chapterFile(ab, nn)
  if (info) {
    const text = readFileSync(info.path, 'utf8')
    const sections = sectionsOf(text)
    const spans = refSpansFor(ab, nn, docs, folioStats)
    const annotated = annotateSections(sections, spans)
    enfoui = annotated.filter((s) => s.enfoui)
    // Un chapitre crédité par CATALOGUE (`cat`) n'est jamais cité en `l.X` (données ré-extraites au
    // chapitre, pas en ligne) : le trou-section n'y mesure rien, exemption gardée sans condition.
    // `skipHoles` (HORS_REGLE/SCENARIO_BOOKS/isFrontMatter) ne s'applique en revanche QUE si le
    // chapitre reste effectivement non-crédité (🟡/⬜) : un chapitre narratif passé ✅ par des refs de
    // règle embarquées (ex. NADJ 16 « Jeux de taverne », crédité pour PRÉCISÉMENT ce contenu) n'est
    // plus « clairement non-règle » — masquer ses sections à 0 réf y cache un vrai trou (#454 faux
    // vert, juge adversarial). ⚠ N'ÉLARGIR jamais l'inverse (retirer `skipHoles` des 🟡/⬜) : ça
    // rouvrirait le faux positif documenté ci-dessus sur ADE I 07/08, LDB 62 armes. ⚠ Ceci N'EXEMPTE
    // PAS EDO/MSR/PDT/AU1 (`SCENARIO_PUR`) : leurs chapitres ✅ (crédités par une rencontre qui
    // APPELLE une règle définie ailleurs, ex. EDO 07/09) RESTENT affichés ici — le juge adversarial
    // (#454 tour 2) a mesuré que 73 % des trous globaux (56/77) en proviennent, tous du bruit de
    // scénario (« CONCLUSION », « PNJ », « Récompenses »…), aucun trou de règle. On ne les MASQUE PAS
    // (un vrai trou de règle pourrait s'y cacher un jour) : on les VENTILE à l'affichage (`main`,
    // `SCENARIO_PUR`) en « bruit de scénario » distinct des « candidats trous de règle » des livres
    // mixtes/de règles — jamais un chiffre global qui les confond.
    holes = (cat || (skipHoles && mark !== '✅')) ? [] : annotated.filter((s) => s.refs === 0 && !s.enfoui)
  }
  return { total, owner, ownerN, mark, cat, holes, enfoui, ignoredFolios: folioStats.ignoredFolios }
}

function main() {
  // Profondeur-conscient : on garde chaque fiche séparée pour compter les refs et trouver la fiche PROPRIÉTAIRE.
  const docs = readdirSync(rawDir).filter((f) => f.endsWith('.md') && f !== 'coverage.md')
    .map((f) => ({ file: f, text: readFileSync(join(rawDir, f), 'utf8') }))
  // Chapitres LDB couverts par un CATALOGUE (catalogue-*.md = données mécaniques verbatim ré-extraites,
  // sans réf `l.X` ligne — créditées au niveau CHAPITRE via `LDB NN`).
  const catalogCh = new Set() // clés « ABBR NN » créditées par un catalogue (tous livres)
  for (const d of docs) {
    if (!/^catalogue-/.test(d.file)) continue
    for (const [ab] of BOOKS) {
      const re = new RegExp(`\\b${esc(ab)} (\\d+)\\b`, 'g'); let m
      while ((m = re.exec(d.text))) catalogCh.add(`${ab} ${Number(m[1])}`)
    }
  }

  const SUMMARY_PLACEHOLDER = '__SUMMARY_LINE__'
  const out = ['# Atlas RAW — Registre de couverture', '',
    `> Contrat « l'Atlas remplace la source » : chaque chapitre des ${BOOKS.length} livres doit être **couvert** (cité`,
    '> par une fiche `docs/raw/`) ou explicitement **hors-règle** (narratif). Un chapitre `⬜` = trou.',
    '> Recourir à la source pour un point = un défaut de l\'Atlas à corriger ici. Régénéré par',
    '> `node scripts/raw/coverage.mjs`. Détail **section-granulaire** (H2) sous la table d\'un chapitre',
    '> qui enfouit une section : `⬜` = section sans aucune réf dans sa plage, `🔻 enfoui` = titre orné',
    '> (`•`) rétrogradé par l\'extraction — un défaut d\'extraction, pas une section ordinaire (#454).', '',
    SUMMARY_PLACEHOLDER, '']

  let gOk = 0, gMid = 0, gHole = 0
  let gSecEnfoui = 0
  // #454 juge (défaut 1) : ventilation des trous section-granulaires en deux comptes DISTINCTS —
  // jamais un total confondu qui laisse croire à 77 trous de règle. `gSecHolesScenario` = livres de
  // `SCENARIO_PUR` (EDO/MSR/PDT/AU1, campagnes pures : le crédit ✅ d'un chapitre vient d'une rencontre
  // qui APPELLE une règle définie ailleurs, ses sections vides sont de la prose de scénario, jamais une
  // règle) ; `gSecHolesRegle` = tout le reste (livres de règles + compagnons MIXTES ACE/NADJ/ADE/MCLB/
  // EDOC/MSRC/MDG où une section vide PEUT cacher une vraie règle non couverte).
  let gSecHolesScenario = 0, gSecHolesRegle = 0
  let gIgnoredFolios = 0 // #606 : folios cites en docs sans ancre data-folio resoluble dans le bon chapitre
  const perBook = []
  for (const [ab, dir] of BOOKS) {
    let files
    try { files = readdirSync(dir).filter((f) => /^\d+ - /.test(f) && f.endsWith('.md')) }
    catch { out.push(`## ${ab} — ⚠ dossier introuvable (${dir})`, ''); continue }
    let bOk = 0, bMid = 0, bHole = 0
    const lines2 = ['| Ch. | Titre | État | refs (propriétaire) |', '|---|---|---|---|']
    const detailBlocks = []
    const isPur = SCENARIO_PUR.has(ab)
    for (const f of files.sort()) {
      const nn = f.match(/^(\d+) - /)[1]
      const title = f.replace(/^\d+ - /, '').replace(/\.md$/, '')
      const artefact = /^_/.test(title)
      const narrative = HORS_REGLE.has(`${ab} ${Number(nn)}`) || SCENARIO_BOOKS.has(ab) || isFrontMatter(title)
      const c = classify(ab, nn, narrative, docs, catalogCh)
      if (artefact && c.total === 0) { lines2.push(`| ${nn} | *(artefact OCR)* | ➖ | |`); continue }
      if (c.mark !== '✅' && narrative) {
        lines2.push(`| ${nn} | ${title} | ➖ hors-règle | |`); continue
      }
      if (c.mark === '✅') bOk++; else if (c.mark === '🟡') bMid++; else bHole++
      gIgnoredFolios += c.ignoredFolios
      const detail = c.total ? `${c.total} (${c.owner} ×${c.ownerN})` : ''
      lines2.push(`| ${nn} | ${artefact ? '*(artefact OCR)*' : title} | ${c.mark} | ${detail} |`)
      if (c.enfoui.length || c.holes.length) {
        if (isPur) gSecHolesScenario += c.holes.length; else gSecHolesRegle += c.holes.length
        gSecEnfoui += c.enfoui.length
        const rows = [
          ...c.enfoui.map((s) => `  - 🔻 enfoui l.${s.lo}-${s.hi - 1} « ${s.title.replace(/\s*•\s*/g, ' ').trim()} » — titre orné rétrogradé par l'extraction, ${s.refs} réf`),
          ...c.holes.map((s) => `  - ⬜ l.${s.lo}-${s.hi - 1} « ${s.title} »${isPur ? ' — bruit de scénario' : ' — candidat trou de règle'}, 0 réf`),
        ]
        detailBlocks.push(`- **${ab} ${nn}** (${title}) :`, ...rows)
      }
    }
    gOk += bOk; gMid += bMid; gHole += bHole
    perBook.push(`${ab} ✅${bOk}·🟡${bMid}·⬜${bHole}`)
    out.push(`## ${ab} — ✅ ${bOk} · 🟡 ${bMid} · ⬜ ${bHole}`, '', ...lines2, '')
    if (detailBlocks.length) {
      const label = isPur
        ? '**Sections enfouies/trouées** (granularité H2 — livre de `SCENARIO_PUR`, les ⬜ sont du bruit de scénario, PAS des trous de règle) :'
        : '**Sections enfouies/trouées** (granularité H2, invisibles au niveau chapitre — les ⬜ sont des candidats trou de règle) :'
      out.push(label, '', ...detailBlocks, '')
    }
  }

  const denom = gOk + gMid + gHole
  const gSecHoles = gSecHolesScenario + gSecHolesRegle
  const summaryLine = `**Couverture (profondeur) : ✅ ${gOk} couverts · 🟡 ${gMid} effleurés · ⬜ ${gHole} trous** sur ${denom} chapitres-règles (hors artefacts OCR). ✅ = une fiche propriétaire le traite (≥3 refs) ; 🟡 = seulement cité en renvoi ; ⬜ = absent. Section-granulaire (H2, PARTIEL) : ${gSecHoles} section(s) trouée(s) — dont **${gSecHolesScenario} bruit de scénario** (livres \`SCENARIO_PUR\` EDO/MSR/PDT/AU1 : prose de campagne, aucune règle) et **${gSecHolesRegle} candidat(s) trou de règle** (reste : livres de règles + compagnons mixtes ACE/NADJ/ADE/MCLB/EDOC/MSRC/MDG, où une section vide peut cacher une vraie règle non couverte) — et ${gSecEnfoui} titre(s) de chapitre enfoui(s) détecté(s) (titre orné rétrogradé en H2 par l'extraction) — chiffre NON exhaustif : un chapitre crédité par CATALOGUE (transcription verbatim, pas de traitement) ne détaille jamais ses sections ici, et la granularité H2 sous-mesure structurellement les livres qui structurent leurs chapitres en H3 (LDB : 16 sections H2 pour 86 chapitres, MCLB : 0). Mesure indépendante sur l'ensemble des 997 sections H2 des 15 livres : 157 couvertes par une FICHE, 381 par un CATALOGUE, 459 (46 %) par NI L'UN NI L'AUTRE. Refonte de la mesure (granularité H3, distinction fiche/catalogue, zéro masquage silencieux) : **#604**. Réfs folio (\`ABBR NN p.X\`, #606) : ${gIgnoredFolios} ignorée(s) proprement (ancre absente/ambiguë/hors-chapitre). Par livre : ${perBook.join(' · ')}.`
  const summaryIdx = out.indexOf(SUMMARY_PLACEHOLDER)
  out[summaryIdx] = summaryLine
  writeFileSync(join(rawDir, 'coverage.md'), out.join('\n'))
  console.log(`coverage profondeur : ✅ ${gOk} · 🟡 ${gMid} · ⬜ ${gHole} (sur ${denom} chapitres) · sections : ⬜${gSecHoles} (scénario ${gSecHolesScenario} · règle ${gSecHolesRegle}) · 🔻${gSecEnfoui} · folios ignorés ${gIgnoredFolios}`)
  console.log('par livre : ' + perBook.join(' · '))
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
