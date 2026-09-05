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

/** `trouvaillesDe(label)` décide ce que rend chaque lentille ; le réfutateur confirme tout ce qu'il reçoit. */
const jouerRevue = ({ mode = 'palier', chainage = 'vérifié', dod = [], trouvaillesDe = null } = {}) => jouer(
  'revue-palier.js',
  { worktree: ARBRE, scratchpad: SONDES, base: BASE, tete: TETE, date: DATE, mode, dod, faits: faits(chainage) },
  (prompt, opts) => {
    if (opts.phase === 'Lentilles') {
      if (trouvaillesDe) return { trouvailles: trouvaillesDe(opts.label), tenues: [] };
      return opts.label === 'fermetures-soldes'
        ? { trouvailles: [{ titre: 'Un solde qui ne répond pas', preuve: `vu de ${BASE} à ${TETE}`, attendu: 'le solde répond au DoD' }], tenues: ['le reste tient'] }
        : { trouvailles: [], tenues: [`${opts.label} : rien à dire`] };
    }
    // Un réfutateur juge un LOT : il rend UN verdict par trouvaille reçue, apparié par le titre.
    const recues = JSON.parse(prompt.slice(prompt.indexOf('TROUVAILLES : ') + 14, prompt.indexOf('\n\nArbre jugé')));
    return { verdicts: recues.map((t) => ({ titre: t.titre, confirmee: true, bloquante: false, preuve: 'confirmé sur pièces' })) };
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
  assert.deepEqual(rendu.agents, { lentilles: 5, refutation: 0, total: 5 });
});

test('revue-palier : UN réfutateur PAR LENTILLE, pas par trouvaille', async () => {
  const { rendu, promptsParLabel } = await jouerRevue({
    trouvaillesDe: (label) => (['fermetures-soldes', 'cross-os'].includes(label)
      ? [1, 2, 3].map((n) => ({ titre: `${label} — trouvaille ${n}`, preuve: 'p', attendu: 'a' }))
      : []),
  });
  assert.deepEqual(rendu.agents, { lentilles: 8, refutation: 2, total: 10 });
  assert.deepEqual(
    [...promptsParLabel.keys()].filter((c) => c.startsWith('Réfutation:')).sort(),
    ['Réfutation:refutation:cross-os', 'Réfutation:refutation:fermetures-soldes'],
  );
  assert.equal(rendu.trouvailles.length, 6, '6 trouvailles jugées par 2 agents');
});

