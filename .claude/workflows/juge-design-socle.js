export const meta = {
  name: 'juge-design-socle',
  description: "Jugement adversarial d'un DESIGN de socle AVANT le codeur : lecture des sections d'ENTRÉE du brief (Invariant, cas canonique), trois lentilles de juge indépendantes, réfutation de chaque bloquant par deux autres juges, synthèse calculée par le script. Rend le bloc à coller sous `## Design jugé :`. args : { brief, worktree, date, scratchpad }.",
  whenToUse: "Avant de dispatcher un codeur sur un brief de SOCLE (module que plusieurs flux composent, ou branche par type de porteur/entité). Le brief doit DÉJÀ porter son `## Invariant` et son CAS CANONIQUE : ce workflow juge le design, il ne l'écrit pas — et il refuse un brief qui porte déjà un verdict.",
  phases: [
    { title: 'Lecture', detail: "sections d'entrée du brief, rendues en objet" },
    { title: 'Design', detail: 'trois lentilles de juge, indépendantes' },
    { title: 'Réfutation', detail: 'deux juges tentent de réfuter chaque bloquant' },
    { title: 'Synthèse', detail: 'verdict, écartés et bloc — code pur du script' },
  ],
}

// args parfois STRINGIFIÉ par le harnais → parse défensif (même forme que `audit-poison.js`).
const input = typeof args === 'string' ? JSON.parse(args || '{}') : (args || {})
const BRIEF = String(input.brief || '')
const WORKTREE = String(input.worktree || '')
const DATE = String(input.date || '')
const SCRATCHPAD = String(input.scratchpad || '')

const manquesDArgs = [
  BRIEF ? null : 'args.brief — chemin ABSOLU du brief à juger',
  WORKTREE ? null : 'args.worktree — chemin ABSOLU de l’arbre jugé',
  DATE ? null : 'args.date — AAAA-MM-JJ, la date du commit prévu (aucune horloge dans un script : la reprise doit rendre le même run)',
  SCRATCHPAD ? null : 'args.scratchpad — dossier où les sondes s’écrivent, hors du worktree',
].filter(Boolean)
if (manquesDArgs.length) {
  log(`ARRÊT : ${manquesDArgs.length} argument(s) manquant(s) — ${manquesDArgs.join(' · ')}`)
  return { verdict: 'ARRÊT', manques: manquesDArgs, bloquants: [], ecartes: [], dits: [], agents: 0, date: DATE }
}

const CADRE = `Arbre jugé (chemin ABSOLU, à utiliser tel quel) : ${WORKTREE}
Brief jugé : ${BRIEF}
Date du jour : ${DATE}
Dossier de sondes : ${SCRATCHPAD}

Interdits, sans exception : tout git ÉCRIVAIN (checkout, restore, reset, stash, add, commit, clean) ; toute suite de tests du dépôt et toute gate (une sonde se joue sur UN fichier isolé, jamais sur la suite) ; toute écriture sous l'arbre jugé — une sonde s'écrit sous le dossier de sondes ci-dessus ou dans un dépôt jetable, et tout processus lancé est TUÉ avant ton rendu.
Shell = PowerShell (le pont Bash est mesuré 100× plus lent sur cette machine). Le brief peut vivre hors de la racine du projet : dans ce cas lis-le par PowerShell, les outils de contexte refusent les chemins hors racine.
Ton rendu = l'objet du schéma, rien d'autre.`

const LECTURE = {
  type: 'object', additionalProperties: false,
  properties: {
    // REQUIS et au PLURIEL : un brief de socle porte N invariants (six sur le premier brief réel),
    // et un champ seulement OPTIONNEL est un champ que l'agent omet — deux runs arrêtés sur
    // « aucun VERBATIM cité » devant un brief qui en portait six (wf_2595703f-917, wf_cd16b62d-d3b).
    // La QUESTION est requise elle aussi : une citation prouve ce qu'elle RÉPOND.
    invariants: {
      type: 'array', minItems: 1,
      items: {
        type: 'object', additionalProperties: false,
        properties: { verbatim: { type: 'string' }, source: { type: 'string' }, question: { type: 'string' } },
        required: ['verbatim', 'source', 'question'],
      },
    },
    casCanonique: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { fichier: { type: 'string' }, ligne: { type: 'number' }, role: { type: 'string' } },
        required: ['fichier', 'ligne'],
      },
    },
    perimetre: { type: 'array', items: { type: 'string' } },
    primitives: { type: 'array', items: { type: 'string' } },
    designJugePresent: { type: 'boolean' },
    manques: { type: 'array', items: { type: 'string' } },
  },
  required: ['invariants', 'casCanonique', 'perimetre', 'primitives', 'designJugePresent', 'manques'],
}

