import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRollSeamExclusivity, ROLL_SEAM_RX, scanPendingJetFabrication, engineRollerExports, engineHomonyms, scanEngineDelegatedRoll } from '../../scripts/guards/lib/rollSeamExclusivity.mjs';
import { rollSeamExcluded, ROLL_SEAM_PHASE2_STOCK, PENDING_JET_FABRICATION_STOCK, ENGINE_DELEGATED_ROLL_STOCK, SEAM_CALLERS } from '../../scripts/guards/lib/rollSeamWhitelist.mjs';
import { scanBattleRngEngineLeak } from '../../scripts/guards/lib/battleRngEngineLeak.mjs';
import { battleRngEngineLeakExcluded } from '../../scripts/guards/lib/battleRngEngineLeakWhitelist.mjs';

/**
 * Garde-fou « exclusivité du seam de jet » (#274, DERNIER verrou du programme #276).
 * La porte `openRoll` (`src/state/rollSeam.ts`) +
 * `TestOutcome.seal` (`src/engine/testOutcome.ts`) sont le SEUL chemin scellé pour produire une issue
 * de Test — un `rollTest(`/`d100(`/`TestOutcome.seal(` inline hors whitelist forge un jet SANS passer
 * par la policy de surfaçage M/V/I (Décision 3). Double détente avec le hook pre-commit
 * (`scripts/git-hooks/pre-commit.mjs`) — un `rollTest` réintroduit dans un flow doit être rouge ICI
 * (CI/local) ET au commit.
 *
 * Ce qui n'est PAS une violation se décide par la FORME, pas par une liste de noms (#918 lot B) :
 *  - `src/engine/**` : moteur PUR, fonctions qui REÇOIVENT un `rng` sans jamais décider du
 *    surfaçage — c'est l'APPELANT (state/) qui choisit modale/MJ/inline (règle du seam elle-même).
 *  - (S) position de spec et (M) dé de monde : reconnues STRUCTURELLEMENT par le scanner (critères
 *    et angles morts en en-tête de `scripts/guards/lib/rollSeamExclusivity.mjs`).
 *  - `ROLL_SEAM_CORE` : les fichiers qui SONT le seam (porte, fabrique, séquenceur, résolveurs de
 *    spec, pont de Test déclenché) — exclusion de principe.
 *  - `ROLL_SEAM_PHASE2_STOCK` : le stock restant à router par `openRoll`, avec son compte par fichier
 *    vérifié plus bas (cf. `scripts/guards/lib/rollSeamWhitelist.mjs`).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/state/ → ../../ = racine du projet
const SCAN_DIRS = ['src'];

const EXCLUDED = (rel: string) => /\.test\.[tj]sx?$/.test(rel) || rollSeamExcluded(rel);

function scanFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e)) files.push(p);
    }
  };
  for (const d of SCAN_DIRS) walk(join(ROOT, d));
  return files;
}

function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of scanFiles()) {
    const rel = relative(ROOT, f).split('\\').join('/');
    if (EXCLUDED(rel)) continue;
    const n = scanRollSeamExclusivity(rel, readFileSync(f, 'utf8')).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('garde-fou « seam de jet » — exclusivité de rollTest/d100/TestOutcome.seal (cliquet, #274)', () => {
  it('aucun fichier hors whitelist ne roule/scelle un Test en direct', () => {
    const counts = countsByFile();
    const offenders = Object.entries(counts).map(([rel, n]) => `${rel} : ${n} site(s)`);
    expect(
      offenders,
      `Nouveau jet forgé hors seam — router par openRoll (src/state/rollSeam.ts) ou justifier l'entrée dans la whitelist (roll-seam-exclusivity-guard.test.ts) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('fail-closed : le scanner détecte un rollTest inline SYNTHÉTIQUE', () => {
    const regressed = "const res = rollTest(best.value, 'intermediaire', battleRng());";
    expect(scanRollSeamExclusivity('src/state/x.ts', regressed).length).toBe(1);
  });

  it('fail-closed : le scanner détecte un d100 inline SYNTHÉTIQUE (DR forgés à la main)', () => {
    const regressed = 'const sl = Math.floor(target / 10) - Math.floor(d100(rng) / 10);';
    expect(scanRollSeamExclusivity('src/state/x.ts', regressed).length).toBe(1);
  });

  it('fail-closed : le scanner détecte un TestOutcome.seal( hors seam SYNTHÉTIQUE', () => {
    const regressed = "return TestOutcome.seal({ roll: 1, target: 40, success: true, sl: 1, isDouble: false });";
    expect(scanRollSeamExclusivity('src/state/x.ts', regressed).length).toBe(1);
  });

  it('le noyau du seam (rollSeam.ts, hors scan) porte bien TestOutcome.seal( — sinon le foyer a bougé', () => {
    const src = readFileSync(join(ROOT, 'src/state/rollSeam.ts'), 'utf8');
    expect(scanRollSeamExclusivity('src/state/rollSeam.ts', src).length).toBeGreaterThan(0);
  });

  it('lignes EXACTES : un JSDoc de 10 lignes avant le site ne décale pas la ligne rapportée', () => {
    const src = [
      "import { rollTest } from '../engine/tests';",
      '/**',
      ' * 1', ' * 2', ' * 3', ' * 4', ' * 5', ' * 6', ' * 7', ' * 8',
      ' */',
      "const t = rollTest(40, 'intermediaire', battleRng());",
    ].join('\n');
    expect(scanRollSeamExclusivity('src/state/x.ts', src)).toEqual([
      { line: 12, detail: "rollTest(40, 'intermediaire', battleRng())" },
    ]);
  });

  it('(S) position de spec : un rollTest dans le callback `resolve` d’une spec makeRollFlow n’est pas une violation', () => {
    const spec = [
      'export const FLOWS = {',
      '  test: makeRollFlow({',
      '    resolve: (p) => rollTest(p.skillValue, p.difficulty, battleRng()),',
      '  }),',
      '};',
    ].join('\n');
    expect(scanRollSeamExclusivity('src/state/x.ts', spec)).toEqual([]);
  });

  it('(S) hors position : le MÊME rollTest dans une fonction libre reste une violation', () => {
    const libre = 'function resolve(p) { return rollTest(p.skillValue, p.difficulty, battleRng()); }';
    expect(scanRollSeamExclusivity('src/state/x.ts', libre).length).toBe(1);
  });

  it('(M) dé de monde : un d100 comparé à un seuil n’est pas une violation', () => {
    expect(scanRollSeamExclusivity('src/state/x.ts', 'if (d100(rng) <= chance.target) { found = true; }')).toEqual([]);
  });

  it('(M) dé de monde : un d100 lu en TABLE (findTableEntry, via une liaison locale) n’est pas une violation', () => {
    const table = [
      'function tirer(rng) {',
      '  const roll = d100(rng);',
      '  return findTableEntry(t.ranges, roll);',
      '}',
    ].join('\n');
    expect(scanRollSeamExclusivity('src/state/x.ts', table)).toEqual([]);
  });

  it('(M) ne blanchit pas un Test déguisé : un d100 qui nourrit une valeur de Test reste une violation', () => {
    const deguise = "const sl = Math.floor(testValue(c, 'perception') / 10) - Math.floor(d100(rng) / 10);";
    expect(scanRollSeamExclusivity('src/state/x.ts', deguise).length).toBe(1);
  });

  it('(M) ne blanchit pas un Test à variable NEUTRE : la valeur comparée vient d’effectiveChar (A1)', () => {
    const neutre = [
      'function jet(c, rng) {',
      "  const cible = effectiveChar(c, 'ag');",
      "  if (d100(rng) <= cible) return 'reussi';",
      "  return 'rate';",
      '}',
    ].join('\n');
    expect(scanRollSeamExclusivity('src/state/x.ts', neutre).length).toBe(1);
  });

  it('(M) ne blanchit pas un Test OPPOSÉ maison : deux d100 contre deux caractéristiques (A4)', () => {
    const duel = [
      'function duel(a, b, rng) {',
      "  const va = effectiveChar(a, 'cc');",
      "  const vb = effectiveChar(b, 'cc');",
      '  return (d100(rng) <= va) && (d100(rng) > vb);',
      '}',
    ].join('\n');
    expect(scanRollSeamExclusivity('src/state/x.ts', duel).length).toBe(2);
  });

  it('(M) ne blanchit pas un d100 comparé à une caractéristique EN DIRECT (E2)', () => {
    const direct = 'function jet(c, rng) { if (d100(rng) <= c.characteristics.ag) return 1; return 0; }';
    expect(scanRollSeamExclusivity('src/state/x.ts', direct).length).toBe(1);
  });

  it('(S) fail-closed : un callback `resolve` DÉPORTÉ (fonction libre référencée) reste une violation (B1)', () => {
    const deporte = [
      'function resolveIt(p) { return rollTest(p.skillValue, p.difficulty, battleRng()); }',
      'export const F = { t: makeRollFlow({ resolve: resolveIt }) };',
    ].join('\n');
    expect(scanRollSeamExclusivity('src/state/x.ts', deporte).length).toBe(1);
  });

  it('(S) fail-closed : une spec CONSTRUITE puis passée à makeRollFlow reste une violation (B2)', () => {
    const construite = [
      "const spec = { resolve: (p) => rollTest(p.skillValue, p.difficulty, battleRng()) };",
      'export const F = makeRollFlow(spec);',
    ].join('\n');
    expect(scanRollSeamExclusivity('src/state/x.ts', construite).length).toBe(1);
  });

  it('(S) la MÉTHODE raccourcie du littéral est une position de spec au même titre que la propriété (B3)', () => {
    const methode = [
      'export const F = makeRollFlow({',
      '  resolve(p) { return rollTest(p.skillValue, p.difficulty, battleRng()); },',
      '});',
    ].join('\n');
    expect(scanRollSeamExclusivity('src/state/x.ts', methode)).toEqual([]);
  });

  it('pré-filtre : les formes espacées/multilignes/génériques passent la garde ET sont détectées', () => {
    const formes: [string, string][] = [
      ['C1b d100 espacé', "const t = rollTest(1,'moyen',rng);\nconst r = d100 (rng);\nconst dr = Math.floor(testValue(c,'x')/10) - Math.floor(r/10);"],
      ['C3b TestOutcome .seal multiligne', "const t = rollTest(1,'moyen',rng);\nreturn TestOutcome\n  .seal({ roll: 1, target: 40, success: true, sl: 1, isDouble: false });"],
      ['C4b rollTest espacé', "const x = d100(rng);\nconst t = rollTest (40, 'moyen', battleRng());"],
      ['F2 rollTest générique', "const t = rollTest<string>(40, 'moyen', battleRng());"],
    ];
    const rates = formes.filter(([, src]) => !ROLL_SEAM_RX.test(src) || scanRollSeamExclusivity('src/state/x.ts', src).length === 0);
    expect(rates.map(([nom]) => nom)).toEqual([]);
  });

  it('stock de phase 2 (#918) : le compte déclaré par fichier est le compte MESURÉ', () => {
    const ecarts: string[] = [];
    for (const [rel, attendu] of ROLL_SEAM_PHASE2_STOCK) {
      const n = scanRollSeamExclusivity(rel, readFileSync(join(ROOT, rel), 'utf8')).length;
      if (n !== attendu) ecarts.push(`${rel} : ${n} site(s) mesuré(s), ${attendu} déclaré(s)`);
    }
    expect(
      ecarts,
      `Stock de phase 2 périmé — un site de plus est une régression, un site migré se solde ICI (ROLL_SEAM_PHASE2_STOCK, scripts/guards/lib/rollSeamWhitelist.mjs) :\n${ecarts.join('\n')}`,
    ).toEqual([]);
  });
});

