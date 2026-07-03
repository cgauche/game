/**
 * Garde-fou d'INTÉGRITÉ des données app-owned (`src/data/*.json`). Attrape AU BUILD les corruptions de
 * donnée qui ne plantent qu'au runtime — typiquement une string template `"$indice"` qui atteint
 * `resolveFormula` et crashe en plein combat. GÉNÉRIQUE : balaie TOUS les `.json` (aucune liste codée
 * en dur), messages d'échec ACTIONNABLES (fichier + chemin JSON + valeur fautive).
 *
 * Cinq familles de checks :
 *  1. SYNTAXE        — chaque fichier `JSON.parse` (échec → rouge avec le fichier).
 *  2. OPS CONNUES    — toute `{op:'…'}` (hors Condition `kind`) a un `op` du vocabulaire `GameOp` réel
 *                      (extrait de l'union `GameOp` de `engine/ops.ts` par regex → zéro dérive).
 *  3. FORMULES       — tout champ Formula d'une `GameOp` (`amount`/`count`/… ) est `isValidFormula`
 *                      (number fini OU objet à clé connue). Une string qui fuit → rouge.
 *  4. PLACEHOLDERS   — une string `$…` n'est tolérée QUE si elle vaut `'$arg'`/`'$indice'` ET vit dans
 *                      les `effects` de `traits.json` (substituée par `withArg`, state/triggeredEffects).
 *  5. REFS           — `summon/polymorph/scheduleRespawn.ref` → créature ; `grantTrait.traitId` → trait ;
 *                      `condition/removeCondition.name` → État ; `exposeDisease/contractDisease.disease`
 *                      → maladie. Tolère le template `'$arg'`/`'$indice'`.
 *
 * EXCLUSION `miscast.json` (familles 3 & 5) : ce fichier est un DIALECTE source (`JsonOp`/`JsonFormula` :
 * `{sinPlus1:true}`, `sinPlus1Value`, noms paramétrés par `sinPoints`) COMPILÉ en `GameOp` réels par
 * `engine/miscast.ts::expandOp`, et validé par `engine/miscast-ops.test.ts`. Ses `op` restent vérifiés
 * (famille 2 : ce sont des noms `GameOp` standard), mais ses Formules/refs suivent un autre vocabulaire.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidFormula } from '../engine/ops';
import { ICON_DEFS } from '../ui/icons';
import { findCreatureById, findCreature, findVehicleById, traitById, findConditionById, findDiseaseById, symptomById } from './index';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));

// --- Vocabulaire GameOp EXACT, extrait de l'union `GameOp` de engine/ops.ts (membres `| { op: '…'`) →
//     jamais une liste maintenue à la main qui dériverait de l'union.
const OPS_SRC = readFileSync(fileURLToPath(new URL('../engine/ops.ts', import.meta.url)), 'utf8');
const KNOWN_OPS = new Set([...OPS_SRC.matchAll(/\|\s*\{\s*op:\s*'([^']+)'/g)].map((m) => m[1]));
// Opérateurs de comparaison d'une Condition `compare`/`slThreshold`/… (engine/flowCore.ts `CompareOp`) :
// un AUTRE espace de noms pour la clé `op`, TOUJOURS porté par un objet à `kind` → exclu du dispatch GameOp.
const COMPARE_OPS = new Set(['>=', '<=', '==', '<', '>', '!=']);

// Fichier DIALECTE compilé (cf. en-tête) : exclu des familles Formule & Refs.
const MISCAST = 'miscast.json';
// Marqueur narratif toléré pour `condition.name` : Pétrifié (LDB 85 l.238) n'est PAS un État RAW LDB 16
// (pas d'entrée `etats.json`, aucun consommateur) — c'est un tag d'arbitrage, pas une ref d'entité.
const SOFT_CONDITIONS = new Set(['petrifie']);

// Champs d'une `GameOp` typés `Formula` (ou `number`, qui passe `isValidFormula`) — au minimum amount/count.
const FORMULA_FIELDS = [
  'amount', 'count', 'value', 'durationRounds', 'escapeStrength', 'radius', 'damage', 'meters',
  'maxBounces', 'hopMeters', 'delayDays', 'radiusMeters', 'lengthMeters', 'bonus', 'indice', 'mod',
  'rounds', 'minutes', 'hours', 'days',
  // Extensions #50 : États à durée d'horloge (op `condition`) + ops différées (op `delayed`).
  'durationMinutes', 'durationHours', 'afterMinutes', 'afterHours', 'afterDays', 'forMinutes', 'forHours', 'forDays',
];

/** Template d'instance substitué au runtime par `withArg` (state/triggeredEffects) — légitime UNIQUEMENT
 *  dans les `effects` de `traits.json` (`$arg` ← arg d'instance, `$indice` ← Indice). Ailleurs = bug. */
