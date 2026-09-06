// Contrat de `docs:check` CIBLÉ (#1679 L2 T1d) : un générateur dont toutes les cibles portent un pied
// qui signe LES MÊMES SOURCES et LEUR PROPRE CORPS n'est pas rejoué. Tout le reste l'est, et le dit.
//   node --test scripts/docs/build-all-check.test.mjs  (chaîné dans `npm run test:docs`)
//
// Chaque cas tourne sur un DÉPÔT JETABLE avec des générateurs FICTIFS (patron
// `scripts/docs/lib/enregistreur-lectures.test.mjs`) : la fraîcheur se juge sur l'INDEX et le DISQUE,
// donc elle ne se mesure que dans un dépôt dont on tient les deux.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fraicheurDesGenerateurs, motifRejeuComplet, SOURCES_LUES } from './build-all.mjs'
import {
  avecPied,
  empreinteDuDisque,
  ignoresGit,
  indexGit,
  motifDeRejeu,
  retirerPied,
  serialiserSourcesLues,
  sha1Corps,
} from './lib/empreinte-sources.mjs'

const ICI = path.dirname(fileURLToPath(import.meta.url))

// Chemin de doc ASSEMBLÉ : un littéral `docs/<nom>.md` qui ne désigne AUCUN doc réel est lu par
// `scripts/docs/check-doc-refs.mjs` comme une référence vivante — qu'il déclare morte. Patron :
// `scripts/docs/lib/empreinte-sources.test.mjs`.
const doc = (nom) => ['docs', `${nom}.md`].join('/')
const DOC_A = doc('a')
const DOC_B = doc('b')

/** Trois générateurs FICTIFS : deux qui signent un doc, un qui n'injecte qu'un bloc. */
const GENERATEURS = [
  { runner: 'node', script: 'g/a.mjs', targets: [DOC_A] },
  { runner: 'node', script: 'g/b.mjs', targets: [DOC_B] },
  { runner: 'node', script: 'g/bloc.mjs', targets: [], injecte: ['MANUSCRIT.md'] },
]

const SOURCES = { 'g/a.mjs': ['src/a.ts'], 'g/b.mjs': ['src/b.ts'], 'g/bloc.mjs': ['src/a.ts'] }

/** Empreinte des sources d'un générateur, telle que le DISQUE les porte — ce que le pied signe. */
function empreinteDe(racine, script) {
  const lues = { fichiers: SOURCES[script], dossiers: new Map([['src', listerDossier(path.join(racine, 'src'))]]) }
  return empreinteDuDisque(racine, lues, new Set()).empreinte
}

/** Signe les cibles d'un générateur comme le ferait `docs:build`. */
function signer(racine, script) {
  const empreinte = empreinteDe(racine, script)
  for (const cible of GENERATEURS.find((g) => g.script === script).targets) {
    const chemin = path.join(racine, cible)
    writeFileSync(chemin, avecPied(readFileSync(chemin, 'utf8'), { empreinte, fichiers: 1, dossiers: 1 }))
  }
}

/** Dépôt jetable : deux sources, deux docs signés, un manuscrit, et le dérivé des sources mesurées. */
function depot() {
  const racine = mkdtempSync(path.join(tmpdir(), 'check-cible-'))
  const git = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8' })
  git('init', '-q')
  git('config', 'user.email', 'test@local')
  git('config', 'user.name', 'test')
  mkdirSync(path.join(racine, 'docs'))
  mkdirSync(path.join(racine, 'src'))
  writeFileSync(path.join(racine, 'src', 'a.ts'), 'export const a = 1\n')
  writeFileSync(path.join(racine, 'src', 'b.ts'), 'export const b = 1\n')
  writeFileSync(path.join(racine, 'docs', 'a.md'), '# a\n')
  writeFileSync(path.join(racine, 'docs', 'b.md'), '# b\n')
  writeFileSync(path.join(racine, 'MANUSCRIT.md'), '# manuscrit\n')
  signer(racine, 'g/a.mjs')
  signer(racine, 'g/b.mjs')
  writeFileSync(
    path.join(racine, SOURCES_LUES),
    serialiserSourcesLues({
      'g/a.mjs': { cibles: [DOC_A], fichiers: ['src/a.ts'], dossiers: ['src'] },
      'g/b.mjs': { cibles: [DOC_B], fichiers: ['src/b.ts'], dossiers: ['src'] },
      'g/bloc.mjs': { cibles: [], fichiers: ['src/a.ts'], dossiers: ['src'] },
    }),
  )
  git('add', '-A')
  return { racine, git }
}

/** La mesure de fraîcheur, telle que `--check` la joue. */
function mesurer(racine) {
  const lues = JSON.parse(readFileSync(path.join(racine, SOURCES_LUES), 'utf8'))
  return fraicheurDesGenerateurs(racine, indexGit(racine), lues, ignoresGit(racine), GENERATEURS)
}

