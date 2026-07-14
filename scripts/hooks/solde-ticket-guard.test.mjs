// Test du hook `solde-ticket-guard` (node --test) : la fermeture de ticket au commit exige un
// SOLDE écrit conforme, avec sa propre réfutation adversariale, et respecte le palier de revue
// adversariale (demande 2026-07-14). Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractClosedIssues,
  validateSolde,
  validateRevuePalier,
  evaluate,
  extractRefIssues,
  validateRefFile,
  evaluateAntiEsquive,
  analyzeStagedDiff,
} from './solde-ticket-guard.mjs'

const TODAY = '2026-07-14'
const VERIFIE_OK = 'VERIFIE: relu le diff complet, lancé npm test et vérifié les 3 fichiers touchés à la main.'
const REFUTATION_OK = 'Un juge adversarial a rejoué le diff contre le DoD du ticket, tenté 2 contournements, aucun ne passe.'

const solde = ({ restes = 'RAS', verdict = 'CONFIRMÉ', date = TODAY } = {}) =>
  `${VERIFIE_OK}\n\n## Restes\n${restes}\n\n## Réfutation\nverdict: ${verdict}\n${REFUTATION_OK}\n\n(${date})\n`

// ── extractClosedIssues ──────────────────────────────────────────────────────────────────────────
test('extractClosedIssues : mono-fermeture', () => {
  assert.deepEqual(extractClosedIssues('git commit -m "corrige #42"'), [42])
})

test('extractClosedIssues : multi-fermeture dédupliquée/triée', () => {
  assert.deepEqual(extractClosedIssues('git commit -m "fixes #10 and closes #3, ferme #10"'), [3, 10])
})

test('extractClosedIssues : here-string / heredoc PowerShell/bash', () => {
  const cmd = 'git commit -m @\'\nfeat: truc\n\ncorrige #7\n\'@'
  assert.deepEqual(extractClosedIssues(cmd), [7])
})

test('extractClosedIssues : aucun mot-clef → vide', () => {
  assert.deepEqual(extractClosedIssues('git commit -m "wip sur #7"'), [])
})

test('extractClosedIssues : pas un commit → vide même avec mot-clef', () => {
  assert.deepEqual(extractClosedIssues('git log --grep "corrige #7"'), [])
})

// ── validateSolde ─────────────────────────────────────────────────────────────────────────────────
test('validateSolde : conforme (RAS, verdict CONFIRMÉ)', () => {
  const r = validateSolde(solde(), TODAY)
  assert.equal(r.ok, true, r.problems.join(' ; '))
  assert.equal(r.refuted, false)
})

test('validateSolde : conforme (items avec dispositions variées, verdict PARTIEL)', () => {
  const restes = [
    '- perf du picker signalée par l\'agent -> #512',
    '- typo doc trouvée en route -> corrigé dans ce commit',
    '- flakiness test réseau -> RAS : reproduit hors périmètre, déjà connu (#490)',
  ].join('\n')
  const r = validateSolde(solde({ restes, verdict: 'PARTIEL' }), TODAY)
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateSolde : verdict sans accent accepté (CONFIRME/REFUTE)', () => {
  assert.equal(validateSolde(solde({ verdict: 'CONFIRME' }), TODAY).ok, true)
})

test('validateSolde : fichier absent', () => {
  const r = validateSolde(null, TODAY)
  assert.equal(r.ok, false)
  assert.deepEqual(r.problems, ['fichier absent'])
})

test('validateSolde : ligne VERIFIE absente', () => {
  const content = solde().replace(`${VERIFIE_OK}\n\n`, '')
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /VERIFIE.*absente/)
})

test('validateSolde : VERIFIE trop court', () => {
  const content = solde().replace(VERIFIE_OK, 'VERIFIE: relu vite fait.')
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /trop court/)
})

