export const meta = {
  name: 'revue-palier',
  description: "Revue adversariale d'un PALIER (mode `palier`) ou réfutation de la fermeture d'un lot (mode `refutation`) : une lentille de juge par angle, chacune nourrie des SEULS faits dont elle a besoin (le reste attend dans le fichier de faits), puis UN réfutateur PAR LENTILLE qui juge en un lot toutes les trouvailles de cet angle (plafond 12), synthèse et texte d'archive calculés par le script. args : { worktree, scratchpad, base, tete, date, faits, faitsChemin, mode, dod }.",
  whenToUse: "Quand le palier de commits de substance est atteint (mode `palier`), ou avant de solder un lot dont le DoD est écrit (mode `refutation`). Les faits arrivent de `scripts/ops/faits-de-palier.mjs` : un script de workflow ne lit aucun fichier et ne mesure rien lui-même.",
  phases: [
    { title: 'Lentilles', detail: 'un juge par angle, sur les faits de son angle' },
    { title: 'Réfutation', detail: 'un juge par lentille, ses trouvailles en un lot' },
    { title: 'Synthèse', detail: "verdict et texte d'archive — code pur du script" },
  ],
}

// args parfois STRINGIFIÉ par le harnais → parse défensif (même forme que `audit-poison.js`).
const input = typeof args === 'string' ? JSON.parse(args || '{}') : (args || {})
const WORKTREE = String(input.worktree || '')
const SCRATCHPAD = String(input.scratchpad || '')
const BASE = String(input.base || '')
const TETE = String(input.tete || '')
const DATE = String(input.date || '')
const MODE = input.mode === 'refutation' ? 'refutation' : 'palier'
const DOD = Array.isArray(input.dod) ? input.dod : []
const FAITS = input.faits || null
const FAITS_CHEMIN = String(input.faitsChemin || (FAITS && FAITS.faitsChemin) || '')

const manquesDArgs = [
  WORKTREE ? null : 'args.worktree — chemin ABSOLU de l’arbre jugé',
  SCRATCHPAD ? null : 'args.scratchpad — dossier où les sondes s’écrivent, hors de l’arbre jugé',
  BASE ? null : 'args.base — sha de base de la fenêtre (la tête de fenêtre de la dernière revue archivée)',
  TETE ? null : 'args.tete — sha de tête de la fenêtre',
  DATE ? null : 'args.date — AAAA-MM-JJ, la date du commit prévu (la porte de solde exige cette date DANS le fichier)',
  FAITS ? null : 'args.faits — l’objet rendu par `scripts/ops/faits-de-palier.mjs` (un script de workflow ne mesure rien lui-même)',
  FAITS_CHEMIN ? null : 'args.faitsChemin — le fichier où le JSON COMPLET des faits attend (`--sortie` de `faits-de-palier`)',
  MODE === 'refutation' && !DOD.length ? 'args.dod — les clauses du DoD à réfuter, une par lentille (mode refutation)' : null,
].filter(Boolean)
if (manquesDArgs.length) {
  log(`ARRÊT : ${manquesDArgs.length} argument(s) manquant(s) — ${manquesDArgs.join(' · ')}`)
  return { mode: MODE, verdict: 'ARRÊT', manques: manquesDArgs, trouvailles: [], refutees: [], tenues: [], agents: 0, date: DATE, base: BASE, tete: TETE }
}

const CADRE = `Arbre jugé (chemin ABSOLU, à utiliser tel quel) : ${WORKTREE}
Dossier de sondes : ${SCRATCHPAD}
Fenêtre jugée : de ${BASE} à ${TETE}
Date du jour : ${DATE}
Faits COMPLETS (JSON) : ${FAITS_CHEMIN}

Interdits, sans exception : tout git ÉCRIVAIN (checkout, restore, reset, stash, add, commit, clean) ; toute suite de tests du dépôt et toute gate (une sonde se joue sur UN fichier isolé, jamais sur la suite) ; toute écriture sous l'arbre jugé — une sonde s'écrit sous le dossier de sondes ci-dessus ou dans un dépôt jetable, et tout processus lancé est TUÉ avant ton rendu.
Shell = PowerShell (le pont Bash est mesuré 100× plus lent sur cette machine). Le code de sortie ne se lit jamais à travers un tube : mesure-le par \`spawnSync\` ou par redirection fichier.
Épingle l'arbre avant de mesurer (\`git log --oneline -1\`) et dis le hash dans ta preuve.
Ton rendu = l'objet du schéma, rien d'autre.`

