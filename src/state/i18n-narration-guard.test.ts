import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou i18n — narration moteur (Phase C, cf. docs/i18n-seam.md).
 *
 * Règle : dans les fichiers MIGRÉS, toute ligne de JOURNAL de combat/effet doit passer par le
 * catalogue (`t(...)` / `tr(...)`), jamais par un littéral FR brut. Le scan échoue si un SITE
 * D'ÉMISSION de journal contient un littéral de chaîne accentué (= français) au lieu d'un appel `t`.
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
 *
 * Baseline : ZÉRO. Aucune allowlist — un nouveau littéral FR de narration dans ces fichiers
 * échoue le test. Étendre `MIGRATED` au fur et à mesure que d'autres fichiers passent au catalogue.
 */
const here = (f: string) => fileURLToPath(new URL(f, import.meta.url));
const read = (f: string) => readFileSync(here(f), 'utf8');

/** Fichiers dont la narration de JOURNAL est entièrement passée au catalogue (Phase C). */
const MIGRATED: Record<string, string> = {
  'engine/conditions.ts': read('../engine/conditions.ts'),
  'engine/ops.ts': read('../engine/ops.ts'),
  'engine/psychology.ts': read('../engine/psychology.ts'),
  'state/combat/turnHooks.ts': read('./combat/turnHooks.ts'),
  'state/outOfCombatUpkeep.ts': read('./outOfCombatUpkeep.ts'),
  'state/combatManeuvers.ts': read('./combatManeuvers.ts'),
  'state/flowOutcomes.ts': read('./flowOutcomes.ts'),
  'state/combatSlice.ts': read('./combatSlice.ts'),
  'state/combatFlow.ts': read('./combatFlow.ts'),
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

describe('garde-fou i18n — narration moteur (Phase C)', () => {
  for (const [name, raw] of Object.entries(MIGRATED)) {
    it(`${name} : aucune ligne de journal en littéral FR brut`, () => {
      const body = stripComments(raw);
      const offenders: string[] = [];
      for (const shape of EMIT_SHAPES) {
        shape.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = shape.exec(body))) {
          const quote = m[1];
          const litStart = m.index + m[0].length - 1;
          const lit = readString(body, litStart, quote);
          if (lit && ACCENT.test(lit)) {
            const line = body.slice(0, m.index).split('\n').length;
            offenders.push(`L${line}: ${lit.slice(0, 80)}`);
          }
        }
      }
      expect(offenders, `Littéraux FR de narration hors catalogue dans ${name} :\n${offenders.join('\n')}`).toEqual([]);
    });
  }
});
