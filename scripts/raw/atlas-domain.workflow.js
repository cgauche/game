export const meta = {
  name: 'atlas-raw-fanout',
  description: "Atlas RAW AUTONOME. Le PERIMETRE (coeur de regles + livres, avec leur langue) ENTRE par `args`, projete de src/data/books.json par `node scripts/raw/workflow-args.mjs <coeur>` : le script ne nomme aucun livre. Par domaine : Cadrage (auto-decouverte des chapitres) -> Cartographie -> Taxonomie -> Survey de tous les livres du perimetre -> Synthese (tables verbatim) -> Boucle d'audit completude+dedup (loop-until-dry) -> Verif fidelite -> correction fidelite. Le champ Implemente des fiches est DERIVE du code par build-implemente (#487) — le workflow ne pose qu'un placeholder. Le LOT de domaines a traiter et la CARTE des domaines du coeur entrent par le meme `args` (--domaines a,b) : le script ne nomme aucun domaine. Un domaine SAUTE sort dans `sautes`, avec sa raison, jamais en silence. Mode de REPRISE (`args.reprise` = le rendu d UN domaine, --reprise <rendu.json>) : ne rejoue que Verif -> correction de fidelite -> re-verif sur les topics non prouves fideles, et rend le rendu complete. Zero config par domaine.",
  phases: [
    { title: 'Cadrage', detail: 'auto-decouverte des chapitres du domaine (index)', model: 'sonnet' },
    { title: 'Cartographie', detail: 'inventaire exhaustif a couvrir', model: 'sonnet' },
    { title: 'Taxonomie', detail: 'topics couvrant tout l inventaire', model: 'opus' },
    { title: 'Survey', detail: 'consolidation de tous les livres du perimetre', model: 'haiku/sonnet' },
    { title: 'Synthese', detail: 'entrees autosuffisantes, tables verbatim', model: 'opus' },
    { title: 'Audit', detail: 'completude+dedup en boucle (loop-until-dry)', model: 'opus' },
    { title: 'Verif', detail: 'fidelite + correction', model: 'sonnet/opus' },
  ],
}

const MAXLOOPS = 3

// ---- PERIMETRE, recu du lanceur par `args` ----
// Le script ne nomme AUCUN livre ni AUCUN domaine : le registre lui ENTRE, projete de
// `src/data/books.json` et de `scripts/raw/domaines.json` par `node scripts/raw/workflow-args.mjs`
// (#1825). Chaque defaut de forme LEVE en le NOMMANT : un perimetre devine ferait survoler des
// livres entiers, et un lot devine relacherait des agents sur des domaines que personne n'a demandes.
if (typeof args === 'undefined' || args === null || typeof args !== 'object' || Array.isArray(args)) {
  throw new Error('atlas-domain: `args` absent ou non-objet — le lanceur doit passer le perimetre rendu par `node scripts/raw/workflow-args.mjs <coeur> <drapeau> --domaines a,b` : { coeur, domaines: [{ cle, titre }], lot: [cle], livres: [{ ab, dir, coeur, language }], reprise? }')
}
const COEUR = args.coeur
if (typeof COEUR !== 'string' || !COEUR) {
  throw new Error('atlas-domain: `args.coeur` absent ou non textuel — le coeur de regles du perimetre ne se devine pas')
}
const BOOKS = Array.isArray(args.livres) ? args.livres : []
if (!BOOKS.length) {
  throw new Error('atlas-domain: `args.livres` absent ou vide — aucun livre a parcourir pour le coeur « ' + COEUR + ' »')
}
for (const b of BOOKS) {
  const manque = ['ab', 'dir', 'language'].filter((k) => !b || typeof b[k] !== 'string' || !b[k])
  if (manque.length) {
    throw new Error('atlas-domain: une entree de `args.livres` sans ' + manque.map((k) => '`' + k + '`').join(', ') + ' : ' + JSON.stringify(b))
  }
}
// Le livre de REFERENCE du perimetre = son livre de coeur ; aucun repli nomme.
const REFERENCE = BOOKS.find((b) => b.coeur === COEUR)
if (!REFERENCE) {
  throw new Error('atlas-domain: aucun livre de coeur « ' + COEUR + ' » dans `args.livres` — le livre de reference du perimetre ne se devine pas')
}
// ---- DOMAINES, recus du meme `args` ----
// La CARTE (`args.domaines`) tient chaque domaine dans son perimetre : le cadrage EXCLUT les
// chapitres-foyers des autres. Le LOT (`args.lot`) est ce que CE run traite.
const DOMAINES = Array.isArray(args.domaines) ? args.domaines : []
if (!DOMAINES.length) {
  throw new Error('atlas-domain: `args.domaines` absent ou vide — la carte des domaines du coeur « ' + COEUR + ' » ne se devine pas')
}
for (const d of DOMAINES) {
  const manque = ['cle', 'titre'].filter((k) => !d || typeof d[k] !== 'string' || !d[k])
  if (manque.length) {
    throw new Error('atlas-domain: une entree de `args.domaines` sans ' + manque.map((k) => '`' + k + '`').join(', ') + ' : ' + JSON.stringify(d))
  }
}
const LOT = Array.isArray(args.lot) ? args.lot : []
if (!LOT.length) {
  throw new Error('atlas-domain: `args.lot` absent ou vide — le lot de domaines a traiter ne se devine pas ; domaines du coeur « ' + COEUR + ' » : ' + DOMAINES.map((d) => d.cle).join(', '))
}
const inconnus = LOT.filter((c) => !DOMAINES.some((d) => d.cle === c))
if (inconnus.length) {
  throw new Error('atlas-domain: domaine(s) « ' + inconnus.join(', ') + ' » du lot inconnu(s) du coeur « ' + COEUR + ' » — domaines declares : ' + DOMAINES.map((d) => d.cle).join(', '))
}
const CARTE_DOMAINES = DOMAINES.map((d) => '- ' + d.cle + ' : ' + d.titre).join('\n')

