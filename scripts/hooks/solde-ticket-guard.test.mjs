// Test du hook `solde-ticket-guard` (node --test) : la fermeture de ticket au commit exige un
// SOLDE écrit conforme, avec sa propre réfutation adversariale, et respecte le palier de revue
// adversariale (demande 2026-07-14). Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve, join } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import {
  extractClosedIssues,
  validateSolde,
  validateRevuePalier,
  evaluate,
  extractRefIssues,
  validateRefFile,
  evaluateAntiEsquive,
  analyzeStagedDiff,
  extractMessageSources,
  evaluateAmendInvisible,
  manifestTickets,
  evaluateManifestClosure,
  extractTargetDir,
  validateJugeFile,
  validateJugeVisionFile,
  evaluateJuge,
  isGitCommitCommand,
  extractCommitPathspecs,
  repoRoot,
  readSoldeFile,
  readStagedSoldeFile,
  readCounterFile,
  readRevuePalierFile,
  readRefFile,
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
  assert.deepEqual(analyzeStagedDiff(''), { touchesSrc: false, touchesUi: false, totalLines: 0 })
  assert.deepEqual(analyzeStagedDiff(undefined), { touchesSrc: false, touchesUi: false, totalLines: 0 })
})

test('analyzeStagedDiff : touche src/ui/** → touchesUi', () => {
  const raw = '3\t1\tsrc/ui/RollShell.tsx\n'
  const r = analyzeStagedDiff(raw)
  assert.equal(r.touchesSrc, true)
  assert.equal(r.touchesUi, true)
})

test('analyzeStagedDiff : src/** hors src/ui/** → touchesUi false', () => {
  const raw = '3\t1\tsrc/engine/combat.ts\n'
  const r = analyzeStagedDiff(raw)
  assert.equal(r.touchesSrc, true)
  assert.equal(r.touchesUi, false)
})

// ── analyzeStagedDiff pathspec-scopé (#591 défaut 1, arbre PARTAGÉ) ────────────────────────────────
test('analyzeStagedDiff : pathspecs fournis → seuls les fichiers matchés comptent (index d\'une autre session ignoré)', () => {
  const raw = [
    '50\t20\tsrc/ui/RollShell.tsx', // fichier ÉTRANGER (autre session), pas dans le pathspec
    '3\t1\tscripts/hooks/solde-ticket-guard.mjs',
    '1\t0\t.claude/settings.json',
  ].join('\n')
  const r = analyzeStagedDiff(raw, ['scripts/hooks/solde-ticket-guard.mjs', '.claude/settings.json'])
  assert.equal(r.touchesUi, false)
  assert.equal(r.touchesSrc, false)
  assert.equal(r.totalLines, 5)
})

test('analyzeStagedDiff : pathspec sur un dossier couvre tous ses fichiers', () => {
  const raw = '3\t1\tsrc/ui/RollShell.tsx\n5\t0\tsrc/engine/combat.ts\n'
  const r = analyzeStagedDiff(raw, ['src/ui'])
  assert.equal(r.touchesUi, true)
  assert.equal(r.touchesSrc, true)
  assert.equal(r.totalLines, 4)
})

test('analyzeStagedDiff : pathspecs vide (défaut) → portée INCHANGÉE, index entier', () => {
  const raw = '3\t1\tsrc/ui/RollShell.tsx\n'
  assert.deepEqual(analyzeStagedDiff(raw), analyzeStagedDiff(raw, []))
})

// ── isGitCommitCommand / extractCommitPathspecs (#591 défauts 1 et 3 — parsing STRUCTUREL) ─────────
test('isGitCommitCommand : git commit simple → true', () => {
  assert.equal(isGitCommitCommand('git commit -m "corrige #7"'), true)
})

test('isGitCommitCommand : git -C <path> commit → true (flag global sauté)', () => {
  assert.equal(isGitCommitCommand('git -C ../autre-repo commit -m "x"'), true)
})

test('isGitCommitCommand : enchaînement cmd1 && git commit → true', () => {
  assert.equal(isGitCommitCommand('npm test && git commit -m "x"'), true)
})

