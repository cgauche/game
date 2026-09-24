// Porte de version de Node (#1801) : la règle PURE, puis son CÂBLAGE dans chaque point d'entrée qui
// rend un verdict. `.npmrc` et les hooks shell de `scripts/git-hooks/` se jouent de bout en bout sur un
// FAUX ARBRE en dossier temporaire — `package.json` `engines.node` y exige un Node inexistant, et les
// VRAIS `.npmrc`, `scripts/node-requis.mjs` et hooks shell y sont copiés. `npm run gates` se juge sur l'AST de
// `scripts/gates/toutes.mjs`, dont les imports ne se copient pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scriptKindDe, typescript } from './guards/lib/dialecte.mjs'
import { listerDossier } from './guards/lib/lister.mjs'
import { refusDeVersion } from './node-requis.mjs'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const DOSSIER_HOOKS = join(RACINE, 'scripts', 'git-hooks')
/** Les hooks shell : chaque fichier de `scripts/git-hooks/` sans extension. */
const HOOKS_SHELL = listerDossier(DOSSIER_HOOKS).filter((f) => !f.includes('.'))
/** githooks(5) : un hook `post-*` ne peut pas faire échouer l'opération qui vient d'avoir lieu. */
const estPostHook = (hook) => hook.startsWith('post-')
/** Les `.mjs` qu'un hook shell lance à côté de lui, `"$(dirname "$0")/<nom>.mjs"`. */
const modulesDuHook = (texte) => [...texte.matchAll(/"\$\(dirname "\$0"\)\/([\w-]+\.mjs)"/g)].map((m) => m[1])
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

/** Faux arbre : `package.json` à l'exigence intenable, `.npmrc`, porte et hooks shell réels. Chaque
 *  `.mjs` qu'un hook shell lance est un TÉMOIN qui dépose `TEMOIN-<nom>` à la racine s'il tourne. */
function fauxArbre() {
  const racine = mkdtempSync(join(tmpdir(), 'node-requis-'))
  mkdirSync(join(racine, 'scripts', 'git-hooks'), { recursive: true })
  writeFileSync(
    join(racine, 'package.json'),
    JSON.stringify({ name: 'faux-arbre', version: '0.0.0', engines: { node: EXIGENCE_INTENABLE }, scripts: { porte: 'node -e 0' } }),
  )
  copyFileSync(join(RACINE, '.npmrc'), join(racine, '.npmrc'))
  copyFileSync(join(RACINE, 'scripts', 'node-requis.mjs'), join(racine, 'scripts', 'node-requis.mjs'))
  for (const hook of HOOKS_SHELL) {
    const texte = readFileSync(join(DOSSIER_HOOKS, hook), 'utf8')
    writeFileSync(join(racine, 'scripts', 'git-hooks', hook), texte)
    const modules = modulesDuHook(texte)
    assert.ok(modules.length, `${hook} ne lance aucun \`.mjs\` lisible : le témoin ne prouverait rien`)
    for (const module of modules) {
      writeFileSync(
        join(racine, 'scripts', 'git-hooks', module),
        `import { writeFileSync } from 'node:fs'\nwriteFileSync(new URL('../../TEMOIN-${module}', import.meta.url), '')\n`,
      )
    }
  }
  return racine
}

const temoins = (racine) => listerDossier(racine).filter((f) => f.startsWith('TEMOIN-'))

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

test('câblage des hooks shell de `scripts/git-hooks/` : chacun refuse AVANT son `.mjs` — exit 1, ou 0 pour un `post-*`', () => {
  const racine = fauxArbre()
  try {
    for (const hook of HOOKS_SHELL) {
      // `rebase` : le seul `$1` qui fasse agir post-rewrite ; les autres hooks refusent avant de le lire.
      const r = spawnSync('sh', [join('scripts', 'git-hooks', hook), 'rebase'], { cwd: racine, env: envNu(), encoding: 'utf8' })
      assert.equal(r.status, estPostHook(hook) ? 0 : 1, `${hook} : ${r.stdout}${r.stderr}`)
      assert.match(r.stderr, REFUS, hook)
    }
    assert.deepEqual(temoins(racine), [], 'un module de hook a tourné sous un Node refusé')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('câblage de `npm run gates` : la PREMIÈRE requête de module de `scripts/gates/toutes.mjs` est la porte', () => {
  const ts = typescript()
  const chemin = join(RACINE, 'scripts', 'gates', 'toutes.mjs')
  const source = ts.createSourceFile(chemin, readFileSync(chemin, 'utf8'), ts.ScriptTarget.Latest, true, scriptKindDe(chemin))
  const premiere = source.statements.find((s) => (ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) && s.moduleSpecifier)
  assert.equal(premiere?.moduleSpecifier.text, '../node-requis.mjs')
  assert.equal(premiere.importClause, undefined, 'la porte s’importe pour son seul effet d’évaluation')
})
