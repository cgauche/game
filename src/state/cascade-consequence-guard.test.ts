import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

/**
 * Cliquet du composeur d'affichage (#295, verrou 2) — le canal `journal:` d'un `CascadeApplier` a
 * disparu DU TYPE (`cascade.ts CascadeApplier`, mort du canal) : le compilateur interdit déjà toute
 * chaîne LIBRE re-décrivant le jet (`${step.result.roll}/${step.result.target}`, « réussi »/« raté »)
 * que la rangée `RollLine` affiche déjà (✓/✗ ±DR). Ce cliquet reste en CEINTURE (grep, pas seulement
 * type) ; le CONTENU des conséquences (`freeCons(...)`) est verrouillé par le describe « CONTENU »
 * ci-dessous — doctrine #295 : une ligne de conséquence narre l'effet DÉJÀ appliqué, jamais le jet.
 *
 * BASELINE gelée par fichier (patron `ui-ratchets.test.ts`), TOUTE à ZÉRO (#295 migration soldée) :
 * toute HAUSSE échoue (régression).
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url)); // racine du repo

/** Isole les littéraux `journal: [...]` d'un CascadeApplier (canal déprécié) — exclut les écritures
 *  d'ÉTAT `journal: [...get().journal...]` (spread de `state.journal`, un champ homonyme sans rapport). */
function journalLiterals(src: string): string[] {
  return src.match(/\bjournal:\s*\[(?!\.\.\.get\(\)\.journal)[^\]]*\]/gs) ?? [];
}

/** Compte, DANS les littéraux `journal:` isolés, les deux motifs de duplication du jet (doc § Verrous) :
 *  re-print du résultat (`${…roll|target|sl}`) et verdict en dur (réussi/raté/réussit/échoue). */
function dupCounts(src: string): { journalArrays: number; jetDup: number; verdict: number } {
  const snippets = journalLiterals(src);
  let jetDup = 0;
  let verdict = 0;
  for (const s of snippets) {
    jetDup += (s.match(/\$\{[^}]*\.(roll|target|sl)\b/g) ?? []).length;
    verdict += (s.match(/\b(r[ée]ussi|rat[ée]|r[ée]ussit|[ée]choue)\b/gi) ?? []).length;
  }
  return { journalArrays: snippets.length, jetDup, verdict };
}

/** Baseline par fichier (relatif à la racine du repo, slashes avant) — ZÉRO partout : `travelFlow`/
 *  `travelPostes`/`seaVoyageFlow`/`shipwreck`/`pursuitFlow`/`combatFlow`/`combat/roundHooks`/
 *  `combat/turnHooks`/`combat/triggeredTest`/`restFlow`/`embrigadementFlow`/`riverVoyageFlow` (Lot 1) +
 *  `combatEffects`/`combatManeuvers`/`encounterPsychFlow` (mort du canal, #295) — plus aucun fichier
 *  du scope ne porte le canal `journal:` déprécié. */
const BASELINE: Record<string, { journalArrays: number; jetDup: number; verdict: number }> = {};

const SCOPE = [
  'src/state/travelFlow.ts', 'src/state/travelPostes.ts', 'src/state/seaVoyageFlow.ts', 'src/state/shipwreck.ts',
  'src/state/pursuitFlow.ts', 'src/state/combatFlow.ts', 'src/state/combat/roundHooks.ts', 'src/state/combat/turnHooks.ts',
  'src/state/combat/triggeredTest.ts', 'src/state/restFlow.ts', 'src/state/embrigadementFlow.ts', 'src/state/riverVoyageFlow.ts',
  'src/state/combatEffects.ts', 'src/state/combatManeuvers.ts', 'src/state/encounterPsychFlow.ts',
];