const DESIGN = {
  type: 'object', additionalProperties: false,
  properties: {
    verdict: { enum: ['TIENT', 'FRAGILE', 'RÉFUTÉ'] },
    bloquants: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { titre: { type: 'string' }, preuve: { type: 'string' }, correction: { type: 'string' } },
        required: ['titre', 'preuve', 'correction'],
      },
    },
    dits: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'bloquants', 'dits'],
}

const REFUTATION = {
  type: 'object', additionalProperties: false,
  properties: {
    refute: { type: 'boolean' },
    preuve: { type: 'string' },
    structurel: { type: 'boolean' },
  },
  required: ['refute', 'preuve', 'structurel'],
}

const lecture = await agent(`Tu LIS un brief d'agent et tu rends sa structure — tu ne juges rien, tu ne décides rien.

${CADRE}

Rends :
- invariants : UN invariant par entrée numérotée de \`## Invariant\` (la section en porte souvent plusieurs) — le verbatim TEL QUEL (jamais reformulé, jamais tronqué à la ponctuation), sa source (fiche/ticket/doctrine + fichier:ligne quand le brief le donne), et la question à laquelle il répondait. Un invariant sans question va AUSSI en \`manques\`, en le nommant par son numéro : une citation prouve ce qu'elle RÉPOND. Liste vide si la section manque ou ne cite aucun verbatim.
- casCanonique : chaque \`fichier:ligne\` que le brief donne comme cas DÉJÀ couvert par le socle (role = ce que le brief dit qu'il couvre). Liste vide si le brief n'en nomme aucun.
- perimetre : les chemins de fichiers que le brief autorise à toucher, tels qu'écrits.
- primitives : les primitives canoniques nommées par le brief.
- designJugePresent : vrai si le brief porte DÉJÀ une section \`## Design jugé :\` suivie d'un verdict non vide (un brief déjà jugé ne se re-juge pas ici).
- manques : ce que le brief n'écrit pas et que la porte du codeur exige, en clair.

Vérifie l'EXISTENCE de chaque \`fichier:ligne\` du cas canonique dans l'arbre jugé, et signale en \`manques\` ceux qui n'existent pas.`,
  { label: 'lecture-du-brief', phase: 'Lecture', schema: LECTURE, agentType: 'lecteur', model: 'sonnet', effort: 'low' })

if (!lecture) {
  log('ARRÊT : la lecture du brief n’a rien rendu — le brief est illisible depuis le harnais.')
  return { verdict: 'ARRÊT', manques: ['lecture du brief sans rendu'], bloquants: [], ecartes: [], dits: [], agents: 1, date: DATE }
}

const manquesDEntree = []
const invariants = Array.isArray(lecture.invariants) ? lecture.invariants : []
if (!invariants.some((i) => i && i.verbatim)) manquesDEntree.push('`## Invariant` : aucun VERBATIM cité (source + question à laquelle il répondait)')
invariants.forEach((i, rang) => {
  if (i && i.verbatim && !i.question) manquesDEntree.push(`invariant ${rang + 1} sans la question à laquelle il répond — une citation prouve ce qu'elle RÉPOND, jamais ce qu'on lui fait dire`)
})
if (!lecture.casCanonique || !lecture.casCanonique.length) manquesDEntree.push('CAS CANONIQUE : aucun `fichier:ligne` que le socle couvre déjà pour ce concept')
if (lecture.designJugePresent) manquesDEntree.push('le brief porte DÉJÀ un `## Design jugé :` non vide — un re-jugement masqué se refuse, l’orchestrateur tranche')
if (manquesDEntree.length) {
  log(`ARRÊT en phase Lecture : ${manquesDEntree.join(' · ')}. Les manques relevés par le lecteur : ${(lecture.manques || []).join(' · ') || 'aucun'}.`)
  return {
    verdict: 'ARRÊT', manques: manquesDEntree, lecture,
    bloquants: [], ecartes: [], dits: [], agents: 1, date: DATE,
    bloc: `**ARRÊT — design non jugé.** Le brief n’est pas jugeable en l’état : ${manquesDEntree.join(' ; ')}.`,
  }
}