const isTemplate = (v: unknown, file: string, path: string): boolean =>
  (v === '$arg' || v === '$indice') && file === 'traits.json' && path.includes('effects');

/** Un objet est-il une `GameOp` à valider ? `op` string ET PAS de `kind` (les Conditions `compare`/… ont
 *  un `kind` et réutilisent la clé `op` pour un opérateur — jamais une GameOp). */
const isGameOp = (o: Record<string, unknown>): boolean => typeof o.op === 'string' && !('kind' in o);

interface Issue { file: string; path: string; detail: string }
interface Scan { parseErrors: Issue[]; unknownOps: Issue[]; badFormulas: Issue[]; badPlaceholders: Issue[]; badRefs: Issue[] }

function refResolves(op: string, o: Record<string, unknown>, file: string, path: string, out: Issue[]): void {
  const tol = (v: unknown) => isTemplate(v, file, path);
  const ref = (field: string, val: unknown, ok: (s: string) => boolean, kind: string) => {
    if (typeof val !== 'string' || tol(val)) return;
    if (!ok(val)) out.push({ file, path: `${path}.${field}`, detail: `ref ${kind} introuvable : ${JSON.stringify(val)}` });
  };
  if (op === 'summon' || op === 'polymorph' || op === 'scheduleRespawn')
    // Runtime `spawnEnemy` résout par id ; mais les données authorent les invocations par LIBELLÉ (et
    // 'self' = sentinelle scheduleRespawn) → on valide « nomme une vraie créature » (id OU libellé OU coque).
    ref('ref', o.ref, (s) => s === 'self' || !!findCreatureById(s) || !!findCreature(s) || !!findVehicleById(s)?.hull, 'créature');
  if (op === 'grantTrait') ref('traitId', o.traitId, (s) => traitById.has(s), 'trait');
  if (op === 'condition' || op === 'removeCondition') ref('name', o.name, (s) => !!findConditionById(s) || SOFT_CONDITIONS.has(s), 'État');
  if (op === 'exposeDisease' || op === 'contractDisease') ref('disease', o.disease, (s) => !!findDiseaseById(s) || !!symptomById.get(s), 'maladie');
}

function walk(node: unknown, file: string, path: string, scan: Scan): void {
  if (Array.isArray(node)) { node.forEach((v, i) => walk(v, file, `${path}[${i}]`, scan)); return; }
  if (!node || typeof node !== 'object') return;
  const o = node as Record<string, unknown>;
  if (isGameOp(o)) {
    const op = o.op as string;
    // (2) vocabulaire — un opérateur de comparaison orphelin (sans kind) n'est pas une GameOp : on l'ignore.
    if (!KNOWN_OPS.has(op) && !COMPARE_OPS.has(op)) scan.unknownOps.push({ file, path, detail: `op inconnue : ${JSON.stringify(op)}` });
    if (KNOWN_OPS.has(op) && file !== MISCAST) {
      // (3) formules
      for (const ff of FORMULA_FIELDS) {
        if (!(ff in o)) continue;
        const v = o[ff];
        if (isTemplate(v, file, `${path}.${ff}`)) continue; // template de trait substitué par withArg
        if (!isValidFormula(v)) scan.badFormulas.push({ file, path: `${path}.${ff}`, detail: `Formule invalide (op '${op}') : ${JSON.stringify(v)}` });
      }
      // (5) refs
      refResolves(op, o, file, path, scan.badRefs);
    }
  }
  // (4) placeholders — toute string $… hors template toléré.
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' && v.startsWith('$') && !isTemplate(v, file, `${path}.${k}`))
      scan.badPlaceholders.push({ file, path: `${path}.${k}`, detail: `placeholder $… non substitué : ${JSON.stringify(v)}` });
    walk(v, file, `${path}.${k}`, scan);
  }
}

