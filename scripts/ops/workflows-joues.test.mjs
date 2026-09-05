// LES SCRIPTS DE WORKFLOW, JOUÉS AVEC DES DOUBLURES — sans un seul agent.
//
// Un script de `.claude/workflows/` est du JavaScript pur qu'aucun `import` ne peut charger
// (`export const meta` d'un côté, `return` de premier niveau de l'autre : le harnais l'enveloppe
// dans une fonction async). Ces tests l'enveloppent DE LA MÊME FAÇON et lui donnent des doublures
// pour `agent`/`parallel`/`pipeline` : ce qui est vérifié est ce que le script REND et ce qu'il
// ENVOIE, pas une réécriture de l'un ou de l'autre dans un test.
//
// `workflows.test.mjs` juge leur FORME (sans les exécuter) ; ce fichier-ci juge leur COMPORTEMENT.
//
// Ce qui s'y joue : la porte de solde accepte-t-elle le texte de `revue-palier`
// (`validateRevuePalier`), s'en déduit-il un nom d'archive (`nomDArchiveDeRevue`), un rejeu de BANC
// se dit-il comme tel, chaque lentille ne reçoit-elle QUE les faits de son angle (le COÛT), et
// `juge-design-socle` laisse-t-il passer un brief qui porte SIX invariants (deux runs réels arrêtés
// à tort : wf_2595703f-917, wf_cd16b62d-d3b).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRevuePalier } from '../hooks/solde-ticket-guard.mjs';
import { fenetreDeRevue, nomDArchiveDeRevue } from '../guards/lib/revuePalier.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const DOSSIER = join(RACINE, '.claude', 'workflows');
const DATE = '2026-09-04';
const BASE = 'f0f9436f5';
const TETE = 'c5b9087dc';
const MARQUEUR_REVUE = 'MARQUEUR-DE-LA-REVUE-PRECEDENTE';
// Chemins de FIXTURE : les scripts ne les OUVRENT pas, ils les recopient dans leurs prompts. Ils
// s'écrivent sans lettre de lecteur — une fixture ne nomme aucune machine
// (`src/portable-paths-guard.test.ts`).
const FAITS_CHEMIN = '/faits-de-palier/faits.json';
const ARBRE = '/arbre-jete';
const SONDES = '/sondes-jetees';
const BRIEF = '/briefs/brief-L3-socle.md';

/**
 * Joue un script de workflow dans l'enveloppe du harnais, avec des doublures.
 * `repondre(prompt, opts)` rend ce que l'agent aurait rendu, phase par phase.
 * @returns {{ rendu: object, promptsParLabel: Map<string, string>, journal: string[] }}
 */
async function jouer(nomDuScript, argsDuRun, repondre) {
  const source = readFileSync(join(DOSSIER, nomDuScript), 'utf8').replace(/^export const meta/m, 'const meta');
  const promptsParLabel = new Map();
  const journal = [];
  const agent = (prompt, opts) => {
    promptsParLabel.set(`${opts.phase}:${opts.label}`, prompt);
    return Promise.resolve(repondre(prompt, opts));
  };
  const parallel = (thunks) => Promise.all(thunks.map((t) => t()));
  const pipeline = async (items, ...stages) => {
    const out = [];
    for (const item of items) {
      let courant = item;
      for (const stage of stages) courant = await stage(courant);
      out.push(courant);
    }
    return out;
  };
  const fabrique = new Function(
    'agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget',
    `return (async () => {\n${source}\n})()`,
  );
  const rendu = await fabrique(agent, parallel, pipeline, () => {}, (m) => journal.push(m), argsDuRun, undefined);
  return { rendu, promptsParLabel, journal };
}

// ── `revue-palier.js` ────────────────────────────────────────────────────────────────────────────

const faits = (chainage) => ({
  base: BASE,
  tete: TETE,
  depuis: '2026-09-04',
  chainage,
  faitsChemin: FAITS_CHEMIN,
  commits: [{ sha: 'aaa111', sujet: 'feat: un lot', corps: 'feat: un lot\n\nCLIQUET: scripts/x.test.mjs +1 — raison assez longue pour compter', substance: true }],
  fermetures: [{ numero: '1679', sha: 'aaa111', sujet: 'feat: un lot', solde: true }],
  stocks: { disponible: true, valeur: { refus: [], notes: [], commits: 1 } },
  fermeturesHorsCommit: { disponible: false, raison: 'hors ligne' },
  auditStock: { disponible: false, raison: 'hors ligne' },
  derogations: { disponible: true, valeur: { dansLaFenetre: [], horsFenetre: 6 } },
  runsCi: { disponible: false, raison: 'hors ligne' },
  revuePrecedente: { chemin: '.claude/soldes/revue-palier-2026-09-04-2c11fdd9a.md', disponible: true, valeur: `# Revue précédente ${MARQUEUR_REVUE}` },
  provenance: { commits: 'script' },
});

