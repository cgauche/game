// Tests du wrapper `scripts/typecheck-fast.mjs` sur un FAUX dépôt (tmpdir + faux
// `node_modules/typescript/bin/tsc`) : le résumé imprimé doit lister TOUTES les erreurs (jamais un
// extrait) et ne jamais annoncer « 0 erreur(s) » quand le processus sort en échec.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const WRAPPER = join(REPO, 'scripts', 'typecheck-fast.mjs')

/** Faux dépôt : le wrapper copié + un `tsc` de substitution au chemin qu'il lance. */
function fauxDepot(sourceDuFauxTsc) {
  const base = mkdtempSync(join(tmpdir(), 'typecheck-fast-'))
  mkdirSync(join(base, 'scripts'), { recursive: true })
  copyFileSync(WRAPPER, join(base, 'scripts', 'typecheck-fast.mjs'))
  if (sourceDuFauxTsc !== null) {
    mkdirSync(join(base, 'node_modules', 'typescript', 'bin'), { recursive: true })
    writeFileSync(join(base, 'node_modules', 'typescript', 'bin', 'tsc'), sourceDuFauxTsc, 'utf8')
  }
  return base
}

function lance(base) {
  return spawnSync(process.execPath, [join(base, 'scripts', 'typecheck-fast.mjs')], {
    encoding: 'utf8',
    cwd: base,
  })
}

test('500 erreurs TS : toutes listées, entête exact, code de sortie propagé', () => {
  const base = fauxDepot(
    'for (let i = 1; i <= 500; i++) {\n' +
      "  process.stdout.write(`src/f${i}.ts(1,1): error TS2322: erreur numero ${i}\\n`)\n" +
      '}\n' +
      'process.exit(2)\n',
  )
  try {
    const run = lance(base)
    assert.equal(run.status, 2, `code de sortie non propagé : ${run.status}`)
    assert.match(run.stdout, /typecheck:fast — 500 erreur\(s\)/)
    const listees = run.stdout.split(/\r?\n/).filter((l) => /error TS\d+/.test(l))
    assert.equal(listees.length, 500, `${listees.length} lignes listées au lieu de 500`)
    assert.match(run.stdout, /src\/f500\.ts\(1,1\): error TS2322: erreur numero 500/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('échec SANS erreur TS : jamais « 0 erreur(s) », la sortie brute est rendue', () => {
  const base = fauxDepot('process.stderr.write("tsc: panne du compilateur\\n")\nprocess.exit(3)\n')
  try {
    const run = lance(base)
    assert.equal(run.status, 3)
    assert.ok(
      !/0 erreur\(s\)/.test(run.stdout),
      `résumé menteur : « 0 erreur(s) » avec un code ${run.status}\n${run.stdout}`,
    )
    assert.match(run.stdout, /ÉCHEC \(code 3\)/)
    assert.match(run.stdout, /panne du compilateur/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('tsc introuvable : la cause est imprimée, jamais un résumé vert', () => {
  const base = fauxDepot(null)
  try {
    const run = lance(base)
    assert.notEqual(run.status, 0)
    assert.ok(
      !/0 erreur\(s\)/.test(run.stdout),
      `résumé menteur sur tsc introuvable :\n${run.stdout}`,
    )
    assert.match(run.stdout, /ÉCHEC/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