test('isGitCommitCommand : gh issue create citant "git commit" dans le corps → false (jamais un grep de sous-chaîne, #591 défaut 3)', () => {
  const cmd = 'gh issue create --title "bug" --body "le hook a refusé un git commit légitime"'
  assert.equal(isGitCommitCommand(cmd), false)
})

test('isGitCommitCommand : git log --grep "git commit" → false (sous-commande ≠ commit)', () => {
  assert.equal(isGitCommitCommand('git log --grep "git commit"'), false)
})

test('isGitCommitCommand : here-string PowerShell git commit -m @\'...\'@ → true', () => {
  assert.equal(isGitCommitCommand('git commit -m @\'\nfeat: truc\n\'@'), true)
})

test('extractCommitPathspecs : "git commit -- <paths> -m <msg>" → les 2 chemins, message exclu', () => {
  const cmd = 'git commit -- scripts/hooks/x.mjs .claude/settings.json -m "corrige #591"'
  assert.deepEqual(extractCommitPathspecs(cmd), ['scripts/hooks/x.mjs', '.claude/settings.json'])
})

test('extractCommitPathspecs : pas de pathspec (commit -m seul) → []', () => {
  assert.deepEqual(extractCommitPathspecs('git commit -m "corrige #7"'), [])
})

test('extractCommitPathspecs : pas un commit → []', () => {
  assert.deepEqual(extractCommitPathspecs('gh issue create --body "git commit -- foo"'), [])
})

test('extractCommitPathspecs : --file=<path> ne devient pas un pathspec', () => {
  assert.deepEqual(extractCommitPathspecs('git commit --file=commit-415.txt -- src/ui/Foo.tsx'), ['src/ui/Foo.tsx'])
})

// ── juge adversarial : -am contourne tout (défaut le plus grave, réfuté) ────────────────────────────
test('extractCommitPathspecs : "-am" (shorts groupés) → le message n\'est PAS un pathspec, [] (index entier)', () => {
  assert.deepEqual(extractCommitPathspecs('git commit -am "feat: refonte truc"'), [])
})

test('extractCommitPathspecs : "-am" + pathspec après -- → le pathspec seul, message exclu', () => {
  const cmd = 'git commit -- src/ui/Foo.tsx -am "feat: refonte truc"'
  assert.deepEqual(extractCommitPathspecs(cmd), ['src/ui/Foo.tsx'])
})

test('extractCommitPathspecs : "-cam" (short groupé à 3 lettres) → message exclu, [] (index entier)', () => {
  assert.deepEqual(extractCommitPathspecs('git commit -cam "feat: refonte truc"'), [])
})

test('analyzeStagedDiff intégration : "-am" ne filtre PAS le diff à néant (index entier retenu)', () => {
  const raw = '50\t20\tsrc/ui/RollShell.tsx\n'
  const pathspecs = extractCommitPathspecs('git commit -am "feat: refonte truc"')
  const r = analyzeStagedDiff(raw, pathspecs)
  assert.equal(r.touchesUi, true)
  assert.equal(r.totalLines, 70)
})

// ── glob non résolu : jamais un scoping résolu à tort en "aucun fichier" ────────────────────────────
test('extractCommitPathspecs : pathspec avec glob ("src/**/*.tsx") → [] (index entier, jamais silencé)', () => {
  assert.deepEqual(extractCommitPathspecs('git commit -- "src/**/*.tsx" -m "x"'), [])
})

test('extractCommitPathspecs : un seul pathspec glob parmi plusieurs invalide TOUT le scoping', () => {
  const cmd = 'git commit -- src/ui/Foo.tsx "src/**/*.tsx" -m "x"'
  assert.deepEqual(extractCommitPathspecs(cmd), [])
})

// ── call-operator PowerShell (`& "C:\Program Files\Git\git.exe" commit ...`) ────────────────────────
test('isGitCommitCommand : call-operator PowerShell avec chemin absolu vers git.exe → true', () => {
  const cmd = '& "C:\\Program Files\\Git\\git.exe" commit -m "corrige #7"'
  assert.equal(isGitCommitCommand(cmd), true)
})