// Ce que TOUTE lentille reçoit : la fenêtre, l'état du chaînage, la provenance de chaque fait, et les
// commits — sans leur corps, qui pèse à lui seul l'essentiel du JSON et ne sert qu'à trois angles.
const CHAMPS_TOUJOURS = ['base', 'tete', 'depuis', 'chainage', 'faitsChemin', 'commits', 'provenance']

/** Les faits de CETTE lentille, et le nom de ceux qui restent dans le fichier. PUR. */
function extraitDesFaits(champs, avecCorpsDesCommits) {
  const voulus = new Set([...CHAMPS_TOUJOURS, ...(champs || [])])
  const extrait = {}
  const omis = []
  for (const [cle, valeur] of Object.entries(FAITS)) {
    if (!voulus.has(cle)) { omis.push(cle); continue }
    extrait[cle] = cle === 'commits' && !avecCorpsDesCommits && Array.isArray(valeur)
      ? valeur.map(({ corps, ...reste }) => reste)
      : valeur
  }
  return { extrait, omis }
}

/** Le bloc de faits d'une lentille, tel qu'il part dans son prompt. PUR. */
function faitsDe(lentille) {
  const { extrait, omis } = extraitDesFaits(lentille.champs, lentille.corpsDesCommits)
  const reste = omis.length
    ? `Les champs \`${omis.join('`, `')}\` ne sont PAS ici : ils attendent dans ${FAITS_CHEMIN}, lis-le si ton angle les demande.`
    : 'Tous les champs mesurés sont ici.'
  const corps = lentille.corpsDesCommits ? '' : ' Les commits sont donnés SANS leur corps de message (le journal git ou le fichier ci-dessus le rend).'
  return `FAITS MESURÉS hors du harnais pour TON angle (chaque champ porte sa provenance dans \`provenance\`) — ils sont ta BASE, jamais ta conclusion ; tout fait que tu contestes se re-mesure et se dit. ${reste}${corps}
${JSON.stringify(extrait, null, 1)}`
}

const LENTILLE = {
  type: 'object', additionalProperties: false,
  properties: {
    trouvailles: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          titre: { type: 'string' },
          preuve: { type: 'string' },
          attendu: { type: 'string' },
          sonde: { type: 'string' },
        },
        required: ['titre', 'preuve', 'attendu'],
      },
    },
    tenues: { type: 'array', items: { type: 'string' } },
  },
  required: ['trouvailles', 'tenues'],
}

/** UN verdict par trouvaille REÇUE, apparié par le `titre` : le réfutateur en juge un LOT. */
const VERDICTS = {
  type: 'object', additionalProperties: false,
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          titre: { type: 'string' },
          confirmee: { type: 'boolean' },
          bloquante: { type: 'boolean' },
          preuve: { type: 'string' },
        },
        required: ['titre', 'confirmee', 'bloquante', 'preuve'],
      },
    },
  },
  required: ['verdicts'],
}

