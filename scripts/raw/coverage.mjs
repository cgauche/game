// Registre de couverture de l'Atlas RAW — le backbone de « l'Atlas remplace la source ».
// Déterministe : pour chaque chapitre des 15 livres autorisés, vérifie s'il est CITÉ (`ABBR NN l.`)
// par au moins une fiche docs/raw/*.md. Un chapitre non cité = trou (à couvrir ou à marquer hors-règle).
// #454 défaut A/7 : granularité SECTION en sus du chapitre — un chapitre à sujets multiples peut être
// ✅ au total (une section porte l'essentiel des refs) tout en enfouissant une section SANS AUCUNE réf.
// `sectionsOf`/`refSpansFor`/`annotateSections`/`classifyHole` sont PURES (testées) ; seule `classify`
// touche le disque (chapterFile). Re-run après chaque domaine pour voir les trous se réduire à zéro.
// #604 : granularité ADAPTATIVE (`SECTION_LEVEL`, PAR LIVRE — voir plus bas) — le LDB/MCLB structurent
// leurs chapitres en H3, pas H2 ; un simple argmax de comptage brut s'y ferait piéger par les listes
// profondément imbriquées (chronologies AA en gras, qui gonflent H4 même dans des livres réellement
// structurés en H2 — mesuré, cf. #604). Zéro masquage silencieux : un chapitre crédité par CATALOGUE ne
// supprime plus ses trous de section, il les ÉTIQUETTE (`classifyHole`) — fiche / catalogue / scénario /
// hors-règle / trou. Le dénominateur de la ligne de résumé est DÉRIVÉ (jamais un compte recopié).
// Sortie : docs/raw/coverage.md
import { readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS, esc, chapterFile, folioSpan, readText } from './_lib.mjs'
const rawDir = 'docs/raw'
// Chapitres HORS-RÈGLE (exclus du dénominateur) : section MJ/cadre du LDB (terrain/politique/colonies/
// sites = direction de jeu, pas des règles PC) + front-matter (index/intro/préface) de tout livre.
// Conservateur : on ne tague QUE le clairement-non-règle, pour ne jamais masquer un vrai trou de règle.
// Livres d'AVENTURE purs : leurs chapitres-règles sont couverts (✅/📖) ; tout chapitre restant = scénario.
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
  'VDM 1', // histoire de la magie (cadre, prose pure) ; ch.15 némésis = PNJ nommés STATBLOCKÉS → catalogue-creatures (comme PDT) ; 2-14 = règles/data
])
const isFrontMatter = (t) => /^index$|^introduction|avant-?propos|préface|^preface|^sommaire|^\*+$/i.test(t.trim())

// --- Granularité SECTION adaptative (#454 défaut A/7, #604), PURE ---

// Niveau de heading DOMINANT porteur de contenu, PAR LIVRE (mesuré, #604 « Mesures du grounding ») :
// un argmax de comptage BRUT se fait piéger par les listes profondément imbriquées (chronologies AA en
// gras : ex. `05 - LA TILÉE…` culmine à 46 titres H4, tous des DATES d'une frise chronologique, jamais
// des sujets de chapitre) qui gonflent H4 même dans des livres réellement structurés en H2. Table
// curatée, grondée sur l'histogramme réel (H2/H3/H4 par fichier-chapitre) plutôt qu'un heuristique
// aveugle — même esprit que `SCENARIO_BOOKS`/`HORS_REGLE` ci-dessus : explicite, documentée, vérifiable.
// Défaut 2 (H2, comportement historique) pour tout livre absent de la table.
export const SECTION_LEVEL = new Map([
  ['LDB', 3], ['MCLB', 3], ['ACE', 3], ['EDOC', 3], ['MSRC', 3], ['MSR', 3],
  ['PDT', 3], ['NADJ', 3], ['MDG', 3], ['ZI', 3],
  ['AU1', 4],
  // AA, ADE I, ADE II, EDO restent au défaut H2 (chapitres réellement structurés en H2).
])
export const sectionLevelOf = (ab) => SECTION_LEVEL.get(ab) || 2