const jouerRevue = ({ mode = 'palier', chainage = 'vérifié', dod = [] } = {}) => jouer(
  'revue-palier.js',
  { worktree: ARBRE, scratchpad: SONDES, base: BASE, tete: TETE, date: DATE, mode, dod, faits: faits(chainage) },
  (prompt, opts) => {
    if (opts.phase === 'Lentilles') {
      return opts.label === 'fermetures-soldes'
        ? { trouvailles: [{ titre: 'Un solde qui ne répond pas', preuve: `vu de ${BASE} à ${TETE}`, attendu: 'le solde répond au DoD' }], tenues: ['le reste tient'] }
        : { trouvailles: [], tenues: [`${opts.label} : rien à dire`] };
    }
    return { confirmee: true, preuve: 'confirmé sur pièces', bloquante: false };
  },
);

test('revue-palier, mode palier : le texte PASSE la porte de solde et se NOMME lui-même', async () => {
  const { rendu } = await jouerRevue();
  assert.equal(rendu.verdict, 'PARTIEL');
  assert.equal(rendu.banc, false);
  assert.equal(rendu.texte.split('\n')[0], `# Revue de palier — fenêtre ${BASE}..${TETE} — ${DATE}`);
  const porte = validateRevuePalier(rendu.texte, DATE);
  assert.deepEqual(porte.problems, []);
  assert.equal(porte.ok, true);
  assert.equal(nomDArchiveDeRevue(rendu.texte), `revue-palier-${DATE}-${BASE}.md`);
  assert.deepEqual(fenetreDeRevue(rendu.texte), { date: DATE, base: BASE, tete: TETE });
});

test('revue-palier : UNE seule plage `sha..sha` dans tout le texte — les preuves écrivent « de X à Y »', async () => {
  const { rendu } = await jouerRevue();
  const plages = rendu.texte.match(/[0-9a-f]{7,40}\.\.[0-9a-f]{7,40}/g) ?? [];
  assert.equal(plages.length, 1, `plages trouvées : ${plages.join(', ')}`);
  assert.match(rendu.texte, /de f0f9436f5 à c5b9087dc/);
});

test('revue-palier, BANC : un rejeu sans chaînage se DIT dans le texte, et reste lisible par la porte', async () => {
  const { rendu } = await jouerRevue({ chainage: "ignoré (--sans-chainage, banc) — base attendue par l'histoire : f0f9436f5, base jouée : 2c11fdd9a" });
  assert.equal(rendu.banc, true);
  assert.equal(rendu.texte.split('\n')[0], `# BANC — revue de palier REJOUÉE sur la fenêtre ${BASE}..${TETE} — ${DATE}`);
  assert.match(rendu.texte, /^banc: chaînage ignoré \(--sans-chainage\) — fenêtre déjà jugée par \.claude\/soldes\/revue-palier-2026-09-04-2c11fdd9a\.md ; ce texte est une MESURE, il ne s’archive pas\.$/m);
  assert.equal(validateRevuePalier(rendu.texte, DATE).ok, true);
});

test('revue-palier, mode refutation : aucun texte de solde n’est fabriqué', async () => {
  const { rendu } = await jouerRevue({ mode: 'refutation', dod: ['la clause une', 'la clause deux'] });
  assert.equal(rendu.texte, null);
  assert.equal(rendu.mode, 'refutation');
  // 2 clauses de DoD + fermetures + hotfixes + dérogations = 5 lentilles, aucune trouvaille ici.
  assert.equal(rendu.agents, 5);
});

test('revue-palier, COÛT : chaque lentille ne reçoit QUE les faits de son angle', async () => {
  const { promptsParLabel } = await jouerRevue();
  const revuePrec = promptsParLabel.get('Lentilles:restes-de-la-revue-precedente');
  const fermetures = promptsParLabel.get('Lentilles:fermetures-soldes');
  const poison = promptsParLabel.get('Lentilles:poison-des-diffs');
  assert.match(revuePrec, new RegExp(MARQUEUR_REVUE), 'la lentille des restes reçoit la revue précédente');
  assert.equal(fermetures.includes(MARQUEUR_REVUE), false, 'les autres lentilles ne la portent pas');
  assert.match(fermetures, /"fermetures"/);
  assert.equal(fermetures.includes('CLIQUET'), false, 'les commits arrivent SANS leur corps hors des angles qui le lisent');
  assert.match(poison, /CLIQUET/, 'la lentille du poison lit les messages entiers');
  assert.equal(fermetures.includes(FAITS_CHEMIN), true, 'le chemin des faits complets est donné pour le reste');
});

