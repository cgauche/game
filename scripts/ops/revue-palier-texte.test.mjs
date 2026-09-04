// CE QUE `revue-palier.js` PRODUIT, joué pour de vrai — sans un seul agent.
//
// Le script est du JavaScript pur qu'aucun `import` ne peut charger (`export const meta` d'un côté,
// `return` de premier niveau de l'autre : le harnais l'enveloppe dans une fonction async). Ce test
// l'enveloppe DE LA MÊME FAÇON et lui donne des doublures pour `agent`/`parallel`/`pipeline` : ce
// qui est vérifié est alors le TEXTE réellement rendu, pas une réécriture de ce texte dans un test.
//
// Trois choses s'y jouent : la porte de solde accepte-t-elle ce texte (`validateRevuePalier`), le
// nom d'archive se déduit-il de lui (`nomDArchiveDeRevue`), et un rejeu de BANC se dit-il comme tel.
// Plus une quatrième, qui décide du COÛT : chaque lentille ne reçoit QUE les faits de son angle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRevuePalier } from '../hooks/solde-ticket-guard.mjs';
import { fenetreDeRevue, nomDArchiveDeRevue } from '../guards/lib/revuePalier.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = join(RACINE, '.claude', 'workflows', 'revue-palier.js');
const DATE = '2026-09-04';
const BASE = 'f0f9436f5';
const TETE = 'c5b9087dc';
const MARQUEUR_REVUE = 'MARQUEUR-DE-LA-REVUE-PRECEDENTE';
// Chemins de FIXTURE : le script ne les OUVRE pas, il les recopie dans ses prompts. Ils s'écrivent
// donc sans lettre de lecteur — une fixture ne nomme aucune machine (`src/portable-paths-guard.test.ts`).
const FAITS_CHEMIN = '/faits-de-palier/faits.json';
const ARBRE = '/arbre-jete';
const SONDES = '/sondes-jetees';

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

/** Le script, enveloppé comme le harnais l'enveloppe, avec ses doublures. */
async function jouer({ mode = 'palier', chainage = 'vérifié', dod = [] } = {}) {
  const source = readFileSync(SCRIPT, 'utf8').replace(/^export const meta/m, 'const meta');
  const promptsParLabel = new Map();
  const journal = [];
  const agent = (prompt, opts) => {
    promptsParLabel.set(`${opts.phase}:${opts.label}`, prompt);
    if (opts.phase === 'Lentilles') {
      return Promise.resolve(opts.label === 'fermetures-soldes'
        ? { trouvailles: [{ titre: 'Un solde qui ne répond pas', preuve: `vu de ${BASE} à ${TETE}`, attendu: 'le solde répond au DoD' }], tenues: ['le reste tient'] }
        : { trouvailles: [], tenues: [`${opts.label} : rien à dire`] });
    }
    return Promise.resolve({ confirmee: true, preuve: 'confirmé sur pièces', bloquante: false });
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
  const rendu = await fabrique(
    agent, parallel, pipeline, () => {}, (m) => journal.push(m),
    { worktree: ARBRE, scratchpad: SONDES, base: BASE, tete: TETE, date: DATE, mode, dod, faits: faits(chainage) },
    undefined,
  );
  return { rendu, promptsParLabel, journal };
}

test('mode palier : le texte PASSE la porte de solde et se NOMME lui-même', async () => {
  const { rendu } = await jouer();
  assert.equal(rendu.verdict, 'PARTIEL');
  assert.equal(rendu.banc, false);
  assert.equal(rendu.texte.split('\n')[0], `# Revue de palier — fenêtre ${BASE}..${TETE} — ${DATE}`);
  const porte = validateRevuePalier(rendu.texte, DATE);
  assert.deepEqual(porte.problems, []);
  assert.equal(porte.ok, true);
  assert.equal(nomDArchiveDeRevue(rendu.texte), `revue-palier-${DATE}-${BASE}.md`);
  assert.deepEqual(fenetreDeRevue(rendu.texte), { date: DATE, base: BASE, tete: TETE });
});

test('mode palier : UNE seule plage `sha..sha` dans tout le texte — les preuves écrivent « de X à Y »', async () => {
  const { rendu } = await jouer();
  const plages = rendu.texte.match(/[0-9a-f]{7,40}\.\.[0-9a-f]{7,40}/g) ?? [];
  assert.equal(plages.length, 1, `plages trouvées : ${plages.join(', ')}`);
  assert.match(rendu.texte, /de f0f9436f5 à c5b9087dc/);
});

test('BANC : un rejeu sans chaînage se DIT dans le texte, et reste lisible par la porte', async () => {
  const { rendu } = await jouer({ chainage: "ignoré (--sans-chainage, banc) — base attendue par l'histoire : f0f9436f5, base jouée : 2c11fdd9a" });
  assert.equal(rendu.banc, true);
  assert.equal(rendu.texte.split('\n')[0], `# BANC — revue de palier REJOUÉE sur la fenêtre ${BASE}..${TETE} — ${DATE}`);
  assert.match(rendu.texte, /^banc: chaînage ignoré \(--sans-chainage\) — fenêtre déjà jugée par \.claude\/soldes\/revue-palier-2026-09-04-2c11fdd9a\.md ; ce texte est une MESURE, il ne s’archive pas\.$/m);
  assert.equal(validateRevuePalier(rendu.texte, DATE).ok, true);
});

test('mode refutation : aucun texte de solde n’est fabriqué', async () => {
  const { rendu } = await jouer({ mode: 'refutation', dod: ['la clause une', 'la clause deux'] });
  assert.equal(rendu.texte, null);
  assert.equal(rendu.mode, 'refutation');
  // 2 clauses de DoD + fermetures + hotfixes + dérogations = 5 lentilles, aucune trouvaille ici.
  assert.equal(rendu.agents, 5);
});

test('COÛT : chaque lentille ne reçoit QUE les faits de son angle', async () => {
  const { promptsParLabel } = await jouer();
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
