// Les fonctions PURES de `faits-de-palier.mjs` : lecture des arguments, du journal git, des
// fermetures, du journal de dérogations et des courses CI. La lecture RÉELLE (git, gh, npm audit)
// n'est pas testée ici — elle compose des hôtes qui portent déjà leurs propres tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { soldesSuivis } from './fermetures-non-citees.mjs';
import {
  CHAMP,
  ENREGISTREMENT,
  analyserArguments,
  derogationsDeLaFenetre,
  derogationsDuJournal,
  fermeturesDesCommits,
  marquerSubstance,
  parserJournal,
  runsParCommit,
  sortieParDefaut,
} from './faits-de-palier.mjs';

test('analyserArguments : la fenêtre se lit, elle ne se devine pas', () => {
  const lu = analyserArguments(['--base', 'aaaaaaaaa', '--tete', 'bbbbbbbbb', '--revue-precedente', 'x.md', '--hors-ligne']);
  assert.equal(lu.base, 'aaaaaaaaa');
  assert.equal(lu.tete, 'bbbbbbbbb');
  assert.equal(lu.revuePrecedente, 'x.md');
  assert.equal(lu.horsLigne, true);
  assert.equal(lu.sansChainage, false);
  assert.equal(lu.sortie, null);
});

test('analyserArguments : `--sortie` et `--sans-chainage` (banc) se lisent', () => {
  // Le chemin n'est ici qu'un JETON : `analyserArguments` est PUR, il ne l'ouvre pas. Il s'écrit donc
  // sans lettre de lecteur — une fixture ne nomme aucune machine (`src/portable-paths-guard.test.ts`).
  const lu = analyserArguments(['--base', 'aaaaaaaaa', '--tete', 'bbbbbbbbb', '--sortie', '/faits-de-banc.json', '--sans-chainage']);
  assert.equal(lu.sortie, '/faits-de-banc.json');
  assert.equal(lu.sansChainage, true);
});

test('sortieParDefaut : hors de l’arbre mesuré, nommée par la fenêtre', () => {
  const chemin = sortieParDefaut('f0f9436f5', 'c5b9087dcabc').replace(/\\/g, '/');
  assert.match(chemin, /wfrp-faits-de-palier\/faits-f0f9436f5-c5b9087dc\.json$/);
});

test('analyserArguments : sans base ni tête, l’erreur NOMME ce qui manque', () => {
  assert.throws(() => analyserArguments([]), /--base <sha>.*--tete <sha>/s);
  assert.throws(() => analyserArguments(['--base', 'aaa']), /--tete <sha>/);
});