// ── `juge-design-socle.js` ───────────────────────────────────────────────────────────────────────

/** Les SIX invariants du premier brief de socle réellement soumis (#1679 L3), tels qu'il les porte. */
const INVARIANTS_L3 = [
  { verbatim: "**Une règle = une porte.** Aucun lot n'écrit une règle en prose sans le hook, le test ou la garde qui la joue.", source: 'plan #1679 approuvé par l’utilisateur le 2026-09-01, § Principes d’exécution, 1', question: 'pourquoi les règles du 30/08 ont-elles été violées 5 fois en 48 h ?' },
  { verbatim: 'jamais de push si le dernier run CI de `main` est rouge (attendre ou corriger)', source: '.claude/memory/user-regime-une-session-par-chantier-2026-09-01.md:24', question: 'comment plusieurs sessions poussent-elles sur un même tronc sans le casser ?' },
  { verbatim: '`ecrireJustificatif` ne dégrade JAMAIS un verdict propre', source: '.claude/soldes/revue-palier-82e95be10.md, écart 1', question: 'un rejeu de gate sur arbre sale peut-il détruire la preuve d’un push régulier ?' },
  { verbatim: '**UNE SEULE charge lourde par machine**', source: 'pilotage v7 de #1679 (issuecomment-5539586217, § Régime)', question: 'pourquoi 109 spawns refusés pendant les gates de T1d ?' },
  { verbatim: '`ECRIT_LU` reste la vérité mesurée', source: 'scripts/gates/toutes.mjs (en-tête posé par T1d a9b7edf17)', question: 'quelles gates peuvent tourner en parallèle sans se lire ni s’écrire ?' },
  { verbatim: 'Les motifs "fin du/de la <nom>" et "était <participe>" restent HORS des familles', source: 'src/comment-poison-guard.test.ts:58-59', question: 'faut-il une famille de garde pour "était <participe>" ?' },
];

const lectureL3 = (invariants) => ({
  invariants,
  casCanonique: [{ fichier: 'scripts/guards/lib/stocksNominatifs.mjs', ligne: 103, role: 'portée de module par l’AST' }],
  perimetre: ['scripts/guards/lib/stocksNominatifs.mjs', 'scripts/git-hooks/pre-push.mjs'],
  primitives: ['porteeDeModule', 'croissancesDeLaPlage'],
  designJugePresent: false,
  manques: [],
});

const jouerJuge = (invariants) => jouer(
  'juge-design-socle.js',
  { brief: BRIEF, worktree: ARBRE, date: DATE, scratchpad: SONDES },
  (prompt, opts) => {
    if (opts.phase === 'Lecture') return lectureL3(invariants);
    if (opts.phase === 'Design') return { verdict: 'FRAGILE', bloquants: [{ titre: 'Un bloquant', preuve: 'preuve', correction: 'correction' }], dits: ['un dit'] };
    return { refute: false, preuve: 'il tient', structurel: false };
  },
);

test('juge-design-socle : un brief qui porte SIX invariants atteint la phase Design', async () => {
  const { rendu, promptsParLabel } = await jouerJuge(INVARIANTS_L3);
  assert.notEqual(rendu.verdict, 'ARRÊT', `manques rendus : ${(rendu.manques || []).join(' · ')}`);
  assert.equal(rendu.lecture.invariants.length, 6);
  assert.ok(promptsParLabel.has('Design:trou-de-socle'), 'la phase Design est atteinte');
  assert.ok(promptsParLabel.has('Réfutation:refutation-1'), 'la phase Réfutation est atteinte');
  assert.equal(rendu.verdict, 'FRAGILE');
});

test('juge-design-socle : aucun invariant = ARRÊT nommé, avant tout jugement', async () => {
  const { rendu, promptsParLabel } = await jouerJuge([]);
  assert.equal(rendu.verdict, 'ARRÊT');
  assert.deepEqual(rendu.manques, ['`## Invariant` : aucun VERBATIM cité (source + question à laquelle il répondait)']);
  assert.equal(promptsParLabel.has('Design:trou-de-socle'), false, 'aucun juge n’est dispatché sur un brief non jugeable');
});

test('juge-design-socle : un invariant SANS sa question = ARRÊT qui le nomme par son rang', async () => {
  const sansQuestion = INVARIANTS_L3.map((i, rang) => (rang === 1 ? { verbatim: i.verbatim, source: i.source } : i));
  const { rendu } = await jouerJuge(sansQuestion);
  assert.equal(rendu.verdict, 'ARRÊT');
  assert.deepEqual(rendu.manques, ["invariant 2 sans la question à laquelle il répond — une citation prouve ce qu'elle RÉPOND, jamais ce qu'on lui fait dire"]);
});
