export const meta = {
  name: 'audit-poison',
  description: "Audit anti-poison rejouable : commentaires RAW mensongers, excuses, pierres tombales, docs périmées — chaque trouvaille vérifiée adversarialement. args optionnel : { paths: ['src/ui', ...] } pour restreindre le périmètre.",
  whenToUse: "Relancer périodiquement (après un gros chantier, avant une migration) ou sur un sous-arbre jamais audité. Clôture : chaque CLASSE nouvelle reçoit son garde-de-porte (scripts/guards/lib) dans le même chantier, et le rapport daté porte le compte de confirmées — il doit décroître d'audit en audit.",
  phases: [
    { title: 'Scout', detail: 'découverte des fichiers à réfs RAW + docs vivants' },
    { title: 'Find', detail: 'lots de fichiers, 4 familles de poison' },
    { title: 'Verify', detail: 'réfutation adversariale par trouvaille' },
  ],
}

// args parfois STRINGIFIÉ par le harnais → parse défensif.
const input = typeof args === 'string' ? JSON.parse(args || '{}') : (args || {})
const SCOPE = input.paths || ['src']

const MAPPING = `Correspondance réf -> dossier Source/ (cwd = racine du projet Game) :
   LDB -> "Source/Warhammer v4 - Livre de base version corrigée/" (chapitres "NN - Titre.md")
   ADE I/II -> "Source/Warhammer v4 - Les archives de l'Empire volume 1/" et "... volume 2/"
   EDO -> "Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/" ; EDOC -> "... Compagnon/"
   MDG -> "Source/WH - V4 - La Mer de Griffe/" ; AA -> "Source/WH - V4 - Aux Armes/" ; ZI -> "Source/WH - V4 - Le zoo impérial/"
   ACE -> "Source/Warhammer v4 - Aldorf la Couronne de l'Empire/" ; Middenheim -> "Source/Warhammer v4 - Middenheim la cité du Loup Blanc/"
   ATTENTION : les numéros de ligne des réfs ont DÉRIVÉ (ré-extraction Marker 2026-06-22) : le CHAPITRE est bon, localise la règle PAR CONCEPT (Grep de mots-clés). Un écart de numéro de ligne seul n'est PAS une trouvaille.`

const FINDINGS = {
  type: 'object', additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          file: { type: 'string' }, line: { type: 'number' },
          kind: { type: 'string', description: 'raw-mismatch | raw-lite | code-mismatch | excuse | tombstone | doc-stale | doc-disposition' },
          quote: { type: 'string' }, claim: { type: 'string' }, reality: { type: 'string' },
          evidence: { type: 'string' }, severity: { enum: ['haute', 'moyenne', 'basse'] }, fix: { type: 'string' },
        },
        required: ['file', 'kind', 'quote', 'claim', 'reality', 'severity'],
      },
    },
  },
  required: ['findings'],
}
const VERDICT = {
  type: 'object', additionalProperties: false,
  properties: { isReal: { type: 'boolean' }, reality: { type: 'string' }, note: { type: 'string' } },
  required: ['isReal', 'reality'],
}
const LIST = {
  type: 'object', additionalProperties: false,
  properties: { rawFiles: { type: 'array', items: { type: 'string' } }, docs: { type: 'array', items: { type: 'string' } } },
  required: ['rawFiles', 'docs'],
}