// Nettoie un titre de heading Markdown brut (span d'ancre folio, gras) → texte comparable.
// Exportée (#604 défaut latent, `check-catalogue-complete.mjs`) : même nettoyage des DEUX côtés
// (section de chapitre / heading de bloc catalogue), jamais une resaisie divergente.
export function cleanTitle(t) {
  return t.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '').replace(/\*\*/g, '').trim()
}

// Chapitres crédités par un CATALOGUE (catalogue-*.md = données mécaniques verbatim ré-extraites, sans
// réf `l.X` ligne — créditées au niveau CHAPITRE via `ABBR NN`) → Set de clés « ABBR NN » (tous livres).
// Extraite de `main()` (#604 défaut latent) : SOURCE UNIQUE consommée par `classify` (mark `📖`) ET par
// `check-catalogue-complete.mjs` (vérifie que la convention qui justifie ce mark tient vraiment).
export function catalogChaptersOf(docs) {
  const catalogCh = new Set()
  for (const d of docs) {
    if (!/^catalogue-/.test(d.file)) continue
    for (const [ab] of BOOKS) {
      const re = new RegExp(`\\b${esc(ab)} (\\d+)\\b`, 'g')
      let m
      while ((m = re.exec(d.text))) catalogCh.add(`${ab} ${Number(m[1])}`)
    }
  }
  return catalogCh
}