const CONTEXTE = `Ce que la lecture a établi du brief (structure, pas verdict) :
${JSON.stringify(lecture, null, 1)}

Lis le brief EN ENTIER par toi-même : la structure ci-dessus est une carte, jamais une source.`

const LENTILLES = [
  {
    label: 'trou-de-socle',
    consigne: `LENTILLE — TROU DE SOCLE. Le design proposé fait-il du nouveau cas une INSTANCE du socle (une déclaration de plus, même code) ou une VARIANTE à branche (\`if (<type de cas>)\` dans un socle : héros/monde, terre/mer, mono/multi, solo/coop, arme/sort) ?
Cherche dans l'arbre jugé : (a) un SECOND socle qui couvre déjà ce concept — deux hôtes pour un concept est le défaut ; (b) le site où le N+1 coûterait plus d'une ligne — nomme-le en fichier:ligne ; (c) la primitive canonique du CLAUDE.md que le design réinvente. Un bloquant sans fichier:ligne n'en est pas un.`,
  },
  {
    label: 'preuve-par-sonde',
    consigne: `LENTILLE — PREUVE PAR SONDE. Écris et JOUE une sonde en lecture seule qui tente de CASSER le design avant que le code n'existe : un appel qui devrait échouer et ne le fait pas, un contrat que le design suppose et que le dépôt ne tient pas, une forme de donnée qui ne se présente pas comme le design le croit.
La sonde s'écrit sous le dossier de sondes, elle se joue sur un fichier isolé, et le CODE EXACT de la sonde + sa SORTIE font partie de ta preuve (l'orchestrateur la fera promouvoir en test). Le code de sortie ne se lit jamais à travers un tube : mesure-le par \`spawnSync\` ou par redirection fichier.`,
  },
  {
    label: 'normes-et-poison',
    consigne: `LENTILLE — MISE AUX NORMES ET POISON. Le design nomme-t-il UN concept par UN terme (aucun synonyme concurrent dans le périmètre) ? Introduit-il un doublon adjacent d'un terme déjà porté par le dépôt ? Que RETIRE-t-il, et la migration de l'existant est-elle dans le geste (un stock qui grandit, une demi-migration, une liste d'exemptions neuve sont des bloquants) ?
Signale le poison que le design ferait naître ou laisserait vivre : paraphrase de règle en commentaire là où seule la réf nue tient, excuse sans tag entériné, pierre tombale — avec fichier:ligne.`,
  },
]

const rendusDeDesign = (await parallel(LENTILLES.map((l) => () => agent(
  `${l.consigne}\n\n${CADRE}\n\n${CONTEXTE}\n\nTu juges SEUL : les autres lentilles ne te sont pas montrées, et tu ne supposes pas ce qu'elles trouvent. Verdict TIENT s'il ne reste aucun bloquant, FRAGILE s'il en reste, RÉFUTÉ si le design ne peut pas être codé tel quel. \`dits\` = ce qui mérite d'être dit sans bloquer.`,
  { label: l.label, phase: 'Design', schema: DESIGN, agentType: 'juge' },
)))).filter(Boolean)

let agentsJoues = 1 + rendusDeDesign.length
log(`Phase Design : ${rendusDeDesign.length}/${LENTILLES.length} lentilles rendues (${LENTILLES.length - rendusDeDesign.length} agent(s) mort(s), leurs bloquants ne sont pas jugés).`)

const normaliser = (t) => String(t ?? '')
  .toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/[^a-z0-9]+/g, ' ').trim()

