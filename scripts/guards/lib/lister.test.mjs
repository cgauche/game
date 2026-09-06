// PORTE DE RÔLE du lecteur à ordre total (#1679 L3b, incident #1620) — trois volets, zéro stock.
//
//  (a) PROPRIÉTÉ  : `listerDossier` rend l'ordre des unités de code, quel que soit l'ordre de création.
//      EFFET      : `listerArbre` rend le MÊME tableau quel que soit l'ordre de création.
//      Sous NTFS la preuve est TRIVIALE (le système rend déjà un listing trié) ; c'est la CI, sur
//      ext4 (ordre d'un hash), qui la porte réellement. Le test est ici pour y être JOUÉ, pas pour
//      être vert sur cette machine.
//  (b) MUR        : toute racine du registre des générateurs (`GENERATORS` ∪ `NON_GENERATOR_CHECKS`,
//      `scripts/docs/build-all.mjs`) est SOUS un des globs `files:` du bloc « ordre total » de
//      `eslint.config.js` — les globs se LISENT depuis la config, jamais recopiés ici.
//  (c) CLÔTURE    : sur la clôture d'imports NON bornée de ces racines (`clotureDImports`, donc
//      `scripts/**` compris — `closureOf` est bornée à `src/` et ne verrait pas les libs de garde
//      atteintes par un générateur, dont `fieldConsumers.mjs`, le fichier de l'incident fondateur),
//      aucun module ne cite un des cinq noms de listing hors `lister.mjs`. Ce volet couvre ce que le
//      lint ne sait PAS exprimer : un module ATTEINT qui vit hors des globs du mur.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerDossier, listerArbre, parUnitesDeCode, parLibelle } from './lister.mjs'
import { clotureDImports } from './importGraph.mjs'
import { GENERATORS, NON_GENERATOR_CHECKS } from '../../docs/build-all.mjs'
import configEslint from '../../../eslint.config.js'

const RACINE_DEPOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '')

/** Les 5 portes de listing de `node:fs` que le mur ferme. */
const NOMS_DE_LISTING = ['readdirSync', 'readdir', 'opendirSync', 'opendir', 'globSync']
const RE_LISTING = new RegExp(`\\b(${NOMS_DE_LISTING.join('|')})\\b`)
const SOURCE_DU_LECTEUR = 'scripts/guards/lib/lister.mjs'

/** Le bloc « ordre total » de la config ESLint réelle, reconnu à son sélecteur de listing. */
function blocDuMur() {
  const bloc = configEslint.find((c) => {
    const regles = c?.rules?.['no-restricted-syntax']
    return Array.isArray(regles) && regles.some((r) => String(r?.selector ?? '').includes('readdirSync'))
  })
  assert.ok(bloc, 'bloc lint « ordre total » introuvable dans eslint.config.js (renommé ? sélecteur changé ?)')
  return bloc
}