test('validateSolde : section Restes absente', () => {
  const content = `${VERIFIE_OK}\n\n## Réfutation\nverdict: CONFIRMÉ\n${REFUTATION_OK}\n\n(${TODAY})\n`
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /"## Restes" absente/)
})

test('validateSolde : item sans disposition', () => {
  const content = solde({ restes: '- un souci vu par l\'agent, sans suite précisée' })
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /sans disposition valide/)
})

test('validateSolde : section Réfutation absente', () => {
  const content = `${VERIFIE_OK}\n\n## Restes\nRAS\n\n(${TODAY})\n`
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /"## Réfutation" absente/)
})

test('validateSolde : verdict RÉFUTÉ → refused=true, deny explicite', () => {
  const r = validateSolde(solde({ verdict: 'RÉFUTÉ' }), TODAY)
  assert.equal(r.ok, false)
  assert.equal(r.refuted, true)
  assert.match(r.problems.join(' ; '), /un ticket réfuté ne se ferme pas/)
})

test('validateSolde : verdict REFUTE sans accent → refused=true', () => {
  assert.equal(validateSolde(solde({ verdict: 'REFUTE' }), TODAY).refuted, true)
})

test('validateSolde : ligne verdict absente dans Réfutation', () => {
  const content = solde().replace('verdict: CONFIRMÉ\n', '')
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /ligne "verdict/)
})

test('validateSolde : Réfutation trop maigre', () => {
  const content = solde().replace(REFUTATION_OK, 'ok.')
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /"## Réfutation" trop maigre/)
})

test('validateSolde : date du jour absente', () => {
  const content = solde().replace(`(${TODAY})\n`, '')
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /date du jour/)
})

test('validateSolde : date d\'un autre jour ne compte pas (anti-réchauffé)', () => {
  const content = solde({ date: '2026-06-01' })
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /date du jour/)
})

// ── validateRevuePalier ──────────────────────────────────────────────────────────────────────────
const revuePalier = ({ verdict = 'CONFIRMÉ', date = TODAY, synth = 'A'.repeat(90) } = {}) =>
  `verdict: ${verdict}\n${synth}\n\n(${date})\n`

test('validateRevuePalier : conforme', () => {
  const r = validateRevuePalier(revuePalier(), TODAY)
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateRevuePalier : fichier absent', () => {
  assert.equal(validateRevuePalier(null, TODAY).ok, false)
})

test('validateRevuePalier : synthèse trop maigre', () => {
  const r = validateRevuePalier(revuePalier({ synth: 'trop court' }), TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /trop maigre/)
})

test('validateRevuePalier : date absente', () => {
  const r = validateRevuePalier(`verdict: CONFIRMÉ\n${'A'.repeat(90)}\n`, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /date du jour/)
})

// ── evaluate (intégration pure, readSolde/readRevuePalier injectés) ────────────────────────────────
test('evaluate : sans mot-clef de fermeture → silence total', () => {
  const d = evaluate({ command: 'git commit -m "wip"', today: TODAY, readSolde: () => { throw new Error('ne doit pas être appelé') } })
  assert.equal(d, null)
})

test('evaluate : solde conforme, palier <10 → silence (commit passe)', () => {
  const d = evaluate({ command: 'git commit -m "corrige #99"', today: TODAY, readSolde: () => solde(), counter: 4 })
  assert.equal(d, null)
})

test('evaluate : solde absent → deny actionnable', () => {
  const d = evaluate({ command: 'git commit -m "corrige #99"', today: TODAY, readSolde: () => null })
  assert.ok(d && typeof d.reason === 'string')
  assert.match(d.reason, /#99/)
  assert.match(d.reason, /\.claude\/soldes\/99\.md/)
  assert.match(d.reason, /fichier absent/)
})

test('evaluate : multi-fermeture — un seul solde manquant listé nommément', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #1, ferme #2"',
    today: TODAY,
    readSolde: (n) => (n === 1 ? solde() : null),
  })
  assert.ok(d)
  assert.doesNotMatch(d.reason, /#1 \(/)
  assert.match(d.reason, /#2 \(/)
})