/**
 * Garde-fou « rng vivant → résolveur moteur » (#370, ronde 2 — cf. `battleRngEngineLeak.mjs`). Le
 * garde d'exclusivité ci-dessus exempte TOUT `src/engine/**` au motif que le moteur pur « reçoit un
 * rng sans jamais décider du surfaçage » — motif qui suppose que l'APPELANT passe par le seam. Ce
 * second garde ferme le trou : un flux `state/**` qui appelle DIRECTEMENT un résolveur moteur `resolveXxx`
 * (convention du dépôt : « roule ET décide » une confrontation complète — Test opposé/étendu, gagnant/DR)
 * avec un rng VIVANT (`battleRng()`) au call-site contourne la policy M/V/I aussi sûrement qu'un
 * `rollTest(` inline. C'était EXACTEMENT le trou de `tavernFlow.playTavernGame` →
 * `resolveTavernGame(..., battleRng())` avant #370 (dorénavant décomposé en `resolveTavernRound`,
 * PUR — aucun rng — et `rollTavernTest`, primitive `roll*` à un seul jet, appelée en POST-COMMIT par
 * l'applier, patron `portFlow.ts`).
 */
describe('garde-fou « rng vivant → résolveur moteur » — un flux state/** ne peut plus appeler un resolveXxx(…) moteur avec battleRng() en direct (#370)', () => {
  it('aucun fichier hors whitelist ne remet un rng vivant à un résolveur moteur', () => {
    const offenders: string[] = [];
    for (const f of scanFiles()) {
      const rel = relative(ROOT, f).split('\\').join('/');
      if (/\.test\.[tj]sx?$/.test(rel) || battleRngEngineLeakExcluded(rel)) continue;
      const findings = scanBattleRngEngineLeak(rel, readFileSync(f, 'utf8'));
      for (const x of findings) offenders.push(`${rel}:${x.line} [rng vivant → ${x.name}] ${x.detail}`);
    }
    expect(
      offenders,
      `rng vivant remis à un résolveur moteur hors seam — router par openRoll (côté joueur) + rouler l'adversaire en POST-COMMIT dans l'applier (patron portFlow.ts), ou justifier l'entrée dans battleRngEngineLeakWhitelist.mjs :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('fail-closed : le scanner détecte un resolveXxx(…, battleRng()) SYNTHÉTIQUE', () => {
    const regressed = [
      "import { resolveTavernGame } from '../engine/tavernGame';",
      "const res = resolveTavernGame(game, playerValue, opponentValue, battleRng());",
    ].join('\n');
    expect(scanBattleRngEngineLeak('src/state/x.ts', regressed).length).toBe(1);
  });

  it('fail-closed : le scanner MORD le rng HOISTÉ (battleRng() et resolveXxx( sur des lignes séparées, #370)', () => {
    const hoisted = [
      "import { resolveTavernGame } from '../engine/tavernGame';",
      "const rng = battleRng();",
      "const res = resolveTavernGame(game, playerValue, opponentValue, rng);",
    ].join('\n');
    expect(scanBattleRngEngineLeak('src/state/x.ts', hoisted).length).toBe(1);
  });

  it('zéro faux positif : une primitive roll*/valeur (testValue/effectiveChar) voisine d’un battleRng() sur une AUTRE ligne ne matche pas', () => {
    const clean = [
      "import { rollTavernTest } from '../engine/tavernGame';",
      "const v = testValue(hero, 'pari');",
      "const opponentTR = rollTavernTest(opponentValue, battleRng());",
    ].join('\n');
    expect(scanBattleRngEngineLeak('src/state/x.ts', clean).length).toBe(0);
  });

  it('zéro faux positif : un résolveur moteur PUR (resolveOpposed, aucun paramètre RNG) coexistant avec battleRng() ne matche pas (#912)', () => {
    const clean = [
      "import { resolveOpposed } from '../engine/tests';",
      'const rng = battleRng();',
      "const res = resolveOpposed(attackerTR, defenderTR);",
    ].join('\n');
    expect(scanBattleRngEngineLeak('src/state/x.ts', clean).length).toBe(0);
  });

  it('vrai positif préservé : un résolveur moteur RNG-capable réel (resolveCasting) reste détecté (#912)', () => {
    const regressed = [
      "import { resolveCasting } from '../engine/magic';",
      "const res = resolveCasting(caster, spell, battleRng());",
    ].join('\n');
    expect(scanBattleRngEngineLeak('src/state/x.ts', regressed).length).toBe(1);
  });
});

/**
 * REGISTRE DES CHEMINS DE JET (#1066) — deux familles de plus, MÊME module de gardes (mécanique dans
 * `rollSeamExclusivity.mjs`, policy dans `rollSeamWhitelist.mjs`), jamais un scanner parallèle : deux
 * comptes divergents du même stock sont le défaut classique. Les deux populations que les gardes
 * ci-dessus laissent passer par construction :
 *  (F) FABRICATION d'un pending de jet au call-site (le roulage arrive plus tard, par le seam — donc
 *      rien ne le signale) ;
 *  (D) roulage DÉLÉGUÉ à un export de `src/engine` (exempté de principe) appelé par un flux.
 * Ce lot FIGE la population avant que #1064 la fasse bouger : une entrée sans justification, un site
 * de plus, ou une entrée devenue vide sont rouges.
 */
const SEAM_CORE = new Set([
  'src/state/rollSeam.ts', 'src/state/rollFlowFactory.ts', 'src/state/cascade.ts',
  'src/state/rollFlowSpecs.ts', 'src/state/combat/triggeredTest.ts',
]);

/** Fichiers de PRODUCTION scannables (hors tests), en chemin relatif POSIX. */
function prodFiles(...dirs: string[]): { rel: string; text: string }[] {
  const out: { rel: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e)) {
        const rel = relative(ROOT, p).split('\\').join('/');
        if (!/\.test\.[tj]sx?$/.test(rel)) out.push({ rel, text: readFileSync(p, 'utf8') });
      }
    }
  };
  for (const d of dirs) walk(join(ROOT, d));
  return out;
}

type Stock = Map<string, { n: number; kind: string; why: string }>;

/** Écarts « compte mesuré vs compte déclaré » d'un stock, plus les fichiers hors stock. */
function stockDiff(stock: Stock, mesure: Map<string, number>) {
  const ecarts: string[] = [];
  for (const [rel, { n }] of stock) {
    const vu = mesure.get(rel) ?? 0;
    if (vu !== n) ecarts.push(`${rel} : ${vu} site(s) mesuré(s), ${n} déclaré(s)${vu === 0 ? ' — entrée PÉRIMÉE, à retirer' : ''}`);
  }
  const horsStock = [...mesure].filter(([rel]) => !stock.has(rel)).map(([rel, n]) => `${rel} : ${n} site(s) HORS registre`);
  return [...ecarts, ...horsStock];
}

/**
 * Le `kind` porte l'INVARIANT de l'entrée, et chaque état a une CHARGE DE PREUVE dans le `why` :
 * une entrée `dette` sans ticket qui l'emporte est une dette orpheline — un « -> #ticket » recopié
 * sans y penser. Une entrée `canonique` qui n'annonce pas sa nature en tête se relit comme de la
 * dette au premier balayage. Le vocabulaire accepté est de TROIS valeurs (#1070) : chaque entrée est
 * qualifiée site par site, une entrée qui se déclare « à trier » est rouge (cf. le test dédié).
 */
const KINDS_ADMIS = ['dette', 'canonique', 'mixte'] as const;

function kindDiff(stock: Stock, label: string) {
  const KINDS = new Set<string>(KINDS_ADMIS);
  const ecarts: string[] = [];
  for (const [rel, e] of stock) {
    if (!KINDS.has(e.kind)) { ecarts.push(`${label} ${rel} : kind « ${e.kind} » inconnu (${KINDS_ADMIS.join('|')})`); continue; }
    const citeTicket = /#\d+/.test(e.why);
    const ditCanonique = /canonique/i.test(e.why);
    if (e.kind === 'dette' && !citeTicket) ecarts.push(`${label} ${rel} : kind=dette sans ticket cité — une population qui doit tomber à zéro nomme le lot qui l'emporte`);
    if (e.kind === 'canonique' && !/^canonique/i.test(e.why.trim())) ecarts.push(`${label} ${rel} : kind=canonique dont la justification n'annonce pas sa nature en tête`);
    if (e.kind === 'mixte' && !(citeTicket && ditCanonique)) ecarts.push(`${label} ${rel} : kind=mixte doit citer un ticket ET dire la part canonique`);
  }
  return ecarts;
}

describe('REGISTRE des chemins de jet (#1070) — le tri de population est SOLDÉ', () => {
  it('chaque entrée des deux stocks est QUALIFIÉE : dette | canonique | mixte, et rien d’autre', () => {
    const restants = [...PENDING_JET_FABRICATION_STOCK, ...ENGINE_DELEGATED_ROLL_STOCK]
      .filter(([, e]) => !(KINDS_ADMIS as readonly string[]).includes(e.kind))
      .map(([rel, e]) => `${rel} : kind=${e.kind}`);
    expect(
      restants,
      `Une entrée du registre n'est pas qualifiée — le tri site par site est le geste, pas une étiquette d'attente (KINDS_ADMIS = ${KINDS_ADMIS.join('|')}) :\n${restants.join('\n')}`,
    ).toEqual([]);
  });

  it('fail-closed : une entrée « à trier » réintroduite est REFUSÉE par kindDiff', () => {
    const stock: Stock = new Map([['src/state/x.ts', { n: 1, kind: 'tri', why: 'population non qualifiée -> #1070.' }]]);
    expect(kindDiff(stock, '(X)')).toEqual(['(X) src/state/x.ts : kind « tri » inconnu (dette|canonique|mixte)']);
  });
});

describe('REGISTRE des chemins de jet (#1066) — (F) fabrication d’un pending de jet', () => {
  const mesure = () => {
    const m = new Map<string, number>();
    for (const { rel, text } of prodFiles('src')) {
      if (SEAM_CORE.has(rel)) continue; // ces fichiers SONT le seam : leur pending est le foyer, pas un contournement
      const n = scanPendingJetFabrication(rel, text).length;
      if (n > 0) m.set(rel, n);
    }
    return m;
  };

  it('le compte par fichier est EXACT et fail-closed (site en plus, entrée périmée, fichier hors registre)', () => {
    const ecarts = stockDiff(PENDING_JET_FABRICATION_STOCK, mesure());
    expect(
      ecarts,
      `Population (F) désynchronisée — un pending de jet fabriqué à la main entre au registre AVEC sa justification (PENDING_JET_FABRICATION_STOCK, scripts/guards/lib/rollSeamWhitelist.mjs) :\n${ecarts.join('\n')}`,
    ).toEqual([]);
  });

  it('chaque entrée du registre porte une justification ÉCRITE', () => {
    const nues = [...PENDING_JET_FABRICATION_STOCK].filter(([, v]) => !v.why?.trim()).map(([rel]) => rel);
    expect(nues, `Entrée de registre sans justification (dette -> #ticket, ou « canonique : <raison mesurée> ») :\n${nues.join('\n')}`).toEqual([]);
  });

  it('chaque entrée porte un `kind` VALIDE dont la charge de preuve est tenue', () => {
    const ecarts = kindDiff(PENDING_JET_FABRICATION_STOCK, '(F)');
    expect(ecarts, `Invariant de stock non tenu — « cette liste décroît » ne vaut que pour la dette :\n${ecarts.join('\n')}`).toEqual([]);
  });

  it('fail-closed : la signature discriminante mord `skillValue` + `target`', () => {
    const src = "set({ pendingX: { actorId: a.id, skillValue: v, difficulty: 'intermediaire', target: v + 0 } });";
    expect(scanPendingJetFabrication('src/state/x.ts', src).length).toBe(1);
  });

  it('fail-closed : elle mord aussi `skillValue` + `roll: null` (pending pas encore roulé)', () => {
    const src = "set({ pendingX: { skillValue: v, difficulty: 'intermediaire', roll: null, sl: 0, success: false } });";
    expect(scanPendingJetFabrication('src/state/x.ts', src).length).toBe(1);
  });

  it('zéro faux positif : `skillValue` SEUL (paramètre de résolveur) n’est pas une fabrication', () => {
    const src = 'function resolve(p) { return { skillValue: p.skillValue, skillLabel: p.label }; }';
    expect(scanPendingJetFabrication('src/state/x.ts', src)).toEqual([]);
  });

  it('zéro faux positif : `target` SEUL (cible d’un effet) n’est pas une fabrication', () => {
    expect(scanPendingJetFabrication('src/state/x.ts', 'const o = { target: foe.id, amount: 3 };')).toEqual([]);
  });
});

describe('REGISTRE des chemins de jet (#1066) — (D) roulage délégué à un export de src/engine', () => {
  const rollers = () => engineRollerExports(prodFiles('src/engine'));

  const mesure = (names: Set<string>) => {
    const m = new Map<string, number>();
    for (const { rel, text } of prodFiles('src/state', 'src/ui')) {
      if (SEAM_CORE.has(rel)) continue;
      const n = scanEngineDelegatedRoll(rel, text, names).length;
      if (n > 0) m.set(rel, n);
    }
    return m;
  };

  it('la liste des rouleurs est DÉRIVÉE, transitivement : `rollMightTest` ET `resolveClash` en sont', () => {
    const r = rollers();
    expect(r.get('rollMightTest')?.file).toBe('src/engine/massBattle.ts');
    expect(r.get('resolveClash')?.file, 'resolveClash ne roule QUE via rollMightTest — sans clôture transitive, le site fondateur du trou reste invisible').toBe('src/engine/massBattle.ts');
    expect(r.has('rollTest'), 'rollTest/d100 sont la population du garde d’exclusivité, pas de celui-ci').toBe(false);
  });

  it('le call-site massBattle est VISIBLE au garde (plus aucun Test résolu hors de tout registre)', () => {
    const sites = scanEngineDelegatedRoll(
      'src/state/massBattleFlow.ts',
      readFileSync(join(ROOT, 'src/state/massBattleFlow.ts'), 'utf8'),
      new Set(rollers().keys()),
    );
    expect(sites.map((s: { name: string }) => s.name)).toContain('resolveClash');
    expect(ENGINE_DELEGATED_ROLL_STOCK.has('src/state/massBattleFlow.ts')).toBe(true);
  });

  it('le compte par fichier est EXACT et fail-closed (site en plus, entrée périmée, fichier hors registre)', () => {
    const ecarts = stockDiff(ENGINE_DELEGATED_ROLL_STOCK, mesure(new Set(rollers().keys())));
    expect(
      ecarts,
      `Population (D) désynchronisée — un call-site de rouleur moteur entre au registre AVEC sa justification (ENGINE_DELEGATED_ROLL_STOCK, scripts/guards/lib/rollSeamWhitelist.mjs) :\n${ecarts.join('\n')}`,
    ).toEqual([]);
  });

  it('chaque entrée du registre porte une justification ÉCRITE', () => {
    const nues = [...ENGINE_DELEGATED_ROLL_STOCK].filter(([, v]) => !v.why?.trim()).map(([rel]) => rel);
    expect(nues, `Entrée de registre sans justification :\n${nues.join('\n')}`).toEqual([]);
  });

  it('chaque entrée porte un `kind` VALIDE dont la charge de preuve est tenue', () => {
    const ecarts = kindDiff(ENGINE_DELEGATED_ROLL_STOCK, '(D)');
    expect(ecarts, `Invariant de stock non tenu — « cette liste décroît » ne vaut que pour la dette :\n${ecarts.join('\n')}`).toEqual([]);
  });

  it('(S) position de spec : le MÊME appel dans un callback `resolve` de spec n’est pas un site', () => {
    const spec = 'export const F = makeRollFlow({ resolve: (p) => resolveClash(p.a, p.b, battleRng()) });';
    expect(scanEngineDelegatedRoll('src/state/x.ts', spec, ['resolveClash'])).toEqual([]);
    const libre = 'function go(p) { return resolveClash(p.a, p.b, battleRng()); }';
    expect(scanEngineDelegatedRoll('src/state/x.ts', libre, ['resolveClash']).length).toBe(1);
  });
});

/**
 * Les ANGLES MORTS déclarés par `docs/registre-jets.md` sont eux-mêmes MESURÉS ici — un angle mort
 * écrit dans une doc mais jamais éprouvé est une promesse, pas une mesure ; et s'il se refermait un
 * jour (résolution de liaison ajoutée au scanner), la doc le dirait encore à tort. Le 3ᵉ cas est
 * SURVEILLÉ, pas subi : aucun homonyme rouleur aujourd'hui, et le test rougit dès qu'il en naît un.
 */
describe('REGISTRE des chemins de jet (#1066) — les angles morts DÉCLARÉS sont mesurés', () => {
  it('faux négatif ASSUMÉ : un import RENOMMÉ échappe au scan (résolution par nom appelé, sans liaison)', () => {
    const renomme = [
      "import { resolveClash as duel } from '../engine/massBattle';",
      'function go(p) { return duel(p.a, p.b, battleRng()); }',
    ].join('\n');
    expect(scanEngineDelegatedRoll('src/state/x.ts', renomme, ['resolveClash'])).toEqual([]);
  });

  it('faux négatif ASSUMÉ : un appel par NAMESPACE (`mb.resolveClash(…)`) échappe au scan', () => {
    const ns = [
      "import * as mb from '../engine/massBattle';",
      'function go(p) { return mb.resolveClash(p.a, p.b, battleRng()); }',
    ].join('\n');
    expect(scanEngineDelegatedRoll('src/state/x.ts', ns, ['resolveClash'])).toEqual([]);
  });

  it('SURVEILLANCE : aucun rouleur d’engine n’a d’HOMONYME dans un autre module (l’index est à plat)', () => {
    const files = prodFiles('src/engine');
    const rollers = engineRollerExports(files);
    const collisions = [...engineHomonyms(files)]
      .filter(([name, h]) => h.rollsDirectly || rollers.has(name))
      .map(([name, h]) => `${name} déclaré dans ${h.files.join(' + ')}`);
    expect(
      collisions,
      `Homonyme de rouleur apparu — \`engineRollerExports\` indexe par nom À PLAT : la dernière déclaration lue écrase les autres, ce qui peut FAIRE SORTIR un vrai rouleur de la liste (et sa clôture transitive avec lui). Désambiguïser (renommer, ou clé fichier#nom) :\n${collisions.join('\n')}`,
    ).toEqual([]);
  });

  it('faux négatif ASSUMÉ : un dé qui n’est ni `rollTest` ni `d100` (ex. `d10`) n’est vu par AUCUN des trois scanners', () => {
    const src = readFileSync(join(ROOT, 'src/state/massBattleFlow.ts'), 'utf8');
    const rollers = new Set(engineRollerExports(prodFiles('src/engine')).keys());
    const hazard = /export function massBattleSetHazard[\s\S]*?\n}/.exec(src)?.[0] ?? '';
    expect(hazard, 'massBattleSetHazard a bougé — l’exemple d’angle mort cité par la doc doit rester mesurable').toContain('d10(battleRng())');
    expect(scanRollSeamExclusivity('src/state/massBattleFlow.ts', hazard)).toEqual([]);
    expect(scanPendingJetFabrication('src/state/massBattleFlow.ts', hazard)).toEqual([]);
    expect(scanEngineDelegatedRoll('src/state/massBattleFlow.ts', hazard, rollers)).toEqual([]);
  });
});

describe('REGISTRE des chemins de jet (#1066) — familles CANONIQUES énumérées (seamCallers)', () => {
  it('chaque famille déclarée existe, à son fichier, avec son statut d’export MESURÉ', () => {
    const ecarts: string[] = [];
    for (const c of SEAM_CALLERS) {
      const path = join(ROOT, c.file);
      if (!existsSync(path)) { ecarts.push(`${c.name} : fichier ${c.file} introuvable`); continue; }
      const src = readFileSync(path, 'utf8');
      const decl = new RegExp(`^(export\\s+)?(async\\s+)?(function|const|let|class)\\s+${c.name}\\b`, 'm').exec(src);
      if (!decl) { ecarts.push(`${c.name} : aucune déclaration dans ${c.file}`); continue; }
      const exported = decl[1] !== undefined;
      if (exported !== c.exported) ecarts.push(`${c.name} (${c.file}) : exporté=${exported} mesuré, ${c.exported} déclaré`);
      if (!c.role?.trim()) ecarts.push(`${c.name} : rôle non renseigné`);
    }
    expect(
      ecarts,
      `Énumération des familles canoniques périmée — le registre est la SOURCE de docs/registre-jets.md (SEAM_CALLERS, scripts/guards/lib/rollSeamWhitelist.mjs) :\n${ecarts.join('\n')}`,
    ).toEqual([]);
  });

  it('la 3ᵉ famille navale `openCrewTestPending` est bien MODULE-LOCALE (le fait qui l’a tenue hors registre)', () => {
    const src = readFileSync(join(ROOT, 'src/state/combatSlice.ts'), 'utf8');
    expect(/^export\s+function\s+openCrewTestPending\b/m.test(src)).toBe(false);
    expect(/^function\s+openCrewTestPending\b/m.test(src)).toBe(true);
  });
});

/**
 * CLIQUET « le calcul de ligne ne se réécrit plus à la main » (#1153 L2bis) — l'arithmétique de cible
 * (`DIFFICULTY_MODIFIERS[…]` ET `DIFFICULTY_MODIFIERS.…`, écrêtage `Math.min(99, …)`) n'a de place que
 * dans `src/engine/**` (les formules), dans le MONTEUR canonique (`rollSeam.rollLine`) et chez ses
 * LECTEURS d'affichage (`ui/breakdown.ts`, `ui/RollLine.tsx`, harnais de test) — partout ailleurs,
 * elle signe un monteur local qui refait la ligne et peut donc mentir (base fondue, chip fantôme,
 * cible NaN). Les DEUX notations sont mordues : indexer par crochets ou par point est le même geste,
 * et n'en voir qu'une laissait 6 sites hors du compte (#1153 L1a).
 *
 * Ce stock est un CLIQUET : il ne peut que DÉCROÎTRE. Toute entrée est un site à router par
 * `rollLine` ; le COMBAT y entre lot par lot (#1153 L1b).
 *
 * RÉFÉRENTIEL DE MESURE : `HEAD` + le lot COURANT, jamais l'arbre de travail. Une baseline abaissée
 * sur le WIP NON COMMITTÉ d'une autre session créditerait un travail qui peut ne jamais atterrir —
 * et le cliquet remonterait en silence si ce WIP était abandonné.
 */
const LIGNE_A_LA_MAIN_STOCK: Record<string, number> = {
  // COMBAT — reste du lot L1b (`combatEffects`/`triggeredTest` non migrés ; `encounterPsychFlow` = la
  // rangée batch du Test de Peur hors rencontre)
  'src/state/combat/triggeredTest.ts': 3,
  'src/state/combatEffects.ts': 5,
  'src/state/encounterPsychFlow.ts': 1,
  'src/state/rollFlowSpecs.ts': 2, // cible du dé d'une MANŒUVRE d'attaque + cible de repli d'un Test opposé — COMBAT
  // HORS COMBAT — les sites de jet sont routés par `rollLine`/`rollStep` ; ce qui reste n'est pas une cible.
  'src/state/seaVoyageFlow.ts': 1, // reste : conversion Difficulté→DR d'une infestation (pas une cible)
  'src/ui/editor/LogicDock.tsx': 1, // éditeur : APERÇU d'une difficulté authorée, aucun jet
  'src/state/cascadeTestKit.ts': 1, // le cliquet lui-même (`inexplique`)
};

/** Dette TOTALE MESURÉE sur `HEAD` + ce lot : 14 occurrences / 7 fichiers, dont 11 en combat — verrou
 *  global : un site déplacé d'un fichier à l'autre ne s'y cache pas. */
const TOTAL_DECLARE = Object.values(LIGNE_A_LA_MAIN_STOCK).reduce((s, n) => s + n, 0);

describe('CLIQUET — l’arithmétique de ligne vit dans le monteur, pas dans les flux (#1153)', () => {
  const LIGNE_RX = /DIFFICULTY_MODIFIERS\s*[.[]|Math\.min\(99/g;
  const HORS_CLIQUET = ['src/engine/', 'src/state/rollSeam.ts', 'src/ui/breakdown.ts', 'src/ui/RollLine.tsx'];

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
    }
    return out;
  };

  it('aucun NOUVEAU site ne recalcule une cible à la main (le stock ne peut que décroître)', () => {
    const mesure: Record<string, number> = {};
    for (const abs of walk(join(ROOT, 'src'))) {
      const rel = relative(ROOT, abs).replace(/\\/g, '/');
      if (HORS_CLIQUET.some((p) => rel.startsWith(p))) continue;
      const n = (readFileSync(abs, 'utf8').match(LIGNE_RX) ?? []).length;
      if (n > 0) mesure[rel] = n;
    }
    const ecarts: string[] = [];
    for (const [file, n] of Object.entries(mesure)) {
      const attendu = LIGNE_A_LA_MAIN_STOCK[file];
      if (attendu === undefined) ecarts.push(`${file} : ${n} occurrence(s) NOUVELLE(S) — monter la ligne par \`rollLine\` (rollSeam.ts)`);
      else if (n > attendu) ecarts.push(`${file} : ${n} > ${attendu} déclaré(s) — le cliquet ne remonte pas`);
    }
    expect(ecarts, `Arithmétique de ligne réécrite à la main :\n${ecarts.join('\n')}`).toEqual([]);
    // Le TOTAL est verrouillé aussi : un site déplacé d'un fichier à l'autre ne passerait pas entre
    // les mailles du compte par fichier.
    expect(Object.values(mesure).reduce((s, n) => s + n, 0)).toBeLessThanOrEqual(TOTAL_DECLARE);
  });

  it('le stock DÉCLARÉ suit la dette RÉELLE, à l’unité près (entrée périmée ET baseline trop haute)', () => {
    // Le cliquet ne mord pas qu'à ZÉRO : une baseline de 5 sur un fichier retombé à 3 est PÉRIMÉE elle
    // aussi — sans quoi le stock mentirait de 2 sites déjà migrés, et 2 régressions pourraient s'y
    // glisser sans rien casser (patron `cascade-step-stake-guard`).
    const perimees: string[] = [];
    for (const [file, attendu] of Object.entries(LIGNE_A_LA_MAIN_STOCK)) {
      const abs = join(ROOT, file);
      if (!existsSync(abs)) { perimees.push(`${file} : fichier absent — retirer du stock`); continue; }
      const n = (readFileSync(abs, 'utf8').match(LIGNE_RX) ?? []).length;
      if (n < attendu) perimees.push(`${file} : baseline ${attendu}, réel ${n} — ABAISSER`);
    }
    expect(perimees, `Stock périmé (dette déjà résorbée, à refléter) :\n${perimees.join('\n')}`).toEqual([]);
  });
});

/**
 * SECOND CLIQUET — l'ANGLE MORT du premier (#1153, déclaré au commit 57860131). Une étape-jet peut
 * être montée à la main SANS jamais écrire d'arithmétique : `base: best.value` + `target = base`, la
 * Difficulté et le Soutien fondus dans un helper de cible (`exposureTarget`) ou dans `partyAssisted`.
 * `LIGNE_RX` ne voit rien, et `inexplique` non plus (0 − 0 = 0) : la ligne ment en silence.
 *
 * Ce qu'on mesure ici est STRUCTUREL, pas lexical : un littéral d'objet qui pose `kind:` ET `target:`
 * (donc une étape que `cascade.stepInteraction` classera « jet ») sans que sa ligne vienne du monteur
 * (`...rollStep(` / `...rollLine(`).
 *
 * PÉRIMÈTRE — HORS COMBAT, mais par un geste DIFFÉRENT du premier cliquet : celui-là BASELINE les
 * fichiers de combat dans son stock, celui-ci les EXCLUT du scan (`HORS_PERIMETRE_COMBAT`), et sur un
 * SUR-ENSEMBLE (il ajoute `src/state/combat/`, `combatManeuvers`, `targetingModes`, `rollFlowFactory`,
 * `rollFlowSpecs`). Raison : l'arène a son arithmétique propre (`baseTestMods`, Avantage, allonge) et
 * son lot dédié — un stock chiffré sur un chantier en cours mesurerait le voisin, pas la dette.
 *
 * COUVERTURE DÉCLARÉE (ce que le scanner compte, dette ou pas — le stock est un COMPTE, pas un
 * verdict) : il attrape aussi (a) les DÉCLARATIONS de type qui portent `kind` + `target`
 * (`DeferredUpkeepTest`, `PendingExtendedTest`, `RestRoll`…) et (b) les RELAIS d'une ligne déjà
 * montée ailleurs (`deferredUpkeepSteps` recopie `t.base`/`t.target` du wrapper d'entretien). Ces
 * deux familles sont annotées entrée par entrée ci-dessous. Faux NÉGATIF assumé : une étape dont le
 * littéral est éclaté sur plusieurs variables (`const st = {...}; st.target = …`) échappe au scanner.
 */
const HORS_PERIMETRE_COMBAT = [
  'src/state/combat/', 'src/state/combatFlow.ts', 'src/state/combatSlice.ts', 'src/state/combatEffects.ts',
  'src/state/combatManeuvers.ts', 'src/state/encounterPsychFlow.ts', 'src/state/shipManeuver.ts',
  'src/state/targetingModes.ts', 'src/state/rollFlowSpecs.ts', 'src/state/rollFlowFactory.ts',
];
const ETAPE_A_LA_MAIN_STOCK: Record<string, number> = {
  // TYPES (aucun montage) — `kind` + `target` en position de DÉCLARATION
  'src/data/schemas/defs/spells.ts': 1,
  'src/state/pendings.ts': 1, // PendingExtendedTest
  'src/state/upkeep.ts': 1, // DeferredUpkeepTest
  'src/state/interludeFlow.ts': 2, // PendingActivityFields (type) + `target: 0` sentinelle d'ouverture
  'src/state/store.ts': 1, // signature de `startExtendedTest`
  // RELAIS d'une ligne DÉJÀ montée par le monteur (rien à recalculer ici)
  'src/state/restFlow.ts': 1, // `deferredUpkeepSteps` recopie base/target/mods/clamped du wrapper
  // MONTAGES à la main — dette RÉELLE restante hors combat, à router par `rollStep`
  'src/engine/rest.ts': 3, // bilan EAGER de la modale de Repos (`RestRoll` : type + 2 collectes)
  'src/state/seaActivities.ts': 2, // Cartographie + Activité générique : base et cible montées au site
};
const TOTAL_ETAPES = Object.values(ETAPE_A_LA_MAIN_STOCK).reduce((s, n) => s + n, 0);

/** Littéraux d'objet (un niveau d'imbrication) — assez pour isoler une étape de cascade. */
const LITTERAL_RX = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gs;

function etapesALaMain(src: string): number {
  let n = 0;
  for (const m of src.matchAll(LITTERAL_RX)) {
    const lit = m[0];
    if (!/(^|[\s,{])kind:\s/.test(lit)) continue;
    if (!/(^|[\s,{])target:\s/.test(lit)) continue;
    if (/\.\.\.roll(Step|Line)\(/.test(lit)) continue;
    n++;
  }
  return n;
}

describe('CLIQUET 2 — une étape-JET ne se monte plus à la main, même sans arithmétique (#1153)', () => {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
    }
    return out;
  };

  it('le scanner VOIT bien la famille qu’il prétend mesurer (les 5 sites de restFlow d’avant migration)', () => {
    // Preuve de couverture sur PIÈCE : le montage à base FONDUE tel qu'il s'écrivait (abri de fortune,
    // Soutien de `partyAssisted` fondu, cible = base) — invisible au premier cliquet ET à `inexplique`.
    const avant = `
      steps.push({ id: 'abri', kind: 'shelter', actorId: best.actor.id, label: 'Abri de fortune',
        rollLabel: 'Survie en extérieur', base: best.value, difficulty: 'intermediaire', target: best.value,
        result: null, interactive: true });`;
    expect(etapesALaMain(avant), 'le scanner doit voir le montage à la main').toBe(1);
    const apres = `
      steps.push({ id: 'abri', kind: 'shelter', actorId: best.actor.id, label: 'Abri de fortune',
        rollLabel: 'Survie en extérieur',
        ...rollStep({ actor: best.actor, test: { skill: 'survie-en-exterieur' }, difficulty: 'intermediaire',
          valeur: best.value, soutien: best.support }),
        result: null, interactive: true });`;
    expect(etapesALaMain(apres), 'routé par le monteur : plus rien à voir').toBe(0);
  });

  it('aucune NOUVELLE étape montée à la main (le stock ne peut que décroître)', () => {
    const mesure: Record<string, number> = {};
    for (const abs of walk(join(ROOT, 'src'))) {
      const rel = relative(ROOT, abs).replace(/\\/g, '/');
      if (rel === 'src/state/rollSeam.ts') continue; // le monteur lui-même
      if (HORS_PERIMETRE_COMBAT.some((p) => rel.startsWith(p))) continue; // frontière déclarée, lot dédié
      const n = etapesALaMain(readFileSync(abs, 'utf8'));
      if (n > 0) mesure[rel] = n;
    }
    const ecarts: string[] = [];
    for (const [file, n] of Object.entries(mesure)) {
      const attendu = ETAPE_A_LA_MAIN_STOCK[file];
      if (attendu === undefined) ecarts.push(`${file} : ${n} étape(s) NOUVELLE(S) montée(s) à la main — passer par \`rollStep\` (rollSeam.ts)`);
      else if (n > attendu) ecarts.push(`${file} : ${n} > ${attendu} déclaré(s) — le cliquet ne remonte pas`);
    }
    expect(ecarts, `Étape-jet montée à la main :\n${ecarts.join('\n')}`).toEqual([]);
    expect(Object.values(mesure).reduce((s, n) => s + n, 0)).toBeLessThanOrEqual(TOTAL_ETAPES);
  });

  it('le stock DÉCLARÉ suit la dette RÉELLE (baseline trop haute = mensonge de 1 site migré)', () => {
    const perimees: string[] = [];
    for (const [file, attendu] of Object.entries(ETAPE_A_LA_MAIN_STOCK)) {
      const abs = join(ROOT, file);
      if (!existsSync(abs)) { perimees.push(`${file} : fichier absent — retirer du stock`); continue; }
      const n = etapesALaMain(readFileSync(abs, 'utf8'));
      if (n < attendu) perimees.push(`${file} : baseline ${attendu}, réel ${n} — ABAISSER`);
    }
    expect(perimees, `Stock périmé (dette déjà résorbée, à refléter) :\n${perimees.join('\n')}`).toEqual([]);
  });
});