test('revue-palier : au-delà de 12 trouvailles, une lentille en garde 12 jugées et 3 NON RÉFUTÉES, dites', async () => {
  const { rendu, journal } = await jouerRevue({
    trouvaillesDe: (label) => (label === 'poison-des-diffs'
      ? Array.from({ length: 15 }, (_, i) => ({ titre: `poison ${i + 1}`, preuve: 'p', attendu: 'a' }))
      : []),
  });
  assert.deepEqual(rendu.agents, { lentilles: 8, refutation: 1, total: 9 }, 'UN seul réfutateur pour 15 trouvailles');
  assert.equal(rendu.trouvailles.length, 15, 'aucune trouvaille n’est perdue');
  const nonRefutees = rendu.trouvailles.filter((t) => t.nonRefutee);
  assert.equal(nonRefutees.length, 3, '15 − 12 = 3 au-delà du plafond');
  assert.deepEqual(nonRefutees.map((t) => t.titre), ['poison 13', 'poison 14', 'poison 15']);
  assert.ok(journal.some((l) => /3 trouvaille\(s\) AU-DELÀ du plafond/.test(l)), 'le plafond est DIT dans le journal');
  assert.match(rendu.texte, /3 trouvaille\(s\) NON RÉFUTÉE\(S\) au-delà du plafond/);
  assert.match(rendu.texte, /NON RÉFUTÉE : au-delà du plafond de 12 trouvailles par réfutateur/);
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

/** `bloquantsDe(label)` décide ce que rend chaque lentille de design ; le réfutateur ne réfute rien. */
const jouerJuge = (invariants, bloquantsDe = null) => jouer(
  'juge-design-socle.js',
  { brief: BRIEF, worktree: ARBRE, date: DATE, scratchpad: SONDES },
  (prompt, opts) => {
    if (opts.phase === 'Lecture') return lectureL3(invariants);
    if (opts.phase === 'Design') {
      const bloquants = bloquantsDe
        ? bloquantsDe(opts.label)
        : [{ titre: `Un bloquant de ${opts.label}`, preuve: 'preuve', correction: 'correction', structurel: false }];
      return { verdict: bloquants.length ? 'FRAGILE' : 'TIENT', bloquants, dits: ['un dit'] };
    }
    // Un réfutateur juge un LOT : UN verdict par bloquant reçu, apparié par le titre.
    const recus = JSON.parse(prompt.slice(prompt.indexOf('BLOQUANTS : ') + 12, prompt.indexOf('\n\nArbre jugé')));
    return { verdicts: recus.map((b) => ({ titre: b.titre, refute: false, preuve: 'il tient', structurel: false })) };
  },
);

test('juge-design-socle : un brief qui porte SIX invariants atteint la phase Design', async () => {
  const { rendu, promptsParLabel } = await jouerJuge(INVARIANTS_L3);
  assert.notEqual(rendu.verdict, 'ARRÊT', `manques rendus : ${(rendu.manques || []).join(' · ')}`);
  assert.equal(rendu.lecture.invariants.length, 6);
  assert.ok(promptsParLabel.has('Design:trou-de-socle'), 'la phase Design est atteinte');
  assert.ok([...promptsParLabel.keys()].some((c) => c.startsWith('Réfutation:')), 'la phase Réfutation est atteinte');
  assert.equal(rendu.verdict, 'FRAGILE');
});

test('juge-design-socle : UN réfutateur par lentille, CROISÉ (A→B, B→C, C→A)', async () => {
  const { rendu, promptsParLabel } = await jouerJuge(INVARIANTS_L3);
  assert.deepEqual(rendu.agents, { lecture: 1, design: 3, refutation: 3, total: 7 });
  assert.deepEqual(
    [...promptsParLabel.keys()].filter((c) => c.startsWith('Réfutation:')),
    [
      'Réfutation:refutation:trou-de-socle→preuve-par-sonde',
      'Réfutation:refutation:preuve-par-sonde→normes-et-poison',
      'Réfutation:refutation:normes-et-poison→trou-de-socle',
    ],
    'aucun juge ne réfute ses propres bloquants',
  );
  const croise = promptsParLabel.get('Réfutation:refutation:trou-de-socle→preuve-par-sonde');
  assert.match(croise, /TA LENTILLE : LENTILLE — PREUVE PAR SONDE/, 'le réfutateur reçoit la consigne de SA lentille');
  assert.match(croise, /Un bloquant de trou-de-socle/, 'et les bloquants de l’AUTRE');
});

test('juge-design-socle : au-delà de 8 bloquants, une lentille en garde 8 jugés et 2 NON RÉFUTÉS, dits', async () => {
  const { rendu, journal } = await jouerJuge(INVARIANTS_L3, (label) => (label === 'trou-de-socle'
    ? Array.from({ length: 10 }, (_, i) => ({ titre: `trou ${i + 1}`, preuve: 'p', correction: 'c', structurel: false }))
    : []));
  assert.deepEqual(rendu.agents, { lecture: 1, design: 3, refutation: 1, total: 5 }, 'UN seul réfutateur pour 10 bloquants');
  assert.equal(rendu.bloquants.length, 10, 'aucun bloquant n’est perdu');
  const nonRefutes = rendu.bloquants.filter((b) => b.nonRefute);
  assert.deepEqual(nonRefutes.map((b) => b.titre), ['trou 9', 'trou 10']);
  assert.ok(journal.some((l) => /2 bloquant\(s\) AU-DELÀ du plafond/.test(l)), 'le plafond est DIT dans le journal');
  assert.match(rendu.bloc, /2 NON RÉFUTÉ\(S\) au-delà du plafond de 8 par réfutateur/);
});

test('juge-design-socle : `structurel` demande les DEUX voix, auteur ET réfutateur', async () => {
  const rendus = [];
  for (const [auteurStructurel, refutateurStructurel] of [[true, true], [true, false], [false, true]]) {
    const { rendu } = await jouer('juge-design-socle.js', { brief: BRIEF, worktree: ARBRE, date: DATE, scratchpad: SONDES }, (prompt, opts) => {
      if (opts.phase === 'Lecture') return lectureL3(INVARIANTS_L3);
      if (opts.phase === 'Design') {
        return opts.label === 'trou-de-socle'
          ? { verdict: 'FRAGILE', bloquants: [{ titre: 'le seul bloquant', preuve: 'p', correction: 'c', structurel: auteurStructurel }], dits: [] }
          : { verdict: 'TIENT', bloquants: [], dits: [] };
      }
      const recus = JSON.parse(prompt.slice(prompt.indexOf('BLOQUANTS : ') + 12, prompt.indexOf('\n\nArbre jugé')));
      return { verdicts: recus.map((b) => ({ titre: b.titre, refute: false, preuve: 'p', structurel: refutateurStructurel })) };
    });
    rendus.push(rendu);
  }
  assert.deepEqual(rendus.map((r) => r.bloquants[0].structurel), [true, false, false]);
  assert.deepEqual(rendus.map((r) => r.verdict), ['RÉFUTÉ', 'FRAGILE', 'FRAGILE']);
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
