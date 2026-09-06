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
  coursesParCommit,
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

/** Le séparateur d'enregistrements du journal — une ligne par tentative. */
const NL = '\n';

test('derogationsDuJournal : chaque tentative journalisée est rendue, la fenêtre est marquée', () => {
  const journal = [
    JSON.stringify({ horodatage: '2026-09-03T10:00:00.000Z', etat: 'tentative', motif: 'rouge', sha: 'aaa', raison: 'correctif de la CI rouge elle-même' }),
    JSON.stringify({ horodatage: '2026-09-04T10:00:00.000Z', etat: 'tentative', motif: 'non-consultable', sha: 'zzz', raison: 'une autre raison de vingt caractères' }),
    '',
  ].join(NL);
  const lues = derogationsDuJournal(journal, ['aaa']);
  assert.equal(lues.length, 2);
  assert.deepEqual(lues.map((d) => d.dansLaFenetre), [true, false]);
  assert.equal(lues[0].raison, 'correctif de la CI rouge elle-même');
  assert.equal(lues[0].etat, 'tentative');
  assert.deepEqual(lues.map((d) => d.motif), ['rouge', 'non-consultable']);
});

// La fenêtre d'une revue est faite des commits POUSSÉS : une dérogation attribuée au commit qui l'a
// CAUSÉE (tête de main, course rouge — un ancêtre déjà publié) sortait de toute fenêtre (#1679 L3b).
test('derogationsDuJournal : la fenêtre retrouve la dérogation par le commit POUSSÉ, pas par sa cause', () => {
  const journal = JSON.stringify({
    horodatage: '2026-09-05T10:00:00.000Z',
    etat: 'tentative',
    motif: 'rouge',
    sha: 'pousse111',
    shaCause: 'rouge999',
    raison: 'correctif de la CI rouge elle-même',
  });
  const [lue] = derogationsDuJournal(journal, ['pousse111']);
  assert.equal(lue.dansLaFenetre, true);
  assert.equal(lue.shaCause, 'rouge999');
  assert.equal(derogationsDuJournal(journal, ['rouge999'])[0].dansLaFenetre, false);
});

// Une ligne qui n'est pas un objet JSON n'est pas DEVINÉE : un lecteur qui devine une graphie
// fabrique des dérogations à partir de n'importe quoi.
test('derogationsDuJournal : une ligne non JSON est rendue ILLISIBLE, jamais interprétée', () => {
  const journal = [
    '2026-09-04T12:02:57.887Z	f3d23dfedd1131b8868584a8ddc53b52bc517ff8	corrige le rouge de main (banc météo)',
    '["pas un objet"]',
  ].join(NL);
  const lues = derogationsDuJournal(journal, ['f3d23dfedd1131b8868584a8ddc53b52bc517ff8']);
  assert.deepEqual(lues.map((d) => d.etat), ['illisible', 'illisible']);
  assert.equal(lues[0].ligne.startsWith('2026-09-04T12:02:57.887Z'), true);
  assert.deepEqual(lues.map((d) => d.dansLaFenetre), [false, false]);
});

test('derogationsDeLaFenetre : la revue ne reçoit QUE sa fenêtre ; hors-fenêtre et ILLISIBLES se comptent à part', () => {
  const journal = [
    JSON.stringify({ horodatage: '2026-09-03T10:00:00.000Z', etat: 'tentative', motif: 'rouge', sha: 'aaaaaaaaa', raison: 'correctif de la CI rouge elle-même' }),
    JSON.stringify({ horodatage: '2026-09-04T10:00:00.000Z', etat: 'tentative', motif: 'perimee', sha: 'zzzzzzzzz', raison: 'une autre raison de vingt caractères' }),
    JSON.stringify({ horodatage: '2026-09-04T11:00:00.000Z', etat: 'tentative', motif: 'rouge', sha: 'yyyyyyyyy', raison: 'encore une autre raison journalisée' }),
    'ligne corrompue, ni JSON ni rien',
  ].join(NL);
  const lues = derogationsDeLaFenetre(journal, ['aaaaaaaaa']);
  assert.equal(lues.dansLaFenetre.length, 1);
  assert.equal(lues.dansLaFenetre[0].sha, 'aaaaaaaaa');
  assert.equal(lues.horsFenetre, 2);
  assert.equal(lues.illisibles, 1);
});

test('coursesParCommit : un commit sans course est rendu VIDE, jamais omis', () => {
  const servies = [
    { headSha: 'aaa', conclusion: 'success', status: 'completed', workflowName: 'CI' },
    { headSha: 'aaa', conclusion: 'failure', status: 'completed', workflowName: 'Canari' },
    { headSha: 'ccc', conclusion: 'success', status: 'completed', workflowName: 'CI' },
  ];
  const parSha = coursesParCommit(servies, ['aaa', 'bbb']);
  assert.deepEqual(parSha.map((r) => r.sha), ['aaa', 'bbb']);
  assert.deepEqual(parSha[0].courses.map((c) => c.conclusion), ['success', 'failure']);
  assert.deepEqual(parSha[1].courses, []);
});

test('coursesParCommit : une liste absente ne fait pas tomber la mesure', () => {
  assert.deepEqual(coursesParCommit(null, ['aaa']), [{ sha: 'aaa', courses: [] }]);
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