describe('cliquet composeur — canal journal: déprécié des CascadeApplier (#295, verrou 2, mort du canal)', () => {
  it('aucun fichier du scope ne réutilise le canal journal: (canal absent DU TYPE)', () => {
    const over: string[] = [];
    const stale: string[] = [];
    for (const rel of SCOPE) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      const n = dupCounts(src);
      const b = BASELINE[rel] ?? { journalArrays: 0, jetDup: 0, verdict: 0 };
      if (n.journalArrays > b.journalArrays || n.jetDup > b.jetDup || n.verdict > b.verdict) {
        over.push(`${rel} : journalArrays=${n.journalArrays}(base ${b.journalArrays}) jetDup=${n.jetDup}(base ${b.jetDup}) verdict=${n.verdict}(base ${b.verdict})`);
      }
      if (n.journalArrays < b.journalArrays || n.jetDup < b.jetDup || n.verdict < b.verdict) {
        stale.push(`${rel} : baseline journalArrays=${b.journalArrays}/jetDup=${b.jetDup}/verdict=${b.verdict}, réel ${n.journalArrays}/${n.jetDup}/${n.verdict}`);
      }
    }
    expect(over, `Régression canal journal: déprécié — migrer vers consequences: freeCons(...) :\n${over.join('\n')}`).toEqual([]);
    expect(stale, `Baseline(s) PÉRIMÉE(s) — abaisser (fichier assaini) :\n${stale.join('\n')}`).toEqual([]);
  });

  it('fail-closed : le compteur détecte une duplication SYNTHÉTIQUE de jet dans un littéral journal:', () => {
    const regressed = "registerCascadeApplier('x', (get, set, step, hero) => {\n"
      + "  return { journal: [`${hero.name} : ${step.result.roll}/${step.result.target} → réussi.`] };\n"
      + '});';
    const n = dupCounts(regressed);
    expect(n.journalArrays).toBe(1);
    expect(n.jetDup).toBeGreaterThan(0);
    expect(n.verdict).toBeGreaterThan(0);
  });

  it('fail-closed : une écriture d\'état journal: [...get().journal...] (state.journal) N\'EST PAS confondue avec le canal applier', () => {
    const stateWrite = "set({ journal: [...get().journal.slice(-40), 'ligne'] });";
    expect(journalLiterals(stateWrite)).toEqual([]);
  });

  it('aucun applier des surfaces migrées ne recense de nouveau fichier hors BASELINE (garde exhaustive du scope)', () => {
    for (const rel of Object.keys(BASELINE)) expect(SCOPE).toContain(rel);
  });
});

/**
 * Cliquet du composeur d'affichage (#295, Lot 5 — CONTENU) : le canal `journal:` a disparu (verrou
 * ci-dessus), mais la migration Lot 1 n'avait touché que le TYPE — pas le TEXTE. Ce second cliquet
 * scanne, PAR FICHIER, le motif `${…roll}/${…target}` sur TOUT le fichier (pas seulement les
 * littéraux `journal:`, morts) : un re-print du jet dans un texte de conséquence (`freeCons(...)`,
 * `tell(...)`, `log(...)`…) juste au-dessus d'une rangée qui l'affiche déjà (CascadeModal, SteamSaveModal,
 * RenounceModal…) est le symptôme exact du mandat user (« le pire c'est les résultats qui remettent le
 * résultat du jet visible juste au-dessus »).
 *
 * PÉRIMÈTRE INVERSÉ #410 (2026-07-13) : la garde balaie désormais TOUT `src/state` + `src/engine`
 * (walk récursif) au lieu d'une liste opt-in de 10 fichiers — l'audit de couverture a trouvé le
 * symptôme EXACT vivant hors liste (merchantFlow:206,226 ; portFlow:361,364 ; engine/magic ;
 * engine/provisions ; engine/travel), qu'un nouveau flow aurait franchi en silence. Tout nouveau
 * fichier naît couvert (baseline 0).
 *
 * BASELINE ZÉRO pour tout fichier sans re-print. BASELINE > 0 = STOCK GELÉ par fichier — les sites
 * que le dériveur (`engine/traceLine.ts`) ne peut PAS rendre (raison mesurée en regard de chacun).
 * Toute hausse au-delà = régression ; toute baisse doit ABAISSER la baseline (cliquet décroissant).
 *
 * CE QUE CE SCAN NE VOIT PAS, dit sans détour (il ne lit qu'un motif de TEXTE `${x.roll}/${x.target}`) :
 * une recopie du dé par un autre gabarit (`${roll} sur ${target}`, concaténation, `join`), une recopie
 * routée par une clé de catalogue (`t('out.…')` — le garde i18n ne fait que compter des littéraux FR
 * par fichier, il ne juge AUCUN contenu), et tout re-print hors `src/state`/`src/engine`. Le dériveur
 * lui-même échappe au motif par construction : c'est le volet « canal » (lint AST) plus bas qui tient
 * la porte d'entrée, pas ce compteur.
 */
const CONTENT_DIRS = ['src/state', 'src/engine'];

/** Baseline par fichier — voir doc ci-dessus. Reste 9 occurrences dans 4 fichiers : les IRRÉDUCTIBLES
 *  au dériveur, chacun avec SA raison mesurée (#1262 V3 Lj). */
