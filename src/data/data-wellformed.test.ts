/**
 * Garde-fou d'INTÉGRITÉ des données app-owned (`src/data/*.json`). Attrape AU BUILD les corruptions de
 * donnée qui ne plantent qu'au runtime — typiquement une string template `"$indice"` qui atteint
 * `resolveFormula` et crashe en plein combat. GÉNÉRIQUE : balaie TOUS les `.json` (aucune liste codée
 * en dur), messages d'échec ACTIONNABLES (fichier + chemin JSON + valeur fautive).
 *
 * Six familles de checks :
 *  1. SYNTAXE        — chaque fichier `JSON.parse` (échec → rouge avec le fichier).
 *  2. OPS CONNUES    — toute `{op:'…'}` (hors Condition `kind`) a un `op` du vocabulaire `GameOp` réel
 *                      (extrait de l'union `GameOp` de `engine/ops.ts` par regex → zéro dérive).
 *  3. FORMULES       — tout champ Formula d'une `GameOp` (`amount`/`count`/… ) est `isValidFormula`
 *                      (number fini OU objet à clé connue). Une string qui fuit → rouge.
 *  4. PLACEHOLDERS   — une string `$…` n'est tolérée QUE si elle vaut `'$arg'`/`'$indice'` ET vit dans
 *                      les `effects` de `traits.json` (substituée par `withArg`, state/triggeredEffects).
 *  5. REFS           — `summon/polymorph/scheduleRespawn.ref` → créature ; `grantTrait.traitId` → trait ;
 *                      `condition/removeCondition.id` → État ; `exposeDisease/contractDisease.disease`
 *                      → maladie. Tolère le template `'$arg'`/`'$indice'`.
 *  6. FLOW PUR       — chaque `TriggeredEffect.flow` (champs `TriggeredEffect[]` du catalogue, extraits
 *                      par regex de `data/index.ts` — JAMAIS une liste de fichiers à la main) ne porte pas
 *                      une op de `STRAY_IMPURE_OPS` (`interruptFocus`/`breakBlade`/`delayed`) HORS branche
 *                      `success`/`fail` d'un `test` (`flowHasImpureOpOutsideTest`, engine/flowCore) : ces
 *                      ops n'ont de hook que dans le do-loop de `runCombatFlow` avec son contexte de
 *                      branche — ailleurs, le walker pur `runPureFlowLines` (state/combatEffects) les
 *                      avalerait en silence. `grantFreeAttack` top-level reste légitime (résolu par
 *                      `resolveFreeAttacks`).
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
import { flowHasImpureOpOutsideTest } from '../engine/flowCore';
import type { Flow } from '../engine/flowCore';
import { findCreatureById, findVehicleById, traitById, findConditionById, findDiseaseById, symptomById } from './index';
import { TOLERATED } from '../../scripts/guards/lib/gameOpRefFk.mjs';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));

// --- Vocabulaire GameOp EXACT, extrait de l'union `GameOp` de engine/ops.ts (membres `| { op: '…'`) →
//     jamais une liste maintenue à la main qui dériverait de l'union.
const OPS_SRC = readFileSync(fileURLToPath(new URL('../engine/ops.ts', import.meta.url)), 'utf8');
const KNOWN_OPS = new Set([...OPS_SRC.matchAll(/\|\s*\{\s*op:\s*'([^']+)'/g)].map((m) => m[1]));
// Opérateurs de comparaison d'une Condition `compare`/`slThreshold`/… (engine/flowCore.ts `CompareOp`) :
// un AUTRE espace de noms pour la clé `op`, TOUJOURS porté par un objet à `kind` → exclu du dispatch GameOp.
const COMPARE_OPS = new Set(['>=', '<=', '==', '<', '>', '!=']);

// Champs `TriggeredEffect[]` du catalogue — EXTRAITS par regex de `data/index.ts` (jamais une liste de
// familles à la main) : `effects`/`onHitEffects`… Distincts par TYPE des `Flow` simples (`SpellData.effects`,
// `TrappingData.consumable`) qui ne matchent pas ce motif → naturellement hors périmètre du verrou.
const INDEX_SRC = readFileSync(fileURLToPath(new URL('index.ts', import.meta.url)), 'utf8');
const TRIGGERED_EFFECT_FIELDS = new Set(
  [...INDEX_SRC.matchAll(/(\w+)\?:\s*import\('\.\.\/(?:state\/flow|engine\/flowCore)'\)\.TriggeredEffect\[\]/g)].map((m) => m[1]),
);

// Fichier DIALECTE compilé (cf. en-tête) : exclu des familles Formule & Refs.
const MISCAST = 'miscast.json';
// Marqueurs narratifs tolérés pour `condition.id` : SOURCE UNIQUE `TOLERATED.softIds.etats`
// (`scripts/guards/lib/gameOpRefFk.mjs`), qui déclare le mécanisme et ses réfs RAW.
const SOFT_CONDITIONS = new Set<string>(TOLERATED.softIds.etats);

// Champs d'une `GameOp` typés `Formula` (ou `number`, qui passe `isValidFormula`) — au minimum amount/count.
const FORMULA_FIELDS = [
  'amount', 'count', 'value', 'durationRounds', 'escapeStrength', 'escapeThreshold', 'struggleDamage', 'radius', 'damage', 'meters',
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
interface Scan { parseErrors: Issue[]; unknownOps: Issue[]; badFormulas: Issue[]; badPlaceholders: Issue[]; badRefs: Issue[]; strayImpureOps: Issue[] }

function refResolves(op: string, o: Record<string, unknown>, file: string, path: string, out: Issue[]): void {
  const tol = (v: unknown) => isTemplate(v, file, path);
  const ref = (field: string, val: unknown, ok: (s: string) => boolean, kind: string) => {
    if (typeof val !== 'string' || tol(val)) return;
    if (!ok(val)) out.push({ file, path: `${path}.${field}`, detail: `ref ${kind} introuvable : ${JSON.stringify(val)}` });
  };
  if (op === 'summon' || op === 'polymorph' || op === 'scheduleRespawn')
    // Résolution par ID (runtime `spawnEnemy`) ; `'self'` = sentinelle `scheduleRespawn` (engine/ops.ts),
    // coque de véhicule = créature portée par `VehicleData.hull`.
    ref('ref', o.ref, (s) => s === 'self' || !!findCreatureById(s) || !!findVehicleById(s)?.hull, 'créature');
  if (op === 'grantTrait') ref('traitId', o.traitId, (s) => traitById.has(s), 'trait');
  if (op === 'condition' || op === 'removeCondition') ref('id', o.id, (s) => !!findConditionById(s) || SOFT_CONDITIONS.has(s), 'État');
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
    // (6) flow pur — un champ `TriggeredEffect[]` du catalogue (effects/onHitEffects…) ne porte pas de
    // STRAY_IMPURE_OPS hors branche success/fail de test (cf. en-tête).
    if (TRIGGERED_EFFECT_FIELDS.has(k) && Array.isArray(v)) {
      v.forEach((te, i) => {
        if (te && typeof te === 'object' && 'flow' in te) {
          if (flowHasImpureOpOutsideTest(te.flow as Flow))
            scan.strayImpureOps.push({ file, path: `${path}.${k}[${i}].flow`, detail: `op impure (interruptFocus/breakBlade/delayed) HORS branche success/fail d'un test — avalée en silence par runPureFlowLines` });
        }
      });
    }
    walk(v, file, `${path}.${k}`, scan);
  }
}

const scan: Scan = { parseErrors: [], unknownOps: [], badFormulas: [], badPlaceholders: [], badRefs: [], strayImpureOps: [] };
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
  it("5bis — la famille REFS n'est pas vacante : chaque champ gardé refuse une ref fantôme (contre-épreuve)", () => {
    const probe = (op: Record<string, unknown>) => {
      const s: Scan = { parseErrors: [], unknownOps: [], badFormulas: [], badPlaceholders: [], badRefs: [], strayImpureOps: [] };
      walk([op], 'fixture.json', '', s);
      return s.badRefs;
    };
    // Vert : le champ RÉEL de l'union GameOp, avec une valeur qui résout.
    expect(probe({ op: 'condition', id: 'a-terre' })).toEqual([]);
    expect(probe({ op: 'removeCondition', id: 'a-terre' })).toEqual([]);
    expect(probe({ op: 'condition', id: 'petrifie' })).toEqual([]); // marqueur narratif toléré
    expect(probe({ op: 'grantTrait', traitId: 'peur' })).toEqual([]);
    expect(probe({ op: 'summon', ref: 'gobelin', count: 1 })).toEqual([]);
    expect(probe({ op: 'exposeDisease', disease: 'peste-noire' })).toEqual([]);
    // Rouge : la même op avec une valeur fantôme sur le MÊME champ.
    for (const [op, field] of [
      ['condition', 'id'], ['removeCondition', 'id'], ['grantTrait', 'traitId'],
      ['summon', 'ref'], ['exposeDisease', 'disease'],
    ] as const) {
      const bad = probe({ op, [field]: 'entite-fantome-inexistante' });
      expect(bad, `${op}.${field} : la garde n'a rien vu`).toHaveLength(1);
      expect(bad[0].path).toBe(`[0].${field}`);
    }
  });
  it("6 — extraction des champs TriggeredEffect[] depuis data/index.ts (méta — non vide, effects/onHitEffects présents)", () => {
    expect(TRIGGERED_EFFECT_FIELDS.size).toBeGreaterThan(0);
    for (const field of ['effects', 'onHitEffects']) expect(TRIGGERED_EFFECT_FIELDS.has(field)).toBe(true);
  });
  it("6bis — aucun flow d'effet DÉCLENCHÉ ne porte d'op impure hors branche success/fail d'un test", () => {
    expect(scan.strayImpureOps, `Op(s) impure(s) inexprimable(s) hors test :\n${fmt(scan.strayImpureOps)}`).toEqual([]);
  });
  it('7 — species.json : family non vide sur chaque espèce (groupage du rail créateur — remplace la regex sur label)', () => {
    const species = JSON.parse(readFileSync(join(DIR, 'species.json'), 'utf8')) as { id: string; family?: string }[];
    const missing = species.filter((s) => typeof s.family !== 'string' || !s.family.trim()).map((s) => s.id);
    expect(missing, `Espèce(s) sans family :\n  ${missing.join('\n  ')}`).toEqual([]);
  });
  it("8 — activities.json : chaque Activité porte une icône du registre (ActivityDef.icon ∈ ICON_DEFS)", () => {
    const activities = JSON.parse(readFileSync(join(DIR, 'activities.json'), 'utf8')) as { id: string; icon?: string }[];
    const bad = activities.filter((a) => typeof a.icon !== 'string' || !(a.icon in ICON_DEFS)).map((a) => `${a.id} → ${JSON.stringify(a.icon)}`);
    expect(bad, `Activité(s) sans icône du registre (src/ui/icons) :\n  ${bad.join('\n  ')}`).toEqual([]);
  });
});
