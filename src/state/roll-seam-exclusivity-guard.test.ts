import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRollSeamExclusivity, ROLL_SEAM_RX } from '../../scripts/guards/lib/rollSeamExclusivity.mjs';
import { rollSeamExcluded, ROLL_SEAM_PHASE2_STOCK } from '../../scripts/guards/lib/rollSeamWhitelist.mjs';
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