const CONTENT_BASELINE: Record<string, number> = {
  // #295 — sites GARDÉS nominativement (journal = SEULE surface du jet) que le dériveur ne peut PAS rendre :
  'src/state/seaVoyageFlow.ts': 1, // redémarrage vapeur (`runRestart`) : la ligne porte le DR CUMULÉ du Test étendu (`lastDR`), pas le DR du jet — le patron dirait un autre nombre.
  'src/state/travelFlow.ts': 2, // bêtes de l'attelage (×2) : porteur SANS identité, dé parenthétique en justification d'un effet déjà narré (l'ordre phrase/issue s'inverserait).
  'src/state/riverVoyageFlow.ts': 4, // éclats/calfatage/renflouage IA (×4) : jet INCISÉ dans une narration d'ÉVÉNEMENT — il faudrait scinder en deux lignes.
  'src/state/combat/triggeredTest.ts': 2, // Test opposé INLINE : DEUX jets sur UNE ligne — exigerait un dériveur d'OPPOSÉ (inexistant).
  // RÉSORBÉS dans le dériveur (#1262 V3 Lj) : stock #410 (merchantFlow ×2, portFlow ×2, engine/magic ×2,
  // engine/provisions ×2, engine/travel ×1) + 4 sites #295 (pursuitFlow, shipwreck, travelFlow ×2).
};

function jetEchoCount(src: string): number {
  return (src.match(/\$\{[^}]*\.roll\}\/\$\{[^}]*\.target\}/g) ?? []).length;
}

function contentCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e) && !/\.test\.[tj]sx?$/.test(e)) {
        const rel = relative(ROOT, p).split('\\').join('/');
        const n = jetEchoCount(readFileSync(p, 'utf8'));
        if (n > 0) counts[rel] = n;
      }
    }
  };
  for (const d of CONTENT_DIRS) walk(join(ROOT, d));
  return counts;
}