// ---- REPRISE, recue du meme `args` ----
// Re-verifier un rendu DEJA produit sans rejouer le run : un run de plusieurs dizaines d agents ne
// se jette pas parce qu un agent de verification est reste muet. Le rendu d UN domaine entre, le
// meme rendu COMPLETE sort.
const REPRISE = args.reprise === undefined || args.reprise === null ? null : args.reprise
if (REPRISE !== null) {
  if (typeof REPRISE !== 'object' || Array.isArray(REPRISE)) {
    throw new Error('atlas-domain: `args.reprise` non-objet — la reprise attend le rendu d UN domaine, de la forme que ce workflow rend')
  }
  if (typeof REPRISE.domain !== 'string' || !REPRISE.domain) {
    throw new Error('atlas-domain: `args.reprise.domain` absent ou non textuel — le domaine repris ne se devine pas')
  }
  if (!Array.isArray(REPRISE.topics) || !REPRISE.topics.length) {
    throw new Error('atlas-domain: `args.reprise.topics` absent ou vide — une reprise sans topic n a rien a re-verifier')
  }
  if (LOT.length !== 1 || LOT[0] !== REPRISE.domain) {
    throw new Error('atlas-domain: une reprise ne joue QUE le domaine de son rendu (« ' + REPRISE.domain + ' ») — lot recu : ' + LOT.join(', '))
  }
}

const dirOf = (ab) => (BOOKS.find((b) => b.ab === ab) || {}).dir
const bookMap = BOOKS.map((b) => '- ' + b.ab + ' = ' + b.dir + ' (langue : ' + b.language + ')').join('\n')
const LANGUES = [...new Set(BOOKS.map((b) => b.language))].join(', ')
// #1816 — fiche `user-doctrine-edition-5e-coeur-remplace-ldb-raw-sauf-errata`.
const LANGUE_FICHE = 'LANGUE DE LA FICHE : la SYNTHESE que tu rediges est en FRANCAIS parfaitement accentue.'
// Deux clauses, parce que deux gestes : REPERER du texte (inventorier, juger) et le TRANSCRIRE
// (rediger, augmenter). Une phase qui n ecrit aucune table ne recoit pas la consigne de
// transcription — elle y serait sans objet.
const LANGUE_TERMES = 'LANGUE DES CITATIONS : tout ce qui vient du livre — citation, intitule de regle, intitule de section, cellule de table, terme et ABREVIATION de jeu — reste VERBATIM dans la langue de CE livre (' + LANGUES + ' selon le livre, cf. le mapping), jamais traduit ni francise.'
const LANGUE_TABLES = 'TRANSCRIPTION DES TABLES : une table se transcrit ligne par ligne dans la langue d origine de son livre.'
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/\s+/g, '-').slice(0, 48)

