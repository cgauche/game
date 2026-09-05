// Justificatif de gates par contenu (#1679 L2/L3) — la fixture pose un VRAI dépôt jetable et de VRAIS
// commits : la clé est un `git hash-object`, un double injecté ne prouverait rien de ce que git rend.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import * as FS from 'node:fs'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CI_SEULEMENT,
  JOBS_HORS_JUSTIFICATIF,
  RAISON_CLE_COMPLETE,
  cheminJustificatifs,
  cleGouvernante,
  clesDeContenu,
  commandeEffective,
  ecrireJustificatif,
  estFichierDeJustificatif,
  fichierDeJustificatif,
  gatesRequises,
  horsCle,
  justificatifsSousDAutresCles,
  lireJustificatif,
  migrerAncienneGraphie,
  motifDeRefus,
  nomDeGate,
  nomDeJustificatif,
  perimetreSale,
  segmentDeGate,
  suiteComplete,
} from './justificatif.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

// Chemin de doc ASSEMBLÉ : un littéral `docs/<nom>.md` dans une fixture est lu par
// `scripts/docs/check-doc-refs.mjs` comme une référence vivante — qu'il déclare morte.
const DOC_A = ['docs', 'a.md'].join('/')

const git = (cwd) => (args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

/** Dépôt jetable : `src/`, `docs/` et `.claude/` peuplés, un premier commit. */
function depot() {
  const racine = mkdtempSync(join(tmpdir(), 'justificatif-'))
  const g = git(racine)
  g(['init', '--initial-branch=main'])
  g(['config', 'user.email', 'mesure@example.invalid'])
  g(['config', 'user.name', 'mesure'])
  ecrire(racine, 'src/a.ts', 'export const a = 1\n')
  ecrire(racine, DOC_A, 'doc\n')
  ecrire(racine, '.claude/memory/a.md', 'fiche\n')
  g(['add', '-A'])
  g(['commit', '-m', 'fondation'])
  return racine
}

function ecrire(racine, rel, texte) {
  mkdirSync(join(racine, dirname(rel)), { recursive: true })
  writeFileSync(join(racine, rel), texte)
}

const jeter = (racine) => rmSync(racine, { recursive: true, force: true })

test('`horsCle` : UNE liste — la clé et la mesure de saleté écartent exactement les mêmes chemins', () => {
  assert.deepEqual(
    [DOC_A, '.claude/memory/a.md', 'src/a.ts', 'scripts/a.mjs', 'package.json'].map(horsCle),
    [true, true, false, false, false],
  )
  const racine = depot()
  try {
    ecrire(racine, DOC_A, 'doc modifié\n')
    ecrire(racine, '.claude/memory/a.md', 'fiche modifiée\n')
    assert.deepEqual(perimetreSale({ cwd: racine }), [])
    ecrire(racine, 'src/a.ts', 'export const a = 2\n')
    assert.deepEqual(perimetreSale({ cwd: racine }), [' M src/a.ts'])
  } finally {
    jeter(racine)
  }
})

test('la clé de contenu ignore `docs/` et `.claude/`, et suit `src/`', () => {
  const racine = depot()
  const g = git(racine)
  try {
    const depart = clesDeContenu('HEAD', { cwd: racine }).cleTree
    ecrire(racine, DOC_A, 'doc régénéré\n')
    ecrire(racine, '.claude/memory/b.md', 'fiche neuve\n')
    g(['add', '-A'])
    g(['commit', '-m', 'docs seuls'])
    assert.notEqual(g(['rev-parse', 'HEAD']), g(['rev-parse', 'HEAD~1']))
    assert.equal(clesDeContenu('HEAD', { cwd: racine }).cleTree, depart, 'un commit docs-only garde la clé du parent')
    ecrire(racine, 'src/a.ts', 'export const a = 3\n')
    g(['add', '-A'])
    g(['commit', '-m', 'code'])
    assert.notEqual(clesDeContenu('HEAD', { cwd: racine }).cleTree, depart)
  } finally {
    jeter(racine)
  }
})

test('`clesDeContenu` rend les DEUX clés d’un même `git ls-tree` : la complète voit `docs/`, la partielle non', () => {
  const racine = depot()
  const g = git(racine)
  try {
    const avant = clesDeContenu('HEAD', { cwd: racine })
    for (const cle of [avant.cleTree, avant.cleComplete]) assert.match(cle, /^[0-9a-f]{40}$/)
    assert.notEqual(avant.cleTree, avant.cleComplete, 'deux périmètres, deux empreintes')
    ecrire(racine, DOC_A, 'doc régénéré\n')
    g(['add', '-A'])
    g(['commit', '-m', 'docs seuls'])
    const apres = clesDeContenu('HEAD', { cwd: racine })
    assert.equal(apres.cleTree, avant.cleTree, 'un commit docs-only ne change pas la clé partielle')
    assert.notEqual(apres.cleComplete, avant.cleComplete, 'il change la clé complète')
  } finally {
    jeter(racine)
  }
})

test('un fichier PAR (gate, clé gouvernante, propreté), sans fichier en cours d’écriture, capture portée', () => {
  const racine = depot()
  try {
    const sha = git(racine)(['rev-parse', 'HEAD'])
    const cles = clesDeContenu(sha, { cwd: racine })
    ecrireJustificatif({ cwd: racine, gate: 'test', sha, capture: 'node_modules/.cache/vitest-run-1.txt' })
    const { fichier } = ecrireJustificatif({ cwd: racine, gate: 'typecheck', sha })
    assert.deepEqual(
      readdirSync(join(cheminJustificatifs({ cwd: racine }), cles.cleTree)).sort(),
      [
        fichierDeJustificatif({ gate: 'test', cle: cles.cleTree, sale: false }),
        fichierDeJustificatif({ gate: 'typecheck', cle: cles.cleTree, sale: false }),
      ].sort(),
    )
    const vuTest = lireJustificatif({ cwd: racine, gate: 'test', cles })
    const vuTsc = lireJustificatif({ cwd: racine, gate: 'typecheck', cles })
    assert.equal(vuTest.capture, 'node_modules/.cache/vitest-run-1.txt')
    assert.equal(vuTsc.capture, undefined)
    assert.equal(vuTest.sale, false)
    assert.equal(vuTsc.cleComplete, cles.cleComplete)
    const { sale, ...contenuDuFichier } = vuTsc
    assert.equal(sale, false, 'la vue porte la propreté lue dans le NOM')
    assert.deepEqual(JSON.parse(readFileSync(fichier, 'utf8')), contenuDuFichier, 'la vue = le contenu + `sale`')
    assert.equal(lireJustificatif({ cwd: racine, gate: 'lint', cles }), null)
  } finally {
    jeter(racine)
  }
})

test('`lireJustificatif` LÈVE sans `gate` ou sans `cles` — un lecteur qui les oublie créditerait un autre contenu', () => {
  const racine = depot()
  try {
    const cles = clesDeContenu(git(racine)(['rev-parse', 'HEAD']), { cwd: racine })
    assert.throws(() => lireJustificatif({ cwd: racine, cles }), /`gate` est obligatoire/)
    assert.throws(() => lireJustificatif({ cwd: racine, gate: 'test' }), /clesDeContenu/)
    assert.throws(() => lireJustificatif({ cwd: racine, gate: 'test', cles: { cleTree: cles.cleTree } }), /clesDeContenu/)
  } finally {
    jeter(racine)
  }
})

// Le verdict d'un push régulier ne doit être destructible par aucun rejeu (revue de palier n°3,
// écart 1, ζ). Mesuré le 2026-09-03, avant le nom porteur : sous la clé de `b7227f7b5`, 5 gates
// portaient `sale:true` à des dates POSTÉRIEURES au push — la preuve du push avait été écrasée.
test('deux écrivains SIMULTANÉS : deux fichiers, et le lecteur rend le PROPRE quel que soit l’ordre', () => {
  for (const ordre of [[0, 1], [1, 0]]) {
    const racine = depot()
    try {
      const sha = git(racine)(['rev-parse', 'HEAD'])
      const cles = clesDeContenu(sha, { cwd: racine })
      // Les deux écritures se CHEVAUCHENT : leurs fichiers temporaires coexistent, et les deux
      // renommages sont posés dans l'ordre voulu.
      const renommages = []
      const fs = { ...FS, renameSync: (a, b) => renommages.push([a, b]) }
      ecrireJustificatif({ cwd: racine, gate: 'lint', sha, fs, date: '2026-09-05T10:00:00.000Z' })
      ecrire(racine, 'src/b.ts', 'export const b = 1\n')
      ecrireJustificatif({ cwd: racine, gate: 'lint', sha, fs, date: '2026-09-05T11:00:00.000Z' })
      assert.equal(renommages.length, 2)
      for (const i of ordre) FS.renameSync(...renommages[i])

      const dossier = join(cheminJustificatifs({ cwd: racine }), cles.cleTree)
      assert.deepEqual(
        readdirSync(dossier).sort(),
        [
          fichierDeJustificatif({ gate: 'lint', cle: cles.cleTree, sale: false }),
          fichierDeJustificatif({ gate: 'lint', cle: cles.cleTree, sale: true }),
        ].sort(),
        'deux verdicts DIFFÉRENTS ne partagent pas un fichier',
      )
      const vue = lireJustificatif({ cwd: racine, gate: 'lint', cles })
      assert.equal(vue.sale, false, `ordre ${ordre.join('→')} : le verdict PROPRE doit gagner`)
      assert.equal(vue.date, '2026-09-05T10:00:00.000Z', 'et garder la date du run qui l’a produit')
      assert.equal(motifDeRefus(vue, { nom: 'lint', commande: 'npm run lint' }), null)
    } finally {
      jeter(racine)
    }
  }
})

test('la PROPRETÉ est portée par le NOM : le contenu n’a plus de champ `sale`, il garde `salis`', () => {
  const racine = depot()
  try {
    ecrire(racine, 'src/b.ts', 'export const b = 1\n')
    const sha = git(racine)(['rev-parse', 'HEAD'])
    const cles = clesDeContenu(sha, { cwd: racine })
    const { fichier, salis } = ecrireJustificatif({ cwd: racine, gate: 'test', sha })
    const contenu = JSON.parse(readFileSync(fichier, 'utf8'))
    assert.equal('sale' in contenu, false, 'la propreté vit dans le NOM, pas dans le contenu')
    assert.equal('statut' in contenu, false, 'un justificatif n’existe qu’au vert : le statut n’a rien à dire')
    assert.deepEqual(contenu.salis, ['?? src/b.ts'])
    assert.deepEqual(salis, ['?? src/b.ts'])
    assert.equal(nomDeJustificatif(fichier.split(/[\\/]/).at(-1)).sale, true)
    const vue = lireJustificatif({ cwd: racine, gate: 'test', cles })
    assert.equal(vue.sale, true, 'la vue porte la propreté LUE DANS LE NOM')
    assert.match(motifDeRefus(vue, { nom: 'test', commande: 'npm test' }), /arbre SALE.*\?\? src\/b\.ts/)
  } finally {
    jeter(racine)
  }
})

test('`ecrireJustificatif` rend le fichier, les deux clés et les chemins salis — et rien d’autre', () => {
  const racine = depot()
  try {
    const sha = git(racine)(['rev-parse', 'HEAD'])
    const cles = clesDeContenu(sha, { cwd: racine })
    const rendu = ecrireJustificatif({ cwd: racine, gate: 'test', sha })
    assert.deepEqual(Object.keys(rendu).sort(), ['cleComplete', 'cleTree', 'fichier', 'salis'])
    assert.deepEqual([rendu.cleTree, rendu.cleComplete], [cles.cleTree, cles.cleComplete])
    assert.equal(
      rendu.fichier,
      join(cheminJustificatifs({ cwd: racine }), cles.cleTree, fichierDeJustificatif({ gate: 'test', cle: cles.cleTree, sale: false })),
    )
  } finally {
    jeter(racine)
  }
})

test('clé COMPLÈTE : chaque contenu a SON justificatif, et un contenu inconnu se distingue d’un jamais joué', () => {
  const racine = depot()
  const g = git(racine)
  try {
    const shaA = g(['rev-parse', 'HEAD'])
    const clesA = clesDeContenu(shaA, { cwd: racine })
    ecrireJustificatif({ cwd: racine, gate: 'docs:check', sha: shaA, date: '2026-09-05T10:00:00.000Z' })
    ecrire(racine, DOC_A, 'doc régénéré\n')
    g(['add', '-A'])
    g(['commit', '-m', 'docs seuls'])
    const clesB = clesDeContenu(g(['rev-parse', 'HEAD']), { cwd: racine })
    assert.equal(clesB.cleTree, clesA.cleTree, 'un commit docs-only garde la clé partielle')
    assert.notEqual(clesB.cleComplete, clesA.cleComplete, 'et change la clé complète')
    ecrireJustificatif({ cwd: racine, gate: 'docs:check', sha: 'HEAD', date: '2026-09-05T11:00:00.000Z' })

    assert.equal(lireJustificatif({ cwd: racine, gate: 'docs:check', cles: clesA }).date, '2026-09-05T10:00:00.000Z')
    assert.equal(lireJustificatif({ cwd: racine, gate: 'docs:check', cles: clesB }).date, '2026-09-05T11:00:00.000Z')

    const clesC = { cleTree: clesA.cleTree, cleComplete: 'c'.repeat(40) }
    assert.equal(lireJustificatif({ cwd: racine, gate: 'docs:check', cles: clesC }), null)
    assert.equal(justificatifsSousDAutresCles({ cwd: racine, gate: 'docs:check', cles: clesC }), true)
    assert.match(
      motifDeRefus(null, { nom: 'docs:check', commande: 'npm run docs:check' }, { autresCles: true }),
      /jouée sur un AUTRE arbre : elle lit docs\/[^\n]*— la rejouer : npm run docs:check/,
    )
    assert.match(
      motifDeRefus(null, { nom: 'docs:check', commande: 'npm run docs:check' }, { autresCles: false }),
      /jamais jouée/,
    )

    // MIROIR : pour une gate à clé PARTIELLE, la clé du nom EST celle du dossier — « un AUTRE
    // arbre » n'existe pas, par CONSTRUCTION, sans repli sur un « a été jouée » vague.
    ecrireJustificatif({ cwd: racine, gate: 'lint', sha: shaA })
    for (const cles of [clesA, clesB, clesC])
      assert.equal(justificatifsSousDAutresCles({ cwd: racine, gate: 'lint', cles }), false)
  } finally {
    jeter(racine)
  }
})

test('`cleGouvernante` : complète pour les gates qui lisent docs/ ou .claude/, partielle pour les autres', () => {
  const cles = { cleTree: 'a'.repeat(40), cleComplete: 'b'.repeat(40) }
  for (const nom of ['docs:check', 'docs:empreinte', 'test:docs', 'test:raw', 'test:hooks', 'agents:check']) {
    assert.equal(cleGouvernante(nom, cles), cles.cleComplete, `${nom} lit docs/ ou .claude/ : sa clé est l'arbre PLEIN`)
    assert.ok(RAISON_CLE_COMPLETE[nom], `${nom} doit porter sa raison, elle sert au refus`)
  }
  for (const nom of ['test', 'typecheck', 'lint', 'build', 'deps:unused'])
    assert.equal(cleGouvernante(nom, cles), cles.cleTree, `${nom} ne lit ni docs/ ni .claude/`)
})

test('un nom de justificatif porte la gate, la clé gouvernante et la propreté — et se relit', () => {
  const nom = fichierDeJustificatif({ gate: 'raw:check-code-refs', cle: 'd'.repeat(40), sale: true })
  assert.equal(nom, `raw%3Acheck-code-refs.${'d'.repeat(40)}.sale.json`)
  assert.ok(!nom.includes(':'), '« : » ouvre un flux de données alternatif sous NTFS')
  assert.deepEqual(nomDeJustificatif(nom), { gate: 'raw:check-code-refs', cle: 'd'.repeat(40), sale: true })
  assert.deepEqual(nomDeJustificatif(fichierDeJustificatif({ gate: 'lint', cle: 'e'.repeat(40), sale: false })), {
    gate: 'lint',
    cle: 'e'.repeat(40),
    sale: false,
  })
  for (const etranger of ['derogations.log', 'lint.json', 'docs%3Acheck.json', `lint.${'d'.repeat(40)}.propre.json.1234.en-cours`])
    assert.equal(estFichierDeJustificatif(etranger), false, `${etranger} n’est pas un justificatif de la graphie courante`)
  assert.equal(segmentDeGate('docs:check'), 'docs%3Acheck')
})

/** Ancienne graphie : UN fichier par gate, nommé `<segment>.json`, propreté et statut DANS le contenu. */
function poserAncienJustificatif(racine, { gate, cles, sale = false, statutAncien = 'vert', date = '2026-09-01T00:00:00.000Z' }) {
  const dossier = join(cheminJustificatifs({ cwd: racine }), cles.cleTree)
  mkdirSync(dossier, { recursive: true })
  const fichier = join(dossier, `${segmentDeGate(gate)}.json`)
  writeFileSync(
    fichier,
    `${JSON.stringify({ gate, cleTree: cles.cleTree, cleComplete: cles.cleComplete, sha: 'x'.repeat(40), statut: statutAncien, date, sale, salis: sale ? ['?? src/b.ts'] : [] }, null, 2)}\n`,
  )
  return fichier
}

test('MIGRATION : l’ancienne graphie est RENOMMÉE, les rouges effacés, l’illisible laissé et DIT', () => {
  const racine = depot()
  try {
    const cles = clesDeContenu(git(racine)(['rev-parse', 'HEAD']), { cwd: racine })
    poserAncienJustificatif(racine, { gate: 'lint', cles })
    poserAncienJustificatif(racine, { gate: 'docs:check', cles })
    poserAncienJustificatif(racine, { gate: 'test', cles, sale: true })
    poserAncienJustificatif(racine, { gate: 'typecheck', cles, statutAncien: 'rouge' })
    const dossier = join(cheminJustificatifs({ cwd: racine }), cles.cleTree)
    writeFileSync(join(dossier, 'build.json'), '{ pas du json\n')
    writeFileSync(join(cheminJustificatifs({ cwd: racine }), 'derogations.log'), 'une dérogation\n')

    const dits = []
    const bilan = migrerAncienneGraphie({ cwd: racine, journal: (t) => dits.push(t) })
    assert.deepEqual([bilan.renommes, bilan.effaces, bilan.illisibles.length], [3, 1, 1])
    assert.match(dits.join(''), /illisible\(s\), laissé\(s\) en place/)

    assert.deepEqual(readdirSync(dossier).sort(), [
      'build.json',
      fichierDeJustificatif({ gate: 'docs:check', cle: cles.cleComplete, sale: false }),
      fichierDeJustificatif({ gate: 'lint', cle: cles.cleTree, sale: false }),
      fichierDeJustificatif({ gate: 'test', cle: cles.cleTree, sale: true }),
    ].sort())

    // Les preuves survivent au renommage, et se relisent par la clé qui GOUVERNE chaque gate.
    assert.equal(lireJustificatif({ cwd: racine, gate: 'lint', cles }).date, '2026-09-01T00:00:00.000Z')
    assert.equal(lireJustificatif({ cwd: racine, gate: 'docs:check', cles }).sale, false)
    assert.equal(lireJustificatif({ cwd: racine, gate: 'test', cles }).sale, true, 'le `sale` du NOM, pas celui du contenu')
    assert.equal(lireJustificatif({ cwd: racine, gate: 'typecheck', cles }), null, 'un rouge ne survit à rien')
    assert.equal(
      readFileSync(join(cheminJustificatifs({ cwd: racine }), 'derogations.log'), 'utf8'),
      'une dérogation\n',
      'le journal de dérogations n’est pas un justificatif : la migration ne le touche pas',
    )

    // IDEMPOTENTE : un magasin déjà migré est un no-op.
    const empreinteAvant = readdirSync(dossier).sort().join('|')
    assert.deepEqual(migrerAncienneGraphie({ cwd: racine, journal: () => {} }).renommes, 0)
    assert.equal(readdirSync(dossier).sort().join('|'), empreinteAvant)
  } finally {
    jeter(racine)
  }
})

/**
 * Justificatifs PROPRES par dossier de clé. `graphie: 'toutes'` lit AUSSI l'ancienne (propreté et
 * statut dans le contenu) — c'est l'état AVANT ; `graphie: 'courante'` ne lit que les NOMS, comme
 * la production : une migration débranchée y rend 0.
 */
function propresParDossier(magasin, { graphie }) {
  const parDossier = new Map()
  for (const dossierCle of readdirSync(magasin)) {
    if (!/^[0-9a-f]{40}$/.test(dossierCle)) continue
    const gates = new Set()
    for (const nom of readdirSync(join(magasin, dossierCle))) {
      if (!nom.endsWith('.json')) continue
      const vu = nomDeJustificatif(nom)
      if (vu) {
        if (!vu.sale) gates.add(vu.gate)
        continue
      }
      if (graphie === 'courante') continue
      try {
        const contenu = JSON.parse(readFileSync(join(magasin, dossierCle, nom), 'utf8'))
        if (contenu.statut === 'vert' && contenu.sale !== true) gates.add(contenu.gate)
      } catch {
        /* illisible : compté nulle part, la migration le laisse en place */
      }
    }
    parDossier.set(dossierCle, gates)
  }
  return parDossier
}

const compterJson = (magasin) =>
  readdirSync(magasin)
    .filter((d) => /^[0-9a-f]{40}$/.test(d))
    .reduce((n, d) => n + readdirSync(join(magasin, d)).filter((f) => f.endsWith('.json')).length, 0)

test('MIGRATION : sur une COPIE du magasin RÉEL, aucune preuve n’est perdue', () => {
  const source = cheminJustificatifs({ cwd: REPO })
  const racine = depot()
  try {
    const magasin = join(racine, '.git', 'wfrp-justificatifs')
    rmSync(magasin, { recursive: true, force: true })
    cpSync(source, magasin, { recursive: true })
    const noms22 = gatesRequises({ cwd: REPO }).map((g) => g.nom)
    const avant = propresParDossier(magasin, { graphie: 'toutes' })
    const completsAvant = [...avant.values()].filter((gates) => noms22.every((n) => gates.has(n))).length
    const jsonAvant = compterJson(magasin)
    const derogations = join(magasin, 'derogations.log')
    const journalAvant = existsSync(derogations) ? readFileSync(derogations) : null

    const bilan = migrerAncienneGraphie({ cwd: racine, journal: () => {} })

    const apres = propresParDossier(magasin, { graphie: 'courante' })
    const completsApres = [...apres.values()].filter((gates) => noms22.every((n) => gates.has(n))).length
    assert.equal(
      completsApres,
      completsAvant,
      `dossiers ${noms22.length}/${noms22.length} : ${completsAvant} avant, ${completsApres} après — une preuve a disparu`,
    )
    assert.equal(compterJson(magasin), jsonAvant - bilan.effaces, 'seuls les rouges disparaissent')
    assert.deepEqual(bilan.illisibles, [])
    for (const [dossierCle, gates] of avant)
      assert.deepEqual([...gates].sort(), [...(apres.get(dossierCle) ?? new Set())].sort(), `dossier ${dossierCle}`)
    if (journalAvant !== null)
      assert.deepEqual(readFileSync(derogations), journalAvant, 'derogations.log intact, octet pour octet')
    assert.equal(migrerAncienneGraphie({ cwd: racine, journal: () => {} }).renommes, 0, 'idempotente')
  } finally {
    jeter(racine)
  }
})

test('refus nommés : gate absente, gate jouée sur un arbre sale', () => {
  assert.match(motifDeRefus(null, { nom: 'lint', commande: 'npm run lint' }), /jamais jouée.*npm run lint/)
  assert.match(
    motifDeRefus({ sale: true, salis: ['?? src/b.ts'] }, { nom: 'lint', commande: 'npm run lint' }),
    /arbre SALE \(\?\? src\/b\.ts\)/,
  )
  assert.equal(motifDeRefus({ sale: false }, { nom: 'lint', commande: 'x' }), null)
})

test('un run RESTREINT ne justifie rien — seule la suite complète le fait', () => {
  assert.equal(suiteComplete([], []), true)
  assert.equal(suiteComplete([], ['--maxWorkers=1']), true)
  assert.equal(suiteComplete([], ['--bail=1']), true, '--bail arrête au premier rouge : un run VERT a tout joué')
  assert.equal(suiteComplete(['src/a.test.ts'], ['src/a.test.ts']), false)
  for (const restreint of [
    ['--changed'],
    ['--changed=HEAD~1'],
    ['-t', 'dual wield'],
    ['--testNamePattern', 'X'],
    ['--shard=1/4'],
    ['--project', 'jsdom'],
    ['--dir', 'src/engine'],
    ['--related', 'src/a.ts'],
  ])
    assert.equal(suiteComplete([], restreint), false, `${restreint.join(' ')} restreint ce qui est joué`)
})

test('les gates exigées sont les steps RÉELS de ci.yml, le job `migrations` EXCLU avec sa raison', () => {
  const gates = gatesRequises({ cwd: REPO })
  const noms = gates.map((g) => g.nom)
  for (const attendu of ['test', 'typecheck', 'lint', 'docs:check', 'deps:unused'])
    assert.ok(noms.includes(attendu), `ci.yml joue ${attendu} : il doit être exigé au push (lues : ${noms.join(', ')})`)
  assert.equal(new Set(noms).size, noms.length, 'aucun doublon de gate')
  assert.ok(
    !noms.includes('migrations:replay'),
    'le rejeu des migrations réécrit src/data EN PLACE : il ne se joue pas sur un arbre de travail',
  )
  assert.deepEqual(gates.filter((g) => g.job === 'migrations'), [])
  assert.match(JOBS_HORS_JUSTIFICATIF.migrations, /EN PLACE.*#1613/)
  // Le job `fermetures` agit APRÈS la publication : il ne mesure rien du contenu poussé, et
  // l'exiger au push serait circulaire (il ne peut tourner qu'une fois le push fait).
  assert.deepEqual(gates.filter((g) => g.job === 'fermetures'), [])
  assert.match(JOBS_HORS_JUSTIFICATIF.fermetures, /APRÈS.*publication.*circulaire/s)
  assert.match(JOBS_HORS_JUSTIFICATIF.fermetures, /scripts\/ops\/fermer-depuis-main\.mjs/)
})

test('CARDINAL : les gates de ci.yml, et la part d’entre elles dont le nom porte un « : »', () => {
  // `segmentDeGate` encode le nom parce que `:` ouvre un flux de données alternatif sous NTFS —
  // le chiffre cité par son JSDoc se re-mesure ici, il ne se recopie pas.
  const noms = gatesRequises({ cwd: REPO }).map((g) => g.nom)
  assert.equal(noms.length, 22, `gates exigées : ${noms.join(', ')}`)
  assert.equal(noms.filter((n) => n.includes(':')).length, 18)
  for (const nom of noms)
    assert.ok(!segmentDeGate(nom).includes(':'), `${nom} : « : » est un flux ADS sous NTFS`)
})

test('un step d’une forme NON classée fait LEVER (fail-closed), et le message dit quoi faire', () => {
  const racine = mkdtempSync(join(tmpdir(), 'ci-yml-'))
  try {
    const fichier = join(racine, 'ci.yml')
    writeFileSync(
      fichier,
      ['name: CI', 'jobs:', '  build:', '    steps:', '      - run: npm test', '      - run: ./outil-maison.sh', ''].join('\n'),
    )
    assert.throws(() => gatesRequises({ fichier }), /step non classé : \.\/outil-maison\.sh.*CI_SEULEMENT/s)
    writeFileSync(fichier, ['name: CI', 'jobs:', '  build:', '    steps:', '      - run: npm ci', '      - run: npm run lint', ''].join('\n'))
    assert.deepEqual(gatesRequises({ fichier }).map((g) => g.nom), ['lint'])
    assert.ok('npm ci' in CI_SEULEMENT)
  } finally {
    jeter(racine)
  }
})

test('un step de ci.yml renommé change la liste des gates — la source est le fichier', () => {
  const racine = mkdtempSync(join(tmpdir(), 'ci-yml-'))
  try {
    const fichier = join(racine, 'ci.yml')
    writeFileSync(fichier, ['jobs:', '  build:', '    steps:', '      - run: npm run vigie', ''].join('\n'))
    assert.deepEqual(gatesRequises({ fichier }), [{ nom: 'vigie', commande: 'npm run vigie', job: 'build' }])
  } finally {
    jeter(racine)
  }
})

test('un step porteur d’un `if:` reste classé par sa ligne `run:`', () => {
  const racine = mkdtempSync(join(tmpdir(), 'ci-yml-'))
  try {
    const fichier = join(racine, 'ci.yml')
    writeFileSync(
      fichier,
      [
        'jobs:',
        '  build:',
        '    steps:',
        '      - id: install',
        '        run: npm ci',
        "      - if: ${{ !cancelled() && steps.install.outcome == 'success' }}",
        '        run: npm run lint',
        '      - name: Une gate nommée',
        "        if: ${{ !cancelled() && steps.install.outcome == 'success' }}",
        '        run: npm test',
        '',
      ].join('\n'),
    )
    assert.deepEqual(gatesRequises({ fichier }).map((g) => g.nom), ['lint', 'test'])
  } finally {
    jeter(racine)
  }
})

test('`nomDeGate` : `npm test` → test, `npm run x` → x, tout le reste → null', () => {
  assert.equal(nomDeGate('npm test'), 'test')
  assert.equal(nomDeGate('npm run docs:check'), 'docs:check')
  assert.equal(nomDeGate('npm ci'), null)
  assert.equal(nomDeGate('npm run gen && git diff --exit-code'), null)
  assert.equal(nomDeGate('npm --prefix server ci'), null)
})

test('`commandeEffective` rend la commande jouée sous l’enveloppe de justificatif', () => {
  const scripts = {
    typecheck: 'node scripts/gates/justifie.mjs typecheck -- npm run typecheck:brut',
    'typecheck:brut': 'node scripts/lancer-local.mjs typescript -- tsc --noEmit --incremental false',
    lint: 'node scripts/lancer-local.mjs eslint -- eslint .',
  }
  assert.equal(commandeEffective(scripts, 'typecheck'), scripts['typecheck:brut'])
  assert.equal(commandeEffective(scripts, 'lint'), scripts.lint)
  assert.equal(commandeEffective({ a: 'node scripts/gates/justifie.mjs a -- npm run a' }, 'a'), 'node scripts/gates/justifie.mjs a -- npm run a')
})

test('l’enveloppe de gate n’écrit RIEN au rouge, et propage le code de sortie', () => {
  const racine = mkdtempSync(join(tmpdir(), 'gate-rouge-'))
  try {
    const echoue = join(racine, 'echoue.mjs')
    writeFileSync(echoue, 'process.exit(3)\n')
    const vu = spawnSync(
      process.execPath,
      [join(REPO, 'scripts', 'gates', 'justifie.mjs'), 'gate-de-mesure-rouge', '--', 'node', echoue],
      { cwd: REPO, encoding: 'utf8', timeout: 60_000 },
    )
    assert.equal(vu.status, 3, 'le code de sortie de la commande est celui de l’enveloppe')
    // Contrat POSITIF sur le DISQUE : aucun fichier de cette gate, sous aucune clé ni propreté,
    // dans le dossier où un vert l'aurait posé.
    const dossier = join(cheminJustificatifs({ cwd: REPO }), clesDeContenu('HEAD', { cwd: REPO }).cleTree)
    const poses = (existsSync(dossier) ? readdirSync(dossier) : [])
      .map(nomDeJustificatif)
      .filter((n) => n?.gate === 'gate-de-mesure-rouge')
    assert.deepEqual(poses, [], 'une gate ROUGE ne laisse aucun justificatif')
  } finally {
    jeter(racine)
  }
})

test('ci.yml : chaque gate du job build porte la condition qui l’empêche d’être SKIPPÉE', () => {
  const texte = readFileSync(join(REPO, '.github', 'workflows', 'ci.yml'), 'utf8')
  const build = texte.slice(texte.indexOf('\n  build:'), texte.indexOf('\n  migrations:'))
  const gates = build.split('\n').filter((l) => /^\s*-?\s*run:/.test(l)).length - 1 // l'installation exclue
  const conditions = build.split('\n').filter((l) => l.includes("!cancelled() && steps.install.outcome == 'success'")).length
  assert.equal(
    conditions,
    gates,
    `${gates} gate(s) après l'installation, ${conditions} condition(s) : un step sans elle est SKIPPÉ dès qu'une gate précédente rougit, et son verdict est perdu (runs 33717131460, 33719038837)`,
  )
})

test('un step qui porte `working-directory` ou `env` LÈVE au lieu de créditer la gate racine', () => {
  const racine = mkdtempSync(join(tmpdir(), 'ci-yml-'))
  try {
    const fichier = join(racine, 'ci.yml')
    const cas = {
      'working-directory': ['      - working-directory: server', '        run: npm run lint'],
      env: ['      - env:', '          NODE_OPTIONS: --max-old-space-size=8192', '        run: npm run lint'],
    }
    for (const [cle, lignes] of Object.entries(cas)) {
      writeFileSync(fichier, ['jobs:', '  build:', '    steps:', ...lignes, ''].join('\n'))
      assert.throws(
        () => gatesRequises({ fichier }),
        new RegExp(`step non classé : npm run lint — il porte ${cle}`),
        `un step ${cle} joue AUTRE CHOSE que « npm run lint » : le créditer justifierait un push à tort`,
      )
    }
    writeFileSync(
      fichier,
      ['jobs:', '  build:', '    steps:', '      - name: Une gate nommée', '        id: x', '        run: npm run lint', ''].join('\n'),
    )
    assert.deepEqual(gatesRequises({ fichier }).map((g) => g.nom), ['lint'], '`name`/`id`/`if` sont inertes')
  } finally {
    jeter(racine)
  }
})

test('le nom de fichier d’une gate est légal sous Windows (le `:` y sépare un flux alternatif)', () => {
  const racine = depot()
  try {
    const sha = git(racine)(['rev-parse', 'HEAD'])
    const cles = clesDeContenu(sha, { cwd: racine })
    const { fichier } = ecrireJustificatif({ cwd: racine, gate: 'raw:check-code-refs', sha })
    assert.ok(!fichier.includes(':check'), `nom de fichier illégal sous NTFS : ${fichier}`)
    assert.equal(lireJustificatif({ cwd: racine, gate: 'raw:check-code-refs', cles }).gate, 'raw:check-code-refs')
  } finally {
    jeter(racine)
  }
})