// Découpe le texte d'un fichier-chapitre en sections `[{ title, lo, hi, enfoui, isIntro }]` (`lo`/`hi` =
// lignes 1-based, `hi` EXCLUSIF), au niveau de heading `splitLevel` (2/3/4, #604 `SECTION_LEVEL`) — les
// boundaries retenues sont TOUS les headings de niveau `[2, splitLevel]` (CASCADE, pas le seul niveau
// dominant) : un livre H3-dominant (ex. NADJ) porte aussi de vrais titres H2 sœurs (`NADJ 16` : « LA
// BÊTE… », « LE TORCHON TREMPÉ » sont H2, entrelacés avec des jeux H3 comme « MIDDENBALL » l.113) — les
// ignorer les ferait absorber comme du texte de la section H3 précédente, un second masquage silencieux.
// `enfoui` : le titre porte l'ornement `•` (marque d'un titre de CHAPITRE dans la source — normalement
// rendu en H1) ET ce heading n'est PAS le premier du fichier (le premier heading orné = le titre du
// CHAPITRE COURANT lui-même, faux positif ; validé sur `ADE I 02/03/05/06/07/08`, `ADE II 01/03/04/08/09`
// : tous à la ligne 3-5 du fichier). ⚠ Un enfoui n'est PAS une section sœur de celles qui suivent : c'est
// un titre de CHAPITRE rétrogradé, donc les boundaries normales qui le suivent lui appartiennent (ce sont
// SES sous-sections), au même titre que « Le dressage » appartient à « LE COMBAT MONTÉ » (H1). Sa plage
// s'étend jusqu'au PROCHAIN enfoui du fichier (nouveau chapitre embarqué), ou à défaut jusqu'à la fin du
// fichier — jamais juste jusqu'à la prochaine boundary littérale (mesuré : `AA 09 l.191` réduit à 4
// lignes de titre au lieu des ~311 lignes réelles avant #454 juge, absorbant à tort 10 sous-sections
// comme sœurs). `splitLevel` par défaut 2 (comportement historique, tests synthétiques H2 inchangés).
export function sectionsOf(text, splitLevel = 2) {
  const lines = text.split('\n')
  const headingRe = /^(#{1,6})\s*(.*)$/
  let firstHeadingLine = null
  const boundaries = []
  lines.forEach((l, i) => {
    const m = headingRe.exec(l)
    if (!m) return
    const isFirst = firstHeadingLine == null
    if (isFirst) firstHeadingLine = i + 1
    const level = m[1].length
    const title = cleanTitle(m[2])
    // Frontières : niveaux [2, splitLevel] comme d'habitude, PLUS tout titre H1 ORNÉ (`•`) qui n'est
    // PAS le premier heading du fichier. Le `•` marque un titre de CHAPITRE (rendu H1 dans la source) ;
    // un tel titre APRÈS le titre propre du fichier = un chapitre VOISIN qui a « bavé » à l'extraction
    // Marker (ex. `# • LE GRAND HOSPICE •` folio 68, en queue de `ADE II 04`, appartient à `ADE II 05`).
    // Sans cette frontière, ses sous-sections H2 (« DES HAVRES DE REPOS ») comptent à tort comme des
    // trous de règle du chapitre courant ; ajoutée, `isEnfoui` (ci-dessous, même critère `•`) les absorbe
    // dans la plage du chapitre enfoui. Le `!isFirst` protège le titre H1 propre du fichier (jamais une
    // frontière — il ouvre l'intro), donc les chapitres sans bavure sont inchangés (boundaries identiques).
    if ((level >= 2 && level <= splitLevel) || (level === 1 && !isFirst && /•/.test(title)))
      boundaries.push({ line: i + 1, title })
  })
  const eof = lines.length + 1
  const sections = []
  if (boundaries.length && boundaries[0].line > 1) {
    sections.push({ title: '(intro)', lo: 1, hi: boundaries[0].line, enfoui: false, isIntro: true })
  }
  const isEnfoui = (h) => /•/.test(h.title) && h.line !== firstHeadingLine
  let k = 0
  while (k < boundaries.length) {
    const h = boundaries[k]
    if (isEnfoui(h)) {
      let j = k + 1
      while (j < boundaries.length && !isEnfoui(boundaries[j])) j++
      const hi = j < boundaries.length ? boundaries[j].line : eof
      sections.push({ title: h.title, lo: h.line, hi, enfoui: true, isIntro: false })
      k = j
    } else {
      const hi = k + 1 < boundaries.length ? boundaries[k + 1].line : eof
      sections.push({ title: h.title, lo: h.line, hi, enfoui: false, isIntro: false })
      k++
    }
  }
  // #604 : plus de fallback « (intégral) » silencieux quand `splitLevel` ne trouve rien — l'appelant
  // (`classify`) est responsable de DESCENDRE de niveau avant d'accepter une capitulation ; ici on ne
  // capitule QUE s'il n'y a vraiment aucun heading exploitable (chapitre court, réellement monolithique).
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

// #604 : ventilation EXPLICITE d'une section NON couverte par une fiche (`refs === 0`), PURE — jamais un
// masquage silencieux. Cinq destins pour une section (hors enfoui, qui reste hors-classement) :
//   - 'fiche'      : recoupée par une réf `l.`/`p.` d'une fiche de règles (traitée, pas juste recopiée).
//   - 'hors-regle' : le CHAPITRE entier est explicitement exclu (`HORS_REGLE`/front-matter) — hors sujet
//     par construction, quel que soit le contenu de la section.
//   - 'catalogue'  : le chapitre est crédité par un `catalogue-*.md` (transcription verbatim au chapitre,
//     jamais en ligne) — la section n'est pas TRAITÉE, elle est RECOPIÉE (#604 DoD : transcrit ≠ traité).
//   - 'scenario'   : livre `SCENARIO_PUR` (campagne pure) — bruit de scénario, jamais une règle propre.
//   - 'trou'       : candidat trou de RÈGLE — aucune des exemptions ci-dessus ne s'applique.
export function classifyHole(refs, { cat = false, horsRegle = false, isPur = false } = {}) {
  if (refs > 0) return 'fiche'
  if (horsRegle) return 'hors-regle'
  if (cat) return 'catalogue'
  if (isPur) return 'scenario'
  return 'trou'
}

// Classe un chapitre : ✅ fiche (propriétaire ≥3 refs ligne) · 📖 catalogue SEUL (transcrit, pas traité) ·
// 🟡 effleuré (1-2 refs, sans catalogue) · ⬜ trou (aucune ref, aucun catalogue).
// `sections` : détail section-granulaire (trous ET chapitres enfouis), calculé quel que soit le mark
// chapitre — un chapitre ✅ (des refs abondantes ailleurs) peut enfouir une section SANS AUCUNE réf ;
// c'est exactement le défaut A (#454) : ne JAMAIS gater le détail par le mark chapitre.
function classify(ab, nn, horsRegle, isPur, docs, catalogCh) {
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
  // #604 : ✅ fiche (réf de ligne, ≥3) prime sur 📖 catalogue-seul (transcrit, jamais traité) — distinct
  // au chapitre ET, ci-dessous, distinct au niveau section (`classifyHole`).
  const mark = ownerN >= 3 ? '✅' : cat ? '📖' : total > 0 ? '🟡' : '⬜'

  let holes = [], enfoui = []
  const folioStats = { ignoredFolios: 0 }
  const info = chapterFile(ab, nn)
  if (info) {
    const text = readText(info.path)
    const splitLevel = sectionLevelOf(ab)
    const sections = sectionsOf(text, splitLevel)
    const spans = refSpansFor(ab, nn, docs, folioStats)
    const annotated = annotateSections(sections, spans)
    enfoui = annotated.filter((s) => s.enfoui)
    // #604 : ZÉRO masquage silencieux — un chapitre catalogué ou HORS_REGLE ne suppprime plus ses
    // sections non-fiche, il les ÉTIQUETTE via `classifyHole` (jamais `holes = []`). Un chapitre
    // `SCENARIO_BOOKS` mais crédité ✅ par des refs de règle embarquées (ex. NADJ 16 « Jeux de taverne »,
    // crédité pour PRÉCISÉMENT ce contenu, #454 faux vert) n'y perd rien : `isPur` (book-level, PAS
    // `horsRegle`) ventile alors ses sections vides en 'scenario' seulement pour les campagnes PURES.
    holes = annotated
      .filter((s) => !s.enfoui)
      .map((s) => ({ ...s, hole: classifyHole(s.refs, { cat, horsRegle, isPur }) }))
      .filter((s) => s.hole !== 'fiche')
  }
  return { total, owner, ownerN, mark, cat, holes, enfoui, ignoredFolios: folioStats.ignoredFolios }
}

const HOLE_MARK = { catalogue: '📖', scenario: '⬜', trou: '⬜', 'hors-regle': '➖' }
const HOLE_LABEL = { catalogue: 'transcrit en catalogue, jamais traité', scenario: 'bruit de scénario', trou: 'candidat trou de règle', 'hors-regle': 'hors-règle (narratif/cadre), chapitre par ailleurs couvert' }

function main() {
  // Profondeur-conscient : on garde chaque fiche séparée pour compter les refs et trouver la fiche PROPRIÉTAIRE.
  const docs = readdirSync(rawDir).filter((f) => f.endsWith('.md') && f !== 'coverage.md')
    .map((f) => ({ file: f, text: readText(join(rawDir, f)) }))
  // Chapitres crédités par un catalogue : source unique `catalogChaptersOf` (#604 défaut latent —
  // extraite pour être réutilisée par `check-catalogue-complete.mjs`, jamais une resaisie).
  const catalogCh = catalogChaptersOf(docs)

  const SUMMARY_PLACEHOLDER = '__SUMMARY_LINE__'
  const out = ['# Atlas RAW — Registre de couverture', '',
    `> Contrat « l'Atlas remplace la source » : chaque chapitre des ${BOOKS.length} livres doit être **couvert**`,
    '> (cité par une fiche `docs/raw/`, ✅) ou explicitement **hors-règle** (narratif). Un chapitre `⬜` = trou.',
    '> `📖` = crédité par un CATALOGUE seul (donnée verbatim ré-extraite au chapitre) — **transcrit, pas',
    '> traité** : recourir à la source pour un point qui y vit encore = un défaut de l\'Atlas à corriger.',
    '> Régénéré par `node scripts/raw/coverage.mjs`. Détail **section-granulaire** (niveau de heading',
    '> ADAPTATIF par livre, #604) sous la table d\'un chapitre qui enfouit ou troue une section :',
    '> `⬜` = section sans aucune réf de fiche dans sa plage (`trou` = candidate règle non couverte,',
    '> `scénario` = bruit de campagne pure) · `📖` = section 0-réf d\'un chapitre catalogué (transcrite,',
    '> jamais traitée — plus jamais masquée) · `🔻 enfoui` = titre orné (`•`) rétrogradé par l\'extraction',
    '> — un défaut d\'extraction, pas une section ordinaire (#454).', '',
    SUMMARY_PLACEHOLDER, '']

  let gOk = 0, gCat = 0, gMid = 0, gHole = 0
  let gSecEnfoui = 0
  // #604 : ventilation section-granulaire en CINQ comptes distincts, dérivés (jamais un total confondu) —
  // `classifyHole` est l'UNIQUE source de vérité de cette classification.
  let gSecCatalogue = 0, gSecHorsRegle = 0, gSecHolesScenario = 0, gSecHolesRegle = 0
  let gIgnoredFolios = 0 // #606 : folios cites en docs sans ancre data-folio resoluble dans le bon chapitre
  const perBook = []
  for (const [ab, dir] of BOOKS) {
    let files
    try { files = readdirSync(dir).filter((f) => /^\d+ - /.test(f) && f.endsWith('.md')) }
    catch { out.push(`## ${ab} — ⚠ dossier introuvable (${dir})`, ''); continue }
    let bOk = 0, bCat = 0, bMid = 0, bHole = 0
    const lines2 = ['| Ch. | Titre | État | refs (propriétaire) |', '|---|---|---|---|']
    const detailBlocks = []
    const isPur = SCENARIO_PUR.has(ab)
    for (const f of files.sort()) {
      const nn = f.match(/^(\d+) - /)[1]
      const title = f.replace(/^\d+ - /, '').replace(/\.md$/, '')
      const artefact = /^_/.test(title)
      const horsRegle = HORS_REGLE.has(`${ab} ${Number(nn)}`) || isFrontMatter(title)
      const narrative = horsRegle || SCENARIO_BOOKS.has(ab)
      const c = classify(ab, nn, horsRegle, isPur, docs, catalogCh)
      if (artefact && c.total === 0) { lines2.push(`| ${nn} | *(artefact OCR)* | ➖ | |`); continue }
      if (c.mark !== '✅' && c.mark !== '📖' && narrative) {
        lines2.push(`| ${nn} | ${title} | ➖ hors-règle | |`)
        // #604 : ZÉRO masquage — le chapitre reste hors du dénominateur chapitre (contrat inchangé), mais
        // ses sections ne disparaissent plus de la ventilation section-granulaire (juste comptées, sans
        // le détail exhaustif — le point d'entrée « ➖ hors-règle » de la ligne ci-dessus reste la preuve).
        const info = chapterFile(ab, nn)
        if (info) {
          const text = readText(info.path)
          const sections = sectionsOf(text, sectionLevelOf(ab))
          gSecHorsRegle += sections.filter((s) => !s.isIntro && !s.enfoui).length
        }
        continue
      }
      if (c.mark === '✅') bOk++; else if (c.mark === '📖') bCat++; else if (c.mark === '🟡') bMid++; else bHole++
      gIgnoredFolios += c.ignoredFolios
      const detail = c.total ? `${c.total} (${c.owner} ×${c.ownerN})` : (c.owner ? `catalogue (${c.owner})` : '')
      lines2.push(`| ${nn} | ${artefact ? '*(artefact OCR)*' : title} | ${c.mark} | ${detail} |`)
      const enfouiRows = c.enfoui.map((s) => `  - 🔻 enfoui l.${s.lo}-${s.hi - 1} « ${s.title.replace(/\s*•\s*/g, ' ').trim()} » — titre orné rétrogradé par l'extraction, ${s.refs} réf`)
      const holeRows = c.holes.map((s) => `  - ${HOLE_MARK[s.hole]} l.${s.lo}-${s.hi - 1} « ${s.title} » — ${HOLE_LABEL[s.hole]}, 0 réf`)
      // Ordre de branchement EXHAUSTIF (miroir de `classifyHole`) : un chapitre `✅`/`📖` peut
      // rester HORS_REGLE/front-matter par ailleurs (ex. `AA 02 INTRODUCTION`, `EDOC 13`, `MDG 03`) — sa
      // section 0-réf classe alors 'hors-regle', JAMAIS absorbée dans le compte `gSecHolesRegle` (défaut
      // mesuré par le juge adversarial : 41 sections `undefined` dans coverage.md + `gSecHolesRegle` gonflé
      // de +18 %). `else` final = 'trou' STRICT, plus un fourre-tout.
      for (const s of c.holes) {
        if (s.hole === 'catalogue') gSecCatalogue++
        else if (s.hole === 'hors-regle') gSecHorsRegle++
        else if (s.hole === 'scenario') gSecHolesScenario++
        else gSecHolesRegle++
      }
      if (c.enfoui.length || c.holes.length) {
        gSecEnfoui += c.enfoui.length
        detailBlocks.push(`- **${ab} ${nn}** (${title}) :`, ...enfouiRows, ...holeRows)
      }
    }
    gOk += bOk; gCat += bCat; gMid += bMid; gHole += bHole
    perBook.push(`${ab} ✅${bOk}·📖${bCat}·🟡${bMid}·⬜${bHole}`)
    out.push(`## ${ab} — ✅ ${bOk} · 📖 ${bCat} · 🟡 ${bMid} · ⬜ ${bHole}`, '', ...lines2, '')
    if (detailBlocks.length) {
      const label = `**Sections trouées/cataloguées/enfouies** (niveau de heading ${sectionLevelOf(ab) === 2 ? 'H2' : `H${sectionLevelOf(ab)} adaptatif`}) :`
      out.push(label, '', ...detailBlocks, '')
    }
  }

  const denom = gOk + gCat + gMid + gHole
  const gSecHoles = gSecHolesScenario + gSecHolesRegle
  const summaryLine = `**Couverture (profondeur) : ✅ ${gOk} traités par une fiche · 📖 ${gCat} transcrits par un catalogue seul (jamais traités) · 🟡 ${gMid} effleurés · ⬜ ${gHole} trous** sur ${denom} chapitres-règles (hors artefacts OCR). Section-granulaire (niveau de heading ADAPTATIF par livre — H2 pour AA/ADE I/ADE II/EDO, H3 pour LDB/MCLB/ACE/EDOC/MSRC/MSR/PDT/NADJ/MDG/ZI, H4 pour AU1, #604), ventilation DÉRIVÉE (jamais un compte recopié) sur ${gSecCatalogue + gSecHorsRegle + gSecHoles} section(s) non couvertes par une fiche : **${gSecCatalogue} transcrite(s) en catalogue** (recopiées, pas traitées) · **${gSecHorsRegle} hors-règle** (chapitre explicitement exclu) · **${gSecHolesScenario} bruit de scénario** (livres \`SCENARIO_PUR\` EDO/MSR/PDT/AU1 : prose de campagne, aucune règle) · **${gSecHolesRegle} candidat(s) trou de règle** (reste : livres de règles + compagnons mixtes ACE/NADJ/ADE/MCLB/EDOC/MSRC/MDG, où une section vide peut cacher une vraie règle non couverte) — et ${gSecEnfoui} titre(s) de chapitre enfoui(s) détecté(s) (titre orné rétrogradé par l'extraction). Ce chiffre reste un PLANCHER : les sections couvertes par une fiche (✅ au niveau section) ne sont pas dénombrées ici (volume, cf. #604 DoD « la sortie ne liste pas l'exhaustif »). Réfs folio (\`ABBR NN p.X\`, #606) : ${gIgnoredFolios} ignorée(s) proprement (ancre absente/ambiguë/hors-chapitre). Par livre : ${perBook.join(' · ')}.`
  const summaryIdx = out.indexOf(SUMMARY_PLACEHOLDER)
  out[summaryIdx] = summaryLine
  writeFileSync(join(rawDir, 'coverage.md'), out.join('\n'))
  console.log(`coverage profondeur : ✅ ${gOk} · 📖 ${gCat} · 🟡 ${gMid} · ⬜ ${gHole} (sur ${denom} chapitres) · sections non-fiche : catalogue ${gSecCatalogue} · hors-règle ${gSecHorsRegle} · scénario ${gSecHolesScenario} · règle ${gSecHolesRegle} · 🔻enfoui ${gSecEnfoui} · folios ignorés ${gIgnoredFolios}`)
  console.log('par livre : ' + perBook.join(' · '))
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