const CADRAGE_SCHEMA = { type: 'object', properties: { coverageRefs: { type: 'array', items: { type: 'object', properties: { ab: { type: 'string' }, nn: { type: 'string' } }, required: ['ab', 'nn'] } }, sonnetBooks: { type: 'array', items: { type: 'string' } } }, required: ['coverageRefs'] }
const INVENTORY_SCHEMA = { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, kind: { type: 'string' }, ref: { type: 'string' }, gist: { type: 'string' } }, required: ['item', 'ref'] } } }, required: ['items'] }
const TAXO_SCHEMA = { type: 'object', properties: { topics: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, t: { type: 'string' }, hint: { type: 'string' }, covers: { type: 'array', items: { type: 'string' } } }, required: ['id', 't', 'hint'] } } }, required: ['topics'] }
const SURVEY_SCHEMA = { type: 'object', properties: { hits: { type: 'array', items: { type: 'object', properties: { topicId: { type: 'string' }, ref: { type: 'string' }, gist: { type: 'string' } }, required: ['topicId', 'ref', 'gist'] } } }, required: ['hits'] }
const SYNTH_SCHEMA = { type: 'object', properties: { topicId: { type: 'string' }, title: { type: 'string' }, markdown: { type: 'string' }, refs: { type: 'array', items: { type: 'string' } }, codeHint: { type: 'string' } }, required: ['topicId', 'title', 'markdown', 'refs'] }
const AUDIT_SCHEMA = { type: 'object', properties: { dry: { type: 'boolean' }, gaps: { type: 'array', items: { type: 'object', properties: { kind: { type: 'string', enum: ['survole', 'rate', 'doublon'] }, topicId: { type: 'string' }, newTopicTitle: { type: 'string' }, what: { type: 'string' }, ref: { type: 'string' }, fix: { type: 'string' } }, required: ['kind', 'what'] } } }, required: ['dry', 'gaps'] }
const VERIFY_SCHEMA = { type: 'object', properties: { topicId: { type: 'string' }, faithful: { type: 'boolean' }, issues: { type: 'array', items: { type: 'string' } } }, required: ['topicId', 'faithful', 'issues'] }

const STRUCT = [
  '## <titre>',
  '',
  '<synthese fidele et COMPLETE, en FRANCAIS parfaitement accentue, aussi longue que necessaire pour etre autosuffisante. ZERO invention.>',
  '',
  '<TABLES VERBATIM en Markdown quand la regle est une table (jamais reduites aux bornes), transcrites dans la LANGUE DU LIVRE, chacune suivie de sa ref.>',
  '',
  '**Sources RAW** :',
  '- `<ABBR NN l.X-Y>` — <ce que precise ce passage> (CONSOLIDE tous livres)',
  '',
  '> « citation verbatim quand le mot exact compte, dans la LANGUE DU LIVRE cite » — `<ABBR NN l.X>`',
  '',
  '**Voir aussi** : <topics lies>',
  // Le champ Implemente est DERIVE du code par build-implemente (#487) : le workflow ne pose qu'un
  // placeholder nu, jamais un module devine a la main (que la regeneration remplace).
  '**Implémente :** (non implémenté)',
].join('\n')

function cadragePrompt(dom) {
  return [
    'CADRAGE du domaine "' + dom.title + '" (id ' + dom.domain + ') pour l Atlas RAW du coeur de regles « ' + COEUR + ' ». Tu decouvres TOUS les chapitres (tous les livres du perimetre ci-dessous) qui contiennent des regles de ce domaine.',
    'Lis les index : "' + REFERENCE.dir + '/00 - Index.md" (livre de REFERENCE du perimetre, ' + REFERENCE.ab + ', OBLIGATOIRE) puis les "00 - Index.md" des autres livres si pertinents. Grep au besoin les termes du domaine dans le livre de reference pour confirmer.',
    'Mapping ABBR -> dossier :',
    bookMap,
    '',
    'Les domaines de l Atlas — le TIEN est "' + dom.domain + '" ; les chapitres-FOYERS de tout AUTRE domaine sont HORS de ton perimetre :',
    CARTE_DOMAINES,
    '',
    'Renvoie coverageRefs = SEULEMENT le(s) chapitre(s) DEDIE(s) au domaine (1 a 3 MAXIMUM, nn = prefixe du fichier). EXCLUS imperativement tout chapitre qui est le FOYER d un AUTRE domaine de la liste ci-dessus : ces regles voisines seront cross-referencees en « Voir aussi », jamais re-couvertes ici. Ajoute uniquement un chapitre de SUPPLEMENT vraiment dedie au domaine (p. ex. un systeme alternatif). Le but est un domaine ETROIT, sans chevauchement. sonnetBooks = livres DENSES pour CE domaine.',
    'Renvoie { coverageRefs, sonnetBooks }.',
  ].join('\n')
}