test('extractClosedIssues : call-operator PowerShell reconnu → ferme le ticket', () => {
  const cmd = '& "C:\\Program Files\\Git\\git.exe" commit -m "corrige #7"'
  assert.deepEqual(extractClosedIssues(cmd), [7])
})

test('isGitCommitCommand : call-operator sur un exécutable non-git → false', () => {
  const cmd = '& "C:\\Program Files\\gh\\gh.exe" issue create --body "git commit"'
  assert.equal(isGitCommitCommand(cmd), false)
})

// ── résiduel #591 : quote en MILIEU de bareword (`--message="..."`, `-m"..."` collé) ────────────────
test('tokenizeCommand (via extractCommitPathspecs) : "--message=" multi-mots ne fuit PAS en pathspecs', () => {
  const cmd = 'git commit --message="feat refonte ref #501"'
  assert.deepEqual(extractCommitPathspecs(cmd), [])
})

test('tokenizeCommand (via extractCommitPathspecs) : "-m" valeur COLLÉE (sans espace) ne fuit PAS en pathspecs', () => {
  const cmd = 'git commit -m"feat refonte ref #501"'
  assert.deepEqual(extractCommitPathspecs(cmd), [])
})

test('extractCommitPathspecs : "--message=solo" (mono-mot, déjà vert) reste []', () => {
  assert.deepEqual(extractCommitPathspecs('git commit --message=solo'), [])
})

test('extractCommitPathspecs : "--message=" multi-mots + pathspec réel après -- → seul le pathspec', () => {
  const cmd = 'git commit -- src/ui/Foo.tsx --message="feat refonte ref #501"'
  assert.deepEqual(extractCommitPathspecs(cmd), ['src/ui/Foo.tsx'])
})

test('extractCommitPathspecs : "-cam" groupé + valeur COLLÉE ("-cam\\"a b c\\"") reste []', () => {
  const cmd = 'git commit -cam"a b c"'
  assert.deepEqual(extractCommitPathspecs(cmd), [])
})

test('extractClosedIssues : "--message=" multi-mots reconnaît toujours le mot-clef de fermeture', () => {
  assert.deepEqual(extractClosedIssues('git commit --message="corrige #501 pour de bon"'), [501])
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

// Scope tranché #591 (2026-07-17) : le déclencheur REFUTATION ne porte QUE sur le ticket
// explicitement rattaché (fermeture ou `ref #N`) — un commit sans AUCUN ticket, même src/**
// substantiel, reste hors du mécanisme (ce n'était PAS le déclencheur d'origine, cf. en-tête).
test('evaluateAntiEsquive : aucun ticket rattaché (ni fermeture, ni ref #N), src touché → silence (#591)', () => {
  const d = evaluateAntiEsquive({
    command: 'git commit -m "feat: refonte truc"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    readRefFile: () => { throw new Error('ne doit pas être appelé — aucun ticket rattaché') },
  })
  assert.equal(d, null)
})

// ── validateJugeFile / validateJugeVisionFile ───────────────────────────────────────────────────────
const JUGE_OK = 'Un agent juge adversarial a rejoué le diff contre le DoD, tenté 2 contournements, aucun ne passe.'
const jugeFile = ({ desc = JUGE_OK } = {}) => `## Juge\n${desc}\n`
const jugeVisionFile = ({ desc = JUGE_OK } = {}) => `## Juge-Vision\n${desc}\n`

test('validateJugeFile : conforme', () => {
  const r = validateJugeFile(jugeFile())
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateJugeFile : fichier absent', () => {
  assert.equal(validateJugeFile(null).ok, false)
})

test('validateJugeFile : section absente', () => {
  const r = validateJugeFile('## Réfutation\nverdict: CONFIRMÉ\nblabla suffisamment long pour passer.\n')
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /"## Juge" absente/)
})

test('validateJugeFile : section trop maigre', () => {
  const r = validateJugeFile(jugeFile({ desc: 'ok.' }))
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /trop maigre/)
})

