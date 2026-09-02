// Garde de la mémoire persistante : un en-tête de SUPERSESSION ajouté à une fiche part en `ask`,
// une RÉÉCRITURE au présent passe. Les cas SILENCE sont le cœur du test — le stock mesuré
// (2026-09-02 : 361 fiches, 84 touchées par un motif large, 4 lignes seulement en EN-TÊTE) dit
// qu'un motif trop large crierait sur du récit daté légitime.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { evaluate, enteteSupersession, lignesAjoutees, estFicheMemoire } from './memoire-tombale-guard.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HOOK = join(REPO, 'scripts', 'hooks', 'memoire-tombale-guard.mjs')
const FICHE = join(REPO, '.claude', 'memory', 'game-exemple.md')

const decision = (input, disque = '') => evaluate(input, () => disque)

test('CAS FONDATEUR : un en-tête « ⚠ SUPERSÉDÉ … » ajouté en Edit part en ask', () => {
  const d = decision({
    file_path: FICHE,
    old_string: 'La doctrine dit X.',
    new_string: '> ⚠ **SUPERSÉDÉ LE JOUR MÊME sur son cas (C)** — voir l’autre fiche.\n\nLa doctrine dit X.',
  })
  assert.equal(d?.decision, 'ask')
  assert.match(d.reason, /RÉÉCRIT au présent/)
  assert.match(d.reason, /SUPERSÉDÉ/)
})

test('les trois mots, avec ou sans ornements, en tête de ligne', () => {
  for (const ligne of ['SUPERSÉDÉ par la fiche voisine', '⚠ OBSOLÈTE depuis le 2026-08-01',
    '**PÉRIMÉ** : la mesure a changé', '- Périmés : les trois seuils', '> ## SUPERSEDEE par #1679']) {
    assert.notEqual(decision({ file_path: FICHE, old_string: '', new_string: ligne }), null, ligne)
  }
})

test('SILENCE : la RÉÉCRITURE au présent, que la règle prescrit', () => {
  assert.equal(decision({
    file_path: FICHE,
    old_string: 'La doctrine dit X.',
    new_string: 'La doctrine dit Y (arbitrage utilisateur 2026-09-02, verbatim en tête de fiche).',
  }), null)
})

test('SILENCE : les mots DANS une phrase (vécu daté légitime, 83 fiches mesurées)', () => {
  for (const ligne of ['Les trois seuils sont PÉRIMÉS depuis la mesure du 2026-09-01.',
    'Cette fiche SUPERSÈDE l’observation du 2026-07-11 sur son seul cas (C).',
    'Périmètre : les deux racines src/data et src/scenes.',
    'Le format obsolète y traînait encore, et personne ne le lisait.']) {
    assert.equal(decision({ file_path: FICHE, old_string: '', new_string: ligne }), null, ligne)
  }
})

test('SILENCE : `PORTÉ PAR <garde>` nomme le porteur actuel — une réécriture, pas une tombale', () => {
  assert.equal(decision({
    file_path: FICHE, old_string: '',
    new_string: '**SUPERSÉDÉ — PORTÉ PAR `scripts/hooks/memoire-tombale-guard.mjs` depuis 2026-09-02**',
  }), null)
})

test('SILENCE : le frontmatter, même quand le NOM de la fiche porte le mot', () => {
  const contenu = [
    '---',
    'name: game-presets-pnj-supersede-customstatblock',
    'description: les presets de PNJ supersèdent le CustomStatblock',
    '---',
    '',
    'Le préset porte la statblock.',
  ].join('\n')
  assert.equal(decision({ file_path: FICHE, content: contenu }, ''), null)
})

test('Write : seules les lignes NEUVES comptent (re-sauver une fiche ne redemande rien)', () => {
  const disque = 'Titre\n\n⚠ SUPERSÉDÉ par la fiche voisine.\n\nCorps.'
  assert.equal(decision({ file_path: FICHE, content: disque }, disque), null, 'aucune ligne ajoutée')
  assert.notEqual(decision({ file_path: FICHE, content: disque + '\n\nOBSOLÈTE : la mesure de 2026-08.' }, disque), null)
})

test('hors .claude/memory, et hors .md, le garde se tait', () => {
  assert.equal(decision({ file_path: join(REPO, 'docs', 'architecture.md'), content: 'SUPERSÉDÉ : x' }), null)
  assert.equal(decision({ file_path: join(REPO, '.claude', 'memory', 'index.json'), content: 'SUPERSÉDÉ' }), null)
  assert.equal(estFicheMemoire(FICHE), true)
  assert.equal(estFicheMemoire(join(REPO, 'docs', 'x.md')), false)
})

test('ctx_patch porte le texte en new_text/old_text', () => {
  const d = decision({ path: FICHE, old_text: 'Corps.', new_text: 'PÉRIMÉ — voir plus bas.\nCorps.' })
  assert.equal(d?.decision, 'ask')
})

test('unités : enteteSupersession / lignesAjoutees', () => {
  assert.match(enteteSupersession('> ⚠ **SUPERSÉDÉ** — voir X'), /SUPERSÉDÉ/)
  assert.equal(enteteSupersession('Le périmètre a changé'), null)
  assert.equal(enteteSupersession('rien de spécial'), null)
  assert.deepEqual(lignesAjoutees('a\nb\nc', 'a\nc').map((l) => l.texte), ['b'])
  assert.deepEqual(lignesAjoutees('---\nname: x\n---\nb', '').map((l) => l.texte), ['b'])
})

/** Décision RÉELLE du hook sur un payload d'outil (`null` s'il se tait). */
function decisionOf(tool_input) {
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input }), encoding: 'utf8', cwd: REPO,
  })
  assert.equal(run.status, 0, 'le hook a quitté en ' + run.status + ' : ' + run.stderr)
  if (!run.stdout.trim()) return null
  return JSON.parse(run.stdout).hookSpecificOutput.permissionDecision
}

test('DRIVER : le hook décide de bout en bout, et se tait sur une écriture ordinaire', () => {
  assert.equal(decisionOf({ file_path: FICHE, old_string: 'x', new_string: 'SUPERSÉDÉ : x' }), 'ask')
  assert.equal(decisionOf({ file_path: FICHE, old_string: 'x', new_string: 'La mesure du 2026-09-02 dit y.' }), null)
  assert.equal(decisionOf({ file_path: join(REPO, 'src', 'ui', 'App.tsx'), content: 'OBSOLÈTE' }), null)
})

test('les DEUX surfaces câblent le garde sur Write, Edit et ctx_patch', () => {
  for (const surface of ['.claude/settings.json', '.codex/hooks.json']) {
    const config = JSON.parse(readFileSync(join(REPO, surface), 'utf8'))
    const matchers = (config.hooks?.PreToolUse ?? [])
      .filter((e) => (e.hooks ?? []).some((h) => String(h.command ?? '').includes('memoire-tombale-guard.mjs')))
      .map((e) => String(e.matcher ?? ''))
    assert.ok(matchers.length > 0, surface + ' : hook non câblé')
    for (const canal of ['Write', 'Edit', 'mcp__lean-ctx__ctx_patch'])
      assert.ok(matchers.some((m) => m.split('|').includes(canal)), surface + ' : canal ' + canal + ' non matché')
  }
})