function cartoPrompt(dom, r) {
  const dir = dirOf(r.ab)
  return [
    'CARTOGRAPHIE DE SURFACE — domaine "' + dom.title + '". Tu lis UN chapitre et dresses l INVENTAIRE EXHAUSTIF des regles a couvrir.',
    'Chapitre : ' + r.ab + ' ' + r.nn + ' (Glob "' + dir + '/' + r.nn + ' - *.md" puis Read en ENTIER).',
    'Liste CHAQUE regle / table / sous-systeme distinct du domaine present dans ce chapitre (granulaire : 1 table = 1 item kind:"table"). Pour chaque : { item, kind, ref ("' + r.ab + ' ' + r.nn + ' l.X-Y"), gist }. N invente pas. Renvoie { items }.',
    LANGUE_TERMES,
  ].join('\n')
}

function taxoPrompt(dom, inventory) {
  return [
    'TAXONOMIE du domaine "' + dom.title + '". Inventaire exhaustif a couvrir :',
    inventory.map((it) => '- [' + it.src + '] ' + it.item + ' (' + (it.kind || '?') + ') — ' + (it.gist || '')).join('\n'),
    '',
    'Decoupe en TOPICS atomiques tels que CHAQUE item soit couvert (zero orphelin), en RESTANT dans le domaine (n integre AUCUNE regle appartenant a un autre domaine). Un sous-systeme important merite son propre topic ; les grandes tables sont rattachees explicitement. Les titres ne contiennent JAMAIS « a transcrire »/TODO/« d100 a transcrire » — un topic-table sera REELLEMENT rempli a la synthese. Pour chaque : { id (kebab-case), t (titre FR accentue propre), hint, covers (items englobes, dont les TABLES) }. Vise 8 a 18 topics. Renvoie { topics }.',
  ].join('\n')
}

function surveyPrompt(dom, b, TOPICS) {
  return [
    'Extracteur de REGLES du coeur « ' + COEUR + ' », domaine "' + dom.title + '". Livre : ' + b.ab + ' (langue : ' + b.language + '), dossier "' + b.dir + '".',
    'Repere TOUS les passages-regles du domaine dans CE livre (Glob "' + b.dir + '/*.md", lis 00 - Index.md + chapitres pertinents EN ENTIER ; ne te limite pas, sois exhaustif ; survole seulement l intrigue de scenario).',
    'TOPICS (tag le plus proche ; sinon topicId="autre" + suggestion dans gist) :',
    TOPICS.map((t) => '- ' + t.id + ' : ' + t.t).join('\n'),
    'Pour chaque passage REELLEMENT lu : { topicId, ref ("' + b.ab + ' <NN> l.<debut>-<fin>", lignes reelles), gist (1 phrase, en francais) }. Les termes de jeu cites restent dans la langue du livre (' + b.language + '), jamais traduits. N invente rien ; si rien, hits:[]. Renvoie { hits }.',
  ].join('\n')
}

function synthPrompt(dom, t, hits, covers) {
  const hitText = hits.length ? hits.map((h) => '- [' + h.book + '] ' + h.ref + ' — ' + h.gist).join('\n') : '(aucun candidat — localise via Grep/Read, surtout le livre de reference ' + REFERENCE.ab + ')'
  const cov = (covers && covers.length) ? covers.join(' ; ') : '(voir le titre)'
  return [
    'Tu rediges UNE entree de l Atlas RAW : referentiel AUTOSUFFISANT du coeur de regles « ' + COEUR + ' » — repondre a toute question ET auditer le code SANS ouvrir les livres. Domaine : ' + dom.title + '. Topic : "' + t.t + '" (id ' + t.id + ').',
    'Mapping ABBR -> dossier (et LANGUE de chaque livre) :',
    bookMap,
    'Ce topic DOIT couvrir : ' + cov,
    'Passages-candidats du survey :',
    hitText,
    '',
    'AUTOSUFFISANCE : LIS reellement les passages (Read ; corrige les plages) ; CONSOLIDE tous les livres ; reproduis le CONTENU MECANIQUE REEL (valeurs, conditions, exceptions, couts) ; transcris les TABLES VERBATIM ligne par ligne (jamais aux bornes) ; INDEPENDANT du code (ne renvoie jamais a src/data pour le contenu RAW).',
    '',
    'STRUCTURE EXACTE :',
    '',
    STRUCT.replace('## <titre>', '## ' + t.t),
    '',
    'REGLES : ZERO invention (chaque affirmation/case de table soutenue par un passage LU). RESTE DANS LE PERIMETRE du domaine : une regle qui appartient a un AUTRE domaine se met en **Voir aussi**, on ne la re-traite pas ici. TRANSCRIS REELLEMENT les tables ligne par ligne — il est INTERDIT d ecrire « a transcrire »/TODO/un placeholder a la place d une table. N utilise que les livres du perimetre ci-dessus. Refs/code entre backticks.',
    LANGUE_FICHE,
    LANGUE_TERMES,
    LANGUE_TABLES,
    'Renvoie { topicId:"' + t.id + '", title:"' + t.t + '", markdown, refs:[...], codeHint }.',
  ].join('\n')
}

