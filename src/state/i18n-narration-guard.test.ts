import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou i18n — narration moteur (Phase C, cf. docs/i18n-seam.md).
 *
 * Règle : toute ligne de JOURNAL de combat/effet doit passer par le catalogue (`t(...)` / `tr(...)`),
 * jamais par un littéral FR brut. Le scan échoue si un SITE D'ÉMISSION de journal contient un littéral
 * de chaîne accentué (= français) au lieu d'un appel `t`.
 *
 * PÉRIMÈTRE INVERSÉ #410 (2026-07-13) : ancien jumeau exact du garde emoji FAINÉANT — l'ancienne
 * version n'auditait qu'une allowlist de 9 fichiers MIGRÉS, laissant passer TOUT nouveau littéral FR
 * d'un fichier non listé. Le scan balaie désormais TOUT `src/engine` + `src/state` (walk récursif) ;
 * chaque fichier porte une BASELINE gelée de son stock de littéraux FR (la dette ne CROÎT plus), et
 * les 9 fichiers MIGRÉS restent à ZÉRO (invariant enforced). Tout nouveau fichier naît couvert
 * (baseline 0). Le stock gelé (Phase C, à résorber au catalogue) DÉCROÎT au fil des migrations.
 *
 * Couvre les FORMES d'émission de journal (PAS les libellés de MODALE/UI `{label:…}`/`prompt:` —
 * surface UI distincte, Phase D différée) :
 *   - `ev('<kind>', `…``               (événement de journal)
 *   - `.log(`…`` / `.log('…'`          (journal direct)
 *   - `<arr>.push(`…``                  (poussée d'une LIGNE de journal — string nu en littéral)
 *   - `castRefused(…, `…``              (refus d'incantation journalisé)
 *   - `return `…``                      (issue renvoyée par un describer pur, ex. flowOutcomes)
 *
 * NON couvert volontairement : les tableaux `outcome: […]` / `options: […]` / `label:`/`prompt:`
 * d'étape de MODALE (surface UI distincte, Phase D) — leurs chaînes ne sont PAS du journal.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url)); // src/state/ → ../../ = racine du repo
const SCAN_DIRS = ['src/engine', 'src/state'];

/** Fichiers dont la narration de JOURNAL est entièrement passée au catalogue (Phase C) — baseline
 *  ZÉRO INVARIANTE : un littéral FR y réapparaissant échoue, quelle que soit la baseline générale. */
const MIGRATED = new Set([
  'src/engine/conditions.ts',
  'src/engine/ops.ts',
  'src/engine/psychology.ts',
  'src/state/combat/turnHooks.ts',
  'src/state/outOfCombatUpkeep.ts',
  'src/state/combatManeuvers.ts',
  'src/state/flowOutcomes.ts',
  'src/state/combatSlice.ts',
  'src/state/combatFlow.ts',
]);

/** Stock GELÉ par fichier (recensement #410, 2026-07-13) — littéraux FR de narration hors catalogue,
 *  Phase C à résorber. Toute HAUSSE échoue (régression) ; toute BAISSE doit ABAISSER la baseline. Les
 *  fichiers MIGRÉS (ci-dessus) n'y figurent PAS : leur invariant est ZÉRO. */
const BASELINE: Record<string, number> = {
  'src/engine/disease.ts': 11,
  'src/engine/drunkenness.ts': 1,
  'src/engine/exposure.ts': 2,
  'src/engine/harvest.ts': 1,
  'src/engine/healing.ts': 2,
  'src/engine/items.ts': 1,
  'src/engine/mountTravel.ts': 4,
  'src/engine/provisions.ts': 12,
  'src/engine/qualities/craftEconomy.ts': 3,
  'src/engine/rest.ts': 4,
  'src/engine/shipCritical.ts': 5,
  'src/engine/skills.ts': 2,
  'src/engine/social.ts': 1,
  'src/engine/spellRangeFormat.ts': 3,
  'src/engine/structureCritical.ts': 1,
  'src/engine/suffocation.ts': 1,
  'src/engine/tavernGame.ts': 2,
  'src/engine/traits/dispatch.ts': 1,
  'src/engine/trauma.ts': 10,
  'src/state/combat/roundHooks.ts': 1,
  'src/state/combatEffects.ts': 7,
  'src/state/corruptionFlow.ts': 4,
  'src/state/devtools.ts': 42,
  'src/state/interludeFlow.ts': 28,
  'src/state/keybindings.ts': 1,
  'src/state/massBattleFlow.ts': 20,
  'src/state/medicFlow.ts': 3,
  'src/state/merchantFlow.ts': 15,
  'src/state/mount.ts': 1,
  'src/state/netFlow.ts': 4,
  'src/state/partyFlow.ts': 4,
  'src/state/portFlow.ts': 1,
  'src/state/pursuitFlow.ts': 2,
  'src/state/restFlow.ts': 4,
  'src/state/riverVoyageFlow.ts': 11,
  'src/state/rollFlowFactory.ts': 1,
  'src/state/seaActivities.ts': 4,
  'src/state/seaVoyageFlow.ts': 5,
  'src/state/shipCrew.ts': 4,
  'src/state/shipManeuver.ts': 1,
  'src/state/shipwreck.ts': 2,
  'src/state/store.ts': 10,
  'src/state/travelFlow.ts': 16,
  'src/state/travelPostes.ts': 3,
  'src/state/upkeep.ts': 1,
};

/** Une lettre accentuée FR = preuve de littéral de narration (les ids/clés du catalogue sont ASCII). */
const ACCENT = /[éèêëàâäçôöûùîïœÉÈÊÀÂÇÔÛ]/;

/** Retire commentaires de ligne et de bloc (sans toucher aux chaînes — heuristique suffisante ici). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

/** Sites d'émission de JOURNAL : le littéral de chaîne suit DIRECTEMENT l'ouverture (pas un `t(`/`tr(`). */
const EMIT_SHAPES: RegExp[] = [
  /\.log\(\s*(['"`])/g, // get().log('…') / env.log(`…`)
  /\bev\('[a-z]+',\s*(['"`])/g, // ev('kind', `…`)
  /\.push\(\s*(['"`])/g, // <journalArray>.push(`…`)
  /castRefused\([^;]*?,\s*(['"`])/g, // castRefused(get, set, c, `…`)
  /\breturn\s+(['"`])/g, // return `…` (describer pur ; PAS `return [` = tableau de modale)
];

/** Extrait le littéral de chaîne qui commence au délimiteur `quote` à la position `from`. */
function readString(body: string, from: number, quote: string): string | null {
  const end = body.indexOf(quote, from + 1);
  if (end < 0) return null;
  return body.slice(from, end + 1);
}

/** Compte les littéraux FR de narration d'un fichier (hors catalogue). */
function narrationCount(raw: string): number {
  const body = stripComments(raw);
  let n = 0;
  for (const shape of EMIT_SHAPES) {
    shape.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = shape.exec(body))) {
      const quote = m[1];
      const litStart = m.index + m[0].length - 1;
      const lit = readString(body, litStart, quote);
      if (lit && ACCENT.test(lit)) n++;
    }
  }
  return n;
}

function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e) && !/\.test\.[tj]sx?$/.test(e)) {
        const rel = relative(ROOT, p).split('\\').join('/');
        const n = narrationCount(readFileSync(p, 'utf8'));
        if (n > 0) counts[rel] = n;
      }
    }
  };
  for (const d of SCAN_DIRS) walk(join(ROOT, d));
  return counts;
}

describe('garde-fou i18n — narration moteur (Phase C, #410 inversé)', () => {
  it('aucun fichier de src/engine|src/state ne dépasse sa baseline gelée de littéraux FR', () => {
    const counts = countsByFile();
    const over: string[] = [];
    for (const [rel, n] of Object.entries(counts)) {
      const b = MIGRATED.has(rel) ? 0 : BASELINE[rel] ?? 0;
      if (n > b) over.push(`${rel} : ${n} littéral(aux) FR (baseline gelée ${b})`);
    }
    expect(
      over,
      `Nouveau(x) littéral(aux) FR de narration hors catalogue — passer par t(...)/tr(...) :\n${over.join('\n')}`,
    ).toEqual([]);
  });

  it('les 9 fichiers MIGRÉS restent à ZÉRO littéral FR (invariant Phase C)', () => {
    const counts = countsByFile();
    const regressed: string[] = [];
    for (const rel of MIGRATED) {
      const n = counts[rel] ?? 0;
      if (n > 0) regressed.push(`${rel} : ${n} littéral(aux) FR (doit rester 0)`);
    }
    expect(regressed, `Régression d'un fichier MIGRÉ — la narration doit rester au catalogue :\n${regressed.join('\n')}`).toEqual([]);
  });

  it('CLIQUET : toute baseline devenue trop haute (fichier assaini) doit être ABAISSÉE', () => {
    const counts = countsByFile();
    const stale: string[] = [];
    for (const [rel, b] of Object.entries(BASELINE)) {
      const n = counts[rel] ?? 0;
      if (n < b) stale.push(`${rel} : baseline ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, 'Baseline(s) PÉRIMÉE(s) — abaisser ces entrées de BASELINE').toEqual([]);
  });
});
