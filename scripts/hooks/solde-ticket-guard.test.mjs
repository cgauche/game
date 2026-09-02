// Test du hook `solde-ticket-guard` (node --test) : la fermeture de ticket au commit exige un
// SOLDE écrit conforme, avec sa propre réfutation adversariale, et respecte le palier de revue
// adversariale (demande 2026-07-14). Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { resolve, join } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
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
  readRevuePalierFile,
  readRefFile,
  restesItems,
  restesRoutants,
  lignesDeHunks,
  verifierCapture,
  estFichierEcran,
  estArbrePrincipal,
  evaluateFermetureHorsCommit,
  evaluateArbrePrincipal,
  evaluateHunksEmportes,
  commitEstAncetreDeHead,
  fichiersDuCommitGit,
} from './solde-ticket-guard.mjs'
import { tombalesDansSource, evaluateTombale, EXEMPTIONS_TOMBALE } from './solde-tombale.mjs'

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
    '- typo doc trouvée en route -> corrigé dans ce commit (src/ui/RollShell.tsx:12)',
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
  assert.deepEqual(analyzeStagedDiff(''), { touchesSrc: false, touchesUi: false, totalLines: 0, fichiers: [] })
  assert.deepEqual(analyzeStagedDiff(undefined), { touchesSrc: false, touchesUi: false, totalLines: 0, fichiers: [] })
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

