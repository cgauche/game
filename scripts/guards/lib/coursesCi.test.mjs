// La lecture des courses CI de `main` : une union, un tri, un stub qui sert UNE LISTE PAR APPEL.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHAMPS, coursesCiDeMain, reinitialiserStub, triees } from './coursesCi.mjs'

const dossier = () => mkdtempSync(join(tmpdir(), 'courses-ci-'))
const jeter = (d) => rmSync(d, { recursive: true, force: true })

function stub(d, contenu) {
  reinitialiserStub()
  const fichier = join(d, 'gh.json')
  writeFileSync(fichier, JSON.stringify(contenu))
  return fichier
}

test('la commande porte la branche, le workflow, la limite et TOUS les champs des consommateurs', () => {
  let vus = null
  coursesCiDeMain({
    env: {},
    limit: 300,
    spawn: (cmd, args) => { vus = { cmd, args }; return { status: 0, stdout: '[]', stderr: '' } },
  })
  assert.equal(vus.cmd, 'gh')
  assert.deepEqual(vus.args, ['run', 'list', '--branch', 'main', '--workflow', 'ci.yml', '--limit', '300', '--json', CHAMPS])
  for (const champ of ['conclusion', 'createdAt', 'databaseId', 'headSha', 'status', 'workflowName'])
    assert.ok(CHAMPS.includes(champ), `${champ} manque : un consommateur lirait \`undefined\``)
})

test('`workflow: null` lit TOUS les workflows (les faits de palier en dépendent)', () => {
  let vus = null
  coursesCiDeMain({ env: {}, workflow: null, spawn: (cmd, args) => { vus = args; return { status: 0, stdout: '[]', stderr: '' } } })
  assert.ok(!vus.includes('--workflow'))
})

test('la sortie est TRIÉE par createdAt décroissant — `courses[0]` est la plus récente', () => {
  const lu = coursesCiDeMain({
    env: {},
    spawn: () => ({
      status: 0,
      stderr: '',
      stdout: JSON.stringify([
        { headSha: 'vieille', createdAt: '2026-08-30T09:00:00Z' },
        { headSha: 'recente', createdAt: '2026-09-05T11:00:00Z' },
      ]),
    }),
  })
  assert.deepEqual(lu.valeur.map((c) => c.headSha), ['recente', 'vieille'])
  assert.deepEqual(triees([{ a: 1 }, { a: 2 }]).map((c) => c.a), [1, 2], 'sans date, l’ordre servi est conservé')
})

test('gh muet, en échec ou illisible : INDISPONIBLE nommé, jamais une liste vide', () => {
  const muet = coursesCiDeMain({ env: {}, spawn: () => ({ error: new Error('spawnSync gh ENOENT'), status: null }) })
  assert.equal(muet.disponible, false)
  assert.match(muet.raison, /ENOENT/)

  const echec = coursesCiDeMain({ env: {}, spawn: () => ({ status: 4, stdout: '', stderr: 'gh: jeton expiré' }) })
  assert.equal(echec.disponible, false)
  assert.match(echec.raison, /jeton expiré/)

  const illisible = coursesCiDeMain({ env: {}, spawn: () => ({ status: 0, stdout: '{ tronqué', stderr: '' }) })
  assert.equal(illisible.disponible, false)
})

test('stub : un TABLEAU sert la même liste à chaque appel', () => {
  const d = dossier()
  try {
    const env = { WFRP_GH_STUB: stub(d, [{ headSha: 'a', createdAt: '2026-09-05T10:00:00Z' }]) }
    assert.deepEqual(coursesCiDeMain({ env }).valeur.map((c) => c.headSha), ['a'])
    assert.deepEqual(coursesCiDeMain({ env }).valeur.map((c) => c.headSha), ['a'])
  } finally { jeter(d) }
})

test('stub : `appels` sert UNE LISTE PAR APPEL, la dernière se répète (liste périmée puis relue)', () => {
  const d = dossier()
  try {
    const env = { WFRP_GH_STUB: stub(d, { appels: [[{ headSha: 'perimee' }], [{ headSha: 'fraiche' }]] }) }
    assert.deepEqual(coursesCiDeMain({ env }).valeur.map((c) => c.headSha), ['perimee'])
    assert.deepEqual(coursesCiDeMain({ env }).valeur.map((c) => c.headSha), ['fraiche'])
    assert.deepEqual(coursesCiDeMain({ env }).valeur.map((c) => c.headSha), ['fraiche'])
  } finally { jeter(d) }
})

test('stub illisible : INDISPONIBLE (le cas hors-ligne des fixtures)', () => {
  const d = dossier()
  try {
    const lu = coursesCiDeMain({ env: { WFRP_GH_STUB: join(d, 'jamais-ecrit.json') } })
    assert.equal(lu.disponible, false)
  } finally { jeter(d) }
})