test('evaluate : verdict RÉFUTÉ → deny même si le reste du solde est conforme', () => {
  const d = evaluate({ command: 'git commit -m "corrige #5"', today: TODAY, readSolde: () => solde({ verdict: 'RÉFUTÉ' }) })
  assert.ok(d)
  assert.match(d.reason, /réfuté ne se ferme pas/)
})

test('evaluate : palier <10 sans revue-palier.md → solde seul suffit (silence)', () => {
  const d = evaluate({ command: 'git commit -m "corrige #9"', today: TODAY, readSolde: () => solde(), counter: 9, readRevuePalier: () => null })
  assert.equal(d, null)
})

test('evaluate : palier >=10 sans revue-palier.md → deny palier, quel que soit le solde', () => {
  const d = evaluate({ command: 'git commit -m "corrige #9"', today: TODAY, readSolde: () => solde(), counter: 10, readRevuePalier: () => null })
  assert.ok(d)
  assert.match(d.reason, /[Pp]alier/)
  assert.match(d.reason, /fichier absent/)
})

test('evaluate : palier >=10 + revue-palier.md daté du jour et suffisant → pass (solde encore requis)', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #9"',
    today: TODAY,
    readSolde: () => solde(),
    counter: 12,
    readRevuePalier: () => revuePalier(),
  })
  assert.equal(d, null)
})

test('evaluate : palier >=10 + revue-palier.md présent mais trop maigre → deny palier', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #9"',
    today: TODAY,
    readSolde: () => solde(),
    counter: 10,
    readRevuePalier: () => revuePalier({ synth: 'court' }),
  })
  assert.ok(d)
  assert.match(d.reason, /[Pp]alier/)
})

// ── extractRefIssues (anti-esquive, extension 2026-07-14) ──────────────────────────────────────────
test('extractRefIssues : "ref #N" et "refs #N" reconnus, dédupliqués/triés', () => {
  assert.deepEqual(extractRefIssues('git commit -m "feat: truc, ref #371 refs #371 ref #393"'), [371, 393])
})

test('extractRefIssues : aucun mot-clef → vide', () => {
  assert.deepEqual(extractRefIssues('git commit -m "feat: truc"'), [])
})

test('extractRefIssues : pas un commit → vide même avec mot-clef', () => {
  assert.deepEqual(extractRefIssues('git log --grep "ref #371"'), [])
})

// ── validateRefFile ──────────────────────────────────────────────────────────────────────────────
const refFile = ({ verdict = 'CONFIRMÉ', desc = REFUTATION_OK } = {}) => `## Réfutation\nverdict: ${verdict}\n${desc}\n`

test('validateRefFile : conforme', () => {
  const r = validateRefFile(refFile())
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateRefFile : fichier absent', () => {
  assert.equal(validateRefFile(null).ok, false)
})

test('validateRefFile : section Réfutation trop maigre', () => {
  const r = validateRefFile(refFile({ desc: 'ok.' }))
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /trop maigre/)
})

// ── analyzeStagedDiff ────────────────────────────────────────────────────────────────────────────
test('analyzeStagedDiff : touche src/**, compte les lignes', () => {
  const raw = '5\t2\tsrc/engine/character.ts\n1\t0\tdocs/plans/truc.md\n'
  const r = analyzeStagedDiff(raw)
  assert.equal(r.touchesSrc, true)
  assert.equal(r.totalLines, 8)
})

test('analyzeStagedDiff : docs-only ne touche pas src', () => {
  const raw = '10\t3\tdocs/architecture.md\n'
  const r = analyzeStagedDiff(raw)
  assert.equal(r.touchesSrc, false)
})

