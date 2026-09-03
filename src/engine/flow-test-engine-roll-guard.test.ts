import { describe, it, expect } from 'vitest';
import { scanFlowTestEngineRoll, siteLabel } from '../../scripts/guards/lib/flowTestEngineRoll.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { readFileSync } from 'node:fs';

/**
 * Garde-fou « le moteur ne ROULE pas le nœud qu'il LIT » (#1657 train B3-0 — mécanique dans
 * `scripts/guards/lib/flowTestEngineRoll.mjs`, critères et angles morts en tête de ce module).
 *
 * Le nœud `test` (`FlowTestNode`, `src/engine/flowCore.ts`) est la forme UNIQUE du jet en donnée. Un
 * moteur qui LIT ce nœud le REND (`mkTest` → `MiscastResult.testFlow` → `runCombatFlow`,
 * `state/combatFlow.ts:4146`) ou le DIFFÈRE (`UpkeepDeferTest`, `src/engine/types.ts`) ; s'il le
 * ROULE, l'issue est décidée hors de toute fenêtre de joueur — ni Chance, ni Pacte, ni Résilience —
 * c'est-à-dire la « classe spéciale » de Test que la doctrine des jets interdit.
 *
 * MODE **MESURE** : le stock ci-dessous est la population MESURÉE, nominative et DÉCROISSANTE. Le
 * contrat est une ÉGALITÉ, pas un plafond : un site qui NAÎT est rouge, un site qui MEURT l'est aussi
 * (il se retire de la liste dans le même commit que sa mort). Les 5 sites restants sont ceux du cycle
 * de maladie (`disease.ts` ×4, `rest.ts` ×1) ; la garde passe BLOQUANTE (liste vide, plus de stock)
 * en B3-3, quand ils passent à leur tour par la porte.
 */

/**
 * STOCK au 2026-09-02 — chaque entrée porte le lot qui la tue. Ordre TOTAL (fichier, ligne, famille,
 * nom) : le rendu du scanner ne dépend pas de l'ordre de marche du corpus, donc pas de la machine.
 * DÉCROISSANCE mesurée : baseline 11 → 7 → 5 — les 4 sites des Blessures critiques (`critical.ts` ×3,
 * `trauma.ts` ×1) passent par la porte depuis B3-1, les 2 du coup à l'ÉQUIPAGE (`shipCritical.ts`
 * ×2) depuis B3-2 ; chaque entrée se retire d'ici dans le MÊME commit que le lot qui la route.
 * B3-1b n'en changeait pas le cardinal : les 2 sites d'AMPUTATION qu'il
 * tue n'y ont jamais figuré — ils lisaient une forme PROPRIÉTAIRE (le type `Amputation`), invisible au
 * critère (L) : cet angle mort est déclaré en tête du module et mordu ci-dessous.
 */
const STOCK_2026_09_02: [site: string, mortEn: string][] = [
  ['src/engine/disease.ts:617 [lecteur tickDisease → rollTest]', 'B3-3 — chemin non-`defer` de `tickDisease` retiré'],
  ['src/engine/disease.ts:623 [lecteur tickDisease → rollTest]', 'B3-3 — idem (gangrène)'],
  ['src/engine/disease.ts:646 [lecteur tickDisease → rollTest]', 'B3-3 — idem (Test de cycle de la maladie)'],
  ['src/engine/disease.ts:680 [lecteur tickDisease → rollTest]', 'B3-3 — idem (fin de Durée `persistDifficulty`)'],
  ['src/engine/rest.ts:64 [appelant dailyDiseaseUpkeep → tickDisease]', 'B3-3 — l\'appel cesse d\'atteindre un rouleur'],
];

function sitesReels(): string[] {
  const files = readCorpus(['src/engine']).map(({ rel, text }) => ({ rel, text }));
  return scanFlowTestEngineRoll(files).map(siteLabel);
}

describe('garde `flowTestEngineRoll` — un moteur qui LIT un nœud `test` ne le ROULE pas (#1657 B3)', () => {
  it('le stock mesuré est EXACTEMENT la baseline nominative du 2026-09-02', () => {
    const attendu = STOCK_2026_09_02.map(([site]) => site);
    const reels = sitesReels();
    const nes = reels.filter((s) => !attendu.includes(s));
    const morts = attendu.filter((s) => !reels.includes(s));
    expect(
      reels,
      'stock du garde flowTestEngineRoll divergent de sa baseline datée.\n'
      + (nes.length ? `NÉS (un moteur roule un nœud qu'il lit — le RENDRE en Flow ou le DIFFÉRER (UpkeepDeferTest)) :\n${nes.join('\n')}\n` : '')
      + (morts.length ? `MORTS (retirer l'entrée de STOCK_2026_09_02 dans le MÊME commit) :\n${morts.join('\n')}\n` : ''),
    ).toEqual(attendu);
  });

  it('chaque entrée du stock nomme le lot qui la tue (baseline DÉCROISSANTE, jamais un registre)', () => {
    const sansMort = STOCK_2026_09_02.filter(([, mortEn]) => !/^B3-[123] — .+/.test(mortEn)).map(([s]) => s);
    expect(sansMort, `entrée de stock sans date de mort nommée :\n${sansMort.join('\n')}`).toEqual([]);
  });
});

/**
 * Le critère SÉPARE — sur sources SYNTHÉTIQUES, la lecture seule et le roulage seul restent verts ;
 * seule leur CONJONCTION mord. Sans ces morsures, « 11 sites » ne prouverait ni la couverture
 * (un critère qui ne mord jamais rend 0) ni la précision (un critère qui mord tout rend 11 par accident).
 */