const parTitre = new Map()
const dits = []
for (const rendu of rendusDeDesign) {
  for (const d of rendu.dits || []) dits.push(d)
  for (const b of rendu.bloquants || []) {
    const cle = normaliser(b.titre)
    if (!cle) continue
    if (parTitre.has(cle)) {
      const garde = parTitre.get(cle)
      log(`Bloquants fusionnés sous « ${garde.titre} » : « ${b.titre} » (même titre normalisé « ${cle} ») — sa preuve ET sa correction rejoignent la première, rien n'est jeté.`)
      garde.preuve = `${garde.preuve}\n(autre lentille) ${b.preuve}`
      garde.correction = `${garde.correction}\n(autre lentille) ${b.correction}`
      continue
    }
    parTitre.set(cle, { ...b })
  }
}
const bloquantsUniques = [...parTitre.values()]
log(`Phase Design : ${bloquantsUniques.length} bloquant(s) distinct(s), ${dits.length} dit(s). Réfutation : ${bloquantsUniques.length * 2} agents.`)

// Aucune garde de budget ici : l'unité de `budget.remaining()` n'est pas mesurée sur ce dépôt (la
// comparer à un nombre d'agents ne mordrait jamais). Elle se posera avec un chiffre, après le premier
// banc qui donne le coût d'une réfutation.

const examines = (await pipeline(
  bloquantsUniques,
  (b) => parallel([1, 2].map((rang) => () => agent(
    `RÉFUTATION — pars du principe que ce bloquant est FAUX et essaie de le RÉFUTER sur pièces, dans l'arbre jugé.

BLOQUANT : ${JSON.stringify(b, null, 1)}

${CADRE}

refute = vrai SEULEMENT si tu établis que le bloquant ne tient pas (la preuve invoquée n'existe pas, dit autre chose, ou le design ne fait pas ce que le bloquant lui prête) — cite fichier:ligne ou la sortie de ta sonde. structurel = vrai si, le bloquant tenant, il ne se corrige pas par une retouche du brief mais force à REPENSER le design. Tu juges seul ; un autre juge examine le même bloquant sans te voir (tu es le n°${rang}).`,
    { label: `refutation-${rang}`, phase: 'Réfutation', schema: REFUTATION, agentType: 'juge' },
  ))).then((v) => ({ bloquant: b, refutations: (v || []).filter(Boolean) })),
)).filter(Boolean)

for (const e of examines) agentsJoues += e.refutations.length

const survivants = []
const ecartes = []
for (const { bloquant, refutations } of examines) {
  const refute = refutations.find((r) => r.refute)
  if (!refutations.length) log(`Bloquant « ${bloquant.titre} » : aucun réfutateur n'a rendu — il SURVIT (une réfutation absente n'écarte rien).`)
  if (refute) ecartes.push({ ...bloquant, refutation: refute.preuve })
  else survivants.push({ ...bloquant, structurel: refutations.length === 2 && refutations.every((r) => r.structurel), refutations })
}
const jamaisExamines = bloquantsUniques.filter((b) => !examines.some((e) => normaliser(e.bloquant.titre) === normaliser(b.titre)))
for (const b of jamaisExamines) {
  log(`Bloquant « ${b.titre} » : réfutation en échec (aucun rendu du stage) — il SURVIT sans marque structurelle.`)
  survivants.push({ ...b, structurel: false, refutations: [] })
}

phase('Synthèse')

function blocDe(verdict, survivantsDuBloc, ecartesCompte) {
  const lignes = [
    `**${verdict}** — workflow \`juge-design-socle\`, run \`<runId du lancement, cité par l'orchestrateur>\`, ${DATE}.`,
    `${survivantsDuBloc.length} bloquant(s) survivant(s), ${ecartesCompte} écarté(s) par réfutation.`,
  ]
  survivantsDuBloc.forEach((b, i) => {
    lignes.push(`${i + 1}. ${b.structurel ? '[structurel] ' : ''}**${b.titre}** — ${b.preuve} → ${b.correction}`)
  })
  if (!survivantsDuBloc.length) lignes.push('Aucun bloquant n’a survécu à la réfutation.')
  return lignes.join('\n')
}

const structurels = survivants.filter((b) => b.structurel)
const verdict = structurels.length ? 'RÉFUTÉ' : survivants.length ? 'FRAGILE' : 'TIENT'
log(`Synthèse : ${verdict} — ${survivants.length} survivant(s) dont ${structurels.length} structurel(s), ${ecartes.length} écarté(s), ${agentsJoues} agents joués.`)

return {
  verdict,
  bloquants: survivants,
  ecartes,
  dits,
  lecture,
  agents: agentsJoues,
  date: DATE,
  bloc: blocDe(verdict, survivants, ecartes.length),
}
