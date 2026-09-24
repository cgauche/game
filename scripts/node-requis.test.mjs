// Porte de version de Node (#1801) : la règle PURE, puis son CÂBLAGE de bout en bout sur un FAUX
// ARBRE en dossier temporaire — `package.json` `engines.node` y exige un Node inexistant, et les
// VRAIS `.npmrc`, `scripts/node-requis.mjs` et hooks shell y sont copiés : chaque porte doit refuser.
// `npm run gates` : l'import de tête de `scripts/gates/toutes.mjs`, que ce faux arbre ne porte pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { refusDeVersion } from './node-requis.mjs'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const HOOKS_REFUSANTS = ['pre-commit', 'commit-msg', 'pre-push']
const EXIGENCE_INTENABLE = '>=999.0.0'

test('refus : version inférieure sur le majeur, le mineur ou le correctif', () => {
  for (const version of ['21.99.99', '22.17.9', '22.18.0']) {
    assert.match(refusDeVersion('>=22.18.1', version), new RegExp(`Node ${version.replace(/\./g, '\\.')} .*« >=22\\.18\\.1 »`))
  }
})

test('accord : version égale ou supérieure, préfixe `v` et suffixe de pré-version tolérés', () => {
  for (const version of ['22.18.0', '22.18.1', '22.23.2', '23.0.0', 'v24.1.0', '25.0.0-nightly2026']) {
    assert.equal(refusDeVersion('>=22.18.0', version), null, version)
  }
})

test('plage absente ou hors forme `>=M.m.p` : refus qui la nomme', () => {
  for (const plage of [undefined, '^22.18.0', '>=22.18', '>=22.18.0 <23', '22.18.0']) {
    assert.match(refusDeVersion(plage, '22.23.2'), /forme `>=M\.m\.p`/, String(plage))
  }
})

/** Faux arbre : `package.json` à l'exigence intenable, `.npmrc` et porte réels, hooks shell réels. */
function fauxArbre() {
  const racine = mkdtempSync(join(tmpdir(), 'node-requis-'))
  mkdirSync(join(racine, 'scripts', 'git-hooks'), { recursive: true })
  writeFileSync(
    join(racine, 'package.json'),
    JSON.stringify({ name: 'faux-arbre', version: '0.0.0', engines: { node: EXIGENCE_INTENABLE }, scripts: { porte: 'node -e 0' } }),
  )
  copyFileSync(join(RACINE, '.npmrc'), join(racine, '.npmrc'))
  copyFileSync(join(RACINE, 'scripts', 'node-requis.mjs'), join(racine, 'scripts', 'node-requis.mjs'))
  for (const hook of HOOKS_REFUSANTS) {
    copyFileSync(join(RACINE, 'scripts', 'git-hooks', hook), join(racine, 'scripts', 'git-hooks', hook))
    writeFileSync(join(racine, 'scripts', 'git-hooks', `${hook}.mjs`), 'process.exit(0)\n')
  }
  return racine
}

/** Environnement sans ce que `npm run` pose à l'appelant (`npm_config_*` serait lu comme configuration). */
function envNu() {
  return Object.fromEntries(Object.entries(process.env).filter(([cle]) => !/^npm_/i.test(cle)))
}

const REFUS = new RegExp(`Node ${process.versions.node.replace(/\./g, '\\.')} ne satisfait pas package\\.json engines\\.node « ${EXIGENCE_INTENABLE} »`)

test('câblage `.npmrc` : `npm install` refuse le Node courant, exit 1, EBADENGINE', () => {
  const racine = fauxArbre()
  try {
    const r = spawnSync('npm', ['install', '--dry-run', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: racine,
      env: envNu(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    })
    assert.equal(r.status, 1, r.stdout + r.stderr)
    assert.match(r.stderr, new RegExp(`EBADENGINE[\\s\\S]*${EXIGENCE_INTENABLE.replace(/\./g, '\\.')}`))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('câblage des hooks shell : chaque porte git refuse avant son `.mjs`, exit 1', () => {
  const racine = fauxArbre()
  try {
    for (const hook of HOOKS_REFUSANTS) {
      const r = spawnSync('sh', [join('scripts', 'git-hooks', hook)], { cwd: racine, env: envNu(), encoding: 'utf8' })
      assert.equal(r.status, 1, `${hook} : ${r.stdout}${r.stderr}`)
      assert.match(r.stderr, REFUS, hook)
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