/** Un glob ESLint de la forme `dossier/**` ou un chemin exact. */
const couvrePar = (glob) => {
  const motif = glob
    .split('/')
    .map((seg) => (seg === '**' ? '.*' : seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')))
    .join('/')
  return new RegExp(`^${motif}$`)
}

const racinesDuRegistre = () => [...new Set([...GENERATORS.map((g) => g.script), ...NON_GENERATOR_CHECKS])].sort()

// --- (a) PROPRIÉTÉ et EFFET -------------------------------------------------------------------

test('PROPRIÉTÉ — `listerDossier` rend l’ordre des unités de code, jamais celui de la création', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lister-'))
  try {
    // Pas deux noms qui ne diffèrent QUE par la casse : NTFS les confondrait (un seul fichier).
    for (const nom of ['z.md', 'b.md', 'A.md', '_x.md', 'c.md']) writeFileSync(join(dir, nom), '')
    // 'A'=0x41 < '_'=0x5F < 'b'=0x62 : l'ordre des unités de code, pas celui — insensible à la casse —
    // que NTFS rendrait ('_x.md', 'A.md', 'b.md', …).
    assert.deepEqual(listerDossier(dir), ['A.md', '_x.md', 'b.md', 'c.md', 'z.md'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('EFFET — `listerArbre` rend le MÊME tableau quel que soit l’ordre de création des entrées', () => {
  const poser = (ordre) => {
    const dir = mkdtempSync(join(tmpdir(), 'lister-'))
    for (const rel of ordre) {
      const parts = rel.split('/')
      if (parts.length > 1) mkdirSync(join(dir, ...parts.slice(0, -1)), { recursive: true })
      writeFileSync(join(dir, ...parts), '')
    }
    return dir
  }
  const chemins = ['b/z.ts', 'a.ts', 'b/a.ts', 'c.ts', 'b/c/d.ts']
  const d1 = poser(chemins)
  const d2 = poser([...chemins].reverse())
  try {
    assert.deepEqual(listerArbre(d1), ['a.ts', 'b/a.ts', 'b/c/d.ts', 'b/z.ts', 'c.ts'])
    assert.deepEqual(listerArbre(d2), listerArbre(d1))
  } finally {
    rmSync(d1, { recursive: true, force: true })
    rmSync(d2, { recursive: true, force: true })
  }
})

test('EFFET — `listerArbre` honore `filtre` (fichiers) et `descendre` (dossiers)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lister-'))
  try {
    mkdirSync(join(dir, 'node_modules'))
    writeFileSync(join(dir, 'node_modules', 'p.ts'), '')
    writeFileSync(join(dir, 'a.ts'), '')
    writeFileSync(join(dir, 'a.md'), '')
    assert.deepEqual(
      listerArbre(dir, { filtre: (r) => r.endsWith('.ts'), descendre: (r) => r !== 'node_modules' }),
      ['a.ts'],
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('`parLibelle` — alphabétique ACCENTS et CASSE ignorés, là où `parUnitesDeCode` les fait décider', () => {
  // Les trois désalphabétisations mesurées sur les docs routés par CLAUDE.md quand un libellé est trié
  // en unités de code : accent APRÈS la lettre nue, majuscule AVANT toute minuscule.
  assert.deepEqual(['Transformation', 'États'].sort(parLibelle), ['États', 'Transformation'])
  assert.deepEqual(['Transformation', 'États'].sort(parUnitesDeCode), ['Transformation', 'États'])
  assert.deepEqual(['Magie Mineure', 'Magie des Arcanes'].sort(parLibelle), ['Magie des Arcanes', 'Magie Mineure'])
  assert.deepEqual(['activityById', 'ACTIVITIES'].sort(parLibelle), ['ACTIVITIES', 'activityById'])
  assert.deepEqual(['zeta', 'ACTIVITIES'].sort(parLibelle), ['ACTIVITIES', 'zeta'])
  assert.deepEqual(['zeta', 'ACTIVITIES'].sort(parUnitesDeCode), ['ACTIVITIES', 'zeta'])
})

test('`parLibelle` — ordre TOTAL et DÉTERMINISTE : deux libellés de même clé sont départagés, jamais égaux', () => {
  // Sans le départage par unités de code brutes, « Béni » et « beni » seraient ÉGAUX : l'ordre
  // retomberait sur celui de l'entrée, c'est-à-dire sur la machine.
  assert.equal(parLibelle('Béni', 'beni') === 0, false)
  assert.equal(Math.sign(parLibelle('Béni', 'beni')), -Math.sign(parLibelle('beni', 'Béni')))
  const mots = ['beni', 'Béni', 'Bénédiction', 'Beni', 'États', 'Etats', 'zeta', 'ACTIVITIES']
  const attendu = [...mots].sort(parLibelle)
  assert.deepEqual([...mots].reverse().sort(parLibelle), attendu, 'l’ordre dépend encore de l’entrée : il n’est pas TOTAL')
  assert.deepEqual([...mots].sort(parUnitesDeCode).sort(parLibelle), attendu)
})

test('`absent` — `vide` rend `[]` sur un dossier absent, `lever` (défaut) lève', () => {
  const absent = join(tmpdir(), 'lister-absent-' + process.pid)
  assert.deepEqual(listerDossier(absent, { absent: 'vide' }), [])
  assert.throws(() => listerDossier(absent))
})

// --- (b) MUR : la portée du lint COUVRE le registre ---------------------------------------------

test('MUR — toute racine du registre des générateurs est sous un glob du bloc lint « ordre total »', () => {
  const globs = blocDuMur().files.map(couvrePar)
  const hors = racinesDuRegistre().filter((r) => !globs.some((re) => re.test(r)))
  assert.deepEqual(
    hors,
    [],
    `générateur N+1 hors du mur : ajoute son dossier au bloc « ordre total » de eslint.config.js —\n  ${hors.join('\n  ')}`,
  )
})

// --- (c) CLÔTURE : ce que le lint ne sait pas exprimer -------------------------------------------

test('CLÔTURE — aucun module atteint par une racine du registre ne liste un dossier hors `lister.mjs`', () => {
  const precedent = process.cwd()
  process.chdir(RACINE_DEPOT)
  let cloture
  try {
    cloture = [...clotureDImports(racinesDuRegistre())].sort()
  } finally {
    process.chdir(precedent)
  }
  // Contrôle de MESURE par DEUX témoins NOMMÉS, un de chaque côté de la frontière que ce volet existe
  // pour franchir : une lib de `scripts/` (ce que `closureOf`, bornée à `src/`, ne rend JAMAIS — et
  // c'est par là que l'incident #1620 est entré) et un module de `src/`. Jamais un SEUIL sur la
  // taille de la clôture : ce nombre est vivant, il se démode sans rien prouver.
  for (const temoin of ['scripts/guards/lib/fieldConsumers.mjs', 'src/data/index.ts']) {
    assert.ok(
      cloture.includes(temoin),
      `la clôture ne voit plus \`${temoin}\` : la marche ne mesure plus ce que ce volet doit couvrir`,
    )
  }

  const sites = []
  for (const rel of cloture) {
    if (rel === SOURCE_DU_LECTEUR) continue
    let texte
    try { texte = readFileSync(resolve(RACINE_DEPOT, rel), 'utf8') } catch { continue }
    texte.split('\n').forEach((ligne, i) => {
      if (RE_LISTING.test(ligne)) sites.push(`${rel}:${i + 1}: ${ligne.trim().slice(0, 140)}`)
    })
  }
  assert.deepEqual(
    sites,
    [],
    `listing hors du lecteur à ordre total (`
      + `passer par \`listerDossier\`/\`listerArbre\` de ${SOURCE_DU_LECTEUR}) :\n  ${sites.join('\n  ')}`,
  )
})