function rawPrompt(files) {
  return `Tu audites des fichiers de code contre les livres de règles Warhammer v4 FR. Réponds en français. Lis chaque fichier EN ENTIER :
${files.map(f => '- ' + f).join('\n')}

QUATRE familles de poison — ne rapporte que du MATÉRIEL :
1. kind 'raw-mismatch' : un commentaire/comportement contredit le Source cité. Ouvre le chapitre dans Source/ et vérifie l'AFFIRMATION. ${MAPPING}
   ⚠ Les dégâts/effets peuvent vivre en DONNÉE (Flow onHit conditionné, GameOp) — vérifie la donnée avant de déclarer un comportement faux (précédent : faux positif Bélier, issue #102).
2. kind 'raw-lite' : paraphrase de règle là où seule la réf nue devrait figurer (paraphrase FAUSSE → raw-mismatch).
3. kind 'excuse' : commentaire qui JUSTIFIE une exception/migration partielle/déviation (« assumé », « pour l'instant », « épargné », « iso-POC »…) — tous, même plausibles : arbitrage utilisateur.
4. kind 'tombstone' : pierre tombale (« déplacé vers X », « ex-… », « anciennement ») — severity basse, fix = supprimer.
+ kind 'code-mismatch' : commentaire qui contredit le code adjacent (symbole disparu, branchement décrit inexistant).

Champs : file, line, kind, quote (VERBATIM), claim, reality, evidence (extrait Source/code + fichier), severity (haute = copiable et faux), fix (1 ligne). Zéro trouvaille si propre.`
}
function docsPrompt(files) {
  return `Tu audites des références VIVANTES (docs/) contre le code ACTUEL du repo. Réponds en français. Docs :
${files.map(f => '- ' + f).join('\n')}
Pour chaque doc : vérifie chaque affirmation concrète (chemins, symboles, commandes, flux) par Grep/Read. kind 'doc-stale' par claim faux (quote verbatim, reality, evidence fichier:ligne) ; kind 'doc-disposition' (max 1/doc) si le sort global doit changer (corriger / déplacer vers docs/plans/ daté / supprimer — politique CLAUDE.md).`
}
function verifyPrompt(f) {
  return `Vérification ADVERSARIALE — pars du principe que ce constat est FAUX et essaie de le réfuter en relisant la source primaire (Source/ par concept, ou le code). ${MAPPING}

CONSTAT : ${JSON.stringify(f, null, 1)}

isReal=true SEULEMENT si réel, matériel et ACTUEL. Pour 'tombstone'/'excuse'/'raw-lite' : isReal = le commentaire existe tel quel et appartient à sa famille. reality = la vérité en 1 phrase ; note = ce que tu as lu.`
}

// SCOUT — auto-découverte (pas de listes codées en dur : le repo bouge).
const scout = await agent(`Dans le repo (cwd), établis DEUX listes en JSON :
1. rawFiles : tous les fichiers .ts/.tsx NON-test sous ${SCOPE.join(', ')} contenant une réf de livre (regex : (LDB|ADE|EDO|EDOC|MDG|ZI|AA|ACE)[^\\n]{0,40}l\\.\\d+) — utilise Grep files_with_matches, glob !*.test.ts.
2. docs : les .md à la RACINE de docs/ (références vivantes — PAS docs/plans/, PAS docs/raw/).
Rends { rawFiles, docs } avec des chemins relatifs à barres obliques.`,
  { label: 'scout', phase: 'Scout', schema: LIST, model: 'haiku', effort: 'low' })

function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out }
const items = [
  ...chunk(scout.rawFiles, 5).map(files => ({ kind: 'raw', files })),
  ...chunk(scout.docs, 2).map(files => ({ kind: 'docs', files })),
]
log(`Périmètre : ${scout.rawFiles.length} fichiers code + ${scout.docs.length} docs → ${items.length} lots.`)

const MECHANICAL = new Set(['tombstone', 'excuse', 'raw-lite'])
const results = await pipeline(
  items,
  (item) => agent(item.kind === 'raw' ? rawPrompt(item.files) : docsPrompt(item.files),
    { label: `${item.kind}:${item.files[0].split('/').pop()}`, phase: 'Find', schema: FINDINGS, model: 'sonnet', effort: 'medium' }),
  (res) => {
    const fs = (res && res.findings) || []
    if (!fs.length) return []
    return parallel(fs.map(f => () => {
      const mech = MECHANICAL.has(f.kind)
      return agent(verifyPrompt(f), {
        label: `verify:${(f.file || '?').split('/').pop()}${f.line ? ':' + f.line : ''}`, phase: 'Verify',
        schema: VERDICT, model: mech ? 'haiku' : 'sonnet', effort: mech ? 'low' : 'medium',
      }).then(v => ({ ...f, verdict: v }))
    }))
  }
)

const all = results.filter(Boolean).flat().filter(Boolean)
const confirmed = all.filter(f => f.verdict && f.verdict.isReal)
const order = { haute: 0, moyenne: 1, basse: 2 }
confirmed.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3))
log(`${all.length} brutes → ${confirmed.length} confirmées. Suite : rapport daté dans docs/plans/ (avec le COMPTE — il doit décroître d'audit en audit), bugs → issues gabarit #101+, excuses → arbitrage utilisateur, tombstones → purge, et chaque CLASSE nouvelle → garde-de-porte (scripts/guards/lib) dans le même chantier.`)
return { confirmed, stats: { lots: items.length, brutes: all.length, confirmees: confirmed.length, refutees: all.length - confirmed.length } }