test('tout frais : aucun générateur signé n’est rejoué', () => {
  const { racine } = depot()
  try {
    const { frais, motifs } = mesurer(racine)
    assert.deepEqual([...frais.keys()].sort(), ['g/a.mjs', 'g/b.mjs'])
    // Celui qui n'injecte qu'un bloc n'a aucune cible signée : rien n'est jugeable, il est rejoué.
    assert.deepEqual([...motifs.keys()], ['g/bloc.mjs'])
    assert.match(motifs.get('g/bloc.mjs'), /aucune cible signée/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('une source modifiée et STAGÉE sans régénération : SEUL son générateur est rejoué', () => {
  const { racine, git } = depot()
  try {
    writeFileSync(path.join(racine, 'src', 'a.ts'), 'export const a = 2\n')
    git('add', 'src/a.ts')
    const { frais, motifs } = mesurer(racine)
    assert.deepEqual([...frais.keys()], ['g/b.mjs'], 'le générateur intact doit rester frais')
    assert.ok(motifs.has('g/a.mjs'), 'le générateur dont une source a bougé doit être rejoué')
    // Stagée, la source est la MÊME au disque et à l'index : c'est le PIED du doc, signé avant la
    // modification, qui dénonce le décalage.
    assert.match(motifs.get('g/a.mjs'), new RegExp(`^${DOC_A} : sources [0-9a-f]{12} au pied, [0-9a-f]{12} mesurées$`))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('une source modifiée et NON stagée est rejouée aussi (le disque est ce que le générateur lirait)', () => {
  const { racine } = depot()
  try {
    writeFileSync(path.join(racine, 'src', 'b.ts'), 'export const b = 99\n')
    const { frais, motifs } = mesurer(racine)
    assert.deepEqual([...frais.keys()], ['g/a.mjs'])
    assert.ok(motifs.has('g/b.mjs'), 'une source modifiée hors index laisserait un doc périmé « frais »')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un doc dérivé ÉDITÉ À LA MAIN : corps divergent, donc rejoué — ses sources n’ont pas bougé', () => {
  const { racine, git } = depot()
  try {
    const cible = path.join(racine, DOC_A)
    const avant = readFileSync(cible, 'utf8')
    // Le pied est CONSERVÉ à l'octet : seul le corps change. Aucune source n'a bougé.
    writeFileSync(cible, avant.replace('# a\n', '# a\n\nligne ajoutée à la main\n'))
    git('add', DOC_A)
    const { frais, motifs } = mesurer(racine)
    assert.deepEqual([...frais.keys()], ['g/b.mjs'])
    assert.match(motifs.get('g/a.mjs'), /corps divergent \(pied [0-9a-f]{12}, doc [0-9a-f]{12}\)/)
    assert.match(motifs.get('g/a.mjs'), /édité hors de son générateur/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un pied de la graphie SANS « corps: » est traité comme non signé : rejoué', () => {
  const { racine, git } = depot()
  try {
    const cible = path.join(racine, DOC_A)
    const texte = readFileSync(cible, 'utf8')
    const ancien = texte.replace(/ corps: [0-9a-f]{40} -->/, ' -->')
    assert.notEqual(ancien, texte, 'la fixture n’a pas retiré le champ corps')
    writeFileSync(cible, ancien)
    git('add', DOC_A)
    const { motifs } = mesurer(racine)
    assert.match(motifs.get('g/a.mjs'), /pied sans « corps: »/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un doc absent du disque est rejoué, jamais tenu pour frais', () => {
  const { racine } = depot()
  try {
    rmSync(path.join(racine, 'docs', 'a.md'))
    const { frais, motifs } = mesurer(racine)
    assert.deepEqual([...frais.keys()], ['g/b.mjs'])
    assert.match(motifs.get('g/a.mjs'), new RegExp(`^${DOC_A} : absent du disque$`))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('FAIL-CLOSED : sans le dérivé des sources au commit, ou s’il diverge, on rejoue TOUT', () => {
  assert.match(motifRejeuComplet(null, '{}\n'), /n'est pas dans l'index/)
  assert.match(motifRejeuComplet('{}\n', '{"a":1}\n'), /du disque diffère de celui de l'index/)
  assert.equal(motifRejeuComplet('{}\n', '{}\n'), null)
  assert.ok(motifRejeuComplet(null, null).includes(SOURCES_LUES), 'le refus doit NOMMER le dérivé manquant')
})

test('motifDeRejeu : les deux moitiés de la signature sont NÉCESSAIRES', () => {
  const signe = avecPied('# doc\n', { empreinte: 'a'.repeat(40), fichiers: 1, dossiers: 1 })
  assert.equal(motifDeRejeu(signe, 'a'.repeat(40)), null, 'sources et corps concordent : frais')
  assert.match(motifDeRejeu(signe, 'b'.repeat(40)), /sources aaaaaaaaaaaa au pied, bbbbbbbbbbbb mesurées/)
  assert.match(motifDeRejeu('# doc\n', 'a'.repeat(40)), /sans pied/)
  // Le corps signé est bien celui du doc SANS son pied.
  assert.equal(retirerPied(signe), '# doc\n')
  assert.ok(signe.includes(`corps: ${sha1Corps(signe)}`))
})

test('le mode `--check` de build-all.mjs PASSE par ces deux décideurs', () => {
  const source = readFileSync(path.join(ICI, 'build-all.mjs'), 'utf8')
  assert.match(source, /const complet = motifRejeuComplet\(auCommit\(cwd, SOURCES_LUES\), surDisque\)/)
  assert.match(source, /fraicheurDesGenerateurs\(cwd, indexGit\(cwd\), lireSourcesLues\(cwd\), ignores\)/)
  assert.match(source, /if \(frais\.has\(g\.script\)\) \{/, 'la boucle doit SAUTER un générateur frais')
  assert.match(source, /if \(check && !tout\)/, '`--tout` doit court-circuiter la fraîcheur')
})