function auditPrompt(dom, entries, inventory, autre) {
  return [
    'AUDIT DE COMPLETUDE + DEDUP du domaine "' + dom.title + '". La doc doit etre AUTOSUFFISANTE (table reduite aux bornes = INSUFFISANT) et SANS doublon.',
    'INVENTAIRE a couvrir :',
    inventory.map((it) => '- [' + it.src + '] ' + it.item + ' — ' + it.ref).join('\n'),
    'Hits hors-taxonomie a promouvoir si absents :',
    (autre.length ? autre.map((h) => '- [' + h.book + '] ' + h.ref + ' — ' + h.gist).join('\n') : '(aucun)'),
    '',
    'ENTREES PRODUITES (confronte a l inventaire ET a la source — ouvre les fichiers source pour verifier que tables/valeurs sont COMPLETES) :',
    entries.map((e) => '### ' + e.topicId + '\n' + e.markdown).join('\n\n'),
    'Mapping ABBR -> dossier :',
    bookMap,
    '',
    LANGUE_TERMES,
    LANGUE_TABLES,
    'TROUS : kind="survole" (item present mais incomplet — table aux bornes, valeur manquante : topicId+what+ref+fix) ; kind="rate" (item/hit ABSENT : newTopicTitle si nouveau topic, sinon topicId d accueil) ; kind="doublon" (meme contenu transcrit dans 2 topics : topicId a DEGRAISSER + fix). Sois exhaustif sur les TABLES. dry=true seulement si AUCUN trou ni doublon. Renvoie { dry, gaps }.',
  ].join('\n')
}

function augmentPrompt(dom, existingMd, title, topicId, gaps) {
  return [
    'AUGMENTATION/CORRECTION d une entree de l Atlas RAW (domaine ' + dom.title + '). Topic : "' + title + '" (id ' + topicId + ').',
    existingMd ? ('ENTREE ACTUELLE (a COMPLETER/CORRIGER, pas a raccourcir sauf doublon) :\n' + existingMd) : 'NOUVEAU TOPIC (a creer).',
    'POINTS A TRAITER (lis la source aux refs ; transcris/ajoute/corrige pour de vrai ; pour un doublon, retire la redite et renvoie a l autre topic) :',
    gaps.map((g) => '- (' + g.kind + ') ' + g.what + (g.ref ? ' [' + g.ref + ']' : '') + (g.fix ? ' -> ' + g.fix : '')).join('\n'),
    '',
    'Produis l entree COMPLETE et autosuffisante (structure ci-dessous), tables VERBATIM ligne par ligne. ZERO invention.',
    LANGUE_FICHE,
    LANGUE_TERMES,
    LANGUE_TABLES,
    '',
    STRUCT.replace('## <titre>', '## ' + title),
    '',
    'Renvoie { topicId:"' + topicId + '", title:"' + title + '", markdown, refs:[...], codeHint }.',
  ].join('\n')
}

function verifyPrompt(dom, entry) {
  return [
    'VERIF de fidelite (regle 1 : zero invention), domaine ' + dom.title + '. CONSULTATIF.',
    'TITRE : ' + entry.title + '\nREFS : ' + (entry.refs || []).join(' | '),
    'MARKDOWN :\n' + entry.markdown,
    'Pour CHAQUE ref, ouvre la source (mapping ci-dessous), LIS, confirme. Verifie SPECIALEMENT les TABLES/valeurs transcrites (recopie exacte). Traque inventions, lignes fausses, valeurs/tables erronees, autre systeme, refs introuvables, livre hors perimetre, et toute citation TRADUITE la ou le verbatim de la langue du livre est exige.',
    bookMap,
    'Renvoie { topicId:"' + entry.topicId + '", faithful, issues:[...] }.',
  ].join('\n')
}