describe('cliquet composeur — CONTENU des conséquences : re-print roll/target hors rangée (#295 Lot 5, #410 inversé)', () => {
  it('aucun fichier de src/state|src/engine ne dépasse sa baseline gelée', () => {
    const counts = contentCounts();
    const over: string[] = [];
    for (const [rel, n] of Object.entries(counts)) {
      const b = CONTENT_BASELINE[rel] ?? 0;
      if (n > b) over.push(`${rel} : ${n} occurrence(s) (baseline gelée ${b})`);
    }
    expect(over, `Régression — re-print roll/target hors rangée (#295 Lot 5) :\n${over.join('\n')}`).toEqual([]);
  });

  it('CLIQUET : toute baseline devenue trop haute (site purgé) doit être ABAISSÉE', () => {
    const counts = contentCounts();
    const stale: string[] = [];
    for (const [rel, b] of Object.entries(CONTENT_BASELINE)) {
      const n = counts[rel] ?? 0;
      if (n < b) stale.push(`${rel} : baseline gelée ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, `Baseline(s) PÉRIMÉE(s) — abaisser (site purgé depuis) :\n${stale.join('\n')}`).toEqual([]);
  });

  it('fail-closed : le compteur détecte un re-print roll/target SYNTHÉTIQUE hors littéral journal:', () => {
    const regressed = "  return { consequences: freeCons([`${hero.name} : ${step.result.roll}/${step.result.target} → réussi.`]) };";
    expect(jetEchoCount(regressed)).toBe(1);
  });
});

/**
 * VOLET ISSUE (#1262 V3 Lj) — le canal de l'ISSUE d'un jet. Le murage par export est impossible
 * (`get().log` sert le narratif légitime, `describeX` sert AUSSI l'affichage des fenêtres de
 * `src/ui`) : la police est un LINT D'IMPORT AST (`no-restricted-imports`, `eslint.config.js`, patron
 * `ownsLocally`), borné à `src/state` — la couche qui décidait — et MESURÉ ici sur la config RÉELLE
 * (API ESLint, jamais une copie de règle : une regex maison laissait passer les guillemets doubles).
 *
 * Deux goulots exemptés, nommés, et RIEN d'autre : la DÉCLARATION d'issue d'un flux à fenêtre
 * (`rollFlowSpecs.ts`, `spec.issue`, rendue par le verbe `apply`) et la conséquence d'étape de
 * cascade (`encounterPsychFlow.ts` → `freeCons` → `commitStep`).
 *
 * CE QUE CETTE POLICE NE VOIT PAS, mesuré (cf. les deux derniers tests, qui l'attestent au lieu de
 * l'affirmer) : l'import DYNAMIQUE (`await import('./flowOutcomes')`), le `require()`, et surtout
 * toute recopie qui ne passe PAS par un import — réécrire la phrase à la main, ou la router par la
 * clé de catalogue (`t('out.reload', …)`). Aucune garde du dépôt ne tient cette dernière porte : le
 * garde i18n compte des littéraux FR par fichier, il ne juge aucun contenu. La limite est écrite ici
 * plutôt que couverte à tort.
 */
const ISSUE_GOULOTS = [
  'src/state/rollFlowSpecs.ts', // DÉCLARATION `spec.issue` des flux à fenêtre → verbe `apply`
  'src/state/encounterPsychFlow.ts', // conséquence d'étape (freeCons → commitStep)
];

/** Fichier de sonde SOUS le périmètre de la règle (aucun goulot, hors test). */
const SOUS_LA_REGLE = 'src/state/__sonde-canal-issue.ts';
const eslint = new ESLint({ cwd: ROOT });

/** Occurrences de la règle d'import restreint sur un CODE donné (config réelle). */
async function violationsCanal(code: string, filePath = SOUS_LA_REGLE): Promise<number> {
  const [res] = await eslint.lintText(code, { filePath, warnIgnored: false });
  return res.messages.filter((m) => m.ruleId === 'no-restricted-imports').length;
}

describe('cliquet du canal — l’ISSUE d’un jet ne se compose qu’aux GOULOTS (#1262 V3 Lj)', () => {
  it('src/state RÉEL : aucun fichier ne compose d’issue hors goulot (la population EST le contrat)', async () => {
    // Pré-filtre par SOUS-CHAÎNE nue (« flowOutcomes ») — aucune forme d'import n'y échappe, et seuls
    // les candidats sont lintés (linter tout `src/state` coûte ~8 s à chaque run pour le même verdict).
    const candidats: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e) && readFileSync(p, 'utf8').includes('flowOutcomes')) candidats.push(p);
      }
    };
    walk(join(ROOT, 'src', 'state'));
    const res = await eslint.lintFiles(candidats);
    const offenders = res.flatMap((r) => r.messages
      .filter((m) => m.ruleId === 'no-restricted-imports')
      .map(() => relative(ROOT, r.filePath).split('\\').join('/')));
    expect(offenders, 'Issue composée hors goulot — déclarer `spec.issue` et acquitter par `flow.apply` :').toEqual([]);
  });

  it('les GOULOTS sont exemptés NOMMÉMENT (et eux seuls) : le même import y passe', async () => {
    for (const g of ISSUE_GOULOTS) {
      expect(await violationsCanal("import { describeReload } from './flowOutcomes';", g), g).toBe(0);
    }
  });

  it('fail-closed : la règle MORD, quelles que soient les guillemets, la forme d’import ou l’alias', async () => {
    expect(await violationsCanal("import { describeReload } from './flowOutcomes';"), 'guillemets simples').toBe(1);
    expect(await violationsCanal('import { describeReload } from "./flowOutcomes";'), 'guillemets DOUBLES').toBe(1);
    expect(await violationsCanal("import * as FO from './flowOutcomes';\nexport const x = FO;"), 'namespace').toBe(1);
    expect(await violationsCanal("import { describeReload } from '../flowOutcomes';"), 'chemin remontant').toBe(1);
    expect(await violationsCanal("import { describeReload } from '@/state/flowOutcomes';"), 'alias').toBe(1);
    expect(await violationsCanal("export { describeReload } from './flowOutcomes';"), 're-export').toBe(1);
    expect(await violationsCanal("import { ev } from './combatLog';\nexport const w = ev;"), 'un autre import ne mord pas').toBe(0);
  });

  it('LIMITES ASSUMÉES, mesurées : import dynamique, `require`, et recopie par CLÉ i18n passent', async () => {
    expect(await violationsCanal("export const f = async () => (await import('./flowOutcomes')).describeReload;"), 'import dynamique').toBe(0);
    expect(await violationsCanal("const FO = require('./flowOutcomes');\nexport const y = FO;"), 'require').toBe(0);
    expect(
      await violationsCanal("import { t } from '../i18n';\nexport const z = () => t('out.reload', { name: 'x', weapon: 'w', after: 1, reload: 2 });"),
      'recopie par clé de catalogue : AUCUNE garde ne la tient — dit au JSDoc ci-dessus',
    ).toBe(0);
  });
});