const LENTILLES_DE_PALIER = [
  {
    label: 'fermetures-soldes',
    champs: ['fermetures', 'fermeturesHorsCommit'],
    consigne: `LENTILLE — FERMETURES × SOLDES × DoD. Pour chaque ticket fermé dans la fenêtre : le commit fermant cite-t-il le ticket, le solde existe-t-il, PART-IL avec le commit, et le DoD du ticket est-il tenu POINT PAR POINT dans le dépôt ? Une fermeture sans solde committé, un solde qui ne répond pas à son DoD, un DoD tenu « en prose » sans preuve dans le code sont des trouvailles.`,
  },
  {
    label: 'stocks-et-cliquets',
    champs: ['stocks'],
    corpsDesCommits: true,
    consigne: `LENTILLE — STOCKS ET CLIQUETS. Confronte les croissances de stock MESURÉES sur la plage aux \`CLIQUET:\` déclarés dans les messages : un cliquet au mauvais compte, un cliquet-tampon (motif vide de sens), une liste d'exemptions neuve, un stock qui ne décroît pas sur deux paliers sont des trouvailles. Un stock est une DETTE vers zéro.`,
  },
  {
    label: 'poison-des-diffs',
    champs: [],
    corpsDesCommits: true,
    consigne: `LENTILLE — POISON DES DIFFS. Lis les commentaires AJOUTÉS par la fenêtre (\`git diff <base> <tete> -- src scripts\` sans écrire) : paraphrase de règle là où seule la réf nue tient (et une paraphrase FAUSSE se vérifie au \`Source/\`), excuse sans tag entériné, pierre tombale, test qui verrouille un comportement faux. Chaque trouvaille porte son fichier:ligne et sa citation VERBATIM.`,
  },
  {
    label: 'derogations-et-ci',
    champs: ['derogations', 'runsCi'],
    consigne: `LENTILLE — DÉROGATIONS ET CI. Les dérogations servies sont celles de la FENÊTRE (le compte de celles d'ailleurs est dans \`derogations.horsFenetre\`). Chacune a-t-elle une raison réelle et une suite (le rouge dérogé a-t-il été corrigé ensuite) ? Chaque commit poussé a-t-il une CI verte, et un rouge laissé derrière est-il nommé quelque part ? Un push sur rouge non suivi de correctif est une trouvaille.`,
  },
  {
    label: 'commits-triviaux',
    champs: [],
    corpsDesCommits: true,
    consigne: `LENTILLE — COMMITS TRIVIAUX DE L'ORCHESTRATEUR. « Je ne code pas — même le trivial » : cherche dans la fenêtre les commits dont le contenu est du CODE écrit par l'orchestrateur plutôt que par un agent (retouches d'une ligne, correctifs de gate, ajustements de test), et les tests écrits pour faire passer plutôt que pour prouver.`,
  },
  {
    label: 'cross-os',
    champs: [],
    consigne: `LENTILLE — CROSS-OS ET DÉTERMINISME. Ce que la fenêtre ajoute tient-il hors de cette machine : chemins à barres inversées codés en dur, dépendance à la casse, encodage, horloge ou aléa dans un dérivé, ordre de listing du système de fichiers, sortie non déterministe d'un générateur ? Une sonde vaut mieux qu'un raisonnement.`,
  },
  {
    label: 'regime-de-vague',
    champs: [],
    consigne: `LENTILLE — RÉGIME. Le régime a-t-il tenu sur la fenêtre : un seul codeur par train, aucune écriture dans l'arbre principal pendant qu'un worktree travaille, pas de fan-out d'agents lourds en parallèle, une session par chantier, la todo de vague à jour ? Les traces sont dans les messages de commit, les worktrees et les dates.`,
  },
  {
    label: 'restes-de-la-revue-precedente',
    champs: ['revuePrecedente'],
    consigne: `LENTILLE — RESTES DE LA REVUE PRÉCÉDENTE. Le texte de la revue précédente est dans tes faits (\`revuePrecedente\`). Chaque item qu'elle a laissé PARTIEL ou ouvert a-t-il été soldé depuis ? Un reste qui traverse deux revues sans bouger est une trouvaille, et l'absence de revue précédente se dit.`,
  },
]

const LENTILLES_DE_REFUTATION = [
  ...DOD.map((clause, i) => ({
    label: `dod-${i + 1}`,
    champs: [],
    consigne: `LENTILLE — CLAUSE DE DoD n°${i + 1}, à RÉFUTER : « ${clause} ».
Pars du principe que la clause n'est PAS tenue et cherche la preuve de son échec dans le dépôt (le code, pas le rendu d'agent ni le message de commit). Une clause tenue va dans \`tenues\` avec la preuve qui l'établit ; une clause non tenue, ou tenue à moitié, est une trouvaille.`,
  })),
  {
    label: 'fermetures',
    champs: ['fermetures', 'fermeturesHorsCommit'],
    consigne: `LENTILLE — FERMETURES. Le lot ferme-t-il ce qu'il annonce fermer : chaque ticket cité est-il RÉELLEMENT soldé par le code de la fenêtre, et aucun ticket n'est-il fermé sans commit fermant ni solde ?`,
  },
  {
    label: 'hotfixes',
    champs: [],
    corpsDesCommits: true,
    consigne: `LENTILLE — HOTFIXES. La fenêtre contient-elle des correctifs qui rattrapent le lot lui-même (un rouge introduit puis réparé, une gate désarmée puis rarmée) ? Ils disent ce que le lot n'a pas tenu du premier coup et appartiennent à la revue.`,
  },
  {
    label: 'derogations',
    champs: ['derogations', 'runsCi'],
    consigne: `LENTILLE — DÉROGATIONS. Le lot a-t-il été poussé sous dérogation, et cette dérogation a-t-elle été soldée ?`,
  },
]