async function applyGaps(dom, entries, gaps) {
  const groups = new Map()
  for (const g of gaps) {
    const isNew = g.kind === 'rate' && g.newTopicTitle
    const key = isNew ? ('NEW::' + g.newTopicTitle) : (g.topicId || '__divers__')
    if (!groups.has(key)) groups.set(key, { isNew, title: isNew ? g.newTopicTitle : null, topicId: isNew ? null : (g.topicId || '__divers__'), gaps: [] })
    groups.get(key).gaps.push(g)
  }
  const items = [...groups.values()]
  const updates = await parallel(items.map((info) => () => {
    const existing = info.isNew ? null : entries.find((e) => e.topicId === info.topicId)
    const title = info.isNew ? info.title : (existing ? existing.title : info.topicId)
    const tid = info.isNew ? slug(info.title) : info.topicId
    return agent(augmentPrompt(dom, existing ? existing.markdown : null, title, tid, info.gaps), { label: dom.domain + ':augment:' + tid, phase: 'Audit', model: 'opus', schema: SYNTH_SCHEMA })
  }))
  const map = new Map(entries.map((e) => [e.topicId, e]))
  updates.forEach((u, i) => {
    if (!u) return
    const info = items[i]
    // L id est celui qu on a DEMANDE, jamais celui que l agent renvoie : un agent qui rebaptise son
    // topic creerait une entree que rien ne relit, en laissant l originale figee a cote.
    const id = info.isNew ? slug(info.title) : info.topicId
    map.set(id, { topicId: id, title: u.title, markdown: u.markdown, refs: u.refs || [], codeHint: u.codeHint || '' })
  })
  return [...map.values()]
}

/** Les verdicts de fidelite d un jeu d entrees, KEYES PAR L ENTREE JUGEE (`e.topicId`) et jamais
 *  par la reponse de l agent : un `topicId` different dans la reponse keyerait un fantome, que ni
 *  la correction ni l assemblage ne relierait au topic reel. */
async function verdictsDeFidelite(dom, entries, etiquette) {
  const rendus = await parallel(entries.map((e) => () =>
    agent(verifyPrompt(dom, e), { label: dom.domain + ':' + etiquette + ':' + e.topicId, phase: 'Verif', model: 'sonnet', schema: VERIFY_SCHEMA })
      .then((v) => ({ e, v }))))
  const parId = {}
  rendus.forEach((x) => { if (x && x.v) parId[x.e.topicId] = { faithful: x.v.faithful, issues: x.v.issues || [] } })
  return parId
}

/**
 * Verif -> correction de fidelite -> re-verif des SEULS topics touches. `issuesById` ENTRE avec les
 * verdicts deja acquis (une reprise ne rejoue pas ce qui est prouve) et SORT complete ; `aJuger` est
 * le sous-ensemble a soumettre a la verification. Rend les entrees a jour.
 */
async function passeDeFidelite(dom, entries, issuesById, aJuger) {
  phase('Verif')
  Object.assign(issuesById, await verdictsDeFidelite(dom, aJuger, 'verif'))
  const fidByTopic = {}
  for (const tid of Object.keys(issuesById)) {
    const v = issuesById[tid]
    if (v && !v.faithful && v.issues.length) fidByTopic[tid] = v.issues
  }
  const fidGaps = Object.keys(fidByTopic).flatMap((tid) => fidByTopic[tid].map((iss) => ({ kind: 'survole', topicId: tid, what: iss })))
  if (!fidGaps.length) return entries
  // corrige la fidelite + re-verifie SEULEMENT les topics touches (economie de quota : plus de 2e passe globale)
  log(dom.title + ' — correction fidelite : ' + fidGaps.length + ' points / ' + Object.keys(fidByTopic).length + ' topics')
  const avant = new Set(entries.map((e) => e.topicId))
  const corrigees = await applyGaps(dom, entries, fidGaps)
  const touches = new Set(Object.keys(fidByTopic))
  // Un topic NEUF sorti de la correction n a AUCUN verdict : il entre dans la re-verif avec les autres.
  const aRelire = corrigees.filter((e) => touches.has(e.topicId) || !avant.has(e.topicId))
  Object.assign(issuesById, await verdictsDeFidelite(dom, aRelire, 'reverif'))
  return corrigees
}

/** Le rendu d un domaine : les topics AVEC leur verdict de fidelite, plus ce que le run a mesure. */
function renduDeDomaine(dom, entries, issuesById, mesures) {
  return {
    domain: dom.domain,
    title: dom.title,
    topics: entries.map((e) => ({ topicId: e.topicId, title: e.title, markdown: e.markdown, refs: e.refs, codeHint: e.codeHint || '', faithful: issuesById[e.topicId] ? issuesById[e.topicId].faithful : null, issues: issuesById[e.topicId] ? issuesById[e.topicId].issues : [] })),
    autre: mesures.autre,
    inventoryCount: mesures.inventoryCount,
    auditLoops: mesures.auditLoops,
    lastAuditDry: mesures.lastAuditDry,
    surveyCounts: mesures.surveyCounts,
  }
}