test('parserJournal : un enregistrement par commit, sujet et corps séparés', () => {
  const brut = [
    `aaa111${CHAMP}feat: un sujet${CHAMP}feat: un sujet\n\ncorrige #12${ENREGISTREMENT}`,
    `bbb222${CHAMP}chore: un autre${CHAMP}chore: un autre${ENREGISTREMENT}`,
  ].join('\n');
  const commits = parserJournal(brut);
  assert.equal(commits.length, 2);
  assert.deepEqual(commits.map((c) => c.sha), ['aaa111', 'bbb222']);
  assert.equal(commits[0].sujet, 'feat: un sujet');
  assert.match(commits[0].corps, /corrige #12/);
});

test('parserJournal : un journal vide ne rend aucun commit', () => {
  assert.deepEqual(parserJournal(''), []);
  assert.deepEqual(parserJournal(null), []);
});

test('marquerSubstance : seuls les commits qui touchent src/scripts comptent pour le palier', () => {
  const marques = marquerSubstance([{ sha: 'aaa' }, { sha: 'bbb' }], ['aaa']);
  assert.deepEqual(marques.map((c) => c.substance), [true, false]);
});

test('fermeturesDesCommits : les fermetures citées, croisées avec les soldes SUIVIS', () => {
  const commits = [
    { sha: 'aaa', sujet: 'feat: x', corps: 'corrige #1679' },
    { sha: 'bbb', sujet: 'fix: y closes #42', corps: 'fix: y closes #42' },
  ];
  const fermetures = fermeturesDesCommits(commits, new Set(['1679']));
  assert.deepEqual(fermetures.map((f) => [f.numero, f.sha, f.solde]), [['1679', 'aaa', true], ['42', 'bbb', false]]);
});

test('fermeturesDesCommits : un numéro cité deux fois par le MÊME commit ne compte qu’une fois', () => {
  const commits = [{ sha: 'aaa', sujet: 'feat: x corrige #7', corps: 'feat: x corrige #7\n\ncorrige #7' }];
  assert.equal(fermeturesDesCommits(commits, []).length, 1);
});

test('derogationsDuJournal : chaque tentative journalisée est rendue, la fenêtre est marquée', () => {
  const journal = [
    '2026-09-03T10:00:00.000Z\ttentative\taaa\tcorrectif de la CI rouge elle-même',
    '2026-09-04T10:00:00.000Z\ttentative\tzzz\tune autre raison de vingt caractères',
    '',
  ].join('\n');
  const lues = derogationsDuJournal(journal, ['aaa']);
  assert.equal(lues.length, 2);
  assert.deepEqual(lues.map((d) => d.dansLaFenetre), [true, false]);
  assert.equal(lues[0].raison, 'correctif de la CI rouge elle-même');
  assert.equal(lues[0].etat, 'tentative');
});

test('derogationsDuJournal : la graphie SANS marqueur (journal réel) rattache la ligne à son sha', () => {
  const ligne = '2026-09-04T12:02:57.887Z\tf3d23dfedd1131b8868584a8ddc53b52bc517ff8\tcorrige le rouge de main (banc météo)';
  const [lue] = derogationsDuJournal(ligne, ['f3d23dfedd1131b8868584a8ddc53b52bc517ff8']);
  assert.equal(lue.sha, 'f3d23dfedd1131b8868584a8ddc53b52bc517ff8');
  assert.equal(lue.etat, '(sans marqueur)');
  assert.equal(lue.raison, 'corrige le rouge de main (banc météo)');
  assert.equal(lue.dansLaFenetre, true);
});

test('derogationsDeLaFenetre : la revue ne reçoit QUE sa fenêtre, le reste est un NOMBRE', () => {
  const journal = [
    '2026-09-03T10:00:00.000Z\ttentative\taaaaaaaaa\tcorrectif de la CI rouge elle-même',
    '2026-09-04T10:00:00.000Z\ttentative\tzzzzzzzzz\tune autre raison de vingt caractères',
    '2026-09-04T11:00:00.000Z\ttentative\tyyyyyyyyy\tencore une autre raison journalisée',
  ].join('\n');
  const lues = derogationsDeLaFenetre(journal, ['aaaaaaaaa']);
  assert.equal(lues.dansLaFenetre.length, 1);
  assert.equal(lues.dansLaFenetre[0].sha, 'aaaaaaaaa');
  assert.equal(lues.horsFenetre, 2);
});

test('runsParCommit : un commit sans course est rendu VIDE, jamais omis', () => {
  const brut = JSON.stringify([
    { headSha: 'aaa', conclusion: 'success', status: 'completed', workflowName: 'CI' },
    { headSha: 'aaa', conclusion: 'failure', status: 'completed', workflowName: 'Canari' },
    { headSha: 'ccc', conclusion: 'success', status: 'completed', workflowName: 'CI' },
  ]);
  const parSha = runsParCommit(brut, ['aaa', 'bbb']);
  assert.deepEqual(parSha.map((r) => r.sha), ['aaa', 'bbb']);
  assert.deepEqual(parSha[0].courses.map((c) => c.conclusion), ['success', 'failure']);
  assert.deepEqual(parSha[1].courses, []);
});

test('runsParCommit : une sortie illisible ne fait pas tomber la mesure', () => {
  assert.deepEqual(runsParCommit('pas du json', ['aaa']), [{ sha: 'aaa', courses: [] }]);
});

test('soldesSuivis lit l’ARBRE qu’on lui donne (un objet de faits ne mélange pas deux arbres)', () => {
  const depot = mkdtempSync(join(tmpdir(), 'wfrp-soldes-'));
  execFileSync('git', ['init', '--quiet'], { cwd: depot, stdio: ['ignore', 'ignore', 'ignore'] });
  mkdirSync(join(depot, '.claude', 'soldes'), { recursive: true });
  writeFileSync(join(depot, '.claude', 'soldes', '4242.md'), 'solde de banc\n');
  writeFileSync(join(depot, '.claude', 'soldes', '4243.md'), 'jamais ajouté à l’index\n');
  execFileSync('git', ['add', '.claude/soldes/4242.md'], { cwd: depot, stdio: ['ignore', 'ignore', 'ignore'] });
  const suivis = soldesSuivis(depot);
  assert.equal(suivis.has('4242'), true, 'le solde SUIVI de cet arbre est vu');
  assert.equal(suivis.has('4243'), false, 'un fichier seulement présent sur le disque n’est pas un solde suivi');
});