test('analyzeStagedDiff : vide/absent → aucune touche, 0 ligne', () => {
  assert.deepEqual(analyzeStagedDiff(''), { touchesSrc: false, totalLines: 0 })
  assert.deepEqual(analyzeStagedDiff(undefined), { touchesSrc: false, totalLines: 0 })
})

// ── evaluateAntiEsquive ──────────────────────────────────────────────────────────────────────────
const REFUTATION_LINE_OK = 'REFUTATION: un juge adversarial a rejoué le diff et tenté 2 contournements, aucun ne passe.'

test('evaluateAntiEsquive : pas un commit → silence', () => {
  assert.equal(evaluateAntiEsquive({ command: 'git status', stagedTouchesSrc: true, stagedTotalLines: 100 }), null)
})

test('evaluateAntiEsquive : diff ne touche pas src → silence', () => {
  const d = evaluateAntiEsquive({ command: 'git commit -m "ref #371 doc"', stagedTouchesSrc: false, stagedTotalLines: 100 })
  assert.equal(d, null)
})

test('evaluateAntiEsquive : diff < 10 lignes → silence (one-liner sur la suite verte)', () => {
  const d = evaluateAntiEsquive({ command: 'git commit -m "fix: typo, ref #371"', stagedTouchesSrc: true, stagedTotalLines: 9 })
  assert.equal(d, null)
})

test('evaluateAntiEsquive : fermeture déjà couverte par evaluate() → silence', () => {
  const d = evaluateAntiEsquive({ command: 'git commit -m "corrige #9"', stagedTouchesSrc: true, stagedTotalLines: 100 })
  assert.equal(d, null)
})

test('evaluateAntiEsquive : "ref #N" src touché sans réfutation → deny', () => {
  const d = evaluateAntiEsquive({
    command: 'git commit -m "feat: truc, ref #371"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    readRefFile: () => null,
  })
  assert.ok(d)
  assert.match(d.reason, /#371/)
  assert.match(d.reason, /ref-371\.md/)
})

test('evaluateAntiEsquive : "ref #N" avec ligne REFUTATION: inline valide → pass', () => {
  const d = evaluateAntiEsquive({
    command: `git commit -m "feat: truc, ref #371\n\n${REFUTATION_LINE_OK}"`,
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
  })
  assert.equal(d, null)
})

test('evaluateAntiEsquive : "ref #N" avec ligne REFUTATION: trop courte → deny', () => {
  const d = evaluateAntiEsquive({
    command: 'git commit -m "feat: truc, ref #371\n\nREFUTATION: vu."',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    readRefFile: () => null,
  })
  assert.ok(d)
})

test('evaluateAntiEsquive : "ref #N" avec fichier ref-N.md conforme → pass', () => {
  const d = evaluateAntiEsquive({
    command: 'git commit -m "feat: truc, ref #371"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    readRefFile: (n) => (n === 371 ? refFile() : null),
  })
  assert.equal(d, null)
})

test('evaluateAntiEsquive : "ref #N" avec fichier ref-N.md non conforme → deny', () => {
  const d = evaluateAntiEsquive({
    command: 'git commit -m "feat: truc, ref #371"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    readRefFile: (n) => (n === 371 ? refFile({ desc: 'ok.' }) : null),
  })
  assert.ok(d)
  assert.match(d.reason, /trop maigre/)
})

test('evaluateAntiEsquive : aucun ticket, src touché, sans réfutation → deny', () => {
  const d = evaluateAntiEsquive({
    command: 'git commit -m "feat: refonte truc"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
  })
  assert.ok(d)
  assert.match(d.reason, /aucun ticket rattaché/)
})

test('evaluateAntiEsquive : aucun ticket, src touché, avec ligne REFUTATION: → pass', () => {
  const d = evaluateAntiEsquive({
    command: `git commit -m "feat: refonte truc\n\n${REFUTATION_LINE_OK}"`,
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
  })
  assert.equal(d, null)
})