describe('garde `flowTestEngineRoll` — le critère sépare la FABRIQUE du ROULAGE', () => {
  const scan = (text: string) => scanFlowTestEngineRoll([{ rel: 'src/engine/x.ts', text }]);

  it('FABRIQUE sans dé (patron `mkTest`) : verte', () => {
    expect(scan([
      'function mkTest(t: NestedTest): Flow {',
      '  const test: FlowTest = { skill: t.skill, difficulty: t.difficulty };',
      "  return { kind: 'test', test: poserEnjeu(test, stake), success: EMPTY_FLOW, fail: doOps(t.onFail) };",
      '}',
    ].join('\n'))).toEqual([]);
  });

  it('FABRIQUE **qui roule** (la même, un dé en plus) : rouge — forger le nœud ET décider de son issue', () => {
    const sites = scan([
      'function mkTest(t: NestedTest): Flow {',
      '  const test: FlowTest = { skill: t.skill, difficulty: t.difficulty };',
      '  rollTest(0, t.difficulty, defaultRNG);',
      "  return { kind: 'test', test: poserEnjeu(test, stake), success: EMPTY_FLOW, fail: doOps(t.onFail) };",
      '}',
    ].join('\n'));
    expect(sites.map(siteLabel)).toEqual(['src/engine/x.ts:3 [lecteur mkTest → rollTest]']);
  });

  it('LECTURE pure du nœud (patron `opsDuCoup`, paramètre `ShipCrewHit`) : verte', () => {
    expect(scan([
      'function opsDuCoup(hit: ShipCrewHit | undefined): GameOp[] {',
      '  if (!hit) return [];',
      "  return hit.test ? spellOps(hit.test.fail, 'target') : hit.ops ?? [];",
      '}',
    ].join('\n'))).toEqual([]);
  });

  it('ROULAGE sans lecture de nœud (d100 de sévérité) : vert', () => {
    expect(scan([
      'function resolveSeverite(rng: RNG, entry: CritEntry): number {',
      '  const raw = d100(rng);',
      '  return Math.max(1, raw + entry.offset);',
      '}',
    ].join('\n'))).toEqual([]);
  });

  it('LECTURE + roulage DIRECT : rouge, nommé', () => {
    const sites = scan([
      'function rouleNoeud(target: Combatant, node: CritTestNode, rng: RNG): GameOp[] {',
      '  const res = rollTest(valeurDuNoeud(target, node), node.test.difficulty, rng);',
      "  return spellOps(res.success ? node.success : node.fail, 'target');",
      '}',
    ].join('\n'));
    expect(sites.map(siteLabel)).toEqual(['src/engine/x.ts:2 [lecteur rouleNoeud → rollTest]']);
  });

  it('LECTURE par ACCÈS `.test.<champ>` (sans paramètre typé) : rouge', () => {
    const sites = scan([
      'function cycle(dz: DiseaseInstance, rng: RNG): void {',
      '  const difficulty = dz.daily.test.difficulty!;',
      '  if (!rollTest(dz.rv, difficulty, rng).success) applique(dz);',
      '}',
    ].join('\n'));
    expect(sites.map(siteLabel)).toEqual(['src/engine/x.ts:3 [lecteur cycle → rollTest]']);
  });

  it('LECTURE + roulage DÉLÉGUÉ (clôture TRANSITIVE) : rouge sur le lecteur ET sur son appelant', () => {
    const sites = scan([
      'function jette(v: number, d: Difficulty, rng: RNG) { return rollTest(v, d, rng); }',
      'function lit(node: FlowTestNode, rng: RNG) { return jette(1, node.test.difficulty, rng); }',
      'function amont(node: FlowTestNode2, rng: RNG) { return lit(node, rng); }',
    ].join('\n'));
    expect(sites.map(siteLabel)).toEqual([
      'src/engine/x.ts:2 [lecteur lit → jette]',
      'src/engine/x.ts:3 [appelant amont → lit]',
    ]);
  });

  it('ANGLE MORT DÉCLARÉ : un rouleur qui lit une forme PROPRIÉTAIRE n’est PAS vu — et le module le DIT', () => {
    // Source synthétique calquée sur la forme que B3-1b a tuée (#1657) : le jet y est décrit par un type
    // PROPRE au domaine, jamais par le nœud canonique — (R) tient, (L) est faux, la garde rend 0.
    const sites = scan([
      'function resolveAmputation(amp: Amputation, resistVal: number, rng: RNG): GameOp[] {',
      '  const res = rollTest(resistVal, amp.difficulty, rng);',
      "  return res.success ? [] : [{ op: 'condition', id: 'a-terre' }];",
      '}',
    ].join('\n'));
    expect(sites, 'la garde verrait une forme propriétaire : l’angle mort en tête du module a été fermé, le mettre à jour').toEqual([]);
    // Le contrat n'est donc PAS « la garde couvre tout » mais « l’angle mort est NOMMÉ » : sans cette
    // moitié, un vert ci-dessus se lirait comme une couverture qu’il n’a pas.
    const module = readFileSync(new URL('../../scripts/guards/lib/flowTestEngineRoll.mjs', import.meta.url), 'utf8');
    expect(module, 'angle mort « forme propriétaire » non déclaré en tête du module').toMatch(/ANGLE MORT STRUCTUREL[\s\S]*FORME PROPRIÉTAIRE/);
  });

  it('les deux formes LÉGITIMES réelles restent hors du stock (`miscast.ts`, `riverNavigation.ts`)', () => {
    const files = readCorpus(['src/engine']).map(({ rel, text }) => ({ rel, text }));
    const mordus = scanFlowTestEngineRoll(files).filter((s) => /miscast\.ts|riverNavigation\.ts/.test(s.file));
    expect(mordus.map(siteLabel), 'une forme légitime (fabrique de nœud, lecture pure) est mordue').toEqual([]);
  });
});