/**
 * REPRISE : re-verifier un rendu deja produit, sans rejouer une seule phase de decouverte. Seuls les
 * topics que le rendu ne PROUVE pas fideles (`faithful !== true`) repassent ; les autres gardent
 * leur verdict. Sort le MEME rendu, complete.
 */
async function reprendreDomaine(rendu) {
  const declare = DOMAINES.find((d) => d.cle === rendu.domain)
  const dom = { domain: rendu.domain, title: declare.titre }
  const entries = rendu.topics.map((t) => ({ topicId: t.topicId, title: t.title, markdown: t.markdown, refs: t.refs || [], codeHint: t.codeHint || '' }))
  const issuesById = {}
  // TOUT verdict deja rendu entre tel quel — pas seulement les fideles. Une re-verification MUETTE
  // (agent mort) ne doit pas EFFACER ce qu un juge avait etabli : un `faithful:false` avec ses
  // `issues` vaut infiniment mieux qu un `faithful:null` sans issue, que plus rien ne dit comment
  // corriger. Seuls les topics NON prouves fideles repassent.
  for (const t of rendu.topics) if (typeof t.faithful === 'boolean') issuesById[t.topicId] = { faithful: t.faithful, issues: t.issues || [] }
  const mesures = {
    autre: rendu.autre || [],
    inventoryCount: rendu.inventoryCount === undefined ? 0 : rendu.inventoryCount,
    auditLoops: rendu.auditLoops === undefined ? 0 : rendu.auditLoops,
    lastAuditDry: rendu.lastAuditDry === undefined ? false : rendu.lastAuditDry,
    surveyCounts: rendu.surveyCounts || [],
  }
  const aJuger = entries.filter((e) => !(issuesById[e.topicId] && issuesById[e.topicId].faithful === true))
  if (!aJuger.length) {
    log(dom.title + ' — reprise : les ' + entries.length + ' topics sont deja prouves fideles, aucun agent lance')
    return renduDeDomaine(dom, entries, issuesById, mesures)
  }
  log(dom.title + ' — reprise : ' + aJuger.length + ' topic(s) sans preuve de fidelite sur ' + entries.length)
  const finales = await passeDeFidelite(dom, entries, issuesById, aJuger)
  return renduDeDomaine(dom, finales, issuesById, mesures)
}

/**
 * Un domaine : ses topics verifies, ou la RAISON de son saut. Un domaine saute ne disparait jamais
 * en silence — le rendu le PORTE, et l assemblage le refuse.
 */