const LENTILLES = MODE === 'refutation' ? LENTILLES_DE_REFUTATION : LENTILLES_DE_PALIER
const parLabel = new Map(LENTILLES.map((l) => [l.label, l]))
log(`Mode ${MODE} : ${LENTILLES.length} lentille(s) — ${LENTILLES.map((l) => l.label).join(', ')}.`)
log(`Faits embarqués par lentille : ${LENTILLES.map((l) => `${l.label} ${faitsDe(l).length} car.`).join(' · ')} — JSON complet dans ${FAITS_CHEMIN}.`)

const rendus = (await parallel(LENTILLES.map((l) => () => agent(
  `${l.consigne}\n\n${CADRE}\n\n${faitsDe(l)}\n\nTu juges SEUL : les autres lentilles ne te sont pas montrées. \`trouvailles\` = ce qui est MATÉRIEL et prouvé (titre, preuve en fichier:ligne ou sortie de sonde, attendu en une phrase, sonde = le code EXACT si tu en as joué une) ; \`tenues\` = ce que tu as vérifié et qui tient, en une ligne chacune. Zéro trouvaille est un rendu valide.`,
  { label: l.label, phase: 'Lentilles', schema: LENTILLE, agentType: 'juge', model: 'opus' },
).then((r) => (r ? { ...r, lentille: l.label } : null))))).filter(Boolean)

let agentsJoues = rendus.length
log(`Phase Lentilles : ${rendus.length}/${LENTILLES.length} rendues (${LENTILLES.length - rendus.length} agent(s) mort(s) — leur angle n'est PAS jugé).`)

const normaliser = (t) => String(t ?? '')
  .toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/[^a-z0-9]+/g, ' ').trim()

const parTitre = new Map()
const tenues = []
for (const rendu of rendus) {
  for (const t of rendu.tenues || []) tenues.push(`${rendu.lentille} : ${t}`)
  for (const t of rendu.trouvailles || []) {
    const cle = normaliser(t.titre)
    if (!cle) continue
    if (parTitre.has(cle)) {
      const garde = parTitre.get(cle)
      log(`Trouvailles fusionnées sous « ${garde.titre} » (${garde.lentille}) : « ${t.titre} » (${rendu.lentille}), même titre normalisé « ${cle} » — sa preuve, son attendu et sa sonde rejoignent la première, rien n'est jeté.`)
      garde.preuve = `${garde.preuve}\n(lentille ${rendu.lentille}) ${t.preuve}`
      garde.attendu = `${garde.attendu}\n(lentille ${rendu.lentille}) ${t.attendu}`
      if (t.sonde) garde.sondes = [...(garde.sondes || []), t.sonde]
      continue
    }
    parTitre.set(cle, { ...t, lentille: rendu.lentille, sondes: t.sonde ? [t.sonde] : [] })
  }
}
const trouvaillesUniques = [...parTitre.values()]