test('readSoldeFile/readRevuePalierFile/readRefFile : trouvent leur fichier depuis un cwd différent de la racine', () => {
  const fakeRepo = mkdtempSync(join(tmpdir(), 'solde-guard-fakerepo-'))
  const hooksDir = join(fakeRepo, 'scripts', 'hooks')
  const soldesDir = join(fakeRepo, '.claude', 'soldes')
  mkdirSync(hooksDir, { recursive: true })
  mkdirSync(soldesDir, { recursive: true })
  const fakeScript = pathToFileURL(join(hooksDir, 'fake.mjs')).href
  writeFileSync(join(soldesDir, '999.md'), 'solde-999')
  writeFileSync(join(soldesDir, 'revue-palier.md'), 'revue-palier')
  writeFileSync(join(soldesDir, 'ref-999.md'), 'ref-999')

  const elsewhere = mkdtempSync(join(tmpdir(), 'solde-guard-elsewhere-'))
  const cwd = process.cwd()
  try {
    process.chdir(elsewhere)
    assert.equal(readSoldeFile(999, fakeScript), 'solde-999')
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

// ── Plafond de restes ROUTÉS (skill orchestrer § Fermeture) ───────────────────────────────────────
// « une fermeture qui émettrait PLUS D'UN ticket de reste n'est PAS fermable : soit le lot GROSSIT
// pour absorber le reste, soit le ticket RESTE OUVERT ».
test('validateSolde : UN reste routé passe', () => {
  const r = validateSolde(solde({ restes: '- perf du picker -> #512' }), TODAY)
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateSolde : DEUX restes routés → le ticket reste ouvert sur ce reste', () => {
  const restes = ['- perf du picker -> #512', '- flakiness réseau -> #513'].join('\n')
  const r = validateSolde(solde({ restes }), TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /2 restes ROUTÉS/)
  assert.match(r.problems.join(' ; '), /le ticket reste ouvert sur ce reste/)
})

test('restesItems / restesRoutants : « RAS » global ne compte aucun item', () => {
  assert.deepEqual(restesItems(solde()), [])
  assert.deepEqual(
    restesRoutants(solde({ restes: '- a -> #1\n- b -> RAS : rien à faire ici, mesuré au grep' })),
    ['- a -> #1'],
  )
})

// ── « corrigé dans ce commit » : la correction se prouve à son SITE ───────────────────────────────
// Cas fondateur : le solde #584 déclarait « corrigé » un site (src/data/schemas/defs/teintesJeu.ts:88)
// réparé par un AUTRE commit (4d6e1ff78) que celui qui portait le solde (8a2807134) — le fichier
// n'était pas dans son diff.
test('validateSolde : « corrigé dans ce commit » sans fichier:ligne → refus', () => {
  const r = validateSolde(solde({ restes: '- typo doc -> corrigé dans ce commit' }), TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /sans référence <fichier>:<ligne>/)
})

test('validateSolde : « corrigé dans ce commit » citant un fichier HORS du diff stagé → refus (cas #584)', () => {
  const restes = '- chemin mort cité -> corrigé dans ce commit (src/data/schemas/defs/teintesJeu.ts:88)'
  const r = validateSolde(solde({ restes }), TODAY, { fichiersStages: ['.claude/soldes/584.md'] })
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /teintesJeu\.ts, ABSENT du diff stagé/)
})

test('validateSolde : « corrigé dans ce commit » citant une ligne HORS des hunks → refus', () => {
  const restes = '- chemin mort cité -> corrigé dans ce commit (src/data/schemas/defs/teintesJeu.ts:88)'
  const ctx = {
    fichiersStages: ['src/data/schemas/defs/teintesJeu.ts'],
    lignesStagees: () => [12, 13],
  }
  const r = validateSolde(solde({ restes }), TODAY, ctx)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /teintesJeu\.ts:88, hors des lignes que ce commit modifie/)
})

test('validateSolde : site cité présent dans le diff ET dans un hunk → passe', () => {
  const restes = '- chemin mort cité -> corrigé dans ce commit (src/data/schemas/defs/teintesJeu.ts:88)'
  const ctx = {
    fichiersStages: ['src/data/schemas/defs/teintesJeu.ts'],
    lignesStagees: () => [87, 88, 89],
  }
  const r = validateSolde(solde({ restes }), TODAY, ctx)
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('lignesDeHunks : les deux côtés du @@ sont recevables (une correction peut SUPPRIMER)', () => {
  const diff = [
    'diff --git a/x.ts b/x.ts',
    '@@ -10,0 +11,2 @@',
    '+une',
    '+deux',
    '@@ -40 +42 @@',
    '+trois',
  ].join('\n')
  // `-10,0` = ZÉRO ligne retirée (insertion APRÈS la 10) : le côté source n'apporte rien ici.
  assert.deepEqual(lignesDeHunks(diff), [11, 12, 40, 42])
  assert.deepEqual(lignesDeHunks(''), [])
})

test('lignesDeHunks : une SUPPRESSION pure rend les lignes DISPARUES (le chemin mort retiré se prouve)', () => {
  // `@@ -10,5 +9,0 @@` : cinq lignes retirées à partir de la 10, rien d'ajouté. Sans le côté source,
  // « corrigé dans ce commit (f:12) » sur ce geste était impossible à prouver.
  assert.deepEqual(lignesDeHunks('@@ -10,5 +9,0 @@\n-mort\n'), [10, 11, 12, 13, 14])
})

// ── Inventaire gaté ───────────────────────────────────────────────────────────────────────────────
test('validateSolde : « inventaire #<épic> » ne compte PAS comme un reste routé', () => {
  const restes = [
    '- classe hors périmètre -> inventaire #1679 : écart mesuré sur 4 sites, converti par classe',
    '- autre classe hors périmètre -> inventaire #1679 : écart mesuré sur 2 sites, converti par classe',
    '- vrai reste -> #512',
  ].join('\n')
  const r = validateSolde(solde({ restes }), TODAY)
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateSolde : « inventaire » sans état lisible → refus', () => {
  const r = validateSolde(solde({ restes: '- classe -> inventaire #1679 : vu' }), TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /sans état lisible/)
})

test('validateSolde : écart porté à un épic que CE COMMIT ferme → convertir en ticket par classe', () => {
  const restes = '- classe hors périmètre -> inventaire #1679 : écart mesuré sur 4 sites, à convertir'
  const r = validateSolde(solde({ restes }), TODAY, { issuesFermees: [1679] })
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /convertir en ticket par CLASSE avant la clôture/)
})

// ── Anti-tombale : le SCAN porte sur les COMMENTAIRES, jamais sur les chaînes ─────────────────────
const SRC_COMMENTAIRE = ['// Dette : le cas B reste à traiter (#4242)', 'export const x = 1', ''].join('\n')
const SRC_CHAINE = ["export const fixture = ['- dette : #4242']", ''].join('\n')
const SRC_PROVENANCE = ['// Contrat posé par #4242 : la table est ordonnée par identité.', 'export const y = 2', ''].join('\n')

test('tombalesDansSource : un commentaire de dette citant le ticket fermé est TROUVÉ', () => {
  const t = tombalesDansSource([4242], { fichiers: ['src/a.ts'], lire: () => SRC_COMMENTAIRE })
  assert.equal(t.length, 1)
  assert.equal(t[0].fichier, 'src/a.ts')
  assert.equal(t[0].ligne, 1)
})

test('tombalesDansSource : le MÊME motif dans une CHAÎNE n\'est pas un commentaire', () => {
  assert.deepEqual(tombalesDansSource([4242], { fichiers: ['src/b.ts'], lire: () => SRC_CHAINE }), [])
})

test('tombalesDansSource : citer la PROVENANCE d\'un choix (sans motif de dette) est toléré', () => {
  assert.deepEqual(tombalesDansSource([4242], { fichiers: ['src/c.ts'], lire: () => SRC_PROVENANCE }), [])
})

test('tombalesDansSource : hors périmètre de fichier (racine ou extension) → rien', () => {
  assert.deepEqual(tombalesDansSource([4242], { fichiers: ['server/relay.ts'], lire: () => SRC_COMMENTAIRE }), [])
  assert.deepEqual(tombalesDansSource([4242], { fichiers: ['src/data/spells.json'], lire: () => SRC_COMMENTAIRE }), [])
})

test('evaluateTombale : deny NOMMÉ fichier:ligne ; silence sans fermeture', () => {
  const d = evaluateTombale({ issuesFermees: [4242], fichiers: ['src/a.ts'], lire: () => SRC_COMMENTAIRE })
  assert.ok(d)
  assert.equal(d.decision, 'deny')
  assert.match(d.reason, /src\/a\.ts:1/)
  assert.equal(evaluateTombale({ issuesFermees: [], fichiers: ['src/a.ts'], lire: () => SRC_COMMENTAIRE }), null)
})

// ── Fermeture HORS commit ─────────────────────────────────────────────────────────────────────────
test('evaluateFermetureHorsCommit : `gh issue close` refusé, y compris derrière un sous-shell', () => {
  for (const cmd of [
    'gh issue close 1636 --comment "fait"',
    'bash -lc "gh issue close 1636"',
    'gh issue edit 1636 --state closed',
    'gh api repos/cgauche/game/issues/1636 -X PATCH -f state=closed',
    'gh api repos/cgauche/game/issues/1636 --method PATCH --field state=closed',
  ]) {
    const d = evaluateFermetureHorsCommit(cmd)
    assert.ok(d, `passé en silence : ${cmd}`)
    assert.equal(d.decision, 'deny')
    assert.match(d.reason, /la fermeture passe par un commit/)
  }
})

test('evaluateFermetureHorsCommit : silence sur ce qui ne ferme pas', () => {
  for (const cmd of [
    'gh issue create --title "x" --body-file b.md',
    'gh issue view 1636 --json state',
    'gh issue edit 1636 --add-label bug',
    'git commit -m "corrige #1636"',
  ]) {
    assert.equal(evaluateFermetureHorsCommit(cmd), null, `mordu à tort : ${cmd}`)
  }
})

// ── Arbre PRINCIPAL vs worktree ───────────────────────────────────────────────────────────────────
test('estArbrePrincipal : `.git` DOSSIER = principal, `.git` FICHIER = worktree lié', () => {
  const base = mkdtempSync(join(tmpdir(), 'solde-arbre-'))
  try {
    mkdirSync(join(base, 'principal', '.git'), { recursive: true })
    mkdirSync(join(base, 'principal', 'src'), { recursive: true })
    mkdirSync(join(base, 'lie'), { recursive: true })
    writeFileSync(join(base, 'lie', '.git'), 'gitdir: ../principal/.git/worktrees/lie\n', 'utf8')

    assert.equal(estArbrePrincipal(join(base, 'principal')), true)
    assert.equal(estArbrePrincipal(join(base, 'principal', 'src')), true, 'un sous-dossier remonte à son arbre')
    assert.equal(estArbrePrincipal(join(base, 'lie')), false)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('evaluateArbrePrincipal : `ask` (jamais deny) dans l\'arbre principal, silence en worktree', () => {
  const d = evaluateArbrePrincipal({ command: 'git commit -m "x"', principal: true, fichiersStages: ['src/a.ts'] })
  assert.ok(d)
  assert.equal(d.decision, 'ask')
  assert.match(d.reason, /src\/a\.ts/)
  assert.match(d.reason, /\.wt-<ticket>-L<n>/)
  assert.equal(evaluateArbrePrincipal({ command: 'git commit -m "x"', principal: false }), null)
  assert.equal(evaluateArbrePrincipal({ command: 'git status', principal: true }), null)
})

// ── `git commit -- <paths>` : l'ARBRE, pas l'index ────────────────────────────────────────────────
test('evaluateHunksEmportes : chemin nommé stagé ET modifié → deny', () => {
  const d = evaluateHunksEmportes({
    command: 'git commit -m "x" -- src/a.ts',
    fichiersModifies: ['src/a.ts', 'src/b.ts'],
    fichiersStages: ['src/a.ts'],
  })
  assert.ok(d)
  assert.equal(d.decision, 'deny')
  assert.match(d.reason, /prend le contenu de l'ARBRE et ignore l'index/)
})

test('evaluateHunksEmportes : chemin nommé modifié SEULEMENT → contexte, jamais un refus', () => {
  const d = evaluateHunksEmportes({
    command: 'git commit -m "x" -- src/a.ts',
    fichiersModifies: ['src/a.ts'],
    fichiersStages: ['src/b.ts'],
  })
  assert.ok(d)
  assert.equal(d.decision, undefined)
  assert.match(d.contexte, /src\/a\.ts/)
})

test('evaluateHunksEmportes : commit NU (sans pathspec) → silence', () => {
  assert.equal(evaluateHunksEmportes({
    command: 'git commit -m "x"',
    fichiersModifies: ['src/a.ts'],
    fichiersStages: ['src/a.ts'],
  }), null)
})

// ── Écran touché : capture de recette visuelle (E1) ───────────────────────────────────────────────
test('estFichierEcran : src/ui et src/gameIso, jamais leurs tests', () => {
  assert.equal(estFichierEcran('src/ui/RollShell.tsx'), true)
  assert.equal(estFichierEcran('src/gameIso/stage/GameStage3D.tsx'), true)
  assert.equal(estFichierEcran('src/ui/RollShell.test.tsx'), false)
  assert.equal(estFichierEcran('src/engine/combat.ts'), false)
})

test('analyzeStagedDiff : src/gameIso/** compte comme écran', () => {
  const r = analyzeStagedDiff('40\t5\tsrc/gameIso/stage/GameStage3D.tsx\n')
  assert.equal(r.touchesUi, true)
  assert.deepEqual(r.fichiers, ['src/gameIso/stage/GameStage3D.tsx'])
})

/** PNG plausible : signature + en-tête IHDR aux dimensions données, rembourré au poids voulu. */
function pngDe(largeur, hauteur, taille) {
  const buf = Buffer.alloc(Math.max(taille, 24))
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0)
  buf.writeUInt32BE(13, 8)
  buf.write('IHDR', 12, 'ascii')
  buf.writeUInt32BE(largeur, 16)
  buf.writeUInt32BE(hauteur, 20)
  return buf
}

test('verifierCapture : une capture PLAUSIBLE passe ; les six défauts sont NOMMÉS', () => {
  const base = mkdtempSync(join(tmpdir(), 'solde-capture-'))
  try {
    mkdirSync(join(base, 'public', 'qc'), { recursive: true })
    writeFileSync(join(base, 'public', 'qc', 'ok.png'), pngDe(1280, 720, 4096))
    writeFileSync(join(base, 'public', 'qc', 'entete-seul.png'), pngDe(1280, 720, 24))
    writeFileSync(join(base, 'public', 'qc', 'vignette.png'), pngDe(64, 48, 4096))
    writeFileSync(join(base, 'public', 'qc', 'vide.png'), Buffer.alloc(0))
    writeFileSync(join(base, 'public', 'qc', 'faux.png'), 'ceci est du texte', 'utf8')

    assert.equal(verifierCapture('public/qc/ok.png', { racine: base }).ok, true)
    assert.match(verifierCapture('docs/ok.png', { racine: base }).problemes[0], /hors de public\/qc\//)
    assert.match(verifierCapture('public/qc/absente.png', { racine: base }).problemes[0], /introuvable/)
    assert.match(verifierCapture('public/qc/vide.png', { racine: base }).problemes[0], /ni un PNG ni un JPEG/)
    assert.match(verifierCapture('public/qc/faux.png', { racine: base }).problemes[0], /ni un PNG ni un JPEG/)
    // Le défaut qui passait AVANT le juge : un en-tête PNG de 8 octets était accepté.
    assert.match(verifierCapture('public/qc/entete-seul.png', { racine: base }).problemes.join(' ; '), /trop légère/)
    assert.match(verifierCapture('public/qc/vignette.png', { racine: base }).problemes.join(' ; '), /trop petite \(64×48 px/)
    const futur = Date.now() + 60_000
    assert.match(verifierCapture('public/qc/ok.png', { racine: base, mtimeMin: futur }).problemes[0], /plus ANCIENNE/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('validateSolde : un commit qui touche un ÉCRAN exige « ## Recette visuelle » et sa capture', () => {
  const sansSection = validateSolde(solde(), TODAY, { touchesUi: true })
  assert.equal(sansSection.ok, false)
  assert.match(sansSection.problems.join(' ; '), /"## Recette visuelle" absente/)

  const avecCapture = `${VERIFIE_OK}\n\n## Restes\nRAS\n\n## Recette visuelle\ncapture: public/qc/console.png\n\n## Réfutation\nverdict: CONFIRMÉ\n${REFUTATION_OK}\n\n(${TODAY})\n`
  const sansCapture = `${VERIFIE_OK}\n\n## Restes\nRAS\n\n## Recette visuelle\nj'ai regardé l'écran\n\n## Réfutation\nverdict: CONFIRMÉ\n${REFUTATION_OK}\n\n(${TODAY})\n`
  assert.match(
    validateSolde(sansCapture, TODAY, { touchesUi: true }).problems.join(' ; '),
    /sans ligne "capture: /,
  )
  const refuse = validateSolde(avecCapture, TODAY, {
    touchesUi: true,
    verifierCaptureDe: () => ({ ok: false, problemes: ['capture "public/qc/console.png" introuvable sur le disque'] }),
  })
  assert.equal(refuse.ok, false)
  assert.match(refuse.problems.join(' ; '), /introuvable/)
  assert.equal(validateSolde(avecCapture, TODAY, { touchesUi: true }).ok, true)
  assert.equal(validateSolde(solde(), TODAY, { touchesUi: false }).ok, true, 'aucun écran touché : rien n\'est exigé')
})

// Un en-tête de fichier énonce couramment une dette D'UN sujet et cite AILLEURS le ticket d'un
// AUTRE : les juger au BLOC rapprochait 206 paires dans l'arbre (mesuré 2026-09-02), à la LIGNE 57.
const SRC_ENTETE_MIXTE = [
  '/**',
  ' * Rapport GÉNÉRÉ. Le volet B reste non implémenté (#4242).',
  ' * Le classement par identité est celui posé par #4243.',
  ' */',
  'export const z = 3',
  '',
].join('\n')

test('tombalesDansSource : la dette et le ticket doivent tenir sur la MÊME ligne de commentaire', () => {
  const t = tombalesDansSource([4242, 4243], { fichiers: ['src/d.ts'], lire: () => SRC_ENTETE_MIXTE })
  assert.deepEqual(t.map((x) => `#${x.n}@${x.ligne}`), ['#4242@2'])
})

// ── « corrigé par <sha> <fichier>:<ligne> » : la correction est DÉJÀ dans l'histoire ──────────────
// Cas fondateur : `.claude/soldes/584.md:7` — le fix vit dans 4d6e1ff78, le solde a été écrit dans
// 8a2807134 ; « corrigé dans ce commit » y serait faux, « RAS » tairait une correction réelle.
const CORRIGE_PAR = '- chemin mort cité -> corrigé par 4d6e1ff78 src/data/schemas/defs/teintesJeu.ts:88'
const HISTOIRE_OK = {
  commitEstAncetre: () => true,
  fichiersDuCommit: () => ['src/data/schemas/defs/teintesJeu.ts', '.claude/soldes/revue-palier-2205fde51.md'],
}

test('validateSolde : « corrigé par <sha> » conforme (ancêtre de HEAD, touche le fichier cité)', () => {
  const r = validateSolde(solde({ restes: CORRIGE_PAR }), TODAY, HISTOIRE_OK)
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateSolde : « corrigé par <sha> » ne compte PAS comme un reste routé', () => {
  assert.deepEqual(restesRoutants(solde({ restes: CORRIGE_PAR })), [])
})

test('validateSolde : « corrigé par <sha> » dont le sha n\'est PAS un ancêtre de HEAD → refus', () => {
  const r = validateSolde(solde({ restes: CORRIGE_PAR }), TODAY, { ...HISTOIRE_OK, commitEstAncetre: () => false })
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /n'est pas un ANCÊTRE de HEAD/)
})

test('validateSolde : « corrigé par <sha> » citant un fichier que le commit ne touche PAS → refus', () => {
  const r = validateSolde(solde({ restes: CORRIGE_PAR }), TODAY, { ...HISTOIRE_OK, fichiersDuCommit: () => ['docs/architecture.md'] })
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /teintesJeu\.ts:88, que ce commit ne touche PAS/)
})

test('validateSolde : « corrigé par » sans sha ni site reste hors grammaire', () => {
  const r = validateSolde(solde({ restes: '- chemin mort -> corrigé par 4d6e1ff78' }), TODAY, HISTOIRE_OK)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /item sans disposition valide/)
})

test('commitEstAncetreDeHead / fichiersDuCommitGit : le cas fondateur #584 tient contre git RÉEL', () => {
  // Un clone SUPERFICIEL (CI sans `fetch-depth: 0`) ne porte pas 4d6e1ff78 : le test doit dire QUOI
  // corriger, jamais verdir sur une histoire qu'il n'a pas lue.
  assert.equal(
    execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: repoRoot(), encoding: 'utf8' }).trim(),
    'false',
    'dépôt SUPERFICIEL : ce test lit l\'HISTOIRE — poser `fetch-depth: 0` sur le `actions/checkout` du job qui joue `test:hooks`.',
  )
  assert.equal(commitEstAncetreDeHead('4d6e1ff78', repoRoot()), true)
  assert.ok(
    fichiersDuCommitGit('4d6e1ff78', repoRoot()).includes('src/data/schemas/defs/teintesJeu.ts'),
    '4d6e1ff78 ne touche pas le fichier que le solde #584 lui attribue',
  )
  assert.equal(commitEstAncetreDeHead('0000000000000000000000000000000000000000', repoRoot()), false)
})

test('le solde #584 de l\'arbre est CONFORME à sa propre grammaire', () => {
  // Même fail-loud que ci-dessus : sur un clone superficiel, ce solde serait déclaré FAUX alors que
  // c'est l'histoire qui manque.
  assert.equal(
    execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: repoRoot(), encoding: 'utf8' }).trim(),
    'false',
    'dépôt SUPERFICIEL : ce test lit l\'HISTOIRE — poser `fetch-depth: 0` sur le `actions/checkout` du job qui joue `test:hooks`.',
  )
  const contenu = readFileSync(join(repoRoot(), '.claude', 'soldes', '584.md'), 'utf8')
  const r = validateSolde(contenu, '2026-09-02', {
    commitEstAncetre: (sha) => commitEstAncetreDeHead(sha, repoRoot()),
    fichiersDuCommit: (sha) => fichiersDuCommitGit(sha, repoRoot()),
  })
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

// ── C2/C3/C4/C5 : les règles resserrées après le juge de diff ─────────────────────────────────────
test('fichiersDuCommitGit : un RENOMMAGE rend les deux chemins NUS, jamais « {ancien => nouveau} »', () => {
  // Mesuré sur 26be12347 : `.claude/soldes/revue-palier.md` renommée en `revue-palier-2205fde51.md`.
  // Sans `--no-renames`, `git show --numstat` rend UNE ligne agrégée qu'aucun chemin cité n'égale —
  // un solde JUSTE était refusé.
  const repo = mkdtempSync(join(tmpdir(), 'solde-renommage-'))
  try {
    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    git('init', '-q')
    git('config', 'user.email', 'sonde@test')
    git('config', 'user.name', 'sonde')
    git('config', 'commit.gpgsign', 'false')
    mkdirSync(join(repo, 'src'), { recursive: true })
    writeFileSync(join(repo, 'src', 'ancien.ts'), 'export const a = 1\n'.repeat(20), 'utf8')
    git('add', '-A')
    git('commit', '-q', '--no-verify', '-m', 'socle')
    execFileSync('git', ['mv', 'src/ancien.ts', 'src/nouveau.ts'], { cwd: repo, stdio: 'ignore' })
    git('commit', '-q', '--no-verify', '-am', 'renomme')
    const sha = git('rev-parse', 'HEAD').trim()

    const touches = fichiersDuCommitGit(sha, repo)
    assert.ok(touches.includes('src/nouveau.ts'), `chemins rendus : ${JSON.stringify(touches)}`)
    assert.ok(touches.includes('src/ancien.ts'), `chemins rendus : ${JSON.stringify(touches)}`)
    assert.deepEqual(touches.filter((f) => f.includes('=>')), [], 'un chemin agrégé « {a => b} » reste illisible pour un solde')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('EXEMPTIONS_TOMBALE : stock NOMINATIF au site, borné, chaque entrée justifiée', () => {
  assert.ok(EXEMPTIONS_TOMBALE.length <= 5, `stock d'exemption à ${EXEMPTIONS_TOMBALE.length} — il DÉCROÎT`)
  for (const { site, raison } of EXEMPTIONS_TOMBALE) {
    assert.match(site, /^[\w./-]+:\d+$/, `exemption non ancrée à un SITE : "${site}" (jamais un fichier entier)`)
    assert.ok(raison.length >= 30, `exemption "${site}" sans raison lisible`)
  }
  assert.equal(new Set(EXEMPTIONS_TOMBALE.map((e) => e.site)).size, EXEMPTIONS_TOMBALE.length)
})

test('tombalesDansSource : un mot d\'ÉTAT du domaine n\'est pas une dette', () => {
  const etat = ['/** Ouverture cérémonielle EN ATTENTE (#4242) — posée par loadProject. */', 'const x = 1', ''].join('\n')
  const regle = ['/** Départ BLOQUÉ par la porte d\'heure maison (#4242) ? */', 'const y = 2', ''].join('\n')
  assert.deepEqual(tombalesDansSource([4242], { fichiers: ['src/a.ts'], lire: () => etat }), [])
  assert.deepEqual(tombalesDansSource([4242], { fichiers: ['src/b.ts'], lire: () => regle }), [])
})

test('tombalesDansSource : une dette DÉCLARÉE ÉTEINTE sur la ligne n\'en est plus une', () => {
  const eteinte = ['// dette #4242, résorbée par le renommage du champ', 'const x = 1', ''].join('\n')
  const vivante = ['// dette #4242 : le cas B reste à traiter', 'const y = 2', ''].join('\n')
  assert.deepEqual(tombalesDansSource([4242], { fichiers: ['src/a.ts'], lire: () => eteinte }), [])
  assert.equal(tombalesDansSource([4242], { fichiers: ['src/b.ts'], lire: () => vivante }).length, 1)
})

test('estFichierEcran : borné au RENDU — un module de calcul sous src/ui n\'est pas un écran', () => {
  assert.equal(estFichierEcran('src/ui/breakdown.ts'), false)
  assert.equal(estFichierEcran('src/gameIso/builders/walls.ts'), false)
  assert.equal(estFichierEcran('src/ui/styles/tabs.css'), true)
  assert.equal(estFichierEcran('src/engine/tables.ts'), false)
})

test('evaluateHunksEmportes : `git commit -a` emporte TOUT le modifié suivi → contexte nommé', () => {
  const d = evaluateHunksEmportes({
    command: 'git commit -am "x"',
    fichiersModifies: ['src/a.ts', 'src/b.ts'],
    fichiersStages: ['src/a.ts'],
  })
  assert.ok(d, '`-a` passé en silence')
  assert.equal(d.decision, undefined, 'jamais un refus : `-a` est un geste légitime')
  assert.match(d.contexte, /src\/b\.ts/)
  assert.doesNotMatch(d.contexte, /src\/a\.ts/, 'ce que l\'index porte déjà n\'est pas une surprise')
  assert.equal(evaluateHunksEmportes({ command: 'git commit -a -m "x"', fichiersModifies: [], fichiersStages: [] }), null)
})