test('validateJugeVisionFile : conforme', () => {
  const r = validateJugeVisionFile(jugeVisionFile())
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateJugeVisionFile : section absente', () => {
  const r = validateJugeVisionFile(jugeFile())
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /"## Juge-Vision" absente/)
})

// ── evaluateJuge (extension REFUTATION → JUGE adversarial, générale à tout domaine) ────────────────
const JUGE_LINE_OK = 'JUGE: un agent juge adversarial a rejoué le diff contre le DoD, aucun contournement ne passe.'
const JUGE_VISION_LINE_OK = 'JUGE-VISION: captures fraîches jugées contre l\'attendu, mécanisme et pixels vérifiés.'

test('evaluateJuge : pas un commit → silence', () => {
  assert.equal(evaluateJuge({ command: 'git status', stagedTouchesSrc: true, stagedTotalLines: 100 }), null)
})

test('evaluateJuge : diff ne touche pas src → silence', () => {
  assert.equal(evaluateJuge({ command: 'git commit -m "ref #371 doc"', stagedTouchesSrc: false, stagedTotalLines: 100 }), null)
})

test('evaluateJuge : diff < 10 lignes → silence', () => {
  assert.equal(evaluateJuge({ command: 'git commit -m "fix: typo"', stagedTouchesSrc: true, stagedTotalLines: 9 }), null)
})

test('evaluateJuge : fermeture de ticket → silence (déjà couverte par le solde)', () => {
  assert.equal(evaluateJuge({ command: 'git commit -m "corrige #9"', stagedTouchesSrc: true, stagedTotalLines: 100 }), null)
})

// Scope tranché #591 : évaluateJuge partage EXACTEMENT le déclencheur d'evaluateAntiEsquive — un
// `ref #N` rattaché, jamais un commit sans ticket du tout.
test('evaluateJuge : aucun ticket rattaché, src touché → silence (#591)', () => {
  const d = evaluateJuge({
    command: 'git commit -m "feat: refonte truc"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: false,
    readRefFile: () => { throw new Error('ne doit pas être appelé — aucun ticket rattaché') },
  })
  assert.equal(d, null)
})

test('evaluateJuge : "ref #N" src touché sans ligne JUGE → deny', () => {
  const d = evaluateJuge({ command: 'git commit -m "feat: refonte truc, ref #501"', stagedTouchesSrc: true, stagedTotalLines: 100, stagedTouchesUi: false })
  assert.ok(d)
  assert.match(d.reason, /JUGE:/)
})

test('evaluateJuge : "ref #N" src touché avec ligne JUGE: valide, hors UI → pass', () => {
  const d = evaluateJuge({
    command: `git commit -m "feat: refonte truc, ref #501\n\n${JUGE_LINE_OK}"`,
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: false,
  })
  assert.equal(d, null)
})

test('evaluateJuge : "ref #N" ligne JUGE: trop courte → deny', () => {
  const d = evaluateJuge({ command: 'git commit -m "feat: truc, ref #501\n\nJUGE: vu."', stagedTouchesSrc: true, stagedTotalLines: 100 })
  assert.ok(d)
})

test('evaluateJuge : "ref #N" src/ui touché avec JUGE: seul (sans JUGE-VISION) → deny', () => {
  const d = evaluateJuge({
    command: `git commit -m "feat: bouton, ref #501\n\n${JUGE_LINE_OK}"`,
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: true,
  })
  assert.ok(d)
  assert.match(d.reason, /JUGE-VISION/)
})

test('evaluateJuge : "ref #N" src/ui touché avec JUGE: et JUGE-VISION: → pass', () => {
  const d = evaluateJuge({
    command: `git commit -m "feat: bouton, ref #501\n\n${JUGE_LINE_OK}\n${JUGE_VISION_LINE_OK}"`,
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: true,
  })
  assert.equal(d, null)
})

test('evaluateJuge : "ref #N" avec fichier ref-N.md portant "## Juge" conforme, hors UI → pass', () => {
  const d = evaluateJuge({
    command: 'git commit -m "feat: truc, ref #371"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: false,
    readRefFile: (n) => (n === 371 ? jugeFile() : null),
  })
  assert.equal(d, null)
})