// UN réfutateur par LENTILLE, pas par trouvaille : une réfutation par trouvaille faisait 36 agents
// sur une revue réelle (décision utilisateur 2026-09-05, « 36 agents de réfutation, quel violence »).
// L'auteur et le réfutateur restent DEUX agents distincts — c'est la contradiction qui vaut, pas le
// nombre. Au-delà du plafond, les trouvailles suivantes sont RETENUES et DITES : jamais un cap muet.
const TROUVAILLES_PAR_REFUTATEUR = 12
const parLentille = new Map()
for (const t of trouvaillesUniques) {
  if (!parLentille.has(t.lentille)) parLentille.set(t.lentille, [])
  parLentille.get(t.lentille).push(t)
}
const lots = [...parLentille].map(([lentille, toutes]) => ({
  lentille,
  jugees: toutes.slice(0, TROUVAILLES_PAR_REFUTATEUR),
  auDela: toutes.slice(TROUVAILLES_PAR_REFUTATEUR),
}))
log(`Phase Lentilles : ${trouvaillesUniques.length} trouvaille(s) distincte(s), ${tenues.length} tenue(s). ${agentsJoues} agents joués jusqu'ici.`)
log(`Réfutation : ${lots.length} agents pour ${trouvaillesUniques.length} trouvailles (plafond ${TROUVAILLES_PAR_REFUTATEUR} par réfutateur).`)
for (const lot of lots) {
  if (lot.auDela.length) log(`Lentille ${lot.lentille} : ${lot.auDela.length} trouvaille(s) AU-DELÀ du plafond — non réfutées, retenues telles quelles : ${lot.auDela.map((t) => t.titre).join(' · ')}.`)
}

// Aucune garde de budget ici : l'unité de `budget.remaining()` n'est pas mesurée sur ce dépôt (la
// comparer à un nombre d'agents ne mordrait jamais). Elle se posera avec un chiffre, après le premier
// banc qui donne le coût d'une réfutation.

const examinees = (await pipeline(lots, (lot) => agent(
  `RÉFUTATION — ${lot.jugees.length} trouvaille(s) rendue(s) par la lentille « ${lot.lentille} », qu'un AUTRE juge que leur auteur examine. Pars du principe que CHACUNE est FAUSSE et essaie de la réfuter sur pièces.

TROUVAILLES : ${JSON.stringify(lot.jugees, null, 1)}

${CADRE}

${faitsDe(parLabel.get(lot.lentille) || { label: lot.lentille, champs: [] })}

Rends UN verdict PAR trouvaille, dans \`verdicts\`, chacun portant le \`titre\` REÇU tel quel (c'est lui qui les apparie). confirmee = vrai seulement si la trouvaille est RÉELLE, MATÉRIELLE et ACTUELLE dans l'arbre jugé (re-mesure, ne te fie ni au titre ni à la preuve fournie) ; sinon confirmee = faux et \`preuve\` dit ce qui la réfute. bloquante = vrai si, la trouvaille tenant, elle invalide une FERMETURE ou un solde de la fenêtre — c'est toi qui poses cette marque, pas l'auteur de la trouvaille. Une trouvaille que tu n'examines pas est une trouvaille RETENUE : ne rends pas de verdict que tu n'as pas établi.`,
  { label: `refutation:${lot.lentille}`, phase: 'Réfutation', schema: VERDICTS, agentType: 'juge', model: 'opus' },
).then((v) => ({ lot, verdicts: (v && v.verdicts) || [] })))).filter(Boolean)

const agentsDeRefutation = examinees.length
agentsJoues += agentsDeRefutation

const confirmees = []
const refutees = []
for (const { lot, verdicts } of examinees) {
  const parTitreDuLot = new Map(verdicts.map((v) => [normaliser(v.titre), v]))
  for (const trouvaille of lot.jugees) {
    const verdict = parTitreDuLot.get(normaliser(trouvaille.titre))
    if (!verdict) {
      log(`Trouvaille « ${trouvaille.titre} » (${lot.lentille}) : aucun verdict rendu — elle est RETENUE sans marque bloquante (une réfutation absente n'écarte rien).`)
      confirmees.push({ ...trouvaille, bloquante: false, refutation: null })
      continue
    }
    if (verdict.confirmee) confirmees.push({ ...trouvaille, bloquante: Boolean(verdict.bloquante), refutation: verdict.preuve })
    else refutees.push({ ...trouvaille, refutation: verdict.preuve })
  }
  for (const trouvaille of lot.auDela) {
    confirmees.push({ ...trouvaille, bloquante: false, refutation: null, nonRefutee: `au-delà du plafond de ${TROUVAILLES_PAR_REFUTATEUR} trouvailles par réfutateur` })
  }
}