async function runDomain(domain) {
  const declare = DOMAINES.find((d) => d.cle === domain)
  const dom = { domain, title: declare.titre }

  phase('Cadrage')
  const cad = await agent(cadragePrompt(dom), { label: dom.domain + ':cadrage', phase: 'Cadrage', model: 'sonnet', schema: CADRAGE_SCHEMA })
  const COVERAGE = (cad && cad.coverageRefs) || []
  if (!COVERAGE.length) return { saute: 'cadrage VIDE : aucun chapitre dedie rendu par l agent de cadrage' }
  const SONNET = new Set([REFERENCE.ab, ...((cad && cad.sonnetBooks) || [])])
  log(dom.title + ' — cadrage : ' + COVERAGE.map((r) => r.ab + r.nn).join(',') + ' ; denses=' + [...SONNET].join(','))

  phase('Cartographie')
  const invRes = await parallel(COVERAGE.map((r) => () => agent(cartoPrompt(dom, r), { label: dom.domain + ':carto:' + r.ab + '-' + r.nn, phase: 'Cartographie', model: 'sonnet', schema: INVENTORY_SCHEMA })))
  const inventory = []
  invRes.forEach((x, i) => { if (x && x.items) for (const it of x.items) inventory.push({ item: it.item, kind: it.kind, ref: it.ref, gist: it.gist, src: COVERAGE[i].ab + ' ' + COVERAGE[i].nn }) })
  if (!inventory.length) return { saute: 'inventaire VIDE : la cartographie n a rapporte aucune regle sur ' + COVERAGE.map((r) => r.ab + ' ' + r.nn).join(', ') }
  log(dom.title + ' — inventaire : ' + inventory.length + ' elements')

  phase('Taxonomie')
  const taxo = await agent(taxoPrompt(dom, inventory), { label: dom.domain + ':taxo', phase: 'Taxonomie', model: 'opus', schema: TAXO_SCHEMA })
  const TOPICS = (taxo && taxo.topics) || []
  if (!TOPICS.length) return { saute: 'taxonomie VIDE : aucun topic decoupe sur ' + inventory.length + ' elements inventories' }
  log(dom.title + ' — ' + TOPICS.length + ' topics')

  phase('Survey')
  const surveyRes = await parallel(BOOKS.map((b) => () => agent(surveyPrompt(dom, b, TOPICS), { label: dom.domain + ':survey:' + b.ab, phase: 'Survey', model: SONNET.has(b.ab) ? 'sonnet' : 'haiku', schema: SURVEY_SCHEMA })))
  const byTopic = {}
  TOPICS.forEach((t) => { byTopic[t.id] = [] })
  const autre = []
  surveyRes.forEach((r, i) => { if (r && r.hits) for (const h of r.hits) { const rec = { topicId: h.topicId, ref: h.ref, gist: h.gist, book: BOOKS[i].ab }; (byTopic[h.topicId] ? byTopic[h.topicId] : autre).push(rec) } })
  log(dom.title + ' — survey : ' + Object.values(byTopic).reduce((n, a) => n + a.length, 0) + ' passages ; ' + autre.length + ' hors-taxo')

  phase('Synthese')
  let entries = (await parallel(TOPICS.map((t) => () => agent(synthPrompt(dom, t, byTopic[t.id] || [], t.covers), { label: dom.domain + ':synth:' + t.id, phase: 'Synthese', model: 'opus', schema: SYNTH_SCHEMA })))).filter(Boolean)

  phase('Audit')
  let loops = 0
  let lastDry = false
  while (loops < MAXLOOPS) {
    const audit = await agent(auditPrompt(dom, entries, inventory, autre), { label: dom.domain + ':audit#' + (loops + 1), phase: 'Audit', model: 'opus', schema: AUDIT_SCHEMA })
    const gaps = (audit && audit.gaps) || []
    lastDry = !!(audit && audit.dry)
    log(dom.title + ' — audit #' + (loops + 1) + ' : ' + gaps.length + ' trous' + (lastDry ? ' — sec' : ''))
    if (!gaps.length || lastDry) break
    entries = await applyGaps(dom, entries, gaps)
    loops++
  }

  const issuesById = {}
  entries = await passeDeFidelite(dom, entries, issuesById, entries)

  return {
    rendu: renduDeDomaine(dom, entries, issuesById, {
      autre,
      inventoryCount: inventory.length,
      auditLoops: loops,
      lastAuditDry: lastDry,
      surveyCounts: BOOKS.map((b, i) => ({ book: b.ab, hits: surveyRes[i] && surveyRes[i].hits ? surveyRes[i].hits.length : 0 })),
    }),
  }
}

// ============ EXECUTION (lot) ============
log('Fan-out Atlas RAW — ' + (REPRISE ? 'REPRISE du rendu de : ' : 'lot : ') + LOT.join(', '))
const domains = []
const sautes = []
for (const d of LOT) {
  log('==== Domaine : ' + d + ' ====')
  const res = REPRISE ? { rendu: await reprendreDomaine(REPRISE) } : await runDomain(d)
  if (res.rendu) domains.push(res.rendu)
  else {
    // Un domaine SAUTE sort DANS le rendu : un `log` ne se relit pas, et `assemble` ecrirait le
    // reste du lot sans que rien ne nomme le manquant.
    sautes.push({ domain: d, raison: res.saute })
    log('==== Domaine SAUTE : ' + d + ' — ' + res.saute + ' ====')
  }
}
log('Lot termine (coeur ' + COEUR + ', ' + BOOKS.length + ' livre(s), supplements ' + (args.supplements === undefined ? 'non dit' : String(args.supplements)) + ') : ' + domains.map((d) => d.domain + '(' + d.topics.length + 't' + (d.lastAuditDry ? ',sec' : '') + ')').join(' · ') + (sautes.length ? ' ; SAUTES : ' + sautes.map((s) => s.domain).join(', ') : ''))
// Le rendu PORTE son coeur : `assemble-domain.mjs` refuse d ecrire une fiche sans lui — et refuse
// tout domaine que `sautes` nomme.
return { coeur: COEUR, supplements: args.supplements === undefined ? null : args.supplements, domains, sautes }