const scan: Scan = { parseErrors: [], unknownOps: [], badFormulas: [], badPlaceholders: [], badRefs: [] };
for (const f of files) {
  let data: unknown;
  try { data = JSON.parse(readFileSync(join(DIR, f), 'utf8')); }
  catch (e) { scan.parseErrors.push({ file: f, path: '', detail: (e as Error).message }); continue; }
  walk(data, f, '', scan);
}
const fmt = (issues: Issue[]) => issues.map((i) => `  ${i.file}${i.path} → ${i.detail}`).join('\n');

describe('Intégrité des données src/data/*.json', () => {
  it('extraction du vocabulaire GameOp depuis ops.ts (méta — non vide, ops phares présentes)', () => {
    expect(KNOWN_OPS.size).toBeGreaterThan(60);
    for (const op of ['wounds', 'condition', 'summon', 'grantTrait', 'narrative']) expect(KNOWN_OPS.has(op)).toBe(true);
  });
  it('1 — chaque .json parse', () => {
    expect(scan.parseErrors, `JSON malformé :\n${fmt(scan.parseErrors)}`).toEqual([]);
  });
  it('2 — toute op appartient au vocabulaire GameOp', () => {
    expect(scan.unknownOps, `Op(s) hors vocabulaire GameOp (typo ?) :\n${fmt(scan.unknownOps)}`).toEqual([]);
  });
  it('3 — tout champ Formula est une Formule valide (number fini OU objet à clé connue)', () => {
    expect(scan.badFormulas, `Formule(s) invalide(s) — une string ici planterait resolveFormula :\n${fmt(scan.badFormulas)}`).toEqual([]);
  });
  it("4 — aucune string $… non substituée (sauf template $arg/$indice dans les effects de traits.json)", () => {
    expect(scan.badPlaceholders, `Placeholder(s) $… qui fuiraient au runtime :\n${fmt(scan.badPlaceholders)}`).toEqual([]);
  });
  it('5 — les refs (créature/trait/État/maladie) résolvent', () => {
    expect(scan.badRefs, `Ref(s) non résolue(s) :\n${fmt(scan.badRefs)}`).toEqual([]);
  });
  it('6 — species.json : family non vide sur chaque espèce (groupage du rail créateur — remplace la regex sur label)', () => {
    const species = JSON.parse(readFileSync(join(DIR, 'species.json'), 'utf8')) as { id: string; family?: string }[];
    const missing = species.filter((s) => typeof s.family !== 'string' || !s.family.trim()).map((s) => s.id);
    expect(missing, `Espèce(s) sans family :\n  ${missing.join('\n  ')}`).toEqual([]);
  });
  it("7 — activities.json : chaque Activité porte une icône du registre (ActivityDef.icon ∈ ICON_DEFS)", () => {
    const activities = JSON.parse(readFileSync(join(DIR, 'activities.json'), 'utf8')) as { id: string; icon?: string }[];
    const bad = activities.filter((a) => typeof a.icon !== 'string' || !(a.icon in ICON_DEFS)).map((a) => `${a.id} → ${JSON.stringify(a.icon)}`);
    expect(bad, `Activité(s) sans icône du registre (src/ui/icons) :\n  ${bad.join('\n  ')}`).toEqual([]);
  });
});
