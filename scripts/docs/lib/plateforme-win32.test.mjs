// Rendu sous win32 (#1801) : un générateur qui bâtit un chemin RELATIF par l'API de `node:path`
// rend un corps qui dépend de la plateforme. Le cas est fabriqué par une mutation EN MÉMOIRE (hook
// `load`, aucun fichier du dépôt touché), puis rendu par `build-all.mjs` sur l'arbre réel, en
// `--check` : vert sur un hôte POSIX, rouge rendu sous `--plateforme win32` et sous `--check --tout`.
// Sur un hôte win32, le rendu natif EST le rendu sous win32 : la mutation y rougit en natif, et le
// test le déclare.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url))
const BUILD_ALL = path.join(RACINE, 'scripts', 'docs', 'build-all.mjs')
const HOTE = process.platform

const donnee = (source) => `data:text/javascript,${encodeURIComponent(source)}`

/** `--import` qui mute `fichier` en mémoire : chaque `[avant, après]` doit s'appliquer, sinon le
 *  chargement échoue (une mutation qui ne mord pas ne prouve rien). */
function importMutation(fichier, remplacements) {
  const hook = [
    `const CIBLE = ${JSON.stringify(pathToFileURL(path.join(RACINE, fichier)).href)}`,
    `const REMPLACEMENTS = ${JSON.stringify(remplacements)}`,
    'export async function load(url, contexte, suivant) {',
    '  const r = await suivant(url, contexte)',
    '  if (url !== CIBLE) return r',
    '  let source = String(r.source)',
    '  for (const [avant, apres] of REMPLACEMENTS) {',
    '    const mutee = source.replace(avant, apres)',
    '    if (mutee === source) throw new Error(`mutation sans prise sur ${CIBLE} : ${avant}`)',
    '    source = mutee',
    '  }',
    '  return { ...r, source }',
    '}',
  ].join('\n')
  return `--import ${donnee(`import { register } from 'node:module'\nregister(${JSON.stringify(donnee(hook))})\n`)}`
}

/** `build-all.mjs --check --quiet <argv>` sur l'arbre réel, la mutation en `NODE_OPTIONS`. */
function verifier(argv, mutation) {
  const r = spawnSync(process.execPath, [BUILD_ALL, '--check', '--quiet', ...argv], {
    cwd: RACINE,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} ${mutation ?? ''}`.trim() },
  })
  return { status: r.status, sortie: `${r.stdout}${r.stderr}` }
}

const CAS = [
  {
    nom: '`listerArbre` joint par `join` — build-vocabulaire',
    script: 'scripts/docs/build-vocabulaire.mjs',
    mutation: importMutation('scripts/guards/lib/lister.mjs', [
      ['const enfant = rel ? `${rel}/${nom}` : nom', 'const enfant = rel ? join(rel, nom) : nom'],
    ]),
  },
  {
    nom: '`relatif` rendu par `relative` — reanchor',
    script: 'scripts/raw/reanchor.mjs',
    mutation: importMutation('scripts/raw/_lib.mjs', [
      ["import { dirname, join } from 'node:path'", "import { dirname, join, relative } from 'node:path'"],
      [
        'pages.push({ coeur, nom, relatif, chemin: join(rawDir, relatif), classe })',
        'pages.push({ coeur, nom, relatif: relative(rawDir, join(rawDir, relatif)), chemin: join(rawDir, relatif), classe })',
      ],
    ]),
  },
]

const ROUGE_WIN32 = (script) => `docs:check — ${script} — rendu sous win32 — corps périmé`
const ROUGE_NATIF = (script) => `docs:check — ${script} — corps périmé`
/** Le rouge qu'une mutation dépendante de la plateforme doit rendre sous win32, sur CET hôte. */
const ROUGE_ATTENDU = (script) => (HOTE === 'win32' ? ROUGE_NATIF(script) : ROUGE_WIN32(script))

for (const cas of CAS) {
  test(`rendu sous win32 — ${cas.nom} : sans mutation, vert sous win32`, (t) => {
    t.diagnostic(`hôte ${HOTE}`)
    const r = verifier(['--tout', '--plateforme', 'win32', '--only', cas.script])
    assert.equal(r.status, 0, r.sortie)
  })

  test(`rendu sous win32 — ${cas.nom} : muté, rouge sous win32, vert sur un hôte POSIX`, (t) => {
    const natif = verifier(['--tout', '--plateforme', HOTE, '--only', cas.script], cas.mutation)
    const win32 = verifier(['--tout', '--plateforme', 'win32', '--only', cas.script], cas.mutation)
    assert.equal(win32.status, 1, win32.sortie)
    assert.ok(win32.sortie.includes(ROUGE_ATTENDU(cas.script)), win32.sortie)
    if (HOTE === 'win32') {
      t.diagnostic('hôte win32 : le rendu natif EST le rendu sous win32, la mutation rougit aussi en natif')
      assert.equal(natif.status, 1, natif.sortie)
    } else {
      t.diagnostic(`hôte ${HOTE} : la mutation ne se voit que rendue sous win32`)
      assert.equal(natif.status, 0, natif.sortie)
    }
  })
}

test('`--check --tout` rend chaque générateur sur l\'hôte ET sous win32 : le rouge nomme sa plateforme', (t) => {
  const [cas] = CAS
  const r = verifier(['--tout', '--only', cas.script], cas.mutation)
  assert.equal(r.status, 1, r.sortie)
  assert.ok(r.sortie.includes(ROUGE_ATTENDU(cas.script)), r.sortie)
  if (HOTE === 'win32') t.diagnostic('hôte win32 : une seule passe, le rendu natif')
  else assert.ok(!r.sortie.includes(ROUGE_NATIF(cas.script)), r.sortie)
})

test('`--plateforme` inconnue : refus nommé, rien de rendu', () => {
  const r = verifier(['--plateforme', 'amiga'])
  assert.equal(r.status, 2, r.sortie)
  assert.match(r.sortie, /--plateforme « amiga » inconnue/)
})