test('evaluateJuge : "ref #N" UI touchée, fichier ref-N.md sans "## Juge-Vision" → deny', () => {
  const d = evaluateJuge({
    command: 'git commit -m "feat: truc, ref #371"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: true,
    readRefFile: (n) => (n === 371 ? jugeFile() : null),
  })
  assert.ok(d)
  assert.match(d.reason, /Juge-Vision/)
})

test('evaluateJuge : "ref #N" UI touchée, fichier ref-N.md avec "## Juge" ET "## Juge-Vision" → pass', () => {
  const d = evaluateJuge({
    command: 'git commit -m "feat: truc, ref #371"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: true,
    readRefFile: (n) => (n === 371 ? `${jugeFile()}\n${jugeVisionFile()}` : null),
  })
  assert.equal(d, null)
})

// ── extractMessageSources (message par fichier -F/--file, fix production 2026-07-14) ──────────────
test('extractMessageSources : pas de -F → texte = commande telle quelle', () => {
  const r = extractMessageSources('git commit -m "corrige #42"')
  assert.equal(r.text, 'git commit -m "corrige #42"')
  assert.equal(r.fileError, null)
})

test('extractMessageSources : -F <path> lu et concaténé', () => {
  const r = extractMessageSources('git commit -F commit-415.txt', {
    readFile: (p) => { assert.match(p, /commit-415\.txt$/); return 'corrige #415\n\ndétail' },
  })
  assert.equal(r.fileError, null)
  assert.match(r.text, /corrige #415/)
  assert.match(r.text, /git commit -F commit-415\.txt/)
})

test('extractMessageSources : --file=<path> (forme =) lu', () => {
  const r = extractMessageSources('git commit --file=commit-415.txt', {
    readFile: () => 'corrige #415',
  })
  assert.match(r.text, /corrige #415/)
})

test('extractMessageSources : --file <path> (forme espace) lu', () => {
  const r = extractMessageSources('git commit --file commit-415.txt', {
    readFile: () => 'corrige #415',
  })
  assert.match(r.text, /corrige #415/)
})

test('extractMessageSources : chemin quoté (doubles/simples) dépouillé avant lecture', () => {
  const seen = []
  extractMessageSources('git commit -F "commit 415.txt"', { readFile: (p) => { seen.push(p); return 'x' } })
  assert.match(seen[0], /commit 415\.txt$/)
  const seen2 = []
  extractMessageSources("git commit -F 'commit-415.txt'", { readFile: (p) => { seen2.push(p); return 'x' } })
  assert.match(seen2[0], /commit-415\.txt$/)
})

test('extractMessageSources : ligne REFUTATION: dans le fichier -F visible dans le texte', () => {
  const r = extractMessageSources('git commit -F commit-x.txt', {
    readFile: () => `feat: truc\n\n${REFUTATION_LINE_OK}`,
  })
  assert.match(r.text, /REFUTATION:/)
})

test('extractMessageSources : -F présent mais fichier illisible → fileError renseigné, texte = commande seule', () => {
  const r = extractMessageSources('git commit -F absent.txt', {
    readFile: () => { throw new Error('ENOENT') },
  })
  assert.equal(r.fileError, 'absent.txt')
  assert.equal(r.text, 'git commit -F absent.txt')
})

test('extractMessageSources : commande vide → texte vide, pas d\'erreur', () => {
  assert.deepEqual(extractMessageSources(''), { text: '', fileError: null })
})

// ── evaluate/evaluateAntiEsquive sur le texte étendu (-F) — intégration bout en bout ───────────────
test('intégration -F : fermeture via -F sans solde → deny (invisible avec l\'ancien driver, visible maintenant)', () => {
  const { text } = extractMessageSources('git commit -F commit-415.txt', { readFile: () => 'corrige #415' })
  const d = evaluate({ command: text, today: TODAY, readSolde: () => null })
  assert.ok(d)
  assert.match(d.reason, /#415/)
})

test('intégration -F : fermeture via -F avec solde conforme → pass', () => {
  const { text } = extractMessageSources('git commit -F commit-415.txt', { readFile: () => 'corrige #415' })
  const d = evaluate({ command: text, today: TODAY, readSolde: () => solde() })
  assert.equal(d, null)
})

test('intégration -F : REFUTATION: dans le fichier -F accepte l\'anti-esquive', () => {
  const { text } = extractMessageSources('git commit -F commit-x.txt', {
    readFile: () => `feat: refonte\n\n${REFUTATION_LINE_OK}`,
  })
  const d = evaluateAntiEsquive({ command: text, stagedTouchesSrc: true, stagedTotalLines: 100 })
  assert.equal(d, null)
})

// ── evaluateAmendInvisible (--amend sans -m/-F, message hérité invisible) ──────────────────────────
test('evaluateAmendInvisible : pas un commit → silence', () => {
  assert.equal(evaluateAmendInvisible({ command: 'git status', stagedTouchesSrc: true }), null)
})

test('evaluateAmendInvisible : pas --amend → silence', () => {
  assert.equal(evaluateAmendInvisible({ command: 'git commit -m "x"', stagedTouchesSrc: true }), null)
})

test('evaluateAmendInvisible : --amend avec -m → silence (message visible)', () => {
  assert.equal(evaluateAmendInvisible({ command: 'git commit --amend -m "corrige #9"', stagedTouchesSrc: true }), null)
})

test('evaluateAmendInvisible : --amend avec -F → silence (message visible via -F)', () => {
  assert.equal(evaluateAmendInvisible({ command: 'git commit --amend -F msg.txt', stagedTouchesSrc: true }), null)
})

test('evaluateAmendInvisible : --amend sans -m/-F, diff staged touche src → deny', () => {
  const d = evaluateAmendInvisible({ command: 'git commit --amend', stagedTouchesSrc: true })
  assert.ok(d)
  assert.match(d.reason, /--amend/)
})

test('evaluateAmendInvisible : --amend sans -m/-F, diff staged ne touche pas src → silence', () => {
  assert.equal(evaluateAmendInvisible({ command: 'git commit --amend', stagedTouchesSrc: false }), null)
})

// ── manifest RAW (prévention #434/#487) ────────────────────────────────────────────────────────────
const manifestWith = (...tickets) =>
  JSON.stringify(tickets.map((n) => ({ id: `dom#t${n}`, ticket: `#${n}` })), null, 2)

test('manifestTickets : extrait les #N (ticket et bloque), dédupliqués', () => {
  const content = JSON.stringify([
    { id: 'a', ticket: '#508' },
    { id: 'b', ticket: '#508' },
    { id: 'c', bloque: 'attend #490 avant câblage' },
  ])
  assert.deepEqual([...manifestTickets(content)].sort((a, b) => a - b), [490, 508])
})

test('manifestTickets : null/vide → ensemble vide', () => {
  assert.equal(manifestTickets(null).size, 0)
  assert.equal(manifestTickets('').size, 0)
})

test('evaluateManifestClosure : fermeture avec entrée manifest présente → bloqué', () => {
  const d = evaluateManifestClosure({
    command: 'git commit -m "corrige #508"',
    readStagedManifest: () => manifestWith(508),
  })
  assert.ok(d)
  assert.match(d.reason, /#508/)
  assert.match(d.reason, /raw\.manifest\.json/)
  assert.match(d.reason, /raw:implemente/)
})

test('evaluateManifestClosure : entrée retirée dans le même commit (manifest stagé sans #N) → passe', () => {
  const d = evaluateManifestClosure({
    command: 'git commit -m "corrige #508"',
    readStagedManifest: () => manifestWith(490), // #508 retiré
  })
  assert.equal(d, null)
})

test('evaluateManifestClosure : commit sans fermeture → intact (silence)', () => {
  const d = evaluateManifestClosure({
    command: 'git commit -m "wip sur #508"',
    readStagedManifest: () => manifestWith(508),
  })
  assert.equal(d, null)
})

test('evaluateManifestClosure : #N absent du manifest → intact (silence)', () => {
  const d = evaluateManifestClosure({
    command: 'git commit -m "corrige #999"',
    readStagedManifest: () => manifestWith(508),
  })
  assert.equal(d, null)
})

test('evaluateManifestClosure : multi-fermeture — seuls les tickets encore présents listés', () => {
  const d = evaluateManifestClosure({
    command: 'git commit -m "corrige #508, ferme #999"',
    readStagedManifest: () => manifestWith(508),
  })
  assert.ok(d)
  assert.match(d.reason, /#508/)
  assert.doesNotMatch(d.reason, /#999/)
})

// ── extractTargetDir (répertoire cible du commit, fix #587) ───────────────────────────────────────
test('extractTargetDir : "cd <path> && git commit" → résolu contre cwd, pas le cwd de la session', () => {
  const cwd = resolve('/repo/session')
  const dir = extractTargetDir('cd ../autre-worktree && git commit -m "corrige #5"', cwd)
  assert.equal(dir, resolve(cwd, '../autre-worktree'))
  assert.notEqual(dir, cwd)
})

test('extractTargetDir : pas de cd → cwd inchangé (comportement d\'origine hors worktree)', () => {
  const cwd = resolve('/repo/session')
  assert.equal(extractTargetDir('git commit -m "corrige #5"', cwd), cwd)
})

test('extractTargetDir : commande vide → cwd inchangé', () => {
  const cwd = resolve('/repo/session')
  assert.equal(extractTargetDir('', cwd), cwd)
  assert.equal(extractTargetDir(null, cwd), cwd)
})

test('extractTargetDir : chemin quoté avec espaces (doubles/simples) dépouillé avant résolution', () => {
  const cwd = resolve('/repo/session')
  const d1 = extractTargetDir('cd "../autre worktree" && git commit -m "corrige #5"', cwd)
  assert.equal(d1, resolve(cwd, '../autre worktree'))
  const d2 = extractTargetDir("cd '../autre worktree' && git commit -m \"corrige #5\"", cwd)
  assert.equal(d2, resolve(cwd, '../autre worktree'))
})

test('extractTargetDir : "git -C <path> commit" reconnu même sans cd', () => {
  const cwd = resolve('/repo/session')
  const dir = extractTargetDir('git -C ../autre-worktree commit -m "corrige #5"', cwd)
  assert.equal(dir, resolve(cwd, '../autre-worktree'))
})

test('extractTargetDir : chemin absolu résolu tel quel', () => {
  const cwd = resolve('/repo/session')
  const abs = resolve('/repo/autre-worktree')
  const dir = extractTargetDir(`cd ${abs} && git commit -m "corrige #5"`, cwd)
  assert.equal(dir, abs)
  assert.notEqual(abs, cwd)
})

test('extractMessageSources : « -F » en PROSE d un message -m n est pas un flag fichier (git refuse -m+-F — faux positif vécu 2026-07-14)', () => {
  const cmd = 'git commit -m "fix(hooks): les fermetures via -F et, pire, laissant passer — utiliser -m ou un chemin lisible"'
  const r = extractMessageSources(cmd, { readFile: () => { throw new Error('ne doit jamais être appelé') } })
  assert.equal(r.fileError, null)
  assert.equal(r.text, cmd)
})

// ── repoRoot / read*File : ancrage à l'emplacement du script, pas au cwd du process ────────────────
// Constat de production : les hooks tournent avec `cwd` = celui de la commande qui les invoque
// (jamais garanti = racine du dépôt) — `resolve('.claude/soldes', ...)` (relatif à `cwd`) cherchait
// au mauvais endroit et le garde affirmait un solde "absent" alors qu'il existait.
test('repoRoot : résolu depuis l\'emplacement du script, retrouve la racine du dépôt même hors cwd', () => {
  const cwd = process.cwd()
  try {
    process.chdir(tmpdir())
    const root = repoRoot(import.meta.url)
    // scripts/hooks/solde-ticket-guard.test.mjs → ../.. = racine du dépôt (package.json y vit).
    assert.doesNotThrow(() => writeFileSync(join(root, '.repoRoot-probe-tmp'), 'x'))
    rmSync(join(root, '.repoRoot-probe-tmp'))
  } finally {
    process.chdir(cwd)
  }
})

test('readSoldeFile/readCounterFile/readRevuePalierFile/readRefFile : trouvent leur fichier depuis un cwd différent de la racine', () => {
  const fakeRepo = mkdtempSync(join(tmpdir(), 'solde-guard-fakerepo-'))
  const hooksDir = join(fakeRepo, 'scripts', 'hooks')
  const soldesDir = join(fakeRepo, '.claude', 'soldes')
  mkdirSync(hooksDir, { recursive: true })
  mkdirSync(soldesDir, { recursive: true })
  const fakeScript = pathToFileURL(join(hooksDir, 'fake.mjs')).href
  writeFileSync(join(soldesDir, '999.md'), 'solde-999')
  writeFileSync(join(soldesDir, '.compteur'), '3')
  writeFileSync(join(soldesDir, 'revue-palier.md'), 'revue-palier')
  writeFileSync(join(soldesDir, 'ref-999.md'), 'ref-999')

  const elsewhere = mkdtempSync(join(tmpdir(), 'solde-guard-elsewhere-'))
  const cwd = process.cwd()
  try {
    process.chdir(elsewhere)
    assert.equal(readSoldeFile(999, fakeScript), 'solde-999')
    assert.equal(readCounterFile(fakeScript), 3)
    assert.equal(readRevuePalierFile(fakeScript), 'revue-palier')
    assert.equal(readRefFile(999, fakeScript), 'ref-999')
  } finally {
    process.chdir(cwd)
    rmSync(fakeRepo, { recursive: true, force: true })
    rmSync(elsewhere, { recursive: true, force: true })
  }
})

// ── Solde STAGÉ : la preuve citée par le message de commit doit entrer dans git ────────────────────
// Les messages de commit citent les soldes par chemin (`.claude/soldes/<N>.md`) ; un solde qui ne
// part pas dans le commit laisse une citation morte. Le garde lit donc l'INDEX, et nomme le cas
// « écrit mais non stagé » séparément de « jamais écrit ».
test('evaluate : solde STAGÉ conforme → silence (le commit passe)', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #77"',
    today: TODAY,
    readSolde: () => solde(),
    soldeOnDisk: () => solde(),
  })
  assert.equal(d, null)
})

test('evaluate : solde conforme sur le DISQUE mais absent de l\'index → deny actionnable (git add)', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #77"',
    today: TODAY,
    readSolde: () => null,
    soldeOnDisk: () => solde(),
  })
  assert.ok(d, 'un solde non stagé disparaîtrait après consommation : la citation du commit mourrait')
  assert.match(d.reason, /#77/)
  assert.match(d.reason, /NON STAGÉ/)
  assert.match(d.reason, /git add \.claude\/soldes\/77\.md/)
})

test('evaluate : ni index ni disque → "fichier absent" (jamais le message de staging)', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #77"',
    today: TODAY,
    readSolde: () => null,
    soldeOnDisk: () => null,
  })
  assert.ok(d)
  assert.match(d.reason, /fichier absent/)
  assert.doesNotMatch(d.reason, /NON STAGÉ/)
})

test('readStagedSoldeFile : rend le contenu de l\'INDEX, `null` pour un fichier seulement sur disque', () => {
  const repo = mkdtempSync(join(tmpdir(), 'solde-guard-index-'))
  try {
    const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: ['ignore', 'pipe', 'ignore'] })
    git('init', '-q')
    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(repo, '.claude', 'soldes', '77.md'), 'solde-77-stage', 'utf8')
    writeFileSync(join(repo, '.claude', 'soldes', '78.md'), 'solde-78-disque', 'utf8')
    git('add', '--force', '.claude/soldes/77.md')

    assert.equal(readStagedSoldeFile(77, repo), 'solde-77-stage')
    assert.equal(readStagedSoldeFile(78, repo), null)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