phase('Synthèse')

/** UNE seule plage `sha..sha` dans le texte : celle qui le NOMME, en 1re ligne. Les preuves écrivent
 *  « de X à Y » pour qu'aucun lecteur, humain ou `fenetreDeRevue`, n'ait deux fenêtres à départager. */
const sansPlage = (t) => String(t ?? '').replace(/\b([0-9a-f]{7,40})\.\.([0-9a-f]{7,40})\b/g, 'de $1 à $2')

const bloquantes = confirmees.filter((t) => t.bloquante)
const nonRefutees = confirmees.filter((t) => t.nonRefutee)
const verdict = bloquantes.length ? 'RÉFUTÉ' : confirmees.length ? 'PARTIEL' : 'CONFIRMÉ'
const banc = String((FAITS && FAITS.chainage) || '').startsWith('ignoré')

const lignesDeTrouvaille = confirmees.map((t, i) => sansPlage(
  `${i + 1}. ${t.bloquante ? '[bloquante] ' : ''}**${t.titre}** (lentille ${t.lentille}) — ${t.preuve} → attendu : ${t.attendu}${t.refutation ? ` · réfutation tentée : ${t.refutation}` : ''}${t.nonRefutee ? ` · NON RÉFUTÉE : ${t.nonRefutee}` : ''}`,
))
const lignesDEcart = refutees.map((t) => sansPlage(`- ~~${t.titre}~~ (lentille ${t.lentille}) — écartée : ${t.refutation}`))

const texte = MODE === 'refutation' ? null : [
  banc
    ? `# BANC — revue de palier REJOUÉE sur la fenêtre ${BASE}..${TETE} — ${DATE}`
    : `# Revue de palier — fenêtre ${BASE}..${TETE} — ${DATE}`,
  '',
  `verdict: ${verdict}`,
  ...(banc
    ? [`banc: chaînage ignoré (--sans-chainage) — fenêtre déjà jugée par ${((FAITS || {}).revuePrecedente || {}).chemin || 'une revue archivée'} ; ce texte est une MESURE, il ne s’archive pas.`]
    : []),
  '',
  `${LENTILLES.length} lentilles de juge lancées sur les faits de leur angle, ${rendus.length} rendues, ${trouvaillesUniques.length} trouvailles distinctes, ${confirmees.length} confirmées après réfutation, ${refutees.length} écartées, ${tenues.length} points vérifiés qui tiennent. ${agentsJoues} agents joués : ${rendus.length} de lentille, ${agentsDeRefutation} de réfutation (un par lentille à trouvailles, plafond ${TROUVAILLES_PAR_REFUTATEUR})${nonRefutees.length ? `, ${nonRefutees.length} trouvaille(s) NON RÉFUTÉE(S) au-delà du plafond` : ''}.`,
  '',
  '## Trouvailles confirmées',
  '',
  ...(lignesDeTrouvaille.length ? lignesDeTrouvaille : ['Aucune trouvaille n’a survécu à la réfutation.']),
  '',
  '## Écartées par réfutation',
  '',
  ...(lignesDEcart.length ? lignesDEcart : ['Aucune.']),
  '',
  '## Points tenus',
  '',
  ...(tenues.length ? tenues.map((t) => sansPlage(`- ${t}`)) : ['Aucun point n’a été rendu comme tenu.']),
  '',
].join('\n')

log(`Synthèse : ${verdict} — ${confirmees.length} confirmée(s) dont ${bloquantes.length} bloquante(s), ${refutees.length} écartée(s), ${agentsJoues} agents joués.${banc ? ' BANC : ce texte est une mesure, il ne s’archive pas.' : ' Le NOM de l’archive se calcule par `nomDArchiveDeRevue(texte)` chez l’orchestrateur, jamais ici.'}`)

return {
  mode: MODE,
  date: DATE,
  base: BASE,
  tete: TETE,
  banc,
  verdict,
  trouvailles: confirmees,
  refutees,
  tenues,
  agents: { lentilles: rendus.length, refutation: agentsDeRefutation, total: agentsJoues },
  texte,
}
